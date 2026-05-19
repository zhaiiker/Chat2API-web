/**
 * Console Script Panel
 *
 * Shows a simple one-line JS command for each provider that the user
 * can copy, paste into the provider's browser Console (F12), and execute.
 * The command returns the token value directly in the Console — the user
 * then copies it and pastes it into the manual input field.
 *
 * No tickets, no fetch, no polling, no bookmarklets. Just:
 *   1. Copy the one-liner
 *   2. Go to provider page → F12 → Console → Paste → Enter
 *   3. Right-click the result → "Copy string"
 *   4. Paste into the token field back in Chat2API
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  Terminal,
} from 'lucide-react'

/**
 * Per-provider one-liner commands to extract the token from the browser.
 * Each returns the token string directly in the Console.
 */
const PROVIDER_COMMANDS: Record<string, { command: string; loginUrl: string }> = {
  deepseek: {
    command: `localStorage.getItem('userToken')`,
    loginUrl: 'https://chat.deepseek.com',
  },
  glm: {
    command: `document.cookie.match(/chatglm_refresh_token=([^;]+)/)?.[1] || 'not found'`,
    loginUrl: 'https://chatglm.cn',
  },
  kimi: {
    command: `document.cookie.match(/kimi-auth=([^;]+)/)?.[1] || 'not found'`,
    loginUrl: 'https://www.kimi.com',
  },
  minimax: {
    command: `JSON.stringify({token: localStorage.getItem('_token'), userId: localStorage.getItem('_userId')})`,
    loginUrl: 'https://chat.minimaxi.com',
  },
  qwen: {
    command: `document.cookie.match(/tongyi_sso_ticket=([^;]+)/)?.[1] || 'not found'`,
    loginUrl: 'https://www.qianwen.com',
  },
  'qwen-ai': {
    command: `localStorage.getItem('token')`,
    loginUrl: 'https://chat.qwen.ai',
  },
  zai: {
    command: `localStorage.getItem('token')`,
    loginUrl: 'https://chat.z.ai',
  },
  perplexity: {
    command: `document.cookie.match(/__Secure-next-auth\\.session-token=([^;]+)/)?.[1] || 'not found'`,
    loginUrl: 'https://www.perplexity.ai',
  },
  mimo: {
    command: `JSON.stringify({service_token: document.cookie.match(/serviceToken=([^;]+)/)?.[1], user_id: document.cookie.match(/userId=([^;]+)/)?.[1], ph_token: document.cookie.match(/xiaomichatbot_ph=([^;]+)/)?.[1]})`,
    loginUrl: 'https://aistudio.xiaomimimo.com',
  },
}

interface ConsoleScriptPanelProps {
  providerId: string
  providerType: string
  providerName?: string
}

export function ConsoleScriptPanel({
  providerId,
  providerType,
  providerName,
}: ConsoleScriptPanelProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const config = PROVIDER_COMMANDS[providerType] || PROVIDER_COMMANDS[providerId]
  const displayName = providerName || providerType

  if (!config) {
    return null
  }

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(config.command)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      // Fallback
      const ta = document.createElement('textarea')
      ta.value = config.command
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    }
  }

  return (
    <div className="space-y-4">
      {/* Step-by-step instructions */}
      <div className="rounded-md border bg-muted/40 p-3">
        <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
          <Terminal className="h-3.5 w-3.5" />
          {t('oauth.console.stepsTitle')}
        </p>
        <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted-foreground">
          <li>{t('oauth.console.step1', { provider: displayName })}</li>
          <li>{t('oauth.console.step2')}</li>
          <li>{t('oauth.console.step3')}</li>
          <li>{t('oauth.console.step4')}</li>
        </ol>
      </div>

      {/* Command display */}
      <div className="rounded-md border bg-background p-3">
        <p className="text-xs text-muted-foreground mb-1.5">
          {t('oauth.console.commandLabel')}
        </p>
        <code className="block whitespace-pre-wrap break-all rounded bg-muted px-2 py-1.5 font-mono text-xs">
          {config.command}
        </code>
      </div>

      {/* Copy button */}
      <Button
        type="button"
        onClick={copyCommand}
        className="w-full"
        variant={copied ? 'default' : 'outline'}
      >
        {copied ? (
          <>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {t('oauth.console.copied')}
          </>
        ) : (
          <>
            <ClipboardCopy className="mr-2 h-4 w-4" />
            {t('oauth.console.copyCommand')}
          </>
        )}
      </Button>

      {/* Open login page */}
      <Button
        type="button"
        onClick={() => window.open(config.loginUrl, '_blank', 'noopener,noreferrer')}
        className="w-full"
        variant="outline"
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        {t('oauth.console.openLogin', { host: new URL(config.loginUrl).hostname })}
      </Button>
    </div>
  )
}

export default ConsoleScriptPanel
