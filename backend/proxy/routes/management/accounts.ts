/**
 * Management API - Account Routes
 * Provides CRUD operations for account management
 */

import Router from '@koa/router'
import type { Context } from 'koa'
import { managementAuthMiddleware } from '../../middleware/managementAuth'
import AccountManager from '../../../store/accounts'
import type { 
  Account, 
  CreateAccountRequest, 
  UpdateAccountRequest,
  ManagementApiResponse,
  ValidationResult 
} from '../../../shared/types'

const router = new Router({ prefix: '/v0/management' })

// Credentials are returned in cleartext to the management UI.
// The management API itself is protected by bearer auth so only
// authenticated operators can see them.

/**
 * Create error response
 */
function createErrorResponse(code: string, message: string): ManagementApiResponse {
  return {
    success: false,
    error: {
      code,
      message,
    },
  }
}

/**
 * Create success response
 */
function createSuccessResponse<T>(data: T): ManagementApiResponse<T> {
  return {
    success: true,
    data,
  }
}

/**
 * GET /v0/management/accounts
 * List all accounts (credentials masked)
 */
router.get('/accounts', managementAuthMiddleware, async (ctx: Context) => {
  try {
    const accounts = AccountManager.getAll(true)
    
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(accounts)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get accounts'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

/**
 * GET /v0/management/providers/:providerId/accounts
 * List accounts by provider (credentials masked)
 */
router.get('/providers/:providerId/accounts', managementAuthMiddleware, async (ctx: Context) => {
  try {
    const providerId = ctx.params.providerId
    const accounts = AccountManager.getByProviderId(providerId, true)
    
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(accounts)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get accounts by provider'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

/**
 * GET /v0/management/accounts/:id
 * Get account by ID (credentials masked)
 * Returns 404 if account not found
 */
router.get('/accounts/:id', managementAuthMiddleware, async (ctx: Context) => {
  try {
    const id = ctx.params.id
    const account = AccountManager.getById(id, true)
    
    if (!account) {
      ctx.status = 404
      ctx.body = createErrorResponse('account_not_found', `Account not found: ${id}`)
      return
    }
    
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(account)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get account'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

/**
 * POST /v0/management/accounts
 * Create new account
 */
router.post('/accounts', managementAuthMiddleware, async (ctx: Context) => {
  try {
    const request = ctx.request.body as CreateAccountRequest
    
    if (!request.providerId) {
      ctx.status = 400
      ctx.body = createErrorResponse('invalid_request', 'Missing required field: providerId')
      return
    }
    
    if (!request.name) {
      ctx.status = 400
      ctx.body = createErrorResponse('invalid_request', 'Missing required field: name')
      return
    }
    
    if (!request.credentials || typeof request.credentials !== 'object') {
      ctx.status = 400
      ctx.body = createErrorResponse('invalid_request', 'Missing or invalid required field: credentials')
      return
    }
    
    const account = AccountManager.create({
      providerId: request.providerId,
      name: request.name,
      email: request.email,
      credentials: request.credentials,
      dailyLimit: request.dailyLimit,
    })
    
    // Return the account with the original (unencrypted) credentials
    // so the frontend can display them immediately after creation
    const responseAccount = { ...account, credentials: request.credentials }
    ctx.status = 201
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(responseAccount)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create account'
    
    if (errorMessage.includes('not found')) {
      ctx.status = 404
      ctx.body = createErrorResponse('provider_not_found', errorMessage)
    } else {
      ctx.status = 500
      ctx.body = createErrorResponse('internal_error', errorMessage)
    }
  }
})

/**
 * PUT /v0/management/accounts/:id
 * Update account
 */
router.put('/accounts/:id', managementAuthMiddleware, async (ctx: Context) => {
  try {
    const id = ctx.params.id
    const request = ctx.request.body as UpdateAccountRequest
    
    const existingAccount = AccountManager.getById(id, false)
    if (!existingAccount) {
      ctx.status = 404
      ctx.body = createErrorResponse('account_not_found', `Account not found: ${id}`)
      return
    }
    
    const updates: Partial<Omit<Account, 'id' | 'createdAt'>> = {}
    
    if (request.name !== undefined) {
      updates.name = request.name
    }
    
    if (request.email !== undefined) {
      updates.email = request.email
    }
    
    if (request.credentials !== undefined) {
      updates.credentials = request.credentials
    }
    
    if (request.dailyLimit !== undefined) {
      updates.dailyLimit = request.dailyLimit
    }
    
    const updatedAccount = AccountManager.update(id, updates)
    
    if (!updatedAccount) {
      ctx.status = 500
      ctx.body = createErrorResponse('update_failed', 'Failed to update account')
      return
    }
    
    // Re-fetch with decrypted credentials for the response
    const freshAccount = AccountManager.getById(id, true)
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(freshAccount || updatedAccount)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update account'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

/**
 * DELETE /v0/management/accounts/:id
 * Delete account
 */
router.delete('/accounts/:id', managementAuthMiddleware, async (ctx: Context) => {
  try {
    const id = ctx.params.id
    
    const deleted = AccountManager.delete(id)
    
    if (!deleted) {
      ctx.status = 404
      ctx.body = createErrorResponse('account_not_found', `Account not found: ${id}`)
      return
    }
    
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse({ id, deleted: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete account'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

/**
 * POST /v0/management/accounts/validate_token
 * Validate credentials before creating an account.
 * Body: { providerId: string, credentials: Record<string, string> }
 */
router.post('/accounts/validate_token', managementAuthMiddleware, async (ctx: Context) => {
  try {
    const body = ctx.request.body as { providerId?: string; credentials?: Record<string, string> }
    
    if (!body.providerId) {
      ctx.status = 400
      ctx.body = createErrorResponse('invalid_request', 'Missing providerId')
      return
    }
    if (!body.credentials || typeof body.credentials !== 'object') {
      ctx.status = 400
      ctx.body = createErrorResponse('invalid_request', 'Missing credentials')
      return
    }

    const { storeManager } = await import('../../../store/store')
    const { validateCredentials } = await import('../../../store/validator')
    
    const provider = storeManager.getProviderById(body.providerId)
    if (!provider) {
      // Provider might not be created yet for builtin; look up from builtin config
      const { getBuiltinProvider } = await import('../../../providers/builtin')
      const builtinConfig = getBuiltinProvider(body.providerId)
      if (!builtinConfig) {
        ctx.status = 404
        ctx.body = createErrorResponse('provider_not_found', `Provider not found: ${body.providerId}`)
        return
      }
      // Build a minimal provider object for validation
      const tempProvider = {
        id: builtinConfig.id,
        name: builtinConfig.name,
        type: 'builtin' as const,
        authType: builtinConfig.authType,
        apiEndpoint: builtinConfig.apiEndpoint,
        chatPath: builtinConfig.chatPath,
        headers: builtinConfig.headers || {},
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        supportedModels: builtinConfig.supportedModels,
      }
      const result = await validateCredentials(tempProvider as any, body.credentials)
      
      // Map to the shape the frontend expects
      const response: any = {
        valid: result.valid,
        error: result.error,
      }
      if (result.accountInfo) {
        response.userInfo = {
          name: result.accountInfo.name,
          email: result.accountInfo.email,
          quota: result.accountInfo.quota,
          used: result.accountInfo.used,
        }
      }
      
      ctx.set('Content-Type', 'application/json')
      ctx.body = createSuccessResponse(response)
      return
    }

    const result = await validateCredentials(provider, body.credentials)
    
    // Map to the shape the frontend expects: { valid, error?, userInfo? }
    const response: any = {
      valid: result.valid,
      error: result.error,
    }
    if (result.accountInfo) {
      response.userInfo = {
        name: result.accountInfo.name,
        email: result.accountInfo.email,
        quota: result.accountInfo.quota,
        used: result.accountInfo.used,
      }
    }
    
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(response)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to validate token'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

/**
 * POST /v0/management/accounts/:id/validate
 * Validate account credentials
 */
router.post('/accounts/:id/validate', managementAuthMiddleware, async (ctx: Context) => {
  try {
    const id = ctx.params.id
    
    const existingAccount = AccountManager.getById(id, true)
    if (!existingAccount) {
      ctx.status = 404
      ctx.body = createErrorResponse('account_not_found', `Account not found: ${id}`)
      return
    }
    
    const validationResult: ValidationResult = await AccountManager.validate(id)
    
    // Map to the shape the frontend expects
    const response: any = {
      valid: validationResult.valid,
      error: validationResult.error,
    }
    if (validationResult.accountInfo) {
      response.userInfo = {
        name: validationResult.accountInfo.name,
        email: validationResult.accountInfo.email,
        quota: validationResult.accountInfo.quota,
        used: validationResult.accountInfo.used,
      }
    }
    
    ctx.set('Content-Type', 'application/json')
    ctx.body = createSuccessResponse(response)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to validate account'
    ctx.status = 500
    ctx.body = createErrorResponse('internal_error', errorMessage)
  }
})

export default router
