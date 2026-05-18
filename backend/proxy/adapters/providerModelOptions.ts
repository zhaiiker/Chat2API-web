export interface DeepSeekChatOptionInput {
  model: string
  web_search?: boolean
  reasoning_effort?: string
}

export interface DeepSeekChatOptions {
  modelType: 'default' | 'expert'
  searchEnabled: boolean
  thinkingEnabled: boolean
}

export function resolveDeepSeekChatOptions(
  request: DeepSeekChatOptionInput,
  prompt: string = ''
): DeepSeekChatOptions {
  const modelLower = request.model.toLowerCase()
  const searchEnabled = Boolean(request.web_search) || modelLower.includes('search')
  const thinkingEnabled = Boolean(request.reasoning_effort)
    || modelLower.includes('r1')
    || modelLower.includes('think')
    || modelLower.includes('reasoner')
    || prompt.includes('deep thinking')

  return {
    modelType: modelLower.includes('pro') || modelLower.includes('expert') ? 'expert' : 'default',
    searchEnabled,
    thinkingEnabled,
  }
}

export type KimiScenario = 'SCENARIO_K2D5' | 'SCENARIO_K2D6'

export function resolveKimiScenario(model: string): KimiScenario {
  return model.toLowerCase().includes('k2.6') ? 'SCENARIO_K2D6' : 'SCENARIO_K2D5'
}

export function createKimiChatPayload(options: {
  model: string
  content: string
  enableWebSearch: boolean
  enableThinking: boolean
}) {
  const scenario = resolveKimiScenario(options.model)

  return {
    scenario,
    chat_id: '',
    tools: options.enableWebSearch ? [{ type: 'TOOL_TYPE_SEARCH', search: {} }] : [],
    message: {
      parent_id: '',
      role: 'user',
      blocks: [{
        message_id: '',
        text: { content: options.content }
      }],
      scenario,
    },
    options: {
      thinking: options.enableThinking
    }
  }
}

export function encodeKimiGrpcFrame(payload: unknown): Buffer {
  const jsonBuffer = Buffer.from(JSON.stringify(payload), 'utf8')
  const frameBuffer = Buffer.alloc(5 + jsonBuffer.length)
  frameBuffer.writeUInt8(0, 0)
  frameBuffer.writeUInt32BE(jsonBuffer.length, 1)
  jsonBuffer.copy(frameBuffer, 5)
  return frameBuffer
}
