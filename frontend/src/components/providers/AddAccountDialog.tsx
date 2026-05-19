/**
 * Add Account Dialog Component
 * Supports OAuth login and manual input methods
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TokenExtractionGuide } from '@/components/oauth/TokenExtractionGuide'
import { 
  User, 
  AlertCircle,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  Copy,
  Check
} from 'lucide-react'
import type { Provider, CredentialField, Account, BuiltinProviderConfig } from '@/types/electron'

/**
 * Map OAuth credentials to provider credential field names
 * OAuth returns credentials with keys like 'chatglm_refresh_token', but providers expect 'refresh_token'
 * DeepSeek stores token as JSON: {"value":"..."}
 */
function mapOAuthCredentials(providerId: string | undefined, credentials: Record<string, string>): Record<string, string> {
  if (!providerId) return credentials

  // For each provider, list every OAuth key that may carry the primary
  // token (raw cookie names, the bookmarklet's relabelled "token" field,
  // older snake_case names, and the camelCase keys the backend adapters
  // emit today). The first key that has a non-empty value wins.
  const primaryTokenCandidates: Record<string, string[]> = {
    glm: ['refreshToken', 'refresh_token', 'chatglm_refresh_token', 'token'],
    deepseek: ['userToken', 'token'],
    qwen: ['tongyi_sso_ticket', 'ticket', 'token'],
    'qwen-ai': ['tongyi_sso_ticket', 'ticket', 'token'],
    zai: ['tongyi_sso_ticket', 'ticket', 'token'],
    perplexity: ['__Secure-next-auth.session-token', 'next-auth.session-token', 'sessionToken', 'token'],
    kimi: ['kimi-auth', 'token'],
    minimax: ['_token', 'token'],
    mimo: ['service_token', 'serviceToken', 'token'],
  }

  const formFieldName: Record<string, string> = {
    glm: 'refresh_token',
    deepseek: 'token',
    qwen: 'ticket',
    'qwen-ai': 'ticket',
    zai: 'ticket',
    perplexity: 'sessionToken',
    kimi: 'token',
    minimax: 'token',
    mimo: 'service_token',
  }

  const pickFirst = (keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = credentials[k]
      if (typeof v === 'string' && v.length > 0) return v
    }
    return undefined
  }

  const fieldName = formFieldName[providerId]
  const tokenCandidates = primaryTokenCandidates[providerId]

  if (fieldName && tokenCandidates) {
    let tokenValue = pickFirst(tokenCandidates)

    // DeepSeek's bookmarklet captures the raw localStorage payload, which
    // is itself a JSON-wrapped string: {"value":"<actual token>"}.
    if (providerId === 'deepseek' && tokenValue && tokenValue.startsWith('{') && tokenValue.endsWith('}')) {
      try {
        const parsed = JSON.parse(tokenValue)
        if (typeof parsed?.value === 'string') {
          tokenValue = parsed.value
        }
      } catch (e) {
        console.error('[AddAccountDialog] Error parsing JSON token:', e)
      }
    }

    if (tokenValue) {
      // MiniMax also requires realUserID, kept alongside the primary token.
      if (providerId === 'minimax') {
        const realUserID = credentials._userId || credentials.realUserID
        const result: Record<string, string> = { [fieldName]: tokenValue }
        if (realUserID) result.realUserID = realUserID
        return result
      }

      // Mimo Studio needs three fields together; the helper below populates
      // all of them and falls back to the (already mapped) primary token.
      if (providerId === 'mimo') {
        const result: Record<string, string> = {}
        const userId = credentials.user_id || credentials.userId || credentials.mimoUserId
        const phToken = credentials.ph_token || credentials.xiaomichatbot_ph || credentials.mimoPhToken
        result.service_token = tokenValue
        if (userId) result.user_id = userId
        if (phToken) result.ph_token = phToken
        return result
      }

      return { [fieldName]: tokenValue }
    }
  }

  // Unknown provider, or none of the candidate keys matched. Pass the
  // raw credentials through so the user at least sees what arrived.
  return credentials
}

interface AddAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider: Provider | null
  onAddAccount: (data: {
    name: string
    email?: string
    credentials: Record<string, string>
    dailyLimit?: number
  }) => Promise<void>
  onValidateToken: (providerId: string, credentials: Record<string, string>) => Promise<{
    valid: boolean
    error?: string
    userInfo?: {
      name?: string
      email?: string
      quota?: number
      used?: number
    }
  }>
  editingAccount?: Account | null
  onUpdateAccount?: (id: string, updates: Partial<Account>) => Promise<void>
}

