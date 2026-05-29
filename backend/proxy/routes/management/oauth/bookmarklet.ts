/**
 * Bookmarklet OAuth ingest route.
 *
 * Three endpoints, on the same `/v0/management/oauth/bookmarklet` path:
 *
 *   POST /issue            (auth required)
 *     Mint a single-use ticket and return the ready-to-drag bookmarklet
 *     `href` for the requested provider. The UI renders this as an
 *     anchor tag the operator can drop into their bookmark bar.
 *
 *   POST /ingest           (PUBLIC — auth is the ticket itself)
 *     Called by the bookmarklet from the provider's own page. Validates
 *     the ticket, runs the same `oauthManager.loginWithToken` flow the
 *     manual paste path uses, and parks the result on the ticket so the
 *     UI can poll for it.
 *
 *   GET  /poll/:ticket     (auth required)
 *     One-shot poll endpoint. Returns the OAuthResult once and consumes
 *     the ticket. The UI calls this on a short interval while the
 *     dialog is open.
 *
 * The ingest endpoint is the only one that does not require the
 * management bearer secret. It must remain reachable from arbitrary
 * provider origins, so we set permissive CORS *only on this route*.
 *
 * Set `CHAT2API_DISABLE_BOOKMARKLET=1` to disable the entire flow; in
 * that mode every endpoint here returns 404 so the route never appears
 * to leak even with a misconfigured reverse proxy.
 */

import Router from '@koa/router'
import type { Context } from 'koa'
import { managementAuthMiddleware } from '../../../middleware/managementAuth'
import { oauthManager } from '../../../../oauth/manager'
import {
  bookmarkletTicketStore,
  BOOKMARKLET_TICKET_TTL_MS,
} from '../../../../oauth/bookmarkletTickets'
import {
  buildBookmarkletHref,
  buildBookmarkletSource,
  getTokenSpec,
  PROVIDER_TOKEN_SPECS,
} from '../../../../oauth/bookmarkletScript'
import type { ProviderType } from '../../../../oauth/types'

const router = new Router({ prefix: '/v0/management/oauth/bookmarklet' })

// Browser-issued cross-origin requests from the provider's page hit the
// public ingest endpoint. We allow them broadly but only on this prefix:
// no other management route emits permissive CORS headers.
function applyIngestCors(ctx: Context): void {
  ctx.set('Access-Control-Allow-Origin', '*')
  ctx.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  ctx.set('Access-Control-Allow-Headers', 'Content-Type')
  // No credentials => no cookies => Allow-Origin:* is safe.
  ctx.set('Vary', 'Origin')
}

function disabled(): boolean {
  return process.env.CHAT2API_DISABLE_BOOKMARKLET === '1'
}

function notFound(ctx: Context): void {
  ctx.status = 404
  ctx.body = {
    success: false,
    error: { code: 'not_found', message: 'Not found' },
  }
}

// CORS preflight for the ingest endpoint only.
router.options('/ingest', (ctx) => {
  if (disabled()) {
    notFound(ctx)
    return
  }
  applyIngestCors(ctx)
  ctx.status = 204
})

/**
 * Public ingest endpoint. Auth is the ticket itself.
 *
 * Body:
 *   {
 *     ticket: string,
 *     providerType?: ProviderType,        // sanity-check only
 *     credentials: { token: string, ... } // shape matches loginWithToken
 *   }
 */
