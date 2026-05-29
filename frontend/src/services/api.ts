import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import type { 
  AppConfig, 
  Provider, 
  Account, 
  ProviderCheckResult,
  OAuthResult,
  LogEntry,
  RequestLogEntry,
  PersistentStatistics,
  DailyStatistics,
  SystemPrompt,
  SessionConfig,
  SessionRecord,
} from '@shared/types'

// Setup default axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: '/v0/management',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add managementApiSecret
apiClient.interceptors.request.use((config) => {
  const secret = localStorage.getItem('managementApiSecret')
  if (secret) {
    config.headers['Authorization'] = `Bearer ${secret}`
  }
  return config
})

// Response interceptor to handle data extraction
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // If response is the standard management API response wrapper
    if (response.data && typeof response.data === 'object' && 'success' in response.data) {
      if (response.data.success) {
        return response.data.data !== undefined ? response.data.data : response.data
      } else {
        return Promise.reject(new Error(response.data.error?.message || 'API request failed'))
      }
    }
    return response.data
  },
  (error) => {
    const url: string = error.config?.url || ''
    const isAuthEndpoint = url.startsWith('/auth/')
    if ((error.response?.status === 401 || error.response?.status === 403) && !isAuthEndpoint) {
      // Existing session was rejected -> drop the cached secret and ask
      // the AuthProvider to surface the login screen again. Auth-endpoint
      // errors are bubbled through unchanged so the login form can show a
      // proper "incorrect password" message.
      localStorage.removeItem('managementApiSecret')
      window.dispatchEvent(new Event('management-api-unauthorized'))
    }
    const message = error.response?.data?.error?.message || error.message
    return Promise.reject(new Error(message))
  }
)

/**
 * Replaces the old window.electronAPI with HTTP client methods
 */
