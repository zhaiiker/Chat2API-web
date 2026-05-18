import type { ChatCompletionRequest } from '../../types'
import type { NormalizedClientToolRequest, ToolClientAdapter } from './types'
import { normalizeOpenAiTools, normalizeToolChoice } from './standardOpenAiTools'

export const cherryStudioMcpAdapter: ToolClientAdapter = {
  id: 'cherry-studio-mcp',
  displayName: 'Cherry Studio MCP',
  normalizeRequest(request: ChatCompletionRequest): NormalizedClientToolRequest {
    const tools = normalizeOpenAiTools(request.tools, 'mcp')
    const toolChoice = normalizeToolChoice(request, new Set(tools.map((tool) => tool.name)))

    return {
      clientAdapterId: 'cherry-studio-mcp',
      toolSource: tools.length > 0 ? 'mcp' : 'none',
      tools,
      toolChoice,
      diagnostics: {
        rawToolCount: request.tools?.length ?? 0,
        normalizedToolNames: tools.map((tool) => tool.name),
      },
    }
  },
}
