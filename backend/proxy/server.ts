/**
 * Proxy Service Module - Proxy Server Core
 * Implements proxy server based on Koa
 */

import Koa, { type Context, type Next } from 'koa'
import Router from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { Server as HttpServer } from 'http'
import * as fs from 'fs'
import * as path from 'path'
import routes from './routes'
import managementRoutes from './routes/management'
import { proxyStatusManager } from './status'
import { storeManager } from '../store/store'
import { sessionManager } from './sessionManager'

const SLOW_REQUEST_THRESHOLD_MS = 1500

const STATIC_MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
}

/**
 * Proxy Server Class
 */
export class ProxyServer {
  private app: Koa
  private router: Router
  private server: HttpServer | null = null
  private port: number = 8080
  private host: string = '127.0.0.1'
  private staticFrontendDir: string | null = null

  constructor() {
    this.app = new Koa()
    this.router = new Router()

    this.setupMiddleware()
    this.setupRoutes()
    this.setupErrorHandler()
  }

  /**
   * Enable serving a built single-page frontend from this server.
   * Static assets are served as-is and unknown paths fall back to index.html
   * so client-side routing keeps working.
   */
  enableStaticFrontend(directory: string): void {
    if (!fs.existsSync(path.join(directory, 'index.html'))) {
      console.warn(`[ProxyServer] No index.html found in ${directory}; static UI disabled.`)
      return
    }
    this.staticFrontendDir = path.resolve(directory)
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    this.app.use(async (ctx, next) => {
      ctx.set('Access-Control-Allow-Origin', '*')
      ctx.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      ctx.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
      ctx.set('Access-Control-Max-Age', '86400')

      if (ctx.method === 'OPTIONS') {
        ctx.status = 204
        return
      }

      await next()
    })

    this.app.use(bodyParser({
      jsonLimit: '50mb',
      formLimit: '50mb',
      textLimit: '50mb',
    }))

    // API Key validation middleware
    this.app.use(async (ctx, next) => {
      // Skip paths that don't require authentication
      const publicPaths = ['/', '/health', '/stats']
      if (publicPaths.includes(ctx.path)) {
        await next()
        return
      }

      // Skip management API paths - they have their own authentication
      if (ctx.path.startsWith('/v0/management')) {
        await next()
        return
      }

      const config = storeManager.getConfig()
      
      if (config.enableApiKey && config.apiKeys && config.apiKeys.length > 0) {
        const authHeader = ctx.get('Authorization') || ''
        const providedKey = authHeader.startsWith('Bearer ') 
          ? authHeader.slice(7) 
          : (ctx.query.api_key as string) || ctx.get('X-API-Key')
        
        if (!providedKey) {
          ctx.status = 401
          ctx.body = {
            error: {
              message: 'API key is required',
              type: 'invalid_request_error',
              code: 'missing_api_key',
            },
          }
          return
        }
        
        const validKey = config.apiKeys.find(
          k => k.key === providedKey && k.enabled
        )
        
        if (!validKey) {
          ctx.status = 401
          ctx.body = {
            error: {
              message: 'Invalid API key',
              type: 'invalid_request_error',
              code: 'invalid_api_key',
            },
          }
          return
        }
        
        // Update usage statistics
        const updatedKeys = config.apiKeys.map(k => 
          k.id === validKey.id 
            ? { 
                ...k, 
                lastUsedAt: Date.now(), 
                usageCount: k.usageCount + 1 
              }
            : k
        )
        storeManager.updateConfig({ apiKeys: updatedKeys })
      }
      
      await next()
    })

    this.app.use(async (ctx, next) => {
      const startTime = Date.now()

      await next()

      const latency = Date.now() - startTime
      const shouldRecordAccessLog =
        !ctx.path.startsWith('/v1/models') &&
        (ctx.status >= 400 || latency >= SLOW_REQUEST_THRESHOLD_MS)

      if (shouldRecordAccessLog) {
        storeManager.addLog('warn', `${ctx.method} ${ctx.path} ${ctx.status} ${latency}ms`, {
          data: {
            method: ctx.method,
            path: ctx.path,
            status: ctx.status,
            latency,
            clientIP: ctx.ip,
            slowRequest: latency >= SLOW_REQUEST_THRESHOLD_MS,
          },
        })
      }
    })
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Register OpenAI API routes
    for (const route of routes) {
      this.router.use(route.routes())
      this.router.use(route.allowedMethods())
    }

    this.router.get('/', async (ctx) => {
      // When the SPA is mounted, let the static fallback render index.html.
      if (this.staticFrontendDir) {
        ctx.status = 404
        return
      }
      ctx.body = {
        name: 'Chat2API Proxy',
        version: '1.1.2',
        description: 'OpenAI API compatible proxy service',
        endpoints: [
          'POST /v1/chat/completions',
          'GET /v1/models',
          'GET /v1/models/:model',
          'POST /v1/completions',
        ],
      }
    })

    this.router.get('/health', async (ctx) => {
      const status = proxyStatusManager.getRunningStatus()
      const statistics = proxyStatusManager.getStatistics()

      ctx.body = {
        status: status.isRunning ? 'running' : 'stopped',
        uptime: status.uptime,
        statistics: {
          totalRequests: statistics.totalRequests,
          successRequests: statistics.successRequests,
          failedRequests: statistics.failedRequests,
          activeConnections: statistics.activeConnections,
        },
      }
    })

    this.router.get('/stats', async (ctx) => {
      const statistics = proxyStatusManager.getStatistics()
      ctx.body = statistics
    })

    // Management API enable check middleware
    // This must be registered before management routes
    const managementEnableCheck = async (ctx: Context, next: Next) => {
      if (!ctx.path.startsWith('/v0/management')) {
        await next()
        return
      }

      try {
        const config = storeManager.getConfig()
        if (!config.managementApi?.enableManagementApi) {
          ctx.status = 404
          ctx.body = {
            success: false,
            error: {
              code: 'management_api_disabled',
              message: 'Management API is not enabled',
            },
          }
          return
        }
        await next()
      } catch {
        ctx.status = 503
        ctx.body = {
          success: false,
          error: {
            code: 'service_unavailable',
            message: 'Service is initializing',
          },
        }
      }
    }

    this.app.use(managementEnableCheck)

    // Register all management routes (they already have /v0/management prefix)
    for (const route of managementRoutes) {
      this.app.use(route.routes())
      this.app.use(route.allowedMethods())
    }

    this.app.use(this.router.routes())
    this.app.use(this.router.allowedMethods())

    this.app.use(async (ctx) => {
      // Don't try to serve a SPA for API/management calls.
      const isApiPath =
        ctx.path.startsWith('/v0/') ||
        ctx.path.startsWith('/v1/') ||
        ctx.path === '/health' ||
        ctx.path === '/stats'

      if (!isApiPath && this.staticFrontendDir && (ctx.method === 'GET' || ctx.method === 'HEAD')) {
        if (await this.serveStaticAsset(ctx)) {
          return
        }
      }

      ctx.status = 404
      ctx.body = {
        error: {
          message: `Route not found: ${ctx.method} ${ctx.path}`,
          type: 'not_found_error',
        },
      }
    })
  }

