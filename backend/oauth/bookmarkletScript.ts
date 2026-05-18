/**
 * Bookmarklet Script Builder
 *
 * Renders the JavaScript blob that operators drag into their bookmark
 * bar. The script runs *on the provider's own page* (after the operator
 * signs in there) and:
 *
 *   1. Reads the auth value out of `localStorage` / `cookie`, using the
 *      same `tokenKey` map the in-app guide already advertises in
 *      `backend/oauth/guides.ts`.
 *   2. Optionally collects a few sibling fields (e.g. MiniMax's
 *      `_userId`, Mimo's `user_id` / `ph_token`) so the ingest endpoint
 *      receives everything the OAuth manager needs in one shot.
 *   3. POSTs the result to the public ingest endpoint with the ticket
 *      that was baked into the script at issue time.
 *
 * The script is intentionally written in defensive vanilla JS — no
 * destructuring, no template literals — so it survives running on
 * provider sites whose CSPs disable eval / strict mode.
 */

import type { ProviderType } from './types'

export interface ProviderTokenSpec {
  /** Where to read from. */
  storageType: 'localStorage' | 'cookie'
  /** Storage key (or cookie name) holding the primary token. */
  tokenKey: string
  /** Field name to send to the ingest endpoint as the primary token. */
  tokenField?: string
  /** Optional extra fields to read from the same storage. */
  extras?: Array<{
    /** Storage key / cookie name to read. */
    sourceKey: string
    /** Where in `localStorage` / `cookie` to read it from. Defaults to `storageType`. */
    storageType?: 'localStorage' | 'cookie'
    /** Field name in the ingest payload. */
    field: string
    /** When true, the bookmarklet aborts if this field is missing. */
    required?: boolean
  }>
  /** Human-readable origin label, used in the alert messages. */
  originLabel: string
  /** URL the user should be on when they click the bookmarklet. */
  expectedOrigin?: string
}

/**
 * Per-provider token layout. Mirrors `frontend/src/components/oauth/
 * TokenExtractionGuide.tsx` so manual and automatic flows agree.
 */
export const PROVIDER_TOKEN_SPECS: Record<ProviderType, ProviderTokenSpec> = {
  deepseek: {
    storageType: 'localStorage',
    tokenKey: 'userToken',
    tokenField: 'token',
    originLabel: 'DeepSeek',
    expectedOrigin: 'https://chat.deepseek.com',
  },
  glm: {
    storageType: 'cookie',
    tokenKey: 'chatglm_refresh_token',
    tokenField: 'token',
    originLabel: 'ChatGLM',
    expectedOrigin: 'https://chatglm.cn',
  },
  kimi: {
    // Kimi's access token lives in cookies (`kimi-auth`) on chat sessions.
    // Network-tab extraction is documented as a fallback for the manual
    // flow, but the cookie is the canonical place for the bookmarklet.
    storageType: 'cookie',
    tokenKey: 'kimi-auth',
    tokenField: 'token',
    originLabel: 'Kimi',
    expectedOrigin: 'https://www.kimi.com',
  },
  minimax: {
    storageType: 'localStorage',
    tokenKey: '_token',
    tokenField: 'token',
    extras: [
      { sourceKey: '_userId', field: 'realUserID', required: true },
    ],
    originLabel: 'MiniMax',
    expectedOrigin: 'https://chat.minimaxi.com',
  },
  qwen: {
    storageType: 'cookie',
    tokenKey: 'tongyi_sso_ticket',
    tokenField: 'token',
    originLabel: 'Tongyi Qianwen',
    expectedOrigin: 'https://www.qianwen.com',
  },
  'qwen-ai': {
    storageType: 'localStorage',
    tokenKey: 'token',
    tokenField: 'token',
    originLabel: 'Qwen Chat',
    expectedOrigin: 'https://chat.qwen.ai',
  },
  zai: {
    storageType: 'localStorage',
    tokenKey: 'token',
    tokenField: 'token',
    originLabel: 'Z.ai',
    expectedOrigin: 'https://chat.z.ai',
  },
  mimo: {
    storageType: 'localStorage',
    tokenKey: 'service_token',
    tokenField: 'token',
    extras: [
      { sourceKey: 'user_id', field: 'mimoUserId', required: true },
      { sourceKey: 'ph_token', field: 'mimoPhToken', required: true },
    ],
    originLabel: 'Mimo Studio',
    expectedOrigin: 'https://aistudio.xiaomimimo.com',
  },
  perplexity: {
    storageType: 'cookie',
    tokenKey: '__Secure-next-auth.session-token',
    tokenField: 'token',
    originLabel: 'Perplexity',
    expectedOrigin: 'https://www.perplexity.ai',
  },
}

