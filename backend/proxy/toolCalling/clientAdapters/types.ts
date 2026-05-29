import type { ChatCompletionRequest } from '../../types'
import type { NormalizedToolDefinition } from '../types'
import type { ToolClientAdapterId } from '../../../shared/toolCalling'

export interface NormalizedToolChoice {
  mode: 'auto' | 'none' | 'required' | 'forced'
  forcedName?: string
}

export interface NormalizedClientToolRequest {
  clientAdapterId: string
  toolSource: 'openai' | 'mcp' | 'none'
  tools: NormalizedToolDefinition[]
  toolChoice: NormalizedToolChoice
  diagnostics: {
    requestedClientAdapterId?: string
    fallbackClientAdapterId?: string
    detectedClientType?: string
    rawToolCount: number
    normalizedToolNames: string[]
  }
}

export interface ToolClientAdapter {
  id: ToolClientAdapterId
  displayName: string
  normalizeRequest(request: ChatCompletionRequest): NormalizedClientToolRequest
}
