/**
 * Management API - Authentication Routes
 *
 * Implements a small, password-based first-run + login flow on top of the
 * Management API secret model. Operators set a password from the web UI on
 * first boot, then log in with that password to receive a long-lived
 * Management API secret which the SPA stores in localStorage.
 *
 * These three endpoints intentionally do NOT require Bearer auth, so they
 * remain reachable before any secret has been issued:
 *
 *   GET  /v0/management/auth/status           -> { firstRun, requirePassword }
 *   POST /v0/management/auth/setup            -> { secret }
 *   POST /v0/management/auth/login            -> { secret }
 *
 *   POST /v0/management/auth/change_password  -> requires Bearer auth
 *
 * Both `setup` and `login` are rate-limited per remote address to slow down
 * brute-force attempts.
 */

import Router from '@koa/router'
import type { Context } from 'koa'
import * as crypto from 'crypto'
import { storeManager } from '../../../store/store'
import {
  generateManagementSecret,
  managementAuthMiddleware,
} from '../../middleware/managementAuth'

const router = new Router({ prefix: '/v0/management/auth' })

const MIN_PASSWORD_LENGTH = 8
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_ATTEMPTS = 10

/** in-memory sliding window of failed attempts keyed by remote IP. */
const recentAttempts = new Map<string, number[]>()

function ok<T>(data: T) {
  return { success: true as const, data }
}

function fail(code: string, message: string, status = 400) {
  return { status, body: { success: false as const, error: { code, message } } }
}

function rateLimit(ip: string): boolean {
  const now = Date.now()
  const entries = recentAttempts.get(ip) || []
  const fresh = entries.filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  if (fresh.length >= RATE_LIMIT_MAX_ATTEMPTS) {
    recentAttempts.set(ip, fresh)
    return false
  }
  fresh.push(now)
  recentAttempts.set(ip, fresh)
  return true
}

function hashPassword(password: string, saltHex?: string): { hash: string; salt: string } {
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16)
  const hash = crypto.scryptSync(password, salt, 64)
  return { hash: hash.toString('hex'), salt: salt.toString('hex') }
}

function verifyPassword(password: string, hashHex: string, saltHex: string): boolean {
  try {
    const expected = Buffer.from(hashHex, 'hex')
    const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), 64)
    if (expected.length !== actual.length) return false
    return crypto.timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}

function getManagementConfig() {
  const config = storeManager.getConfig()
  return config.managementApi || {
    enableManagementApi: true,
    managementApiSecret: '',
    firstRunCompleted: false,
  }
}

router.get('/status', async (ctx: Context) => {
  const cfg = getManagementConfig()
  const firstRun = !cfg.firstRunCompleted || !cfg.passwordHash
  ctx.body = ok({
    firstRun,
    requirePassword: !firstRun,
    passwordSetAt: cfg.passwordSetAt ?? null,
  })
})

router.post('/setup', async (ctx: Context) => {
  if (!rateLimit(ctx.ip)) {
    const f = fail('rate_limited', 'Too many attempts, please wait a minute and try again.', 429)
    ctx.status = f.status
    ctx.body = f.body
    return
  }

  const { password } = (ctx.request.body as { password?: string }) || {}
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    const f = fail(
      'invalid_password',
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
    )
    ctx.status = f.status
    ctx.body = f.body
    return
  }

  const cfg = getManagementConfig()
  if (cfg.firstRunCompleted && cfg.passwordHash) {
    const f = fail(
      'already_initialised',
      'Initial setup is already complete. Please log in or change your password from the settings page.',
      409,
    )
    ctx.status = f.status
    ctx.body = f.body
    return
  }

  const { hash, salt } = hashPassword(password)
  const secret = cfg.managementApiSecret || generateManagementSecret()

  storeManager.updateConfig({
    managementApi: {
      ...cfg,
      enableManagementApi: true,
      managementApiSecret: secret,
      firstRunCompleted: true,
      passwordHash: hash,
      passwordSalt: salt,
      passwordSetAt: Date.now(),
    },
  })

  storeManager.addLog('info', 'Management password initialised via first-run setup')
  ctx.body = ok({ secret })
})

router.post('/login', async (ctx: Context) => {
  if (!rateLimit(ctx.ip)) {
    const f = fail('rate_limited', 'Too many attempts, please wait a minute and try again.', 429)
    ctx.status = f.status
    ctx.body = f.body
    return
  }

  const { password } = (ctx.request.body as { password?: string }) || {}
  if (typeof password !== 'string' || !password) {
    const f = fail('invalid_password', 'Password is required.')
    ctx.status = f.status
    ctx.body = f.body
    return
  }

  const cfg = getManagementConfig()
  if (!cfg.firstRunCompleted || !cfg.passwordHash || !cfg.passwordSalt) {
    const f = fail(
      'setup_required',
      'Initial setup is required. Please open the web UI to create a password.',
      409,
    )
    ctx.status = f.status
    ctx.body = f.body
    return
  }

  if (!verifyPassword(password, cfg.passwordHash, cfg.passwordSalt)) {
    storeManager.addLog('warn', `Failed management login from ${ctx.ip}`)
    const f = fail('invalid_credentials', 'Incorrect password.', 401)
    ctx.status = f.status
    ctx.body = f.body
    return
  }

  // Make sure a secret exists; rotate if missing.
  let secret = cfg.managementApiSecret
  if (!secret) {
    secret = generateManagementSecret()
    storeManager.updateConfig({
      managementApi: { ...cfg, managementApiSecret: secret },
    })
  }

  storeManager.addLog('info', `Management login successful from ${ctx.ip}`)
  ctx.body = ok({ secret })
})

router.post('/change_password', managementAuthMiddleware, async (ctx: Context) => {
  const body = (ctx.request.body as { oldPassword?: string; newPassword?: string; rotateSecret?: boolean }) || {}
  const { oldPassword, newPassword, rotateSecret } = body

  if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
    const f = fail(
      'invalid_password',
      `New password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
    )
    ctx.status = f.status
    ctx.body = f.body
    return
  }

  const cfg = getManagementConfig()

  // If a password is already set, require the old one. (This endpoint is auth
  // gated, but knowing the secret is not the same as knowing the password.)
  if (cfg.passwordHash && cfg.passwordSalt) {
    if (typeof oldPassword !== 'string' || !verifyPassword(oldPassword, cfg.passwordHash, cfg.passwordSalt)) {
      const f = fail('invalid_credentials', 'Current password is incorrect.', 401)
      ctx.status = f.status
      ctx.body = f.body
      return
    }
  }

  const { hash, salt } = hashPassword(newPassword)
  const secret = rotateSecret ? generateManagementSecret() : cfg.managementApiSecret || generateManagementSecret()

  storeManager.updateConfig({
    managementApi: {
      ...cfg,
      enableManagementApi: true,
      managementApiSecret: secret,
      firstRunCompleted: true,
      passwordHash: hash,
      passwordSalt: salt,
      passwordSetAt: Date.now(),
    },
  })

  storeManager.addLog('info', 'Management password changed via web UI')
  ctx.body = ok({ secret, rotated: !!rotateSecret })
})

export default router
