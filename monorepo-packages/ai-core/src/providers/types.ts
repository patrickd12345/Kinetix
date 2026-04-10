export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | string
  content: string
}

export type ProviderCallOptions = {
  temperature?: number
  maxTokens?: number
}

export type ProviderGenerateParams = {
  apiKey: string
  model: string
  messages: ChatMessage[]
  options?: ProviderCallOptions
  fetchImpl?: typeof fetch
}

export type ProviderGenerateResult = {
  text: string
  raw: unknown
}
