import * as fs from 'fs'
import * as path from 'path'
import { proxyServer } from './proxy/server'
import { storeManager } from './store/store'
import { generateManagementSecret } from './proxy/middleware/managementAuth'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Prevent uncaught exceptions from crashing the app
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason)
})

/**
 * On first run (or whenever the management secret is missing) auto-enable
 * the management API and generate a strong secret. The secret is printed
 * to stdout exactly once so the operator can capture it from the logs.
 *
 * Set CHAT2API_MANAGEMENT_SECRET to use a fixed value (recommended for
 * production deployments).
 */
function ensureManagementApiBootstrap(): { secret: string; generated: boolean } {
  const config = storeManager.getConfig()
  const current = config.managementApi || {
    enableManagementApi: false,
    managementApiSecret: '',
  }

  let secret = current.managementApiSecret
  let generated = false

  // Allow operators to inject a fixed secret via env (e.g. Docker secret).
  const envSecret = process.env.CHAT2API_MANAGEMENT_SECRET
  if (envSecret && envSecret.trim()) {
    secret = envSecret.trim()
  } else if (!secret) {
    secret = generateManagementSecret()
    generated = true
  }

  const enable = process.env.CHAT2API_DISABLE_MANAGEMENT_API !== '1'

  if (
    current.managementApiSecret !== secret ||
    current.enableManagementApi !== enable
  ) {
    storeManager.updateConfig({
      managementApi: {
        ...current,
        enableManagementApi: enable,
        managementApiSecret: secret,
      },
    })
  }

  return { secret, generated }
}

/**
 * Resolve the directory where the built frontend lives, if any.
 * Returns null when the bundle is not present (development mode).
 */
function findFrontendDist(): string | null {
  const candidates = [
    process.env.CHAT2API_FRONTEND_DIR,
    path.resolve(__dirname, '../frontend'),
    path.resolve(__dirname, '../../dist/frontend'),
    path.resolve(process.cwd(), 'dist/frontend'),
  ].filter(Boolean) as string[]

  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'index.html'))) {
      return dir
    }
  }
  return null
}

async function initializeApp(): Promise<void> {
  console.log('Initializing Chat2API Backend...')

  try {
    // 1. Initialize Storage
    await storeManager.initialize()
    console.log('Storage initialized successfully')

    // 2. Make sure the management API is reachable from the web UI.
    const { secret, generated } = ensureManagementApiBootstrap()
    if (generated) {
      console.log('')
      console.log('================================================================')
      console.log('  A new Management API secret was generated for this instance.')
      console.log('  Copy it now - it will not be shown again unless you reset it.')
      console.log(`  Secret: ${secret}`)
      console.log('================================================================')
      console.log('')
    } else {
      console.log('Management API: secret loaded from configuration / environment')
    }

    // 3. Optionally serve the built frontend from the same Koa server so
    // that a single port is enough for a VPS deployment.
    const frontendDir = findFrontendDist()
    if (frontendDir) {
      proxyServer.enableStaticFrontend(frontendDir)
      console.log(`Serving frontend from: ${frontendDir}`)
    } else {
      console.log('No built frontend found. Run `npm run build:frontend` for production.')
    }

    // 4. Start Proxy Server
    const config = storeManager.getConfig()
    const port = parseInt(process.env.PORT || String(config.proxyPort || 8080), 10)
    const host = process.env.HOST || '0.0.0.0'

    const started = await proxyServer.start(port, host)
    if (started) {
      const displayHost = host === '0.0.0.0' ? '127.0.0.1' : host
      console.log(`Proxy server started on http://${host}:${port}`)
      console.log(`OpenAI-compatible API: http://${displayHost}:${port}/v1/`)
      console.log(`Management API:        http://${displayHost}:${port}/v0/management/`)
      if (frontendDir) {
        console.log(`Web UI:                http://${displayHost}:${port}/`)
      }
    } else {
      console.error('Failed to start proxy server')
      process.exit(1)
    }

    // Handle graceful shutdown
    const cleanup = async () => {
      console.log('Application is exiting, performing cleanup...')
      await proxyServer.stop()
      storeManager.flushPendingWrites()
      process.exit(0)
    }

    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)
  } catch (error) {
    console.error('Failed to initialize application:', error)
    process.exit(1)
  }
}

// Start the application
void initializeApp()
