import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { deepseekConfig } from '../../src/main/providers/builtin/deepseek.ts'
import { kimiConfig } from '../../src/main/providers/builtin/kimi.ts'
import { mimoConfig } from '../../src/main/providers/builtin/mimo.ts'
import {
  createKimiChatPayload,
  encodeKimiGrpcFrame,
  resolveDeepSeekChatOptions,
  resolveKimiScenario,
} from '../../src/main/proxy/adapters/providerModelOptions.ts'

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))))

test('DeepSeek V4 models drive the actual upstream mode flags', () => {
  assert.ok(deepseekConfig.supportedModels.includes('deepseek-v4-pro'))
  assert.ok(deepseekConfig.supportedModels.includes('deepseek-v4-flash'))
  assert.ok(deepseekConfig.supportedModels.includes('deepseek-reasoner'))
  assert.equal(deepseekConfig.modelMappings?.['deepseek-v4-pro'], 'deepseek-chat')

  assert.deepEqual(
    resolveDeepSeekChatOptions({ model: 'deepseek-v4-pro' }),
    { modelType: 'expert', searchEnabled: false, thinkingEnabled: false },
  )
  assert.deepEqual(
    resolveDeepSeekChatOptions({ model: 'deepseek-v4-flash' }),
    { modelType: 'default', searchEnabled: false, thinkingEnabled: false },
  )
  assert.deepEqual(
    resolveDeepSeekChatOptions({ model: 'deepseek-v4-pro-think-search' }),
    { modelType: 'expert', searchEnabled: true, thinkingEnabled: true },
  )
  assert.deepEqual(
    resolveDeepSeekChatOptions({ model: 'deepseek-reasoner' }),
    { modelType: 'default', searchEnabled: false, thinkingEnabled: true },
  )
})

test('Kimi K2.6 model mapping reaches the web chat request payload', () => {
  assert.deepEqual(kimiConfig.supportedModels, ['Kimi-K2.6', 'Kimi-K2.5'])
  assert.equal(kimiConfig.modelMappings?.['Kimi-K2.6'], 'kimi-k2.6')
  assert.equal(resolveKimiScenario('kimi-k2.6'), 'SCENARIO_K2D6')
  assert.equal(resolveKimiScenario('kimi-k2.5'), 'SCENARIO_K2D5')

  const payload = createKimiChatPayload({
    model: 'kimi-k2.6',
    content: 'hello',
    enableWebSearch: true,
    enableThinking: true,
  })

  assert.equal(payload.scenario, 'SCENARIO_K2D6')
  assert.equal(payload.message.scenario, 'SCENARIO_K2D6')
  assert.deepEqual(payload.tools, [{ type: 'TOOL_TYPE_SEARCH', search: {} }])
  assert.equal(payload.options.thinking, true)

  const frame = encodeKimiGrpcFrame(payload)
  assert.equal(frame.readUInt8(0), 0)
  assert.equal(frame.readUInt32BE(1), frame.length - 5)
  assert.equal(JSON.parse(frame.subarray(5).toString('utf8')).scenario, 'SCENARIO_K2D6')
})

