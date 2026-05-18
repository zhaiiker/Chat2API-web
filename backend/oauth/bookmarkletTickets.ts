/**
 * Bookmarklet Ticket Store
 *
 * Backs the "drag a bookmarklet into your bookmark bar, click it on the
 * provider's page, watch the Chat2API tab pick up the result" flow.
 *
 * Each ticket is a single-use, short-lived secret minted by the management
 * API for an authenticated operator. The bookmarklet POSTs to the public
 * `/v0/management/oauth/bookmarklet/ingest` endpoint, presenting only the
 * ticket — never the long-lived management secret. The ticket is then
 * consumed (or expires), so even a leaked bookmarklet cannot be re-used.
 *
 * The store is in-memory because tickets are intentionally ephemeral
 * (10 minute TTL by default); restarting Chat2API simply invalidates any
 * outstanding bookmarklets and the operator drags a fresh one.
 */

import { randomBytes } from 'crypto'
import type { ProviderType, OAuthResult } from './types'

export type BookmarkletTicketState = 'pending' | 'completed' | 'consumed'

export interface BookmarkletTicket {
  ticket: string
  providerId: string
  providerType: ProviderType
  createdAt: number
  expiresAt: number
  /**
   * 'pending'   – issued, no ingest yet.
   * 'completed' – ingest happened and the result is ready for the UI to poll.
   * 'consumed'  – the UI has read the result; the ticket is now dead.
   */
  state: BookmarkletTicketState
  /**
   * Filled in by `completeTicket`. Mirrors the OAuthResult that
   * `oauthManager.loginWithToken` returned, so the polling endpoint can
   * forward it to the UI verbatim.
   */
  result?: OAuthResult
}

const TICKET_TTL_MS = 10 * 60 * 1000 // 10 minutes
const SWEEP_INTERVAL_MS = 60 * 1000 // 1 minute

export class BookmarkletTicketStore {
  private tickets = new Map<string, BookmarkletTicket>()
  private sweepTimer: NodeJS.Timeout | null = null

  constructor() {
    this.startSweeper()
  }

  /** Issue a fresh ticket for `(providerId, providerType)`. */
  issue(providerId: string, providerType: ProviderType): BookmarkletTicket {
    const now = Date.now()
    const ticket: BookmarkletTicket = {
      ticket: randomBytes(24).toString('base64url'),
      providerId,
      providerType,
      createdAt: now,
      expiresAt: now + TICKET_TTL_MS,
      state: 'pending',
    }
    this.tickets.set(ticket.ticket, ticket)
    return ticket
  }

  /**
   * Look up a ticket by value. Returns undefined when the ticket does not
   * exist, has already been consumed, or has expired (expired tickets are
   * also removed as a side effect).
   */
  lookup(ticketValue: string): BookmarkletTicket | undefined {
    const t = this.tickets.get(ticketValue)
    if (!t) return undefined
    if (Date.now() > t.expiresAt) {
      this.tickets.delete(ticketValue)
      return undefined
    }
    return t
  }

  /**
   * Mark a pending ticket as completed and attach the OAuth result. Returns
   * `true` on success, `false` when the ticket is missing / already used
   * (the caller should surface a 410-style "ticket already used" error).
   */
  complete(ticketValue: string, result: OAuthResult): boolean {
    const t = this.lookup(ticketValue)
    if (!t || t.state !== 'pending') return false
    t.state = 'completed'
    t.result = result
    return true
  }

  /**
   * Read the result of a completed ticket and mark it consumed in the same
   * step. After this call the ticket is gone — the polling endpoint is
   * intentionally one-shot.
   */
  consume(ticketValue: string): OAuthResult | undefined {
    const t = this.tickets.get(ticketValue)
    if (!t) return undefined
    if (Date.now() > t.expiresAt) {
      this.tickets.delete(ticketValue)
      return undefined
    }
    if (t.state !== 'completed' || !t.result) return undefined
    t.state = 'consumed'
    const result = t.result
    this.tickets.delete(ticketValue)
    return result
  }

  /** Drop a ticket explicitly (used on cancel / dialog close). */
  cancel(ticketValue: string): void {
    this.tickets.delete(ticketValue)
  }

  /** Number of live tickets — exposed for tests / health endpoints. */
  size(): number {
    return this.tickets.size
  }

  private startSweeper(): void {
    if (this.sweepTimer) return
    this.sweepTimer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS)
    // Keep the sweeper from holding the event loop open in tests / CLI.
    if (typeof this.sweepTimer.unref === 'function') {
      this.sweepTimer.unref()
    }
  }

  private sweep(): void {
    const now = Date.now()
    for (const [key, t] of this.tickets) {
      if (now > t.expiresAt || t.state === 'consumed') {
        this.tickets.delete(key)
      }
    }
  }

  destroy(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer)
      this.sweepTimer = null
    }
    this.tickets.clear()
  }
}

export const bookmarkletTicketStore = new BookmarkletTicketStore()

export const BOOKMARKLET_TICKET_TTL_MS = TICKET_TTL_MS
