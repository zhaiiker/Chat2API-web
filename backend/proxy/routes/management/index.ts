/**
 * Management API Routes Index
 * Exports all management route modules
 */

import configRouter from './config'
import providersRouter from './providers'
import accountsRouter from './accounts'
import apiKeysRouter from './apiKeys'
import modelMappingsRouter from './modelMappings'
import sessionsRouter from './sessions'
import statisticsRouter from './statistics'
import proxyRouter from './proxy'
import toolCallingRouter from './toolCalling'
import oauthRouter from './oauth/index'
import logsRouter from './logs'
import promptsRouter from './prompts'
import appRouter from './app'

export {
  configRouter,
  providersRouter,
  accountsRouter,
  apiKeysRouter,
  modelMappingsRouter,
  sessionsRouter,
  statisticsRouter,
  proxyRouter,
  toolCallingRouter,
  oauthRouter,
  logsRouter,
  promptsRouter,
  appRouter,
}

export default [
  configRouter,
  providersRouter,
  accountsRouter,
  apiKeysRouter,
  modelMappingsRouter,
  sessionsRouter,
  statisticsRouter,
  proxyRouter,
  toolCallingRouter,
  oauthRouter,
  logsRouter,
  promptsRouter,
  appRouter,
]