export const ApiService = {
  /**
   * Authentication / first-run flow.
   *
   * On first launch the operator opens the web UI and creates a password
   * via `auth.setup`. Subsequent launches require `auth.login`. Both
   * endpoints return a long-lived management secret that the SPA stores
   * in localStorage and sends as `Authorization: Bearer <secret>`.
   */
  auth: {
    status: (): Promise<{
      firstRun: boolean
      requirePassword: boolean
      passwordSetAt: number | null
    }> => apiClient.get('/auth/status'),
    setup: (password: string): Promise<{ secret: string }> =>
      apiClient.post('/auth/setup', { password }),
    login: (password: string): Promise<{ secret: string }> =>
      apiClient.post('/auth/login', { password }),
    changePassword: (
      input: { oldPassword?: string; newPassword: string; rotateSecret?: boolean },
    ): Promise<{ secret: string; rotated: boolean }> =>
      apiClient.post('/auth/change_password', input),
  },

  // Proxy Service
  proxy: {
    start: (port?: number, host?: string) => apiClient.post('/proxy/start', { port, host }),
    stop: () => apiClient.post('/proxy/stop'),
    restart: (port?: number, host?: string) => apiClient.post('/proxy/restart', { port, host }),
    getStatus: () => apiClient.get('/proxy/status'),
  },

  // App Configuration
  config: {
    get: (): Promise<AppConfig> => apiClient.get('/config'),
    update: (updates: Partial<AppConfig>): Promise<AppConfig> => apiClient.put('/config', updates),
  },

  // Providers
  providers: {
    getAll: (): Promise<Provider[]> => apiClient.get('/providers'),
    getBuiltin: (): Promise<Provider[]> => apiClient.get('/providers/builtin'),
    add: (data: Partial<Provider>): Promise<Provider> => apiClient.post('/providers', data),
    update: (id: string, updates: Partial<Provider>): Promise<Provider> => apiClient.put(`/providers/${id}`, updates),
    delete: (id: string): Promise<{ success: boolean }> => apiClient.delete(`/providers/${id}`),
    checkStatus: (id: string): Promise<ProviderCheckResult> => apiClient.post(`/providers/${id}/check_status`),
    checkAllStatus: (): Promise<Record<string, ProviderCheckResult>> => apiClient.post('/providers/check_all_status'),
    duplicate: (id: string): Promise<Provider> => apiClient.post(`/providers/${id}/duplicate`),
    export: (id: string): Promise<string> => apiClient.post(`/providers/${id}/export`),
    import: (jsonData: string): Promise<Provider> => apiClient.post('/providers/import', { data: jsonData }),
    syncModels: (id: string) => apiClient.post(`/providers/${id}/sync_models`),
    updateModels: (id: string) => apiClient.post(`/providers/${id}/update_models`),
    getEffectiveModels: (id: string) => apiClient.get(`/providers/${id}/models/effective`),
    addCustomModel: (id: string, model: any) => apiClient.post(`/providers/${id}/models/custom`, model),
    removeModel: (id: string, modelName: string) => apiClient.delete(`/providers/${id}/models/${encodeURIComponent(modelName)}`),
    resetModels: (id: string) => apiClient.post(`/providers/${id}/models/reset`),
  },

  // Accounts
  accounts: {
    getAll: (includeCredentials = false): Promise<Account[]> => apiClient.get('/accounts', { params: { includeCredentials } }),
    getById: (id: string, includeCredentials = false): Promise<Account> => apiClient.get(`/accounts/${id}`, { params: { includeCredentials } }),
    getByProvider: (providerId: string): Promise<Account[]> => apiClient.get('/accounts', { params: { providerId } }),
    add: (data: Partial<Account>): Promise<Account> => apiClient.post('/accounts', data),
    update: (id: string, updates: Partial<Account>): Promise<Account> => apiClient.put(`/accounts/${id}`, updates),
    delete: (id: string): Promise<{ success: boolean }> => apiClient.delete(`/accounts/${id}`),
    validate: (id: string): Promise<{ success: boolean; error?: string }> => apiClient.post(`/accounts/${id}/validate`),
    validateToken: (providerId: string, credentials: Record<string, string>) => apiClient.post('/accounts/validate_token', { providerId, credentials }),
    getCredits: (id: string) => apiClient.get(`/accounts/${id}/credits`),
    clearChats: (id: string) => apiClient.post(`/accounts/${id}/clear_chats`),
  },

  // OAuth
  oauth: {
    startLogin: (providerId: string, providerType: string): Promise<OAuthResult> => apiClient.post('/oauth/start_login', { providerId, providerType }),
    cancelLogin: (): Promise<void> => apiClient.post('/oauth/cancel_login'),
    loginWithToken: (data: { providerId: string, providerType: string, token: string, realUserID?: string, mimoUserId?: string, mimoPhToken?: string }): Promise<OAuthResult> => apiClient.post('/oauth/login_with_token', data),
    validateToken: (providerId: string, providerType: string, credentials: Record<string, string>) => apiClient.post('/oauth/validate_token', { providerId, providerType, credentials }),
    refreshToken: (providerId: string, providerType: string, credentials: Record<string, string>) => apiClient.post('/oauth/refresh_token', { providerId, providerType, credentials }),
    getStatus: () => apiClient.get('/oauth/status'),

    /**
     * Bookmarklet flow.
     *
     * `issue` mints a single-use ticket and returns the ready-to-drag
     * `javascript:` href the operator drops into their bookmark bar.
     * The bookmarklet itself POSTs to the public ingest endpoint with
     * the ticket; the UI then polls `poll` to pick up the result.
     *
     * `poll` returns `{ state: 'pending' }` (HTTP 202) while the
     * bookmarklet hasn't fired yet, and the OAuthResult once it has.
     * The poll consumes the ticket on first read, so callers must
     * surface the result they get back.
     *
     * `cancel` drops a still-pending ticket (e.g. when the dialog is
     * closed before the operator clicked the bookmarklet).
     */
    bookmarklet: {
      issue: (
        providerId: string,
        providerType: string,
      ): Promise<{
        ticket: string
        expiresAt: number
        ttlMs: number
        ingestUrl: string
        providerType: string
        providerId: string
        bookmarklet: {
          href: string
          source: string
          expectedOrigin?: string
        }
      }> =>
        apiClient.post('/oauth/bookmarklet/issue', { providerId, providerType }),
      poll: (
        ticket: string,
      ): Promise<
        | { state: 'pending'; expiresAt: number }
        | { state: 'completed'; result: OAuthResult }
      > => {
        // The ingest path returns 202 Accepted while still pending. The
        // shared response interceptor unwraps `{ success, data }`, so a
        // `state: 'pending'` body comes through cleanly. We don't need
        // axios to treat 202 as an error — its default `validateStatus`
        // already accepts 2xx.
        return apiClient.get(`/oauth/bookmarklet/poll/${encodeURIComponent(ticket)}`)
      },
      cancel: (ticket: string): Promise<{ cancelled: boolean }> =>
        apiClient.delete(`/oauth/bookmarklet/${encodeURIComponent(ticket)}`),
    },

    // Stubs for unsupported methods
    startInAppLogin: async (): Promise<OAuthResult> => { throw new Error('Not supported in web version') },
    cancelInAppLogin: async (): Promise<void> => {},
    isInAppLoginOpen: async (): Promise<boolean> => false,
  },

  // App Logs
  logs: {
    get: (filter?: any): Promise<LogEntry[]> => apiClient.get('/logs/app', { params: filter }),
    getStats: () => apiClient.get('/logs/app/stats'),
    getTrend: (days?: number) => apiClient.get('/logs/app/trend', { params: { days } }),
    getAccountTrend: (accountId: string, days?: number) => apiClient.get(`/logs/app/trend/${accountId}`, { params: { days } }),
    clear: (): Promise<void> => apiClient.post('/logs/app/clear'),
    export: (format?: string): Promise<string> => apiClient.get('/logs/app/export', { params: { format } }),
    getById: (id: string): Promise<LogEntry> => apiClient.get(`/logs/app/${id}`),
  },

  // Request Logs
  requestLogs: {
    get: (filter?: any): Promise<RequestLogEntry[]> => apiClient.get('/logs/request', { params: filter }),
    getById: (id: string): Promise<RequestLogEntry> => apiClient.get(`/logs/request/${id}`),
    getStats: () => apiClient.get('/logs/request/stats'),
    getTrend: (days?: number) => apiClient.get('/logs/request/trend', { params: { days } }),
    clear: (): Promise<void> => apiClient.post('/logs/request/clear'),
  },

  // Statistics
  statistics: {
    get: (): Promise<PersistentStatistics> => apiClient.get('/statistics'),
    getToday: (): Promise<DailyStatistics> => apiClient.get('/statistics/today'),
  },

  // System Prompts
  prompts: {
    getAll: (): Promise<SystemPrompt[]> => apiClient.get('/prompts'),
    getBuiltin: (): Promise<SystemPrompt[]> => apiClient.get('/prompts/builtin'),
    getCustom: (): Promise<SystemPrompt[]> => apiClient.get('/prompts/custom'),
    getById: (id: string): Promise<SystemPrompt> => apiClient.get(`/prompts/${id}`),
    add: (prompt: any): Promise<SystemPrompt> => apiClient.post('/prompts', prompt),
    update: (id: string, updates: any): Promise<SystemPrompt> => apiClient.put(`/prompts/${id}`, updates),
    delete: (id: string): Promise<void> => apiClient.delete(`/prompts/${id}`),
    getByType: (type: string): Promise<SystemPrompt[]> => apiClient.get('/prompts', { params: { type } }),
  },

  // Sessions
  sessions: {
    getConfig: (): Promise<SessionConfig> => apiClient.get('/sessions/config'),
    updateConfig: (updates: Partial<SessionConfig>): Promise<SessionConfig> => apiClient.put('/sessions/config', updates),
    getAll: (): Promise<SessionRecord[]> => apiClient.get('/sessions'),
    getActive: (): Promise<SessionRecord[]> => apiClient.get('/sessions/active'),
    getById: (id: string): Promise<SessionRecord> => apiClient.get(`/sessions/${id}`),
    getByAccount: (accountId: string): Promise<SessionRecord[]> => apiClient.get(`/sessions/account/${accountId}`),
    getByProvider: (providerId: string): Promise<SessionRecord[]> => apiClient.get(`/sessions/provider/${providerId}`),
    delete: (id: string): Promise<void> => apiClient.delete(`/sessions/${id}`),
    clearAll: (): Promise<void> => apiClient.post('/sessions/clear_all'),
    cleanExpired: (): Promise<number> => apiClient.post('/sessions/clean_expired'),
  },

  // App Meta (Stubs)
  app: {
    getVersion: (): Promise<{version: string}> => apiClient.get('/app/version'),
    checkUpdate: async () => ({ hasUpdate: false }),
    downloadUpdate: async () => {},
    installUpdate: async () => {},
    getUpdateStatus: async () => ({ status: 'idle' }),
    minimize: async () => {},
    maximize: async () => {},
    close: async () => {},
    showWindow: async () => {},
    hideWindow: async () => {},
    openExternal: async (url: string) => { window.open(url, '_blank') },
  },

  // Management API (Auth)
  managementApi: {
    getConfig: () => apiClient.get('/config').then(res => (res as any).managementApi),
    updateConfig: (updates: any) => apiClient.put('/config', { managementApi: updates }).then(res => (res as any).managementApi),
    generateSecret: async () => {
      // In web version, we can't just generate and get the secret directly without auth
      // So this should ideally be handled via a logged-in config update
      throw new Error('Not supported directly from frontend without auth')
    }
  },

  // Context Management
  contextManagement: {
    getConfig: () => apiClient.get('/config').then(res => (res as any).contextManagement),
    updateConfig: (updates: any) => apiClient.put('/config', { contextManagement: updates }).then(res => (res as any).contextManagement),
  }
}
