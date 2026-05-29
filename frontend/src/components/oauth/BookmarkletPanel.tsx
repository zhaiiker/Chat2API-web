/**
 * Bookmarklet Panel
 *
 * Shows a draggable "Save to Chat2API" bookmark link that the operator
 * can drop into their bookmark bar. After they sign in on the provider's
 * page and click the bookmarklet, this component automatically picks up
 * the token via polling and calls `onSuccess`.
 *
 * The component handles the full lifecycle:
 *   1. Issue a ticket (POST /oauth/bookmarklet/issue)
 *   2. Show the bookmarklet as a draggable <a> link
 *   3. Poll (GET /oauth/bookmarklet/poll/:ticket) until the bookmarklet
 *      fires or the ticket expires
 *   4. Cancel the ticket on unmount
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertCircle,
  Bookmark,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Timer,
} from 'lucide-react'
import { ApiService } from '@/services/api'

interface BookmarkletPanelProps {
  providerId: string
  providerType: string
  providerName?: string
  loginUrl: string
  onSuccess: (
    credentials: Record<string, string>,
    accountInfo?: { name?: string; email?: string },
  ) => void
}

type Phase = 'idle' | 'issuing' | 'waiting' | 'success' | 'error'

const POLL_INTERVAL_MS = 2000

export function BookmarkletPanel({
  providerId,
  providerType,
  providerName,
  loginUrl,
  onSuccess,
}: BookmarkletPanelProps) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<Phase>('idle')
  const [bookmarkletHref, setBookmarkletHref] = useState('')
  const [expectedOrigin, setExpectedOrigin] = useState('')
  const [ticket, setTicket] = useState('')
  const [error, setError] = useState('')
  const [expiresAt, setExpiresAt] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const ticketRef = useRef('')

  const displayName = providerName || providerType

  // Cleanup: cancel ticket + stop polling on unmount
  useEffect(() => {
    return () => {
      stopPolling()
      if (ticketRef.current) {
        ApiService.oauth.bookmarklet.cancel(ticketRef.current).catch(() => {})
      }
    }
  }, [])

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const issueTicket = async () => {
    setPhase('issuing')
    setError('')
    try {
      const data = await ApiService.oauth.bookmarklet.issue(providerId, providerType)
      setBookmarkletHref(data.bookmarklet.href)
      setExpectedOrigin(data.bookmarklet.expectedOrigin || '')
      setTicket(data.ticket)
      setExpiresAt(data.expiresAt)
      ticketRef.current = data.ticket
      setPhase('waiting')
      startPolling(data.ticket, data.expiresAt)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('oauth.bookmarklet.networkError'))
      setPhase('error')
    }
  }

  const startPolling = (ticketValue: string, expires: number) => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      // Auto-stop when expired
      if (Date.now() > expires) {
        stopPolling()
        setError(t('oauth.bookmarklet.expired'))
        setPhase('error')
        return
      }

      try {
        const res = await ApiService.oauth.bookmarklet.poll(ticketValue)
        if (res.state === 'completed') {
          stopPolling()
          ticketRef.current = ''
          const result = res.result
          if (result.success && result.credentials) {
            setPhase('success')
            onSuccess(result.credentials, result.accountInfo)
          } else {
            setError(result.error || t('oauth.bookmarklet.tokenInvalid'))
            setPhase('error')
          }
        }
        // state === 'pending' → keep polling
      } catch (err: any) {
        // 404/410 means ticket is gone
        if (err?.message?.includes('Ticket')) {
          stopPolling()
          setError(t('oauth.bookmarklet.ticketUsed'))
          setPhase('error')
        }
        // Other transient errors — just keep polling
      }
    }, POLL_INTERVAL_MS)
  }

  const timeLeft = Math.max(0, Math.round((expiresAt - Date.now()) / 1000))

  if (phase === 'idle' || phase === 'issuing') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {t('oauth.bookmarklet.description', { provider: displayName })}
        </p>
        <Button
          type="button"
          onClick={issueTicket}
          disabled={phase === 'issuing'}
          className="w-full"
          variant="default"
        >
          {phase === 'issuing' ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('oauth.bookmarklet.generating')}
            </>
          ) : (
            <>
              <Bookmark className="mr-2 h-4 w-4" />
              {t('oauth.bookmarklet.generate')}
            </>
          )}
        </Button>
      </div>
    )
  }

  if (phase === 'waiting') {
    return (
      <div className="space-y-4">
        {/* Draggable bookmarklet link */}
        <div className="rounded-md border bg-muted/40 p-3 text-center">
          <p className="text-xs text-muted-foreground mb-2">
            {t('oauth.bookmarklet.dragHint')}
          </p>
          {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
          <a
            href={bookmarkletHref}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 cursor-grab active:cursor-grabbing"
            onClick={(e) => {
              e.preventDefault()
              alert(t('oauth.bookmarklet.clickWarning', { provider: displayName }))
            }}
          >
            <Bookmark className="h-4 w-4" />
            {t('oauth.bookmarklet.dragButton')}
          </a>
        </div>

        {/* Instructions */}
        <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted-foreground">
          <li>{t('oauth.bookmarklet.instructions.drag')}</li>
          <li>{t('oauth.bookmarklet.instructions.open')}</li>
          <li>
            {t('oauth.bookmarklet.instructions.click')}{' '}
            <code className="font-mono bg-background px-1 py-0.5 rounded border text-[10px]">
              {expectedOrigin || loginUrl}
            </code>
          </li>
          <li>{t('oauth.bookmarklet.instructions.wait')}</li>
        </ol>

        <Button
          type="button"
          onClick={() => window.open(loginUrl, '_blank', 'noopener,noreferrer')}
          className="w-full"
          variant="outline"
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          {t('oauth.bookmarklet.openLogin', { host: new URL(loginUrl).hostname })}
        </Button>

        {/* Polling indicator */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('oauth.bookmarklet.waiting')}
          </span>
          <span className="flex items-center gap-1">
            <Timer className="h-3 w-3" />
            {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')} {t('oauth.bookmarklet.timeLeft')}
          </span>
        </div>
      </div>
    )
  }

  if (phase === 'success') {
    return (
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription>
          {t('oauth.bookmarklet.success')}
        </AlertDescription>
      </Alert>
    )
  }

  // phase === 'error'
  return (
    <div className="space-y-3">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
      <Button type="button" onClick={issueTicket} className="w-full" variant="outline">
        <Bookmark className="mr-2 h-4 w-4" />
        {t('oauth.bookmarklet.tryAgain')}
      </Button>
    </div>
  )
}

export default BookmarkletPanel
