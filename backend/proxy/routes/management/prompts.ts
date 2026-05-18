import Router from '@koa/router'
import type { Context } from 'koa'
import { managementAuthMiddleware } from '../../middleware/managementAuth'
import { storeManager } from '../../../store/store'

const router = new Router({ prefix: '/v0/management/prompts' })

router.use(managementAuthMiddleware)

function createErrorResponse(code: string, message: string) {
  return {
    success: false,
    error: {
      code,
      message,
    },
  }
}

function createSuccessResponse<T>(data: T) {
  return {
    success: true,
    data,
  }
}

router.get('/', async (ctx: Context) => {
  try {
    const prompts = storeManager.getSystemPrompts()
    ctx.body = createSuccessResponse(prompts)
  } catch (error) {
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', error instanceof Error ? error.message : 'Unknown error')
  }
})

router.get('/builtin', async (ctx: Context) => {
  try {
    const prompts = storeManager.getBuiltinPrompts()
    ctx.body = createSuccessResponse(prompts)
  } catch (error) {
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', error instanceof Error ? error.message : 'Unknown error')
  }
})

router.get('/custom', async (ctx: Context) => {
  try {
    const prompts = storeManager.getCustomPrompts()
    ctx.body = createSuccessResponse(prompts)
  } catch (error) {
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', error instanceof Error ? error.message : 'Unknown error')
  }
})

router.get('/:id', async (ctx: Context) => {
  try {
    const prompt = storeManager.getSystemPromptById(ctx.params.id)
    if (!prompt) {
      ctx.status = 404
      ctx.body = createErrorResponse('not_found', 'System prompt not found')
      return
    }
    ctx.body = createSuccessResponse(prompt)
  } catch (error) {
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', error instanceof Error ? error.message : 'Unknown error')
  }
})

router.post('/', async (ctx: Context) => {
  try {
    const data = ctx.request.body as any
    if (!data.name || !data.content || !data.type) {
      ctx.status = 400
      ctx.body = createErrorResponse('invalid_request', 'Missing required fields')
      return
    }
    const prompt = storeManager.addSystemPrompt(data)
    ctx.body = createSuccessResponse(prompt)
  } catch (error) {
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', error instanceof Error ? error.message : 'Unknown error')
  }
})

router.put('/:id', async (ctx: Context) => {
  try {
    const data = ctx.request.body as any
    const prompt = storeManager.updateSystemPrompt(ctx.params.id, data)
    if (!prompt) {
      ctx.status = 404
      ctx.body = createErrorResponse('not_found', 'System prompt not found or cannot be modified')
      return
    }
    ctx.body = createSuccessResponse(prompt)
  } catch (error) {
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', error instanceof Error ? error.message : 'Unknown error')
  }
})

router.delete('/:id', async (ctx: Context) => {
  try {
    const success = storeManager.deleteSystemPrompt(ctx.params.id)
    if (!success) {
      ctx.status = 404
      ctx.body = createErrorResponse('not_found', 'System prompt not found or cannot be deleted')
      return
    }
    ctx.body = createSuccessResponse({ success: true })
  } catch (error) {
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', error instanceof Error ? error.message : 'Unknown error')
  }
})

export default router
