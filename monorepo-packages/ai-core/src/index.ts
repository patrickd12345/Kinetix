export { resolveKey, splitGatewayKeys, type ResolveKeyInput, type ResolveKeyResult } from './byok/keyResolver.js'
export {
  getPlatformKey,
  loadUserKey,
  setUserKeyLoader,
  type UserKeyLoader,
} from './byok/keyStorage.js'
export { isProviderAllowedForProduct } from './byok/keyScope.js'
export {
  isValidAnthropicApiKey,
  isValidGeminiApiKey,
  isValidOpenAiApiKey,
  validateProviderKey,
} from './byok/keyValidation.js'
export { openaiChat } from './providers/openai.js'
export { anthropicChat } from './providers/anthropic.js'
export { geminiChat } from './providers/gemini.js'
export type { ChatMessage, ProviderCallOptions, ProviderGenerateParams, ProviderGenerateResult } from './providers/types.js'
export { generate, type GenerateInput, type GenerateResult } from './routing/router.js'
export { recordAiCoreTelemetry, type AiCoreTelemetryPayload } from './telemetry.js'