router.post('/ingest', async (ctx: Context) => {
  if (disabled()) {
    notFound(ctx)
    return
  }
  applyIngestCors(ctx)

  const body = (ctx.request.body as any) || {}
  const ticketValue: unknown = body.ticket
  const providerType: unknown = body.providerType
  const credentials: unknown = body.credentials

  if (typeof ticketValue !== 'string' || !ticketValue) {
    ctx.status = 400
    ctx.body = {
      success: false,
      error: { code: 'invalid_request', message: 'Missing ticket' },
    }
    return
  }

  const ticket = bookmarkletTicketStore.lookup(ticketValue)
  if (!ticket) {
    // Use 410 Gone so the bookmarklet's alert can distinguish an expired
    // ticket from a flat-out invalid request.
    ctx.status = 410
    ctx.body = {
      success: false,
      error: { code: 'ticket_invalid', message: 'Ticket invalid or expired. Please reissue from Chat2API.' },
    }
    return
  }

  if (ticket.state !== 'pending') {
    ctx.status = 410
    ctx.body = {
      success: false,
      error: { code: 'ticket_used', message: 'Ticket has already been used.' },
    }
    return
  }

  // Optional sanity check: the bookmarklet sends back the providerType
  // the UI told it about. If it disagrees with what the ticket was
  // issued for, refuse — that should never happen in normal use.
  if (providerType && providerType !== ticket.providerType) {
    ctx.status = 400
    ctx.body = {
      success: false,
      error: { code: 'provider_mismatch', message: 'Bookmarklet provider does not match ticket.' },
    }
    return
  }

  if (!credentials || typeof credentials !== 'object') {
    ctx.status = 400
    ctx.body = {
      success: false,
      error: { code: 'invalid_request', message: 'Missing credentials' },
    }
    return
  }

  const creds = credentials as Record<string, unknown>
  const token = typeof creds.token === 'string' ? creds.token : undefined
  if (!token) {
    ctx.status = 400
    ctx.body = {
      success: false,
      error: { code: 'invalid_request', message: 'Missing credentials.token' },
    }
    return
  }

  try {
    const result = await oauthManager.loginWithToken(
      ticket.providerId,
      ticket.providerType,
      token,
      typeof creds.realUserID === 'string' ? creds.realUserID : undefined,
      typeof creds.mimoUserId === 'string' ? creds.mimoUserId : undefined,
      typeof creds.mimoPhToken === 'string' ? creds.mimoPhToken : undefined,
    )

    bookmarkletTicketStore.complete(ticketValue, result)

    if (result.success) {
      ctx.body = { success: true, data: { received: true } }
    } else {
      // The token reached us but failed validation upstream. Surface the
      // provider's error message so the bookmarklet's alert is useful.
      ctx.status = 400
      ctx.body = {
        success: false,
        error: { code: 'token_invalid', message: result.error || 'Token validation failed' },
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error'
    bookmarkletTicketStore.complete(ticketValue, {
      success: false,
      providerId: ticket.providerId,
      providerType: ticket.providerType,
      error: message,
    })
    ctx.status = 500
    ctx.body = {
      success: false,
      error: { code: 'internal_error', message },
    }
  }
})

// Everything below requires the management bearer secret. Apply explicitly
// per-route (matching the rest of `routes/management/*`) so the public
// `/ingest` endpoint above can never accidentally inherit auth.

/**
 * Mint a fresh ticket and return the ready-to-use bookmarklet href.
 */
router.post('/issue', managementAuthMiddleware, async (ctx: Context) => {
  if (disabled()) {
    notFound(ctx)
    return
  }

  const body = (ctx.request.body as any) || {}
  const providerId: unknown = body.providerId
  const providerType: unknown = body.providerType
  if (typeof providerId !== 'string' || !providerId) {
    ctx.status = 400
    ctx.body = {
      success: false,
      error: { code: 'invalid_request', message: 'Missing providerId' },
    }
    return
  }
  if (typeof providerType !== 'string' || !providerType) {
    ctx.status = 400
    ctx.body = {
      success: false,
      error: { code: 'invalid_request', message: 'Missing providerType' },
    }
    return
  }

  const spec = getTokenSpec(providerType as ProviderType)
  if (!spec) {
    ctx.status = 400
    ctx.body = {
      success: false,
      error: {
        code: 'unsupported_provider',
        message:
          'Bookmarklet flow is not configured for provider "' +
          providerType +
          '". Use manual token entry instead.',
      },
    }
    return
  }

  const ticket = bookmarkletTicketStore.issue(providerId, providerType as ProviderType)

  // Build the absolute ingest URL the bookmarklet should POST to. Honor
  // X-Forwarded-* so the URL is correct behind a TLS-terminating reverse
  // proxy. ctx.origin already takes proxy headers into account when
  // `app.proxy = true`, but we fall back to manual reconstruction.
  const protocol = ctx.protocol
  const host = ctx.host
  const ingestUrl = protocol + '://' + host + '/v0/management/oauth/bookmarklet/ingest'

  const buildOpts = {
    ticket: ticket.ticket,
    ingestUrl,
    providerType: providerType as ProviderType,
    spec,
  }

  ctx.body = {
    success: true,
    data: {
      ticket: ticket.ticket,
      expiresAt: ticket.expiresAt,
      ttlMs: BOOKMARKLET_TICKET_TTL_MS,
      ingestUrl,
      providerType,
      providerId,
      bookmarklet: {
        href: buildBookmarkletHref(buildOpts),
        // Pretty source for debugging / "show me what this does" UI.
        source: buildBookmarkletSource(buildOpts),
        expectedOrigin: spec.expectedOrigin,
      },
    },
  }
})

/**
 * Poll for the result of a ticket. One-shot: a successful poll consumes
 * the ticket. Returns 404 while pending so the UI can keep polling
 * cheaply without parsing structured "still pending" responses.
 */
router.get('/poll/:ticket', managementAuthMiddleware, async (ctx: Context) => {
  if (disabled()) {
    notFound(ctx)
    return
  }

  const ticketValue = ctx.params.ticket
  const ticket = bookmarkletTicketStore.lookup(ticketValue)
  if (!ticket) {
    ctx.status = 404
    ctx.body = {
      success: false,
      error: { code: 'ticket_invalid', message: 'Ticket invalid or expired' },
    }
    return
  }

  if (ticket.state === 'pending') {
    // 202 Accepted = "not done yet, keep polling". The UI treats this as
    // the polling continuation signal.
    ctx.status = 202
    ctx.body = {
      success: true,
      data: { state: 'pending', expiresAt: ticket.expiresAt },
    }
    return
  }

  const result = bookmarkletTicketStore.consume(ticketValue)
  if (!result) {
    // Either consumed by another poller or expired between lookup and
    // consume. Treat as gone.
    ctx.status = 410
    ctx.body = {
      success: false,
      error: { code: 'ticket_used', message: 'Ticket has already been consumed' },
    }
    return
  }

  ctx.body = {
    success: true,
    data: { state: 'completed', result },
  }
})

/**
 * Drop a ticket explicitly (e.g. when the dialog is closed).
 */
router.delete('/:ticket', managementAuthMiddleware, async (ctx: Context) => {
  if (disabled()) {
    notFound(ctx)
    return
  }
  bookmarkletTicketStore.cancel(ctx.params.ticket)
  ctx.body = { success: true, data: { cancelled: true } }
})

export default router

export const SUPPORTED_BOOKMARKLET_PROVIDERS = Object.keys(PROVIDER_TOKEN_SPECS)
