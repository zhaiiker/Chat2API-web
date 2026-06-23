/**
 * Claude Messages API Converter
 * Converts between Claude Messages API format and OpenAI Chat Completions format
 */

import { ChatCompletionRequest, ChatMessage, ChatCompletionTool } from '../types'
import { cleanToolMarkers } from './cleanToolMarkers'

/**
 * Claude Messages API Request Format
 */
export interface ClaudeMessagesRequest {
  model: string
  messages: ClaudeMessage[]
  max_tokens: number
  system?: string | ClaudeContentBlock[]
  temperature?: number
  top_p?: number
  top_k?: number
  stop_sequences?: string[]
  stream?: boolean
  tools?: ClaudeTool[]
  tool_choice?: ClaudeToolChoice
  metadata?: {
    user_id?: string
  }
}

/**
 * Claude Message Format
 */
export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string | ClaudeContentBlock[]
}

/**
 * Claude Content Block
 */
export type ClaudeContentBlock = 
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64' | 'url'; media_type: string; data?: string; url?: string } }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, any> }
  | { type: 'tool_result'; tool_use_id: string; content: string | ClaudeContentBlock[] }

/**
 * Claude Tool Definition
 */
export interface ClaudeTool {
  name: string
  description?: string
  input_schema: {
    type: 'object'
    properties: Record<string, any>
    required?: string[]
  }
}

/**
 * Claude Tool Choice
 */
export type ClaudeToolChoice = 
  | { type: 'auto' }
  | { type: 'any' }
  | { type: 'tool'; name: string }

/**
 * Claude Messages API Response Format
 */
export interface ClaudeMessagesResponse {
  id: string
  type: 'message'
  role: 'assistant'
  content: ClaudeContentBlock[]
  model: string
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null
  stop_sequence?: string | null
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

/**
 * Convert Claude Messages request to OpenAI Chat Completions request
 */
export function claudeRequestToOpenAI(claudeRequest: ClaudeMessagesRequest): ChatCompletionRequest {
  const messages: ChatMessage[] = []

  // Handle system message
  if (claudeRequest.system) {
    let systemContent: string
    if (typeof claudeRequest.system === 'string') {
      systemContent = claudeRequest.system
    } else {
      systemContent = claudeRequest.system
        .filter(block => block.type === 'text')
        .map(block => (block as { type: 'text'; text: string }).text)
        .join('\n')
    }
    messages.push({
      role: 'system',
      content: systemContent,
    })
  }

  // Convert messages
  for (const msg of claudeRequest.messages) {
    if (typeof msg.content === 'string') {
      messages.push({
        role: msg.role,
        content: msg.content,
      })
    } else {
      // Handle content blocks
      const textBlocks = msg.content.filter(block => block.type === 'text')
      const imageBlocks = msg.content.filter(block => block.type === 'image')
      const toolUseBlocks = msg.content.filter(block => block.type === 'tool_use')
      const toolResultBlocks = msg.content.filter(block => block.type === 'tool_result')

      // Convert to OpenAI format
      if (textBlocks.length > 0 || imageBlocks.length > 0) {
        const content: any[] = []

        // Add text blocks
        for (const block of textBlocks) {
          content.push({
            type: 'text',
            text: (block as any).text,
          })
        }

        // Add image blocks
        for (const block of imageBlocks) {
          const imageBlock = block as any
          const imageUrl = imageBlock.source.type === 'url' 
            ? imageBlock.source.url
            : `data:${imageBlock.source.media_type};base64,${imageBlock.source.data}`
          
          content.push({
            type: 'image_url',
            image_url: {
              url: imageUrl,
            },
          })
        }

        messages.push({
          role: msg.role,
          content: content.length === 1 && content[0].type === 'text' ? content[0].text : content,
        })
      }

      // Handle tool use (assistant message with tool calls)
      if (toolUseBlocks.length > 0) {
        const textContent = textBlocks.map(b => (b as any).text).join('\n') || null
        messages.push({
          role: 'assistant',
          content: textContent,
          tool_calls: toolUseBlocks.map((block, index) => {
            const toolBlock = block as any
            return {
              id: toolBlock.id,
              type: 'function' as const,
              function: {
                name: toolBlock.name,
                arguments: JSON.stringify(toolBlock.input),
              },
            }
          }),
        })
      }

      // Handle tool results
      for (const block of toolResultBlocks) {
        const toolResult = block as any
        let resultContent: string
        
        if (typeof toolResult.content === 'string') {
          resultContent = toolResult.content
        } else {
          resultContent = toolResult.content
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
            .join('\n')
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolResult.tool_use_id,
          content: resultContent,
        })
      }
    }
  }

