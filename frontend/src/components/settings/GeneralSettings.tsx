import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSettingsStore, OAuthProxyMode } from '@/stores/settingsStore'
import { Bell, Globe, Zap } from 'lucide-react'

export function GeneralSettings() {
  const { t } = useTranslation()
  const {
    autoStartProxy,
    setAutoStartProxy,
    enableNotifications,
    setEnableNotifications,
    oauthProxyMode,
    setOauthProxyMode,
  } = useSettingsStore()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            {t('settings.autoStartProxy')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-start-proxy">{t('settings.autoStartProxy')}</Label>
              <p className="text-sm text-muted-foreground">{t('settings.autoStartProxyHelp')}</p>
            </div>
            <Switch
              id="auto-start-proxy"
              checked={autoStartProxy}
              onCheckedChange={setAutoStartProxy}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {t('settings.notifications')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notifications">{t('settings.enableNotifications')}</Label>
              <p className="text-sm text-muted-foreground">{t('settings.enableNotificationsHelp')}</p>
            </div>
            <Switch
              id="notifications"
              checked={enableNotifications}
              onCheckedChange={setEnableNotifications}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t('settings.networkProxy')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('settings.oauthProxyMode')}</Label>
              <p className="text-sm text-muted-foreground">{t('settings.oauthProxyModeHelp')}</p>
            </div>
            <Select
              value={oauthProxyMode}
              onValueChange={(value) => setOauthProxyMode(value as OAuthProxyMode)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('settings.oauthProxyMode')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">{t('settings.oauthProxySystem')}</SelectItem>
                <SelectItem value="none">{t('settings.oauthProxyNone')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
