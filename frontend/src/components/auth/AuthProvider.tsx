import React, { useEffect, useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Alert, AlertDescription } from '../ui/alert'
import { AlertCircle, KeyRound, Loader2, ShieldCheck, Sparkles } from 'lucide-react'
import { ApiService } from '@/services/api'
import logoIcon from '@/assets/icons/icons.png'

/**
 * Auth flow states. The provider mounts above the rest of the SPA, so the
 * user always lands either here or in the app proper.
 *
 *   loading     -> probing /auth/status
 *   firstRun    -> "Set initial password" form (server has no password yet)
 *   login       -> "Enter password" form (server has a password configured)
 *   offline     -> banner + retry (backend unreachable)
 *   authenticated -> children render
 */
type Phase = 'loading' | 'firstRun' | 'login' | 'authenticated' | 'offline'

const STORAGE_KEY = 'managementApiSecret'

interface AuthProviderProps {
  children: React.ReactNode
}

/** Animated, theme-aware backdrop reused on the login page. */
function AuthBackdrop() {
  return (
    <div aria-hidden="true" className="bokeh-bg">
      <div className="bokeh-blob bokeh-blob-1" />
      <div className="bokeh-blob bokeh-blob-2" />
    </div>
  )
}

interface PasswordFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoComplete: string
  autoFocus?: boolean
  disabled?: boolean
}

/** Password input + label + show/hide toggle, styled with the glass look. */
function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  autoFocus,
  disabled,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm text-[var(--text-muted)]">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          disabled={disabled}
          className="glass-input h-11 pr-16 text-[var(--text-primary)]"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  )
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  /** Decide which screen to show based on /auth/status + cached secret. */
  const probe = React.useCallback(async () => {
    setPhase('loading')
    setError('')
    try {
      const status = await ApiService.auth.status()
      if (status.firstRun) {
        setPhase('firstRun')
        return
      }
      // Server has a password. If we have a cached secret, validate it
      // by hitting any auth-protected endpoint.
      const cached = localStorage.getItem(STORAGE_KEY)
      if (cached) {
        try {
          await ApiService.config.get()
          setPhase('authenticated')
          return
        } catch {
          localStorage.removeItem(STORAGE_KEY)
        }
      }
      setPhase('login')
    } catch (err) {
      setPhase('offline')
      setError(err instanceof Error ? err.message : 'Cannot reach the management API.')
    }
  }, [])

  useEffect(() => {
    void probe()
  }, [probe])

  // If the secret gets invalidated mid-session (e.g. another tab logged out),
  // bounce back to the login screen.
  useEffect(() => {
    const onUnauth = () => {
      setPhase('login')
      setError('Session expired, please sign in again.')
    }
    window.addEventListener('management-api-unauthorized', onUnauth)
    return () => window.removeEventListener('management-api-unauthorized', onUnauth)
  }, [])

  const handleFirstRun = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }
    if (password !== confirmPassword) {
      setError('The two passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      const { secret } = await ApiService.auth.setup(password)
      localStorage.setItem(STORAGE_KEY, secret)
      setPassword('')
      setConfirmPassword('')
      setPhase('authenticated')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete setup.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!password) {
      setError('Please enter your password.')
      return
    }
    setSubmitting(true)
    try {
      const { secret } = await ApiService.auth.login(password)
      localStorage.setItem(STORAGE_KEY, secret)
      setPassword('')
      setPhase('authenticated')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.')
    } finally {
      setSubmitting(false)
    }
  }

  if (phase === 'authenticated') {
    return <>{children}</>
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center px-4 py-10 text-[var(--text-primary)] overflow-hidden">
      <AuthBackdrop />

      <div className="w-full max-w-md animate-scale-in">
        <div className="glass-card relative overflow-hidden p-8 sm:p-10">
          {/* top accent bar */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[var(--accent-primary)] via-[var(--accent-secondary)] to-[var(--accent-tertiary)] opacity-80"
          />

          <header className="flex flex-col items-center text-center mb-8">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--accent-primary)_12%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--accent-primary)_25%,transparent)] shadow-[var(--glow-primary)]">
              <img
                src={logoIcon}
                alt="Chat2API"
                className="h-10 w-10 object-contain"
                onError={(e) => {
                  // fall back to an icon if the bundled logo is missing
                  ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {phase === 'firstRun' ? 'Welcome to Chat2API' : 'Chat2API Manager'}
            </h1>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--text-muted)]">
              {phase === 'firstRun' && (
                <>Create an administrator password to secure the web UI. You can change it later from Settings.</>
              )}
              {phase === 'login' && <>Sign in with your administrator password to continue.</>}
              {phase === 'loading' && <>Connecting to the backend service…</>}
              {phase === 'offline' && <>The management API is not reachable right now.</>}
            </p>
          </header>

          {phase === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--accent-primary)]" />
              <p className="text-sm text-[var(--text-muted)]">Talking to the server…</p>
            </div>
          )}

          {phase === 'offline' && (
            <div className="space-y-5">
              <Alert variant="destructive" className="border-[var(--error)]/40 bg-[var(--error)]/10">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {error || 'Make sure the backend is running on the configured port.'}
                </AlertDescription>
              </Alert>
              <Button
                size="lg"
                className="glass-btn glass-btn-primary w-full justify-center"
                onClick={() => void probe()}
              >
                Retry
              </Button>
            </div>
          )}

          {phase === 'firstRun' && (
            <form onSubmit={handleFirstRun} className="space-y-5">
              {error && (
                <Alert variant="destructive" className="border-[var(--error)]/40 bg-[var(--error)]/10">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <PasswordField
                id="new-password"
                label="New password"
                placeholder="At least 8 characters"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                autoFocus
                disabled={submitting}
              />
              <PasswordField
                id="confirm-password"
                label="Confirm password"
                placeholder="Repeat the password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
                disabled={submitting}
              />

              <Button
                type="submit"
                size="lg"
                disabled={submitting}
                className="glass-btn glass-btn-primary w-full justify-center mt-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting up…
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Create password and continue
                  </>
                )}
              </Button>

              <p className="pt-1 text-center text-xs text-[var(--text-dim)]">
                Your password is stored as a salted scrypt hash on the server and never sent in the clear.
              </p>
            </form>
          )}

          {phase === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              {error && (
                <Alert variant="destructive" className="border-[var(--error)]/40 bg-[var(--error)]/10">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <PasswordField
                id="password"
                label="Password"
                placeholder="Your administrator password"
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
                autoFocus
                disabled={submitting}
              />

              <Button
                type="submit"
                size="lg"
                disabled={submitting}
                className="glass-btn glass-btn-primary w-full justify-center mt-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Sign in
                  </>
                )}
              </Button>
            </form>
          )}
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-[var(--text-dim)]">
          <Sparkles className="h-3 w-3" />
          Chat2API · OpenAI-compatible proxy
        </p>
      </div>
    </div>
  )
}
