import type { ToolProtocolAdapter } from './base'
import type { ToolProtocolId } from '../types'
import { managedBracketProtocol } from './managedBracket'
import { managedXmlProtocol } from './managedXml'
import { anthropicToolUseProtocol } from './anthropicToolUse'
import { codexResponsesProtocol } from './codexResponses'

const protocols: Record<ToolProtocolId, ToolProtocolAdapter> = {
  openai_chat: managedBracketProtocol,
  managed_bracket: managedBracketProtocol,
  managed_xml: managedXmlProtocol,
  anthropic_tool_use: anthropicToolUseProtocol,
  codex_responses: codexResponsesProtocol,
}

export function getToolProtocol(id: ToolProtocolId): ToolProtocolAdapter {
  return protocols[id]
}

export function getManagedProtocols(): ToolProtocolAdapter[] {
  return [
    managedBracketProtocol,
    managedXmlProtocol,
    anthropicToolUseProtocol,
    codexResponsesProtocol,
  ]
}
