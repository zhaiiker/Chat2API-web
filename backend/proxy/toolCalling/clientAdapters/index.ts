import type { ToolClientAdapterId } from '../../../shared/toolCalling'
import type { ToolClientAdapter } from './types'
import { standardOpenAiToolsAdapter } from './standardOpenAiTools'
import { cherryStudioMcpAdapter } from './cherryStudioMcp'

const adapters = new Map<string, ToolClientAdapter>([
  [standardOpenAiToolsAdapter.id, standardOpenAiToolsAdapter],
  [cherryStudioMcpAdapter.id, cherryStudioMcpAdapter],
])

export function getToolClientAdapter(clientAdapterId: ToolClientAdapterId): ToolClientAdapter {
  const adapter = adapters.get(clientAdapterId)
  if (adapter) return adapter

  return {
    ...standardOpenAiToolsAdapter,
    normalizeRequest(request) {
      const result = standardOpenAiToolsAdapter.normalizeRequest(request)
      return {
        ...result,
        diagnostics: {
          ...result.diagnostics,
          requestedClientAdapterId: clientAdapterId,
          fallbackClientAdapterId: standardOpenAiToolsAdapter.id,
        },
      }
    },
  }
}

export function listToolClientAdapters(): ToolClientAdapter[] {
  return [standardOpenAiToolsAdapter, cherryStudioMcpAdapter]
}
