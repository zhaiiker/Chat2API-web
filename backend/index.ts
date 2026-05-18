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

async function initializeApp(): Promise<void> {
  console.log('Initializing Chat2API Backend...')
  
  try {
    // 1. Initialize Storage
    await storeManager.initialize()
    console.log('Storage initialized successfully')
    
    // 2. Start Proxy Server
    const config = storeManager.getConfig()
    const port = config.proxyPort || parseInt(process.env.PORT || '8080', 10)
    const host = process.env.HOST || '0.0.0.0'
    
    const started = await proxyServer.start(port, host)
    if (started) {
      console.log(`Proxy server started on http://${host}:${port}`)
      console.log(`Management API available at http://${host}:${port}/v0/management/`)
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
initializeApp()
