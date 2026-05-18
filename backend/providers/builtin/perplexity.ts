import type { BuiltinProviderConfig } from '../../store/types'

export const perplexityConfig: BuiltinProviderConfig = {
  id: 'perplexity',
  name: 'Perplexity',
  type: 'builtin',
  authType: 'cookie',
  apiEndpoint: 'https://www.perplexity.ai',
  chatPath: '/rest/sse/perplexity_ask',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    'Accept': 'text/event-stream',
    'Content-Type': 'application/json',
    'Origin': 'https://www.perplexity.ai',
    'Referer': 'https://www.perplexity.ai/',
  },
  enabled: true,
  description: 'Perplexity AI search assistant with multi-model support and web search enhancement',
  supportedModels: [
    'Auto',
    'Turbo',
    'PPLX-Pro',
    'GPT-5',
    'Gemini-2.5-Pro',
    'Claude-Sonnet-4',
    'Claude-Opus-4',
    'Nemotron',
  ],
  modelMappings: {
    'Auto': 'auto',
    'Turbo': 'turbo',
    'PPLX-Pro': 'pplx_pro',
    'GPT-5': 'gpt5',
    'Gemini-2.5-Pro': 'gemini25pro',
    'Claude-Sonnet-4': 'claude4sonnet',
    'Claude-Opus-4': 'claude4opus',
    'Nemotron': 'nemotron',
  },
  credentialFields: [
    {
      name: 'sessionToken',
      label: 'Session Token',
      type: 'password',
      required: true,
      placeholder: 'Enter Perplexity session token',
      helpText: 'Session token obtained from Perplexity web version (__Secure-next-auth.session-token cookie)',
    },
  ],
}

export default perplexityConfig
