/**
 * Proxy Service Module - Claude Messages API Route
 * Implements /v1/messages route (Claude Messages API compatible)
 */

import Router from '@koa/router'
import type { Context } from 'koa'
import { Transform } from 'stream'
import { loadBalancer } from '../loadbalancer'
import { requestForwarder } from '../forwarder'
import { proxyStatusManager } from '../status'
import { modelMapper } from '../modelMapper'
import { storeManager } from '../../store/store'
import {
  claudeRequestToOpenAI,
  openAIResponseToClaude,
  openAIStreamChunkToClaude,
  type ClaudeMessagesRequest,
} from '../utils/claudeConverter'
import { normalizeChatRoles } from '../utils/messageContent'

const router = new Router({ prefix: '/v1' })

/**
 * Generate Request ID
 */
function generateRequestId(): string {
  return `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Get Client IP
 */
function getClientIP(ctx: Context): string {
  return ctx.headers['x-real-ip'] as string ||
    ctx.headers['x-forwarded-for'] as string ||
    ctx.ip ||
    'unknown'
}

/**
 * Handle Claude Messages API Request
 */
router.post('/messages', async (ctx: Context) => {
  const startTime = Date.now()
  const requestId = generateRequestId()
  const clientIP = getClientIP(ctx)

  let claudeRequest: ClaudeMessagesRequest
  try {
    claudeRequest = ctx.request.body as ClaudeMessagesRequest
  } catch (error) {
    ctx.status = 400
    ctx.body = {
      type: 'error',
      error: {
        type: 'invalid_request_error',
        message: 'Invalid request body',
      },
    }
    return
  }

  // Validate required fields
  if (!claudeRequest.model) {
    ctx.status = 400
    ctx.body = {
      type: 'error',
      error: {
        type: 'invalid_request_error',
        message: 'Missing required field: model',
      },
    }
    return
  }

  if (!claudeRequest.messages || !Array.isArray(claudeRequest.messages) || claudeRequest.messages.length === 0) {
    ctx.status = 400
    ctx.body = {
      type: 'error',
      error: {
        type: 'invalid_request_error',
        message: 'Missing required field: messages',
      },
    }
    return
  }

  if (!claudeRequest.max_tokens) {
    ctx.status = 400
    ctx.body = {
      type: 'error',
      error: {
        type: 'invalid_request_error',
        message: 'Missing required field: max_tokens',
      },
    }
    return
  }

  // Convert Claude request to OpenAI format
  let openAIRequest
  try {
    openAIRequest = claudeRequestToOpenAI(claudeRequest)
  } catch (error) {
    ctx.status = 400
    ctx.body = {
      type: 'error',
      error: {
        type: 'invalid_request_error',
        message: error instanceof Error ? error.message : 'Failed to convert request format',
      },
    }
    return
  }

  // Normalize chat roles
  openAIRequest.messages = normalizeChatRoles(openAIRequest.messages) as typeof openAIRequest.messages

  const config = storeManager.getConfig()
  const preferredProviderId = modelMapper.getPreferredProvider(claudeRequest.model)
  const preferredAccountId = modelMapper.getPreferredAccount(claudeRequest.model)

  // Select account using load balancer
  const selection = loadBalancer.selectAccount(
    claudeRequest.model,
    config.loadBalanceStrategy,
    preferredProviderId,
    preferredAccountId
  )

  if (!selection) {
    ctx.status = 529
    ctx.body = {
      type: 'error',
      error: {
        type: 'overloaded_error',
        message: `No available account for model: ${claudeRequest.model}`,
      },
    }
    return
  }

  const { account, provider, actualModel } = selection

  proxyStatusManager.recordRequestStart(claudeRequest.model, provider.id, account.id)

  try {
    const result = await requestForwarder.forwardChatCompletion(
      openAIRequest,
      account,
      provider,
      actualModel,
      {
        requestId,
        providerId: provider.id,
        accountId: account.id,
        model: claudeRequest.model,
        actualModel,
        startTime,
        isStream: claudeRequest.stream || false,
      }
    )

    const latency = Date.now() - startTime

    if (!result.success) {
      proxyStatusManager.recordRequestFailure(latency)

      // Map error to Claude format
      const statusCode = result.status || 500
      let errorType = 'api_error'
      
      if (statusCode === 400) {
        errorType = 'invalid_request_error'
      } else if (statusCode === 401) {
        errorType = 'authentication_error'
      } else if (statusCode === 403) {
        errorType = 'permission_error'
      } else if (statusCode === 404) {
        errorType = 'not_found_error'
      } else if (statusCode === 429) {
        errorType = 'rate_limit_error'
      } else if (statusCode >= 500) {
        errorType = 'api_error'
      }

      ctx.status = statusCode
      ctx.body = {
        type: 'error',
        error: {
          type: errorType,
          message: result.error || 'Request failed',
        },
      }
      return
    }

    proxyStatusManager.recordRequestSuccess(latency)

    storeManager.updateAccount(account.id, {
      lastUsed: Date.now(),
      requestCount: (account.requestCount || 0) + 1,
      todayUsed: (account.todayUsed || 0) + 1,
    })

    storeManager.addLog('debug', `Claude Messages API request succeeded`, {
      requestId,
      providerId: provider.id,
      accountId: account.id,
      model: claudeRequest.model,
      actualModel,
      latency,
      isStream: claudeRequest.stream,
    })

    // Handle streaming response
    if (claudeRequest.stream && result.stream) {
      ctx.set('Content-Type', 'text/event-stream')
      ctx.set('Cache-Control', 'no-cache')
      ctx.set('Connection', 'keep-alive')
      ctx.set('X-Accel-Buffering', 'no')

      // Transform OpenAI SSE stream to Claude SSE format
      let isFirstChunk = true
      const claudeStream = new Transform({
        transform(chunk: Buffer, encoding, callback) {
          try {
            const text = chunk.toString()
            const lines = text.split('\n').filter(line => line.trim())

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') {
                  // OpenAI stream end marker - skip it
                  continue
                }

                try {
                  const parsed = JSON.parse(data)
                  
                  // Check if this is the first chunk with role
                  const isFirst = isFirstChunk && parsed.choices?.[0]?.delta?.role === 'assistant'
                  if (isFirst) {
                    isFirstChunk = false
                  }

                  const claudeEvent = openAIStreamChunkToClaude(parsed, isFirst)
                  if (claudeEvent) {
                    this.push(claudeEvent)
                  }
                } catch (e) {
                  // Skip invalid JSON
                  console.warn('[Messages] Failed to parse SSE chunk:', e)
                }
              }
            }

            callback()
          } catch (error) {
            callback(error as Error)
          }
        },
      })

      result.stream.pipe(claudeStream)
      ctx.body = claudeStream

      claudeStream.on('error', (error) => {
        console.error('[Messages] Stream error:', error)
        storeManager.addLog('error', `Stream error: ${error.message}`, {
          requestId,
          providerId: provider.id,
          accountId: account.id,
        })
      })

      return
    }

    // Handle non-streaming response
    try {
      const claudeResponse = openAIResponseToClaude(result.body, requestId)
      ctx.set('Content-Type', 'application/json')
      ctx.body = claudeResponse
    } catch (error) {
      console.error('[Messages] Response conversion error:', error)
      ctx.status = 500
      ctx.body = {
        type: 'error',
        error: {
          type: 'api_error',
          message: 'Failed to convert response format',
        },
      }
    }
  } catch (error) {
    const latency = Date.now() - startTime
    proxyStatusManager.recordRequestFailure(latency)

    console.error('[Messages] Request error:', error)
    
    ctx.status = 500
    ctx.body = {
      type: 'error',
      error: {
        type: 'api_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }
  }
})

export default router
