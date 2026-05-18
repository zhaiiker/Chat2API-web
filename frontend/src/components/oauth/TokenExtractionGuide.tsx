/**
 * Token Extraction Guide
 *
 * Replaces the old Electron in-app login window. In a pure-web deployment
 * the backend has no way to spawn a browser for the operator, so instead
 * we walk them through the same two clicks they would have made anyway:
 *
 *   1. Open the provider's login page in a new tab
 *   2. After signing in, copy a specific localStorage / cookie value
 *      from DevTools and paste it back here
 *
 * The component then calls /v0/management/oauth/login_with_token, which
 * validates the value against the provider's API exactly like the old
 * Electron flow did at the end.
 */

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { ApiService } from '@/services/api'
import { BookmarkletPanel } from './BookmarkletPanel'

type StorageType = 'localStorage' | 'cookie' | 'network'

interface ProviderGuide {
  loginUrl: string
  storageType: StorageType
  /** Where in DevTools to look. Used to render the highlighted hint. */
  storageHint: string
  /** The exact key/cookie/header name to copy. */
  tokenKey: string
  /** Human-friendly label, shown next to the textarea. */
  tokenLabel: string
  /** Numbered step-by-step instructions. */
  steps: string[]
  placeholder?: string
  /** Optional list of additional fields the provider needs. */
  extraFields?: Array<{
    name: string
    label: string
    placeholder?: string
    storageHint?: string
  }>
}