  // Convert tools
  let tools: ChatCompletionTool[] | undefined
  if (claudeRequest.tools && claudeRequest.tools.length > 0) {
    tools = claudeRequest.tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }))
  }

  // Convert tool_choice
  let tool_choice: any = undefined
  if (claudeRequest.tool_choice) {
    if (claudeRequest.tool_choice.type === 'auto') {
      tool_choice = 'auto'
    } else if (claudeRequest.tool_choice.type === 'any') {
      tool_choice = 'required'
    } else if (claudeRequest.tool_choice.type === 'tool') {
      tool_choice = {
        type: 'function',
        function: { name: claudeRequest.tool_choice.name },
      }
    }
  }

  return {
    model: claudeRequest.model,
    messages,
    max_tokens: claudeRequest.max_tokens,
    temperature: claudeRequest.temperature,
    top_p: claudeRequest.top_p,
    stop: claudeRequest.stop_sequences,
    stream: claudeRequest.stream,
    tools,
    tool_choice,
  }
}

/**
 * Convert OpenAI Chat Completions response to Claude Messages response
 * Handles various response formats from different providers
 */
export function openAIResponseToClaude(
  openAIResponse: any,
  requestId: string
): ClaudeMessagesResponse {
  // Handle null or undefined response
  if (!openAIResponse) {
    throw new Error('Invalid response: response is null or undefined')
  }

  // Extract choices array - handle various formats
  let choices = openAIResponse.choices
  
  // Some providers might wrap response differently
  if (!choices && openAIResponse.data?.choices) {
    choices = openAIResponse.data.choices
  }
  
  if (!choices || !Array.isArray(choices) || choices.length === 0) {
    throw new Error('Invalid OpenAI response: no choices array found')
  }

  const choice = choices[0]
  if (!choice) {
    throw new Error('Invalid OpenAI response: empty choice')
  }

  // Extract message - handle various formats
  let message = choice.message
  if (!message && choice.delta) {
    // Some streaming responses might only have delta
    message = choice.delta
  }
  if (!message) {
    // Fallback: create empty message
    message = { role: 'assistant', content: '' }
  }

  const content: ClaudeContentBlock[] = []

  // Add text content - handle various content formats
  if (message.content) {
    // Content might be string or array
    if (typeof message.content === 'string') {
      // Clean tool markers from the content
      const cleanedText = cleanToolMarkers(message.content)
      if (cleanedText) {
        content.push({
          type: 'text',
          text: cleanedText,
        })
      }
    } else if (Array.isArray(message.content)) {
      // Handle content array (multimodal format)
      for (const item of message.content) {
        if (item.type === 'text' && item.text) {
          const cleanedText = cleanToolMarkers(item.text)
          if (cleanedText) {
            content.push({
              type: 'text',
              text: cleanedText,
            })
          }
        }
      }
    }
  }

  // Add tool calls
  if (message.tool_calls && Array.isArray(message.tool_calls)) {
    for (const toolCall of message.tool_calls) {
      try {
        // Parse arguments - might be string or object
        let input: Record<string, any>
        if (typeof toolCall.function.arguments === 'string') {
          input = JSON.parse(toolCall.function.arguments)
        } else {
          input = toolCall.function.arguments || {}
        }

        content.push({
          type: 'tool_use',
          id: toolCall.id || `call_${Date.now()}`,
          name: toolCall.function.name,
          input,
        })
      } catch (e) {
        console.warn('[Claude Converter] Failed to parse tool call:', e)
        // Skip malformed tool calls
      }
    }
  }

  // If no content at all, add empty text block
  if (content.length === 0) {
    content.push({
      type: 'text',
      text: '',
    })
  }

  // Map finish reason - handle various formats
  let stopReason: ClaudeMessagesResponse['stop_reason'] = 'end_turn'
  const finishReason = choice.finish_reason || choice.stop_reason
  
  if (finishReason === 'length' || finishReason === 'max_tokens') {
    stopReason = 'max_tokens'
  } else if (finishReason === 'stop' || finishReason === 'end_turn') {
    stopReason = 'end_turn'
  } else if (finishReason === 'tool_calls' || finishReason === 'tool_use') {
    stopReason = 'tool_use'
  } else if (finishReason === 'stop_sequence') {
    stopReason = 'stop_sequence'
  }

  // Extract usage - handle various formats
  let inputTokens = 0
  let outputTokens = 0
  
  if (openAIResponse.usage) {
    inputTokens = openAIResponse.usage.prompt_tokens || 
                  openAIResponse.usage.input_tokens || 0
    outputTokens = openAIResponse.usage.completion_tokens || 
                   openAIResponse.usage.output_tokens || 0
  }

  // Extract model name - handle various formats
  let model = openAIResponse.model || 'unknown'
  if (!model || model === 'unknown') {
    model = requestId.split('-')[0] // Fallback to request id prefix
  }

  return {
    id: requestId.replace('chatcmpl-', 'msg_'),
    type: 'message',
    role: 'assistant',
    content,
    model,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    },
  }
}

