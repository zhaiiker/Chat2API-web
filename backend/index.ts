import * as fs from 'fs'
import * as path from 'path'
import { proxyServer } from './proxy/server'
import { storeManager } from './store/store'
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
 * Make sure the management API is enabled and surface the first-run state
 * to the operator. The actual secret is created when the user sets a
 * password from the web UI (see backend/proxy/routes/management/auth.ts).
 *
 * Operators can still inject a fixed secret via CHAT2API_MANAGEMENT_SECRET
 * (useful for headless / scripted deployments).
 */
function ensureManagementApiBootstrap(): { firstRun: boolean; envSecretApplied: boolean } {
  const config = storeManager.getConfig()
  const current = config.managementApi || {
    enableManagementApi: true,
    managementApiSecret: '',
    firstRunCompleted: false,
  }

  const enable = process.env.CHAT2API_DISABLE_MANAGEMENT_API !== '1'
  const envSecret = process.env.CHAT2API_MANAGEMENT_SECRET?.trim()

  let next = { ...current, enableManagementApi: enable }
  let envSecretApplied = false

  if (envSecret) {
    // Treat env-provided secret as an explicit operator decision: enable
    // the API and bypass the password-based first-run flow.
    next = {
      ...next,
      managementApiSecret: envSecret,
      firstRunCompleted: true,
    }
    envSecretApplied = true
  }

  if (
    next.managementApiSecret !== current.managementApiSecret ||
    next.enableManagementApi !== current.enableManagementApi ||
    next.firstRunCompleted !== current.firstRunCompleted
  ) {
    storeManager.updateConfig({ managementApi: next })
  }

  const firstRun = !next.firstRunCompleted
  return { firstRun, envSecretApplied }
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
    const { firstRun, envSecretApplied } = ensureManagementApiBootstrap()
    if (envSecretApplied) {
      console.log('Management API: secret loaded from CHAT2API_MANAGEMENT_SECRET')
    } else if (firstRun) {
      console.log('')
      console.log('================================================================')
      console.log('  First run detected.')
      console.log('  Open the web UI to create your administrator password.')
      console.log('  Until you do, the management API will reject every request')
      console.log('  except /v0/management/auth/{status,setup,login}.')
      console.log('================================================================')
      console.log('')
    } else {
      console.log('Management API: ready (password set; awaiting login)')
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