const GUIDES: Record<string, ProviderGuide> = {
  deepseek: {
    loginUrl: 'https://chat.deepseek.com',
    storageType: 'localStorage',
    storageHint: 'Application → Local Storage → chat.deepseek.com',
    tokenKey: 'userToken',
    tokenLabel: 'User Token',
    placeholder: 'Paste the userToken value here',
    steps: [
      'Click "Open login page" — DeepSeek opens in a new tab.',
      'Sign in to your DeepSeek account.',
      'Press F12 to open DevTools, then go to the Application tab.',
      'Expand "Local Storage" in the left sidebar and pick "chat.deepseek.com".',
      'Find the userToken row and copy its Value.',
      'Paste it below and click Save.',
    ],
  },
  glm: {
    loginUrl: 'https://chatglm.cn',
    storageType: 'localStorage',
    storageHint: 'Application → Local Storage → chatglm.cn',
    tokenKey: 'chatglm_refresh_token',
    tokenLabel: 'Refresh Token',
    placeholder: 'Paste the chatglm_refresh_token value here',
    steps: [
      'Click "Open login page" — ChatGLM opens in a new tab.',
      'Sign in with phone or WeChat.',
      'Press F12 to open DevTools, then go to the Application tab.',
      'Expand "Local Storage" → "chatglm.cn".',
      'Copy the chatglm_refresh_token value.',
      'Paste it below and click Save.',
    ],
  },
  kimi: {
    loginUrl: 'https://www.kimi.com',
    storageType: 'network',
    storageHint: 'Network tab → any /api request → Headers → Authorization',
    tokenKey: 'Authorization',
    tokenLabel: 'Access Token (JWT)',
    placeholder: 'Paste the JWT after "Bearer "',
    steps: [
      'Click "Open login page" — Kimi opens in a new tab.',
      'Sign in to your Kimi account.',
      'Press F12, switch to the Network tab.',
      'Send any message in Kimi, or refresh — pick any /api/* request.',
      'In the Headers panel, find Authorization: Bearer <token>.',
      'Copy everything after "Bearer " and paste it below.',
    ],
  },
  minimax: {
    loginUrl: 'https://chat.minimaxi.com',
    storageType: 'localStorage',
    storageHint: 'Application → Local Storage → chat.minimaxi.com',
    tokenKey: '_token',
    tokenLabel: 'JWT Token',
    placeholder: 'Paste the JWT here',
    steps: [
      'Click "Open login page" — MiniMax opens in a new tab.',
      'Sign in to your MiniMax account.',
      'Press F12 → Application → Local Storage → chat.minimaxi.com.',
      'Copy the _token value.',
      'Also copy the _userId value (next field below).',
      'Paste both below and click Save.',
    ],
    extraFields: [
      {
        name: 'realUserID',
        label: 'Real User ID',
        placeholder: 'Paste the _userId value',
        storageHint: 'Same Local Storage panel, _userId field',
      },
    ],
  },
  qwen: {
    loginUrl: 'https://www.qianwen.com',
    storageType: 'cookie',
    storageHint: 'Application → Cookies → www.qianwen.com',
    tokenKey: 'tongyi_sso_ticket',
    tokenLabel: 'SSO Ticket',
    placeholder: 'Paste the tongyi_sso_ticket cookie value',
    steps: [
      'Click "Open login page" — Tongyi Qianwen opens in a new tab.',
      'Sign in with your Alibaba account.',
      'Press F12 → Application → Cookies → www.qianwen.com.',
      'Find the tongyi_sso_ticket cookie and copy its Value.',
      'Paste it below and click Save.',
    ],
  },
  'qwen-ai': {
    loginUrl: 'https://chat.qwen.ai',
    storageType: 'localStorage',
    storageHint: 'Application → Local Storage → chat.qwen.ai',
    tokenKey: 'token',
    tokenLabel: 'JWT Token',
    placeholder: 'Paste the token value',
    steps: [
      'Click "Open login page" — Qwen Chat (global) opens in a new tab.',
      'Sign in.',
      'Press F12 → Application → Local Storage → chat.qwen.ai.',
      'Copy the token value (it starts with eyJ...).',
      'Paste it below and click Save.',
    ],
  },
  zai: {
    loginUrl: 'https://chat.z.ai',
    storageType: 'localStorage',
    storageHint: 'Application → Local Storage → chat.z.ai',
    tokenKey: 'token',
    tokenLabel: 'Access Token',
    placeholder: 'Paste the token value',
    steps: [
      'Click "Open login page" — Z.ai opens in a new tab.',
      'Sign in to your Z.ai account.',
      'Press F12 → Application → Local Storage → chat.z.ai.',
      'Copy the token value.',
      'Paste it below and click Save.',
    ],
  },
  perplexity: {
    loginUrl: 'https://www.perplexity.ai',
    storageType: 'cookie',
    storageHint: 'Application → Cookies → www.perplexity.ai',
    tokenKey: '__Secure-next-auth.session-token',
    tokenLabel: 'Session Token',
    placeholder: 'Paste the __Secure-next-auth.session-token value',
    steps: [
      'Click "Open login page" — Perplexity opens in a new tab.',
      'Sign in with email or Google.',
      'Press F12 → Application → Cookies → www.perplexity.ai.',
      'Find __Secure-next-auth.session-token and copy its Value.',
      'Paste it below and click Save.',
    ],
  },
  mimo: {
    loginUrl: 'https://aistudio.xiaomimimo.com',
    storageType: 'localStorage',
    storageHint: 'Application → Local Storage → aistudio.xiaomimimo.com',
    tokenKey: 'service_token',
    tokenLabel: 'Service Token',
    placeholder: 'Paste the service_token value',
    steps: [
      'Click "Open login page" — Mimo Studio opens in a new tab.',
      'Sign in.',
      'Press F12 → Application → Local Storage → aistudio.xiaomimimo.com.',
      'Copy three values: service_token, user_id, ph_token.',
      'Paste them in the matching fields below.',
    ],
    extraFields: [
      {
        name: 'mimoUserId',
        label: 'User ID',
        placeholder: 'Paste the user_id value',
        storageHint: 'Same Local Storage panel, user_id field',
      },
      {
        name: 'mimoPhToken',
        label: 'PH Token',
        placeholder: 'Paste the ph_token value',
        storageHint: 'Same Local Storage panel, ph_token field',
      },
    ],
  },
}

export function getProviderGuide(providerType: string): ProviderGuide | undefined {
  return GUIDES[providerType]
}

interface TokenExtractionGuideProps {
  providerId: string
  providerType: string
  providerName?: string
  /** Called with raw credential map after successful validation. */
  onSuccess: (
    credentials: Record<string, string>,
    accountInfo?: { name?: string; email?: string },
  ) => void
}

