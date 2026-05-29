import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { KeyRound, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { ApiService } from '@/services/api'

const STORAGE_KEY = 'managementApiSecret'

export function PasswordSettings() {
  const { t } = useTranslation()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [rotateSecret, setRotateSecret] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const reset = () => {
    setOldPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!oldPassword) {
      setError(t('password.errorCurrentRequired'))
      return
    }
    if (newPassword.length < 8) {
      setError(t('password.errorMinLength'))
      return
    }
    if (newPassword !== confirmPassword) {
      setError(t('password.errorMismatch'))
      return
    }
    if (newPassword === oldPassword) {
      setError(t('password.errorSamePassword'))
      return
    }

    setSubmitting(true)
    try {
      const result = await ApiService.auth.changePassword({
        oldPassword,
        newPassword,
        rotateSecret,
      })
      if (result?.secret) {
        localStorage.setItem(STORAGE_KEY, result.secret)
      }
      setSuccess(
        result?.rotated
          ? t('password.successRotated')
          : t('password.success'),
      )
      reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('password.errorFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          {t('password.title')}
        </CardTitle>
        <CardDescription>
          {t('password.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="space-y-2">
            <Label htmlFor="current-password">{t('password.currentPassword')}</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">{t('password.newPassword')}</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              placeholder={t('password.newPasswordPlaceholder')}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-new-password">{t('password.confirmPassword')}</Label>
            <Input
              id="confirm-new-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={submitting}
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="mt-1"
              checked={rotateSecret}
              onChange={(e) => setRotateSecret(e.target.checked)}
              disabled={submitting}
            />
            <span>{t('password.rotateSecretHint')}</span>
          </label>

          <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('password.updating')}
              </>
            ) : (
              t('password.updateButton')
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