test('Mimo model names and conversation flow match Xiaomi AI Studio web requests', () => {
  assert.deepEqual(mimoConfig.supportedModels, ['MiMo-V2.5-Pro', 'MiMo-V2.5', 'MiMo-V2-Flash'])
  assert.equal(mimoConfig.modelMappings?.['MiMo-V2.5-Pro'], 'mimo-v2.5-pro')
  assert.equal(mimoConfig.modelMappings?.['MiMo-V2.5'], 'mimo-v2.5')
  assert.equal(mimoConfig.modelMappings?.['MiMo-V2-Flash'], 'mimo-v2-flash')

  const forwarderSource = readFileSync(
    join(root, 'src/main/proxy/forwarder.ts'),
    'utf8',
  )
  const forwardMimoStart = forwarderSource.indexOf('private async forwardMimo')
  const forwardMimoEnd = forwarderSource.indexOf('private async forwardPerplexity')
  const forwardMimoSource = forwarderSource.slice(forwardMimoStart, forwardMimoEnd)

  assert.match(forwardMimoSource, /model:\s*actualModel/)
  assert.doesNotMatch(forwardMimoSource, /model:\s*request\.model/)
  assert.match(forwardMimoSource, /const transformed = this\.transformRequestForPromptToolUse\(request, provider\)/)
  assert.match(forwardMimoSource, /messages:\s*transformedRequest\.messages/)
  assert.match(forwardMimoSource, /new MimoStreamHandler\(actualModel, conversationId, 'separate', transformed\.plan\)/)
  assert.match(forwardMimoSource, /this\.applyToolCallsToResponse\(.*transformed/s)

  const mimoAdapterSource = readFileSync(
    join(root, 'src/main/proxy/adapters/mimo.ts'),
    'utf8',
  )

  assert.match(mimoAdapterSource, /open-apis\/chat\/conversation\/save/)
  assert.match(mimoAdapterSource, /open-apis\/chat\/conversation\/genTitle/)
  assert.match(mimoAdapterSource, /async deleteSession\(conversationId: string\)/)
  assert.match(mimoAdapterSource, /await this\.deleteConversations\(\[conversationId\]\)/)
  assert.match(mimoAdapterSource, /await this\.saveConversation\([^)]*conversationId/)
  assert.match(forwardMimoSource, /await adapter\.generateConversationTitle\(/)
  assert.match(forwardMimoSource, /handler\.getAssistantContentForTitle\(\)/)
  assert.match(forwardMimoSource, /const deleteSessionCallback = shouldDeleteSession\(\)/)
  assert.match(forwardMimoSource, /await deleteSessionCallback\(conversationId\)/)
})

test('Add provider dialog templates match the updated DeepSeek and Kimi flows', () => {
  const source = readFileSync(
    join(root, 'src/renderer/src/components/providers/AddProviderDialog.tsx'),
    'utf8',
  )

  assert.match(source, /supportedModels: \['deepseek-v4-pro'.*'deepseek-reasoner'/s)
  assert.match(source, /'deepseek-v4-pro': 'deepseek-chat'/)
  assert.match(source, /supportedModels: \['Kimi-K2\.6', 'Kimi-K2\.5'\]/)
  assert.match(source, /'Kimi-K2\.6': 'kimi-k2\.6'/)
  assert.match(source, /'Content-Type': 'application\/connect\+json'/)
  assert.doesNotMatch(source, /supportedModels: \['kimi', 'kimi-search', 'kimi-research', 'kimi-k1'\]/)
})

test('forwarder delegates managed tool transformation to ToolCallingEngine', () => {
  const source = readFileSync(
    join(root, 'src/main/proxy/forwarder.ts'),
    'utf8',
  )

  assert.match(source, /import \{ ToolCallingEngine \} from '\.\/toolCalling\/ToolCallingEngine'/)
  assert.match(source, /engine\.transformRequest\(/)
  assert.match(source, /engine\.applyNonStreamResponse\(result, transformed\.plan\)/)
  assert.doesNotMatch(source, /promptInjectionService\.process\(/)
  assert.doesNotMatch(source, /transformMCPToolProtocol\(/)
  assert.doesNotMatch(source, /generateToolPrompt\(/)
  assert.match(source, /tools: transformed\.tools/)
  assert.match(source, /messages: transformed\.messages/)
})

test('forwarder reads toolCallingConfig and does not use legacy prompt config for P0 tool calls', () => {
  const source = readFileSync(
    join(root, 'src/main/proxy/forwarder.ts'),
    'utf8',
  )

  assert.match(source, /toolCallingConfig/)
  assert.match(source, /new ToolCallingEngine\(/)
  assert.doesNotMatch(source, /toolPromptConfig\.defaultFormat/)
  assert.doesNotMatch(source, /promptInjectionService\.process\(/)
})

test('active source no longer exposes DS2API or DSML tool protocol markers', () => {
  const activeFiles = [
    'src/main/proxy/toolCalling/ToolCallingEngine.ts',
    'src/main/proxy/toolCalling/providerProfiles.ts',
    'src/main/proxy/toolCalling/protocols/managedXml.ts',
    'src/renderer/src/pages/Models.tsx',
  ]

  for (const file of activeFiles) {
    const source = readFileSync(join(root, file), 'utf8')
    assert.doesNotMatch(source, /DS2API|DSML/i, file)
  }
})