export function AddAccountDialog({
  open,
  onOpenChange,
  provider,
  onAddAccount,
  onValidateToken,
  editingAccount,
  onUpdateAccount,
}: AddAccountDialogProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<string>('manual')
  const [name, setName] = useState('')
  const [dailyLimit, setDailyLimit] = useState<string>('')
  const [credentials, setCredentials] = useState<Record<string, string>>({})
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<{
    valid?: boolean
    error?: string
    userInfo?: {
      name?: string
      email?: string
      quota?: number
      used?: number
    }
  }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEditing = !!editingAccount
  const builtinProvider = provider as BuiltinProviderConfig | null
  const credentialFields: CredentialField[] = builtinProvider?.credentialFields || getDefaultCredentialFields(provider?.authType, t)
  const supportsOAuth = provider && ['deepseek', 'glm', 'kimi', 'mimo', 'minimax', 'qwen', 'qwen-ai', 'zai', 'perplexity'].includes(provider.id)

  useEffect(() => {
    if (open) {
      if (editingAccount) {
        setName(editingAccount.name)
        setDailyLimit(editingAccount.dailyLimit?.toString() || '')
        setCredentials(editingAccount.credentials || {})
        setActiveTab('manual')
      } else {
        resetForm()
      }
    }
  }, [open, editingAccount])

  const resetForm = () => {
    setName('')
    setDailyLimit('')
    setCredentials({})
    setValidationResult({})
    setActiveTab('manual')
  }

  const handleCredentialChange = (fieldName: string, value: string) => {
    setCredentials(prev => ({
      ...prev,
      [fieldName]: value,
    }))
    setValidationResult({})
  }

  const handleValidate = async () => {
    if (!provider) return

    const requiredFields = credentialFields.filter(f => f.required)
    const missingFields = requiredFields.filter(f => !credentials[f.name])
    
    if (missingFields.length > 0) {
      setValidationResult({
        valid: false,
        error: t('providers.fillRequiredFields', { fields: missingFields.map(f => f.label).join(', ') }),
      })
      return
    }

    setIsValidating(true)
    setValidationResult({})

    try {
      const result = await onValidateToken(provider.id, credentials)
      setValidationResult(result)

      if (result.valid && result.userInfo) {
        if (!name && result.userInfo.name) {
          setName(result.userInfo.name)
        }
      }
    } catch (error) {
      setValidationResult({
        valid: false,
        error: error instanceof Error ? error.message : t('providers.validateFailed'),
      })
    } finally {
      setIsValidating(false)
    }
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      setValidationResult({
        valid: false,
        error: t('providers.enterAccountName'),
      })
      return
    }

    const requiredFields = credentialFields.filter(f => f.required)
    const missingFields = requiredFields.filter(f => !credentials[f.name])
    
    if (missingFields.length > 0) {
      setValidationResult({
        valid: false,
        error: t('providers.fillRequiredFields', { fields: missingFields.map(f => f.label).join(', ') }),
      })
      return
    }

    setIsSubmitting(true)

    try {
      // For MiniMax, ensure realUserID is passed correctly
      let finalCredentials = { ...credentials }
      if (provider?.id === 'minimax' && credentials.realUserID && credentials.realUserID.trim()) {
        // realUserID is provided separately, keep both fields
        console.log('[AddAccountDialog] MiniMax realUserID provided:', credentials.realUserID)
      }

      const data = {
        name: name.trim(),
        credentials: finalCredentials,
        dailyLimit: dailyLimit ? parseInt(dailyLimit, 10) : undefined,
      }

      if (isEditing && editingAccount && onUpdateAccount) {
        await onUpdateAccount(editingAccount.id, data)
      } else {
        await onAddAccount(data)
      }

      onOpenChange(false)
      resetForm()
    } catch (error) {
      setValidationResult({
        valid: false,
        error: error instanceof Error ? error.message : t('providers.saveFailed'),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!provider) return null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {isEditing ? t('providers.editAccount') : t('providers.addAccount')}
            </DialogTitle>
            <DialogDescription>
              {t('providers.manageAllAccounts')} - {provider.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('providers.accountName')} *</Label>
              <Input
                id="name"
                placeholder={t('providers.accountNamePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dailyLimit">{t('providers.dailyLimitOptional')}</Label>
              <Input
                id="dailyLimit"
                type="number"
                placeholder={t('providers.dailyLimitPlaceholder')}
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
              />
            </div>

            {supportsOAuth && !isEditing && (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="manual">{t('providers.manualInput')}</TabsTrigger>
                  <TabsTrigger value="oauth">{t('providers.oauthLogin')}</TabsTrigger>
                </TabsList>

                <TabsContent value="manual" className="mt-4">
                  <CredentialFieldsForm
                    fields={credentialFields}
                    credentials={credentials}
                    onChange={handleCredentialChange}
                    t={t}
                    providerId={provider?.id}
                  />
                </TabsContent>

                <TabsContent value="oauth" className="mt-4">
                  {provider && (
                    <TokenExtractionGuide
                      providerId={provider.id}
                      providerType={provider.id}
                      providerName={provider.name}
                      onSuccess={(creds, accountInfo) => {
                        // Map raw OAuth credentials to the provider's credential
                        // field names, then pre-fill the form so the user can
                        // review (and adjust the account name) before saving.
                        console.log('[AddAccountDialog] OAuth raw creds:', JSON.stringify(creds))
                        const mapped = mapOAuthCredentials(provider.id, creds)
                        console.log('[AddAccountDialog] Mapped creds:', JSON.stringify(mapped))
                        // Switch tab FIRST so the credential fields are mounted,
                        // then set credentials so React renders them filled.
                        setActiveTab('manual')
                        // Use a microtask to ensure the tab content has mounted
                        // before we update the credential state that fills the inputs.
                        setTimeout(() => {
                          setCredentials(mapped)
                          if (accountInfo?.name) setName(accountInfo.name)
                          setValidationResult({ valid: true, userInfo: accountInfo })
                        }, 0)
                      }}
                    />
                  )}
                </TabsContent>
              </Tabs>
            )}

            {(!supportsOAuth || isEditing) && (
              <CredentialFieldsForm
                fields={credentialFields}
                credentials={credentials}
                onChange={handleCredentialChange}
                t={t}
                providerId={provider?.id}
              />
            )}

            {validationResult.error && (
              <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{validationResult.error}</span>
              </div>
            )}

            {validationResult.valid && validationResult.userInfo && (
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <div>
                  <span className="font-medium">{t('providers.validationSuccess')}</span>
                  {validationResult.userInfo.quota !== undefined && (
                    <span className="ml-2">
                      {t('providers.quota')}: {validationResult.userInfo.used || 0} / {validationResult.userInfo.quota}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="outline"
              onClick={handleValidate}
              disabled={isValidating || isSubmitting}
            >
              {isValidating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('oauth.validating')}
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {t('providers.validateCredentials')}
                </>
              )}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || isValidating}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('providers.saving')}
                </>
              ) : (
                isEditing ? t('providers.saveChanges') : t('providers.addAccount')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

interface CredentialFieldsFormProps {
  fields: CredentialField[]
  credentials: Record<string, string>
  onChange: (fieldName: string, value: string) => void
  t: (key: string) => string
  providerId?: string
}

function CredentialFieldsForm({ fields, credentials, onChange, t, providerId }: CredentialFieldsFormProps) {
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({})
  const [copiedFields, setCopiedFields] = useState<Record<string, boolean>>({})

  const toggleFieldVisibility = (fieldName: string) => {
    setVisibleFields(prev => ({
      ...prev,
      [fieldName]: !prev[fieldName]
    }))
  }

  const copyToClipboard = async (fieldName: string, value: string) => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopiedFields(prev => ({ ...prev, [fieldName]: true }))
      setTimeout(() => {
        setCopiedFields(prev => ({ ...prev, [fieldName]: false }))
      }, 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const getFieldTranslation = (field: CredentialField) => {
    if (!providerId) return { label: field.label, placeholder: field.placeholder, helpText: field.helpText }

    const translations: Record<string, Record<string, { label: string; placeholder: string; helpText: string }>> = {
      deepseek: {
        token: {
          label: t('deepseek.userToken'),
          placeholder: t('deepseek.userTokenPlaceholder'),
          helpText: t('deepseek.userTokenHelp'),
        },
      },
      glm: {
        refresh_token: {
          label: t('glm.refreshToken'),
          placeholder: t('glm.refreshTokenPlaceholder'),
          helpText: t('glm.refreshTokenHelp'),
        },
      },
      kimi: {
        token: {
          label: t('kimi.accessToken'),
          placeholder: t('kimi.accessTokenPlaceholder'),
          helpText: t('kimi.accessTokenHelp'),
        },
      },
      minimax: {
        token: {
          label: t('minimax.token'),
          placeholder: t('minimax.tokenPlaceholder'),
          helpText: t('minimax.tokenHelp'),
        },
        realUserID: {
          label: t('minimax.realUserID'),
          placeholder: t('minimax.realUserIDPlaceholder'),
          helpText: t('minimax.realUserIDHelp'),
        },
      },
      qwen: {
        ticket: {
          label: t('qwen.ssoTicket'),
          placeholder: t('qwen.ssoTicketPlaceholder'),
          helpText: t('qwen.ssoTicketHelp'),
        },
      },
      'qwen-ai': {
        token: {
          label: t('qwen-ai.token'),
          placeholder: t('qwen-ai.tokenPlaceholder'),
          helpText: t('qwen-ai.tokenHelp'),
        },
        cookies: {
          label: t('qwen-ai.cookies'),
          placeholder: t('qwen-ai.cookiesPlaceholder'),
          helpText: t('qwen-ai.cookiesHelp'),
        },
      },
      zai: {
        token: {
          label: t('zai.token'),
          placeholder: t('zai.tokenPlaceholder'),
          helpText: t('zai.tokenHelp'),
        },
      },
      mimo: {
        service_token: {
          label: t('mimo.serviceToken'),
          placeholder: t('mimo.serviceTokenPlaceholder'),
          helpText: t('mimo.serviceTokenHelp'),
        },
        user_id: {
          label: t('mimo.userId'),
          placeholder: t('mimo.userIdPlaceholder'),
          helpText: t('mimo.userIdHelp'),
        },
        ph_token: {
          label: t('mimo.phToken'),
          placeholder: t('mimo.phTokenPlaceholder'),
          helpText: t('mimo.phTokenHelp'),
        },
      },
      perplexity: {
        sessionToken: {
          label: t('perplexity.sessionToken'),
          placeholder: t('perplexity.sessionTokenPlaceholder'),
          helpText: t('perplexity.sessionTokenHelp'),
        },
      },
    }

    const providerTranslations = translations[providerId]
    if (providerTranslations && providerTranslations[field.name]) {
      return providerTranslations[field.name]
    }

    return { label: field.label, placeholder: field.placeholder, helpText: field.helpText }
  }

  return (
    <div className="space-y-4">
      {fields.map((field) => {
        const translated = getFieldTranslation(field)
        const isPasswordField = field.type === 'password'
        const isVisible = visibleFields[field.name]
        const isCopied = copiedFields[field.name]
        const fieldValue = credentials[field.name] || ''
        
        return (
          <div key={field.name} className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor={field.name}>{translated.label}</Label>
              {field.required && (
                <Badge variant="outline" className="text-xs">{t('providers.required')}</Badge>
              )}
            </div>
            {field.type === 'textarea' ? (
              <div className="relative">
                <textarea
                  id={field.name}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pr-20"
                  placeholder={translated.placeholder}
                  value={fieldValue}
                  onChange={(e) => onChange(field.name, e.target.value)}
                />
                <div className="absolute right-1 top-1 flex gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => copyToClipboard(field.name, fieldValue)}
                    disabled={!fieldValue}
                  >
                    {isCopied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => toggleFieldVisibility(field.name)}
                  >
                    {isVisible ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
            ) : isPasswordField ? (
              <div className="relative">
                <Input
                  id={field.name}
                  type={isVisible ? 'text' : 'password'}
                  placeholder={translated.placeholder}
                  value={fieldValue}
                  onChange={(e) => onChange(field.name, e.target.value)}
                  className="pr-20"
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => copyToClipboard(field.name, fieldValue)}
                    disabled={!fieldValue}
                  >
                    {isCopied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => toggleFieldVisibility(field.name)}
                  >
                    {isVisible ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <Input
                id={field.name}
                type={field.type}
                placeholder={translated.placeholder}
                value={fieldValue}
                onChange={(e) => onChange(field.name, e.target.value)}
              />
            )}
            {translated.helpText && (
              <p className="text-xs text-muted-foreground">{translated.helpText}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function getDefaultCredentialFields(authType?: string, t?: (key: string) => string): CredentialField[] {
  const fieldConfigs: Record<string, CredentialField[]> = {
    token: [
      {
        name: 'token',
        label: 'API Token',
        type: 'password',
        required: true,
        placeholder: t ? t('providers.enterApiToken') : 'Enter API Token',
      },
    ],
    cookie: [
      {
        name: 'cookie',
        label: 'Cookie',
        type: 'textarea',
        required: true,
        placeholder: t ? t('providers.enterCookieString') : 'Enter complete Cookie string',
      },
    ],
    oauth: [
      {
        name: 'access_token',
        label: 'Access Token',
        type: 'password',
        required: true,
        placeholder: t ? t('providers.enterOAuthAccessToken') : 'Enter OAuth Access Token',
      },
    ],
    refresh_token: [
      {
        name: 'refresh_token',
        label: 'Refresh Token',
        type: 'password',
        required: true,
        placeholder: t ? t('providers.enterRefreshToken') : 'Enter Refresh Token',
      },
    ],
    jwt: [
      {
        name: 'jwt',
        label: 'JWT Token',
        type: 'textarea',
        required: true,
        placeholder: t ? t('providers.enterJwtToken') : 'Enter JWT Token (starts with eyJ)',
      },
    ],
  }

  return fieldConfigs[authType || 'token'] || fieldConfigs.token
}

export default AddAccountDialog
