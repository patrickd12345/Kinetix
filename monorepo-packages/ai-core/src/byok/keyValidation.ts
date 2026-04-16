/** OpenAI-style secret keys */
export function isValidOpenAiApiKey(key: string): boolean {
  return /^sk-[A-Za-z0-9_-]{20,}$/.test(key.trim())
}

/** Anthropic API keys */
export function isValidAnthropicApiKey(key: string): boolean {
  return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key.trim())
}

/** Google AI / Gemini API keys (typical format) */
export function isValidGeminiApiKey(key: string): boolean {
  const t = key.trim()
  return t.length >= 20 && /^[A-Za-z0-9_-]+$/.test(t)
}

/** Vercel AI Gateway virtual key (opaque; non-empty) */
export function isValidGatewayVirtualKey(key: string): boolean {
  return key.trim().length >= 8
}

export function validateProviderKey(provider: string, key: string): boolean {
  const k = key.trim()
  if (!k) return false
  switch (provider) {
    case 'openai':
      return isValidOpenAiApiKey(k)
    case 'anthropic':
      return isValidAnthropicApiKey(k)
    case 'gemini':
      return isValidGeminiApiKey(k)
    case 'gateway':
      return isValidGatewayVirtualKey(k)
    default:
      return k.length >= 8
  }
}
