/**
 * Electron API Compatibility Shim
 *
 * Many components were written against the legacy Electron preload API
 * (`window.electronAPI.*`). After migrating to a pure-web architecture
 * those calls now have to go over HTTP via `ApiService`.
 *
 * This shim materialises `window.electronAPI` at startup so legacy
 * code continues to work unchanged while we incrementally rewrite
 * components to call `ApiService` directly.
 *
 * Push-style callbacks (`onStatusChanged`, `onNewLog`, ...) are emulated
 * via low-frequency polling so dashboards still update.
 */

import { ApiService } from './api'
import type { ElectronAPI } from '../types/electron'

const noopUnsubscribe = () => {}

/**
 * Generic light-weight polling helper.
 * Calls `fetcher` immediately and then on a fixed interval; whenever the
 * shallow JSON form of the result changes the listener is notified.
 */
function pollingSubscribe<T>(
  fetcher: () => Promise<T | null | undefined>,
  intervalMs: number,
  listener: (value: T) => void,
): () => void {
  let cancelled = false
  let last: string | undefined

  const tick = async () => {
    if (cancelled) return
    try {
      const value = await fetcher()
      if (cancelled || value == null) return
      const serialised = JSON.stringify(value)
      if (serialised !== last) {
        last = serialised
        listener(value)
      }
    } catch {
      // swallow polling errors so the loop keeps running
    }
  }

  void tick()
  const handle = setInterval(tick, intervalMs)
  return () => {
    cancelled = true
    clearInterval(handle)
  }
}

/**
 * Build the runtime shim. Every method delegates to `ApiService`,
 * which speaks to the Management HTTP API.
 */
