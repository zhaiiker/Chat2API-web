/**
 * Clean Tool Markers Utility
 * Removes tool calling XML markers from response content
 */

/**
 * Clean tool calling markers from content string
 * Removes XML-style tool markers that might be included in the response
 */
export function cleanToolMarkers(content: string): string {
  if (!content || typeof content !== 'string') return content
  
  // Remove Chat2API tool markers
  let cleaned = content
    .replace(/<\|CHAT2API\|tool_calls>[\s\S]*?<\/\|CHAT2API\|tool_calls>/g, '')
    .replace(/<\|CHAT2API\|tool_result[^>]*>[\s\S]*?<\/\|CHAT2API\|tool_result>/g, '')
    .replace(/<\|CHAT2API\|invoke[^>]*>[\s\S]*?<\/\|CHAT2API\|invoke>/g, '')
    .replace(/<\|CHAT2API\|parameter[^>]*>[\s\S]*?<\/\|CHAT2API\|parameter>/g, '')
  
  // Remove standard XML tool markers
  cleaned = cleaned
    .replace(/<tool_calls>[\s\S]*?<\/tool_calls>/g, '')
    .replace(/<tool_result[^>]*>[\s\S]*?<\/tool_result>/g, '')
    .replace(/<invoke[^>]*>[\s\S]*?<\/invoke>/g, '')
  
  // Remove function call markers
  cleaned = cleaned
    .replace(/<function_calls>[\s\S]*?<\/antml:function_calls>/g, '')
  
  return cleaned.trim()
}

/**
 * Clean tool markers from OpenAI response body
 * Modifies the response in-place
 */
export function cleanToolMarkersFromResponse(response: any): void {
  if (!response || typeof response !== 'object') return
  
  // Handle choices array
  if (Array.isArray(response.choices)) {
    for (const choice of response.choices) {
      if (!choice || typeof choice !== 'object') continue
      
      // Clean message content
      if (choice.message?.content && typeof choice.message.content === 'string') {
        choice.message.content = cleanToolMarkers(choice.message.content)
      }
      
      // Clean delta content (for streaming)
      if (choice.delta?.content && typeof choice.delta.content === 'string') {
        choice.delta.content = cleanToolMarkers(choice.delta.content)
      }
    }
  }
}

/**
 * Clean tool markers from streaming chunk
 * Returns cleaned chunk string (for SSE format)
 */
export function cleanToolMarkersFromStreamChunk(chunkText: string): string {
  if (!chunkText || typeof chunkText !== 'string') return chunkText
  
  // Parse SSE chunks
  const lines = chunkText.split('\n')
  const cleanedLines: string[] = []
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6)
      if (data === '[DONE]') {
        cleanedLines.push(line)
        continue
      }
      
      try {
        const parsed = JSON.parse(data)
        cleanToolMarkersFromResponse(parsed)
        cleanedLines.push(`data: ${JSON.stringify(parsed)}`)
      } catch {
        // Invalid JSON, keep as-is
        cleanedLines.push(line)
      }
    } else {
      cleanedLines.push(line)
    }
  }
  
  return cleanedLines.join('\n')
}