/**
 * Convert OpenAI streaming chunk to Claude streaming format
 */
export function openAIStreamChunkToClaude(chunk: any, isFirst: boolean): string {
  const choice = chunk.choices?.[0]
  if (!choice) {
    return ''
  }

  const events: string[] = []

  // First chunk: send message_start event
  if (isFirst) {
    events.push('event: message_start')
    events.push(`data: ${JSON.stringify({
      type: 'message_start',
      message: {
        id: chunk.id.replace('chatcmpl-', 'msg_'),
        type: 'message',
        role: 'assistant',
        content: [],
        model: chunk.model,
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: 0 },
      },
    })}`)
    events.push('')

    events.push('event: content_block_start')
    events.push(`data: ${JSON.stringify({
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'text', text: '' },
    })}`)
    events.push('')
  }

  const delta = choice.delta

  // Handle content delta
  if (delta.content) {
    // Clean tool markers from streaming content
    const cleanedContent = cleanToolMarkers(delta.content)
    if (cleanedContent) {
      events.push('event: content_block_delta')
      events.push(`data: ${JSON.stringify({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: cleanedContent },
      })}`)
      events.push('')
    }
  }

  // Handle tool calls
  if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
    for (const toolCall of delta.tool_calls) {
      if (toolCall.function?.name) {
        events.push('event: content_block_start')
        events.push(`data: ${JSON.stringify({
          type: 'content_block_start',
          index: 1,
          content_block: {
            type: 'tool_use',
            id: toolCall.id,
            name: toolCall.function.name,
            input: {},
          },
        })}`)
        events.push('')
      }

      if (toolCall.function?.arguments) {
        events.push('event: content_block_delta')
        events.push(`data: ${JSON.stringify({
          type: 'content_block_delta',
          index: 1,
          delta: {
            type: 'input_json_delta',
            partial_json: toolCall.function.arguments,
          },
        })}`)
        events.push('')
      }
    }
  }

  // Handle finish
  if (choice.finish_reason) {
    events.push('event: content_block_stop')
    events.push(`data: ${JSON.stringify({
      type: 'content_block_stop',
      index: 0,
    })}`)
    events.push('')

    let stopReason: ClaudeMessagesResponse['stop_reason'] = 'end_turn'
    if (choice.finish_reason === 'length') {
      stopReason = 'max_tokens'
    } else if (choice.finish_reason === 'tool_calls') {
      stopReason = 'tool_use'
    }

    events.push('event: message_delta')
    events.push(`data: ${JSON.stringify({
      type: 'message_delta',
      delta: { stop_reason: stopReason, stop_sequence: null },
      usage: { output_tokens: 0 },
    })}`)
    events.push('')

    events.push('event: message_stop')
    events.push(`data: ${JSON.stringify({ type: 'message_stop' })}`)
    events.push('')
  }

  return events.join('\n')
}
