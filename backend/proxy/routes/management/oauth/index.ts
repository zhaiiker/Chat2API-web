import Router from '@koa/router'
import type { Context } from 'koa'
import { managementAuthMiddleware } from '../../../middleware/managementAuth'
import { oauthManager } from '../../../../oauth/manager'
import type { ProviderVendor } from '../../../../shared/types'
import { AccountManager } from '../../../../store/accounts'

const router = new Router({ prefix: '/v0/management/oauth' })

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

router.post('/start_login', async (ctx: Context) => {
  try {
    const { providerId, providerType } = ctx.request.body as any
    if (!providerId || !providerType) {
      ctx.status = 400
      ctx.body = createErrorResponse('invalid_request', 'Missing providerId or providerType')
      return
    }

    const result = await oauthManager.startLogin({
      providerId,
      providerType,
    })

    ctx.body = createSuccessResponse(result)
  } catch (error) {
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', error instanceof Error ? error.message : 'Unknown error')
  }
})

router.post('/cancel_login', async (ctx: Context) => {
  try {
    await oauthManager.cancelLogin()
    ctx.body = createSuccessResponse({ success: true })
  } catch (error) {
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', error instanceof Error ? error.message : 'Unknown error')
  }
})

router.post('/login_with_token', async (ctx: Context) => {
  try {
    const { providerId, providerType, token, realUserID, mimoUserId, mimoPhToken } = ctx.request.body as any
    if (!providerId || !providerType || !token) {
      ctx.status = 400
      ctx.body = createErrorResponse('invalid_request', 'Missing required fields')
      return
    }

    const result = await oauthManager.loginWithToken(
      providerId,
      providerType,
      token,
      realUserID,
      mimoUserId,
      mimoPhToken
    )

    ctx.body = createSuccessResponse(result)
  } catch (error) {
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', error instanceof Error ? error.message : 'Unknown error')
  }
})

router.post('/validate_token', async (ctx: Context) => {
  try {
    const { providerId, providerType, credentials } = ctx.request.body as any
    if (!providerId || !providerType || !credentials) {
      ctx.status = 400
      ctx.body = createErrorResponse('invalid_request', 'Missing required fields')
      return
    }

    const result = await oauthManager.validateToken(providerId, providerType, credentials)
    ctx.body = createSuccessResponse(result)
  } catch (error) {
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', error instanceof Error ? error.message : 'Unknown error')
  }
})

router.post('/refresh_token', async (ctx: Context) => {
  try {
    const { providerId, providerType, credentials } = ctx.request.body as any
    if (!providerId || !providerType || !credentials) {
      ctx.status = 400
      ctx.body = createErrorResponse('invalid_request', 'Missing required fields')
      return
    }

    const result = await oauthManager.refreshToken(providerId, providerType, credentials)
    ctx.body = createSuccessResponse(result)
  } catch (error) {
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', error instanceof Error ? error.message : 'Unknown error')
  }
})

router.get('/status', async (ctx: Context) => {
  try {
    const status = oauthManager.getStatus()
    ctx.body = createSuccessResponse({ status })
  } catch (error) {
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', error instanceof Error ? error.message : 'Unknown error')
  }
})

export default router
