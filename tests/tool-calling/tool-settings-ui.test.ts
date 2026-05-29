import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('normal tool-calling UI exposes client adapter and managed mode controls', () => {
  const panel = readFileSync('src/renderer/src/components/models/ToolCallingPanel.tsx', 'utf8')

  assert.match(panel, /toolCallingConfig/)
  assert.match(panel, /standard-openai-tools/)
  assert.match(panel, /cherry-studio-mcp/)
  assert.match(panel, /mode.*off/s)
  assert.match(panel, /mode.*auto/s)
  assert.match(panel, /mode.*force/s)
})

test('normal UI hides protocol and prompt-template internals', () => {
  const panel = readFileSync('src/renderer/src/components/models/ToolCallingPanel.tsx', 'utf8')

  assert.doesNotMatch(panel, /defaultFormat/)
  assert.doesNotMatch(panel, /ProtocolFormat/)
  assert.doesNotMatch(panel, /provider\.protocolId/)
  assert.doesNotMatch(panel, /skipKnownClient/i)
  assert.match(panel, /advanced\.customPromptTemplate/)
})

test('provider support matrix shows display labels instead of provider ids', () => {
  const panel = readFileSync('src/renderer/src/components/models/ToolCallingPanel.tsx', 'utf8')

  assert.match(panel, /provider\.label/)
  assert.doesNotMatch(panel, /<span className="text-sm font-medium">\{provider\.providerId\}<\/span>/)
})

test('Models page delegates tool settings to ToolCallingPanel', () => {
  const models = readFileSync('src/renderer/src/pages/Models.tsx', 'utf8')

  assert.match(models, /ToolCallingPanel/)
  assert.doesNotMatch(models, /PromptTemplateCard/)
  assert.doesNotMatch(models, /InjectionConfigCard/)
})
