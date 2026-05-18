import Router from '@koa/router'
import type { Context } from 'koa'
import { managementAuthMiddleware } from '../../middleware/managementAuth'
import { storeManager } from '../../../store/store'

const router = new Router({ prefix: '/v0/management/logs' })

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

// ================= App Logs =================

router.get('/app', async (ctx: Context) => {
  try {
    const filter = ctx.query
    const logs = storeManager.getLogs(filter as any)
    ctx.body = createSuccessResponse(logs)
  } catch (error) {
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', error instanceof Error ? error.message : 'Unknown error')
  }
})

router.get('/app/stats', async (ctx: Context) => {
  try {
    const stats = storeManager.getLogStats()
    ctx.body = createSuccessResponse(stats)
  } catch (error) {
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', error instanceof Error ? error.message : 'Unknown error')
  }
})

router.get('/app/trend', async (ctx: Context) => {
  try {
    const days = ctx.query.days ? parseInt(ctx.query.days as string, 10) : 7
    const trend = storeManager.getLogTrend(days)
    ctx.body = createSuccessResponse(trend)
  } catch (error) {
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', error instanceof Error ? error.message : 'Unknown error')
  }
})

router.get('/app/trend/:accountId', async (ctx: Context) => {
  try {
    const accountId = ctx.params.accountId
    const days = ctx.query.days ? parseInt(ctx.query.days as string, 10) : 7
    const trend = storeManager.getAccountLogTrend(accountId, days)
    ctx.body = createSuccessResponse(trend)
  } catch (error) {
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', error instanceof Error ? error.message : 'Unknown error')
  }
})

router.post('/app/clear', async (ctx: Context) => {
  try {
    storeManager.clearLogs()
    ctx.body = createSuccessResponse({ success: true })
  } catch (error) {
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', error instanceof Error ? error.message : 'Unknown error')
  }
})

// ================= Request Logs =================

router.get('/request', async (ctx: Context) => {
  try {
    const limit = ctx.query.limit ? parseInt(ctx.query.limit as string, 10) : undefined
    const status = ctx.query.status as 'success' | 'error' | undefined
    const providerId = ctx.query.providerId as string | undefined
    
    const filter = { status, providerId, limit }
    const logs = storeManager.getRequestLogs(limit, filter)
    ctx.body = createSuccessResponse(logs)
  } catch (error) {
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', error instanceof Error ? error.message : 'Unknown error')
  }
})

router.get('/request/stats', async (ctx: Context) => {
  try {
    const stats = storeManager.getRequestLogStats()
    ctx.body = createSuccessResponse(stats)
  } catch (error) {
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', error instanceof Error ? error.message : 'Unknown error')
  }
})

router.get('/request/trend', async (ctx: Context) => {
  try {
    const days = ctx.query.days ? parseInt(ctx.query.days as string, 10) : 7
    const trend = storeManager.getRequestLogTrend(days)
    ctx.body = createSuccessResponse(trend)
  } catch (error) {
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', error instanceof Error ? error.message : 'Unknown error')
  }
})

router.post('/request/clear', async (ctx: Context) => {
  try {
    storeManager.clearRequestLogs()
    ctx.body = createSuccessResponse({ success: true })
  } catch (error) {
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', error instanceof Error ? error.message : 'Unknown error')
  }
})

export default router
