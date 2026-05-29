import Router from '@koa/router'
import type { Context } from 'koa'
import { managementAuthMiddleware } from '../../middleware/managementAuth'

// Assume version from package.json
import * as fs from 'fs'
import * as path from 'path'

const router = new Router({ prefix: '/v0/management/app' })

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

router.get('/version', async (ctx: Context) => {
  try {
    const pkgPath = path.resolve(process.cwd(), 'package.json')
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
      ctx.body = createSuccessResponse({ version: pkg.version })
    } else {
      ctx.body = createSuccessResponse({ version: '1.0.0' })
    }
  } catch (error) {
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', error instanceof Error ? error.message : 'Unknown error')
  }
})

// Web interface doesn't support these electron features, stub them for frontend compatibility
router.post('/check_update', async (ctx: Context) => {
  ctx.body = createSuccessResponse({
    hasUpdate: false,
    currentVersion: '1.0.0',
    latestVersion: '1.0.0',
    error: 'Update check is not supported in the web version.',
  })
})

router.post('/download_update', async (ctx: Context) => {
  ctx.body = createSuccessResponse({ success: false, error: 'Not supported' })
})

router.post('/install_update', async (ctx: Context) => {
  ctx.body = createSuccessResponse({ success: false, error: 'Not supported' })
})

router.get('/update_status', async (ctx: Context) => {
  ctx.body = createSuccessResponse({
    status: 'idle',
    progress: { percent: 0, total: 0, transferred: 0, bytesPerSecond: 0 }
  })
})

export default router