/**
 * Render the in-page guide. Falls back to a "manual input only" hint when
 * no curated guide exists for this provider yet.
 */
export function TokenExtractionGuide({
  providerId,
  providerType,
  providerName,
  onSuccess,
}: TokenExtractionGuideProps) {
  const guide = useMemo(() => getProviderGuide(providerType), [providerType])
  const [token, setToken] = useState('')
  const [extras, setExtras] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showManual, setShowManual] = useState(false)

  if (!guide) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No automatic guide is available for {providerName || providerType} yet.
          Please switch to the <strong>Manual Input</strong> tab and paste the
          token fields directly.
        </AlertDescription>
      </Alert>
    )
  }

  const openLoginPage = () => {
    window.open(guide.loginUrl, '_blank', 'noopener,noreferrer')
  }

  const handleSubmit = async () => {
    setError('')
    setSuccess('')
    if (!token.trim()) {
      setError(`Please paste the ${guide.tokenLabel} value.`)
      return
    }
    for (const f of guide.extraFields ?? []) {
      if (!(extras[f.name] ?? '').trim()) {
        setError(`Please paste the ${f.label} value.`)
        return
      }
    }

    setSubmitting(true)
    try {
      const result = await ApiService.oauth.loginWithToken({
        providerId,
        providerType,
        token: token.trim(),
        realUserID: extras.realUserID?.trim(),
        mimoUserId: extras.mimoUserId?.trim(),
        mimoPhToken: extras.mimoPhToken?.trim(),
      })

      if (result.success && result.credentials) {
        setSuccess('Token validated. Saving…')
        onSuccess(result.credentials, result.accountInfo)
      } else {
        setError(result.error || 'Token validation failed.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Token validation failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Recommended: Bookmarklet ── */}
      <BookmarkletPanel
        providerId={providerId}
        providerType={providerType}
        providerName={providerName}
        loginUrl={guide.loginUrl}
        onSuccess={onSuccess}
      />

      {/* ── Fallback: Manual DevTools paste (collapsed by default) ── */}
      <button
        type="button"
        onClick={() => setShowManual(!showManual)}
        className="flex w-full items-center gap-1.5 rounded-md border px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        {showManual ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        Manual paste from DevTools (advanced)
      </button>

      {showManual && (
        <div className="space-y-4 pl-2 border-l-2 border-muted">
          <Button
            type="button"
            onClick={openLoginPage}
            className="w-full"
            variant="outline"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Open login page · {new URL(guide.loginUrl).hostname}
          </Button>

          <div className="rounded-md border bg-muted/40 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Where to find the token
            </p>
            <p className="text-sm">
              <code className="font-mono text-xs bg-background px-1.5 py-0.5 rounded border">
                {guide.storageHint}
              </code>
            </p>
            <ol className="mt-3 list-decimal list-inside space-y-1.5 text-xs text-muted-foreground">
              {guide.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {guide.tokenLabel}
              <span className="ml-1 font-mono text-xs text-muted-foreground">
                ({guide.tokenKey})
              </span>
            </label>
            <Textarea
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={guide.placeholder ?? `Paste the ${guide.tokenLabel} here`}
              rows={3}
              className="font-mono text-xs"
              disabled={submitting}
            />
          </div>

          {(guide.extraFields ?? []).map((f) => (
            <div key={f.name} className="space-y-1.5">
              <label className="text-sm font-medium">
                {f.label}
                {f.storageHint && (
                  <span className="ml-1 text-xs text-muted-foreground font-normal">
                    — {f.storageHint}
                  </span>
                )}
              </label>
              <Textarea
                value={extras[f.name] ?? ''}
                onChange={(e) =>
                  setExtras((s) => ({ ...s, [f.name]: e.target.value }))
                }
                placeholder={f.placeholder ?? `Paste the ${f.label}`}
                rows={2}
                className="font-mono text-xs"
                disabled={submitting}
              />
            </div>
          ))}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Validating…
              </>
            ) : (
              'Save and continue'
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

export default TokenExtractionGuide