  /**
   * Try to serve a static asset from the configured frontend directory.
   * Falls back to `index.html` so the SPA can resolve client-side routes.
   * Returns true when a response was written.
   */
  private async serveStaticAsset(ctx: Context): Promise<boolean> {
    if (!this.staticFrontendDir) return false

    const root = this.staticFrontendDir

    // Normalise the request path and reject any traversal attempts.
    const requestPath = decodeURIComponent(ctx.path)
    if (requestPath.includes('\0')) return false
    const normalised = path.posix.normalize(requestPath).replace(/^\/+/, '')
    if (normalised.startsWith('..')) return false

    const candidates: string[] = []
    if (normalised && normalised !== '/') {
      candidates.push(path.join(root, normalised))
    }
    candidates.push(path.join(root, 'index.html'))

    for (const candidate of candidates) {
      const resolved = path.resolve(candidate)
      if (!resolved.startsWith(root)) continue
      try {
        const stat = await fs.promises.stat(resolved)
        if (stat.isDirectory()) continue
        const ext = path.extname(resolved).toLowerCase()
        ctx.type = STATIC_MIME_TYPES[ext] || 'application/octet-stream'
        ctx.set('Cache-Control', ext === '.html' ? 'no-cache' : 'public, max-age=3600')
        ctx.body = await fs.promises.readFile(resolved)
        return true
      } catch {
        // try next candidate
      }
    }

    return false
  }

  /**
   * Setup error handler
   */
  private setupErrorHandler(): void {
    this.app.on('error', (err, ctx) => {
      const status = err.status || 500
      const message = err.message || 'Internal Server Error'

      storeManager.addLog('error', `Server error: ${message}`, {
        data: {
          status,
          path: ctx.path,
          method: ctx.method,
          stack: err.stack,
        },
      })
    })
  }

  /**
   * Start server
   */
  async start(port?: number, host?: string): Promise<boolean> {
    if (this.server) {
      return false
    }

    this.port = port || proxyStatusManager.getPort()
    this.host = host || proxyStatusManager.getHost()
    
    sessionManager.initialize()

    return new Promise((resolve) => {
      try {
        this.server = this.app.listen(this.port, this.host, () => {
          proxyStatusManager.start()
          proxyStatusManager.setPort(this.port)
          proxyStatusManager.setHost(this.host)

          storeManager.addLog('info', `Proxy server started successfully, listening on ${this.host}:${this.port}`)

          resolve(true)
        })

        this.server.on('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'EADDRINUSE') {
            storeManager.addLog('error', `Port ${this.port} is already in use`)
          } else {
            storeManager.addLog('error', `Server error: ${err.message}`)
          }
          this.server = null
          resolve(false)
        })

        this.server.on('close', () => {
          this.server = null
        })
      } catch (error) {
        storeManager.addLog('error', `Failed to start server: ${error instanceof Error ? error.message : 'Unknown error'}`)
        resolve(false)
      }
    })
  }

  /**
   * Stop server
   */
  async stop(): Promise<boolean> {
    if (!this.server) {
      return false
    }
    
    sessionManager.destroy()

    return new Promise((resolve) => {
      this.server!.close((err) => {
        if (err) {
          storeManager.addLog('error', `Failed to stop server: ${err.message}`)
          resolve(false)
          return
        }

        this.server = null
        proxyStatusManager.stop()

        storeManager.addLog('info', 'Proxy server stopped')

        resolve(true)
      })
    })
  }

  /**
   * Restart server
   */
  async restart(port?: number, host?: string): Promise<boolean> {
    await this.stop()
    return this.start(port, host)
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.server !== null && proxyStatusManager.getRunningStatus().isRunning
  }

  /**
   * Get server port
   */
  getPort(): number {
    return this.port
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return proxyStatusManager.getStatistics()
  }

  /**
   * Get running status
   */
  getStatus() {
    return proxyStatusManager.getRunningStatus()
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    proxyStatusManager.resetStatistics()
  }
}

export const proxyServer = new ProxyServer()
export default proxyServer