export function getTokenSpec(providerType: ProviderType): ProviderTokenSpec | undefined {
  return PROVIDER_TOKEN_SPECS[providerType]
}

export interface BookmarkletBuildOptions {
  ticket: string
  ingestUrl: string
  providerType: ProviderType
  spec: ProviderTokenSpec
}

/**
 * Build the raw JavaScript source for the bookmarklet (without the
 * `javascript:` prefix or URL-encoding). Caller is responsible for
 * URL-encoding when generating an `href`.
 */
export function buildBookmarkletSource(opts: BookmarkletBuildOptions): string {
  const config = {
    ticket: opts.ticket,
    ingestUrl: opts.ingestUrl,
    providerType: opts.providerType,
    storageType: opts.spec.storageType,
    tokenKey: opts.spec.tokenKey,
    tokenField: opts.spec.tokenField || 'token',
    originLabel: opts.spec.originLabel,
    extras: opts.spec.extras || [],
  }

  // Embed config as a JSON literal. JSON.stringify produces a string that
  // is also a valid JS expression — safer than interpolating field-by-field.
  // We further escape `</` so the script can be inlined into HTML if ever
  // needed.
  const configLiteral = JSON.stringify(config).replace(/<\//g, '<\\/')

  // The runtime body. Vanilla JS, no closures over outer scope, no `this`.
  // It is wrapped in an IIFE so it leaves no globals on the page.
  const body = [
    '(function(){',
    'var CFG=' + configLiteral + ';',
    'function readCookie(name){',
    '  var m=document.cookie.match(new RegExp("(?:^|; )"+name.replace(/[.$?*|{}()\\[\\]\\\\\\/\\+\\^]/g,"\\\\$&")+"=([^;]*)"));',
    '  return m?decodeURIComponent(m[1]):null;',
    '}',
    'function read(storage,key){',
    '  try{',
    '    if(storage==="cookie")return readCookie(key);',
    '    return window.localStorage.getItem(key);',
    '  }catch(e){return null;}',
    '}',
    'var primary=read(CFG.storageType,CFG.tokenKey);',
    'if(!primary){',
    '  alert("Chat2API: could not find "+CFG.tokenKey+" in "+CFG.storageType+" for "+CFG.originLabel+".\\n\\nMake sure you are logged in on this page first.");',
    '  return;',
    '}',
    'var payload={ticket:CFG.ticket,providerType:CFG.providerType,credentials:{}};',
    'payload.credentials[CFG.tokenField]=primary;',
    'for(var i=0;i<CFG.extras.length;i++){',
    '  var ex=CFG.extras[i];',
    '  var v=read(ex.storageType||CFG.storageType,ex.sourceKey);',
    '  if(!v&&ex.required){',
    '    alert("Chat2API: missing "+ex.sourceKey+" in "+(ex.storageType||CFG.storageType)+" for "+CFG.originLabel+".");',
    '    return;',
    '  }',
    '  if(v)payload.credentials[ex.field]=v;',
    '}',
    'fetch(CFG.ingestUrl,{',
    '  method:"POST",',
    '  mode:"cors",',
    '  credentials:"omit",',
    '  headers:{"Content-Type":"application/json"},',
    '  body:JSON.stringify(payload)',
    '}).then(function(r){return r.json().then(function(j){return{ok:r.ok,body:j};});})',
    '.then(function(res){',
    '  if(res.ok&&res.body&&res.body.success){',
    '    alert("Chat2API: token sent. You can switch back to the Chat2API tab.");',
    '  }else{',
    '    var msg=(res.body&&res.body.error&&res.body.error.message)||"Chat2API rejected the token.";',
    '    alert("Chat2API: "+msg);',
    '  }',
    '}).catch(function(err){',
    '  alert("Chat2API: network error - "+(err&&err.message?err.message:err));',
    '});',
    '})();',
  ].join('')

  return body
}

/**
 * Build the full `javascript:` href, ready to drop into an `<a href>`.
 */
export function buildBookmarkletHref(opts: BookmarkletBuildOptions): string {
  return 'javascript:' + encodeURI(buildBookmarkletSource(opts))
}
