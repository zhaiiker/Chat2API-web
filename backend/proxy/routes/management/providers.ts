/**
 * Management API - Provider Routes
 * Provides CRUD operations for provider management
 */

import Router from '@koa/router'
import type { Context } from 'koa'
import { managementAuthMiddleware } from '../../middleware/managementAuth'
import ProviderManager from '../../../store/providers'
import type {
  Provider,
  CreateProviderRequest,
  UpdateProviderRequest,
  ProviderStatusRequest,
  ManagementApiResponse,
} from '../../../shared/types'

const router = new Router({ prefix: '/v0/management/providers' })

router.use(managementAuthMiddleware)

function createErrorResponse(code: string, message: string): ManagementApiResponse {
  return {
    success: false,
    error: {
      code,
      message,
    },
  }
}

function createSuccessResponse<T>(data: T): ManagementApiResponse<T> {
  return {
    success: true,
    data,
  }
}

router.get('/', async (ctx: Context) => {
  try {
    const providers = ProviderManager.getAll()

    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(providers)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get providers'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

// Built-in provider catalogue. Registered BEFORE /:id so that the literal
// path 'builtin' isn't swallowed by the dynamic route.
router.get('/builtin', async (ctx: Context) => {
  try {
    const { getBuiltinProviders } = await import('../../../providers/builtin')
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(getBuiltinProviders())
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load built-in providers'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

// Check status of all configured providers in parallel. Same ordering
// reason as /builtin above.
router.post('/check_all_status', async (ctx: Context) => {
  try {
    const { ProviderChecker } = await import('../../../providers/checker')
    const providers = ProviderManager.getAll()
    const results = await Promise.all(
      providers.map(async (p) => {
        try {
          return await ProviderChecker.checkProviderStatus(p)
        } catch (error) {
          return {
            providerId: p.id,
            status: 'offline' as const,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      }),
    )
    const map: Record<string, typeof results[number]> = {}
    for (const r of results) {
      map[r.providerId] = r
    }
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(map)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to check providers'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

router.post('/import', async (ctx: Context) => {
  try {
    const body = ctx.request.body as { data: string }
    if (!body.data) {
      ctx.status = 400
      ctx.body = createErrorResponse('invalid_request', 'Missing data field')
      return
    }
    const providerData = JSON.parse(body.data)
    const provider = ProviderManager.create({
      id: providerData.id,
      name: providerData.name,
      type: providerData.type || 'custom',
      authType: providerData.authType,
      apiEndpoint: providerData.apiEndpoint,
      chatPath: providerData.chatPath,
      headers: providerData.headers || {},
      description: providerData.description,
      supportedModels: providerData.supportedModels,
    })
    ctx.status = 201
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(provider)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to import provider'
    ctx.status = 400
    ctx.body = createErrorResponse('invalid_request', errorMessage)
  }
})

router.post('/:id/check_status', async (ctx: Context) => {
  try {
    const id = ctx.params.id
    const provider = ProviderManager.getById(id)
    if (!provider) {
      ctx.status = 404
      ctx.body = createErrorResponse('not_found', 'Provider not found')
      return
    }
    const { ProviderChecker } = await import('../../../providers/checker')
    const result = await ProviderChecker.checkProviderStatus(provider)
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(result)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to check provider'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

router.get('/:id', async (ctx: Context) => {
  try {
    const id = ctx.params.id
    const provider = ProviderManager.getById(id)

    if (!provider) {
      ctx.status = 404
      ctx.body = createErrorResponse('not_found', 'Provider not found')
      return
    }

    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(provider)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get provider'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

router.post('/', async (ctx: Context) => {
  try {
    const request = ctx.request.body as CreateProviderRequest

    if (!request.name || typeof request.name !== 'string') {
      ctx.status = 400
      ctx.body = createErrorResponse('invalid_request', 'Missing required field: name')
      return
    }

    if (!request.authType) {
      ctx.status = 400
      ctx.body = createErrorResponse('invalid_request', 'Missing required field: authType')
      return
    }

    if (!request.apiEndpoint || typeof request.apiEndpoint !== 'string') {
      ctx.status = 400
      ctx.body = createErrorResponse('invalid_request', 'Missing required field: apiEndpoint')
      return
    }

    const provider = ProviderManager.create({
      id: request.id,
      name: request.name,
      type: request.type || 'custom',
      authType: request.authType,
      apiEndpoint: request.apiEndpoint,
      chatPath: request.chatPath,
      headers: request.headers || {},
      description: request.description,
      icon: request.icon,
      supportedModels: request.supportedModels,
    })

    ctx.status = 201
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(provider)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create provider'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

router.put('/:id', async (ctx: Context) => {
  try {
    const id = ctx.params.id
    const request = ctx.request.body as UpdateProviderRequest

    const existingProvider = ProviderManager.getById(id)
    if (!existingProvider) {
      ctx.status = 404
      ctx.body = createErrorResponse('not_found', 'Provider not found')
      return
    }

    const updates: Partial<Omit<Provider, 'id' | 'type' | 'createdAt'>> = {}

    if (request.name !== undefined) {
      updates.name = request.name
    }

    if (request.apiEndpoint !== undefined) {
      updates.apiEndpoint = request.apiEndpoint
    }

    if (request.chatPath !== undefined) {
      updates.chatPath = request.chatPath
    }

    if (request.headers !== undefined) {
      updates.headers = request.headers
    }

    if (request.enabled !== undefined) {
      updates.enabled = request.enabled
    }

    if (request.description !== undefined) {
      updates.description = request.description
    }

    if (request.icon !== undefined) {
      updates.icon = request.icon
    }

    if (request.supportedModels !== undefined) {
      updates.supportedModels = request.supportedModels
    }

    if (request.modelMappings !== undefined) {
      updates.modelMappings = request.modelMappings
    }

    const updatedProvider = ProviderManager.update(id, updates)

    if (!updatedProvider) {
      ctx.status = 500
      ctx.body = createErrorResponse('update_failed', 'Failed to update provider')
      return
    }

    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(updatedProvider)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update provider'

    if (errorMessage.includes('Built-in providers cannot modify')) {
      ctx.status = 403
      ctx.body = createErrorResponse('forbidden', errorMessage)
      return
    }

    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

router.delete('/:id', async (ctx: Context) => {
  try {
    const id = ctx.params.id

    const deleted = ProviderManager.delete(id)

    if (!deleted) {
      ctx.status = 404
      ctx.body = createErrorResponse('not_found', 'Provider not found')
      return
    }

    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse({ id, deleted: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete provider'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

// ==================== Model Management Routes ====================

router.get('/:id/models/effective', async (ctx: Context) => {
  try {
    const id = ctx.params.id
    const provider = ProviderManager.getById(id)
    if (!provider) {
      ctx.status = 404
      ctx.body = createErrorResponse('not_found', 'Provider not found')
      return
    }
    const { storeManager } = await import('../../../store/store')
    const models = storeManager.getEffectiveModels(id)
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(models)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get effective models'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

router.post('/:id/models/custom', async (ctx: Context) => {
  try {
    const id = ctx.params.id
    const provider = ProviderManager.getById(id)
    if (!provider) {
      ctx.status = 404
      ctx.body = createErrorResponse('not_found', 'Provider not found')
      return
    }
    const { storeManager } = await import('../../../store/store')
    const body = ctx.request.body as { displayName: string; actualModelId: string }
    if (!body.displayName || !body.actualModelId) {
      ctx.status = 400
      ctx.body = createErrorResponse('invalid_request', 'Missing displayName or actualModelId')
      return
    }
    const models = storeManager.addCustomModel(id, {
      displayName: body.displayName,
      actualModelId: body.actualModelId,
    })
    ctx.status = 201
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(models)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to add custom model'
    ctx.status = 400
    ctx.body = createErrorResponse('invalid_request', errorMessage)
  }
})

router.delete('/:id/models/:modelName', async (ctx: Context) => {
  try {
    const id = ctx.params.id
    const modelName = decodeURIComponent(ctx.params.modelName)
    const provider = ProviderManager.getById(id)
    if (!provider) {
      ctx.status = 404
      ctx.body = createErrorResponse('not_found', 'Provider not found')
      return
    }
    const { storeManager } = await import('../../../store/store')
    const models = storeManager.removeModel(id, modelName)
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(models)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to remove model'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

router.post('/:id/models/reset', async (ctx: Context) => {
  try {
    const id = ctx.params.id
    const provider = ProviderManager.getById(id)
    if (!provider) {
      ctx.status = 404
      ctx.body = createErrorResponse('not_found', 'Provider not found')
      return
    }
    const { storeManager } = await import('../../../store/store')
    const models = storeManager.resetModels(id)
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(models)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to reset models'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

router.post('/:id/sync_models', async (ctx: Context) => {
  try {
    const id = ctx.params.id
    const provider = ProviderManager.getById(id)
    if (!provider) {
      ctx.status = 404
      ctx.body = createErrorResponse('not_found', 'Provider not found')
      return
    }
    // Sync is effectively a no-op for builtin providers (models come from config)
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse({ synced: true, models: provider.supportedModels || [] })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to sync models'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

router.post('/:id/update_models', async (ctx: Context) => {
  try {
    const id = ctx.params.id
    const provider = ProviderManager.getById(id)
    if (!provider) {
      ctx.status = 404
      ctx.body = createErrorResponse('not_found', 'Provider not found')
      return
    }
    // For builtin providers, refresh models from the builtin config
    if (provider.type === 'builtin') {
      const { getBuiltinProvider } = await import('../../../providers/builtin')
      const builtinConfig = getBuiltinProvider(id)
      if (builtinConfig) {
        ProviderManager.update(id, {
          supportedModels: builtinConfig.supportedModels,
          modelMappings: builtinConfig.modelMappings,
        })
      }
    }
    const updated = ProviderManager.getById(id)
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(updated)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update models'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

router.post('/:id/duplicate', async (ctx: Context) => {
  try {
    const id = ctx.params.id
    const provider = ProviderManager.getById(id)
    if (!provider) {
      ctx.status = 404
      ctx.body = createErrorResponse('not_found', 'Provider not found')
      return
    }
    const duplicate = ProviderManager.create({
      name: `${provider.name} (Copy)`,
      type: provider.type,
      authType: provider.authType,
      apiEndpoint: provider.apiEndpoint,
      chatPath: provider.chatPath,
      headers: provider.headers,
      description: provider.description,
      icon: provider.icon,
      supportedModels: provider.supportedModels,
    })
    ctx.status = 201
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(duplicate)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to duplicate provider'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

router.post('/:id/export', async (ctx: Context) => {
  try {
    const id = ctx.params.id
    const provider = ProviderManager.getById(id)
    if (!provider) {
      ctx.status = 404
      ctx.body = createErrorResponse('not_found', 'Provider not found')
      return
    }
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(JSON.stringify(provider, null, 2))
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to export provider'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

// ==================== Status Routes ====================

router.patch('/:id/status', async (ctx: Context) => {
  try {
    const id = ctx.params.id
    const request = ctx.request.body as ProviderStatusRequest

    if (request.enabled === undefined || typeof request.enabled !== 'boolean') {
      ctx.status = 400
      ctx.body = createErrorResponse('invalid_request', 'Missing or invalid required field: enabled (must be boolean)')
      return
    }

    const existingProvider = ProviderManager.getById(id)
    if (!existingProvider) {
      ctx.status = 404
      ctx.body = createErrorResponse('not_found', 'Provider not found')
      return
    }

    const updatedProvider = ProviderManager.update(id, { enabled: request.enabled })

    if (!updatedProvider) {
      ctx.status = 500
      ctx.body = createErrorResponse('update_failed', 'Failed to update provider status')
      return
    }

    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(updatedProvider)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update provider status'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

export default router