export function createElectronApiShim(): ElectronAPI {
  return {
    proxy: {
      start: async (port?: number, host?: string) => {
        await ApiService.proxy.start(port, host)
        return true
      },
      stop: async () => {
        await ApiService.proxy.stop()
        return true
      },
      restart: async (port?: number, host?: string) => {
        await ApiService.proxy.restart(port, host)
        return true
      },
      getStatus: () => ApiService.proxy.getStatus() as any,
      onStatusChanged: (callback) =>
        pollingSubscribe(
          () => ApiService.proxy.getStatus().catch(() => null) as any,
          5000,
          callback as any,
        ),
    },

    store: {
      get: async () => undefined,
      set: async () => {},
      delete: async () => {},
      clearAll: async () => {},
    },

    providers: {
      getAll: () => ApiService.providers.getAll() as any,
      getBuiltin: () => ApiService.providers.getBuiltin() as any,
      add: (data: any) => ApiService.providers.add(data) as any,
      update: (id, updates) => ApiService.providers.update(id, updates) as any,
      delete: async (id) => {
        const res: any = await ApiService.providers.delete(id)
        return res?.success ?? true
      },
      checkStatus: (id) => ApiService.providers.checkStatus(id) as any,
      checkAllStatus: () => ApiService.providers.checkAllStatus() as any,
      duplicate: (id) => ApiService.providers.duplicate(id) as any,
      export: (id) => ApiService.providers.export(id) as any,
      import: (jsonData) => ApiService.providers.import(jsonData) as any,
      updateModels: (id) => ApiService.providers.updateModels(id) as any,
      getEffectiveModels: (id) => ApiService.providers.getEffectiveModels(id) as any,
      addCustomModel: (id, model) => ApiService.providers.addCustomModel(id, model) as any,
      removeModel: (id, name) => ApiService.providers.removeModel(id, name) as any,
      resetModels: (id) => ApiService.providers.resetModels(id) as any,
    },

    accounts: {
      getAll: (includeCredentials) => ApiService.accounts.getAll(includeCredentials) as any,
      add: (data: any) => ApiService.accounts.add(data) as any,
      update: (id, updates) => ApiService.accounts.update(id, updates) as any,
      delete: async (id) => {
        const res: any = await ApiService.accounts.delete(id)
        return res?.success ?? true
      },
      validate: async (id) => {
        const res: any = await ApiService.accounts.validate(id)
        return res?.success ?? false
      },
      validateToken: (providerId, credentials) =>
        ApiService.accounts.validateToken(providerId, credentials) as any,
      getById: (id, includeCredentials) =>
        ApiService.accounts.getById(id, includeCredentials) as any,
      getByProvider: (providerId) => ApiService.accounts.getByProvider(providerId) as any,
      getCredits: (id) => ApiService.accounts.getCredits(id) as any,
      clearChats: (id) => ApiService.accounts.clearChats(id) as any,
    },

    oauth: {
      startLogin: (providerId, providerType) =>
        ApiService.oauth.startLogin(providerId, providerType) as any,
      cancelLogin: () => ApiService.oauth.cancelLogin(),
      loginWithToken: (providerId, providerType, token, realUserID, mimoUserId, mimoPhToken) =>
        ApiService.oauth.loginWithToken({
          providerId,
          providerType,
          token,
          realUserID,
          mimoUserId,
          mimoPhToken,
        }) as any,
      validateToken: (providerId, providerType, credentials) =>
        ApiService.oauth.validateToken(providerId, providerType, credentials) as any,
      refreshToken: (providerId, providerType, credentials) =>
        ApiService.oauth.refreshToken(providerId, providerType, credentials) as any,
      getStatus: () => ApiService.oauth.getStatus() as any,
      startInAppLogin: () => ApiService.oauth.startInAppLogin(),
      cancelInAppLogin: () => ApiService.oauth.cancelInAppLogin(),
      isInAppLoginOpen: () => ApiService.oauth.isInAppLoginOpen(),
      onCallback: () => noopUnsubscribe,
      onProgress: () => noopUnsubscribe,
    },

    logs: {
      get: (filter) => ApiService.logs.get(filter) as any,
      getStats: () => ApiService.logs.getStats() as any,
      getTrend: (days) => ApiService.logs.getTrend(days) as any,
      getAccountTrend: (accountId, days) => ApiService.logs.getAccountTrend(accountId, days) as any,
      clear: () => ApiService.logs.clear(),
      export: (format) => ApiService.logs.export(format) as any,
      getById: (id) => ApiService.logs.getById(id) as any,
      onNewLog: () => noopUnsubscribe,
    },

    requestLogs: {
      get: (filter) => ApiService.requestLogs.get(filter) as any,
      getById: (id) => ApiService.requestLogs.getById(id) as any,
      getStats: () => ApiService.requestLogs.getStats() as any,
      getTrend: (days) => ApiService.requestLogs.getTrend(days) as any,
      clear: () => ApiService.requestLogs.clear(),
      onNewLog: () => noopUnsubscribe,
    },

    statistics: {
      get: () => ApiService.statistics.get() as any,
      getToday: () => ApiService.statistics.getToday() as any,
    },

    app: {
      getVersion: async () => {
        const res: any = await ApiService.app.getVersion().catch(() => null)
        if (!res) return ''
        return typeof res === 'string' ? res : (res.version ?? '')
      },
      checkUpdate: async () => ({
        hasUpdate: false,
        currentVersion: '',
        latestVersion: '',
      }),
      downloadUpdate: async () => {},
      installUpdate: async () => {},
      getUpdateStatus: async () => ({
        checking: false,
        available: false,
        downloading: false,
        downloaded: false,
        error: null,
        progress: null,
        version: null,
        releaseDate: null,
        releaseNotes: null,
      }),
      onUpdateChecking: () => noopUnsubscribe,
      onUpdateAvailable: () => noopUnsubscribe,
      onUpdateNotAvailable: () => noopUnsubscribe,
      onUpdateProgress: () => noopUnsubscribe,
      onUpdateDownloaded: () => noopUnsubscribe,
      onUpdateError: () => noopUnsubscribe,
      minimize: async () => {},
      maximize: async () => {},
      close: async () => {},
      showWindow: async () => {},
      hideWindow: async () => {},
      openExternal: async (url: string) => {
        window.open(url, '_blank', 'noopener,noreferrer')
      },
    },

    config: {
      get: () => ApiService.config.get() as any,
      update: async (updates) => {
        await ApiService.config.update(updates)
        return true
      },
      onConfigChanged: (callback) =>
        pollingSubscribe(
          () => ApiService.config.get().catch(() => null) as any,
          15000,
          callback as any,
        ),
    },

    prompts: {
      getAll: () => ApiService.prompts.getAll() as any,
      getBuiltin: () => ApiService.prompts.getBuiltin() as any,
      getCustom: () => ApiService.prompts.getCustom() as any,
      getById: (id) => ApiService.prompts.getById(id) as any,
      add: (prompt: any) => ApiService.prompts.add(prompt) as any,
      update: (id, updates) => ApiService.prompts.update(id, updates) as any,
      delete: async (id) => {
        await ApiService.prompts.delete(id)
        return true
      },
      getByType: (type: string) => ApiService.prompts.getByType(type) as any,
    },

    session: {
      getConfig: () => ApiService.sessions.getConfig() as any,
      updateConfig: async (config) => {
        await ApiService.sessions.updateConfig(config as any)
      },
      getAll: () => ApiService.sessions.getAll() as any,
      getActive: () => ApiService.sessions.getActive() as any,
      getById: (id) => ApiService.sessions.getById(id) as any,
      getByAccount: (accountId) => ApiService.sessions.getByAccount(accountId) as any,
      getByProvider: (providerId) => ApiService.sessions.getByProvider(providerId) as any,
      delete: async (id) => {
        await ApiService.sessions.delete(id)
        return true
      },
      clearAll: () => ApiService.sessions.clearAll(),
      cleanExpired: () => ApiService.sessions.cleanExpired() as any,
    },

    managementApi: {
      getConfig: () => ApiService.managementApi.getConfig() as any,
      updateConfig: async (updates) => {
        await ApiService.managementApi.updateConfig(updates)
        return true
      },
      generateSecret: () => ApiService.managementApi.generateSecret(),
    },

    contextManagement: {
      getConfig: () => ApiService.contextManagement.getConfig() as any,
      updateConfig: (updates) => ApiService.contextManagement.updateConfig(updates) as any,
    },

    toolCalling: {
      getStatus: async () => ({}),
      runSmoke: async () => ({ success: false, error: { message: 'Not implemented in web mode' } }),
    },

    tray: {
      openDashboard: () => {},
      setHeight: () => {},
      quitApp: () => {},
    },

    on: () => noopUnsubscribe,
    send: () => {},
    invoke: async (channel: string, ...args: unknown[]) => {
      // A small set of legacy IPC channels are translated to HTTP calls.
      if (channel === 'managementApi:getConfig') {
        return ApiService.managementApi.getConfig()
      }
      if (channel === 'managementApi:updateConfig') {
        return ApiService.managementApi.updateConfig(args[0])
      }
      if (channel === 'managementApi:generateSecret') {
        return ApiService.managementApi.generateSecret()
      }
      console.warn('[electronShim] Unhandled invoke channel:', channel)
      return undefined
    },
  }
}

/**
 * Install the shim onto `window` if it is not already present.
 * Call this once at app bootstrap.
 */
export function installElectronApiShim(): void {
  if (typeof window === 'undefined') return
  if ((window as any).electronAPI) return
  ;(window as any).electronAPI = createElectronApiShim()
}
