/**
 * In-App Login Manager
 * DEPRECATED: In a pure web environment, we cannot spawn Electron BrowserWindows.
 * This file is kept as a stub so other code compiles, but its functionality
 * is disabled. The actual OAuth login must be handled via redirects in the frontend.
 */

import { EventEmitter } from 'events'
import { ProviderType } from './types'

export interface InAppLoginResult {
  success: boolean
  credentials?: Record<string, string>
  error?: string
}

export interface TokenFoundEvent {
  key: string
  value: string
}

export interface InAppLoginOptions {
  providerId: string
  providerType: ProviderType
  timeout?: number
  proxyMode?: 'system' | 'none'
}

export class InAppLoginManager extends EventEmitter {
  constructor() {
    super()
  }

  async startLogin(options: InAppLoginOptions): Promise<InAppLoginResult> {
    return {
      success: false,
      error: 'In-app login is not supported in the web version. Please use standard browser login.',
    }
  }

  completeWithSuccess(credentials: Record<string, string>): void {
    this.emit('complete', { success: true, credentials })
  }

  cancel(): void {
    this.emit('complete', { success: false, error: 'Cancelled' })
  }

  isWindowOpen(): boolean {
    return false
  }

  destroy(): void {
    this.removeAllListeners()
  }
}

export const inAppLoginManager = new InAppLoginManager()
export default InAppLoginManager
