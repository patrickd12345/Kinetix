type Msg = { role: string; content: string }
export async function executeChat({ messages }: { messages: Msg[] }) {
  const last = [...messages].reverse().find((m) => m.role === 'user')
  return {
    text: last?.content ?? '',
    mode: 'stub',
    latencyMs: 0,
    fallbackReason: null,
  }
}
export async function executeEmbedding({ input }: { input: string }) {
  return {
    embedding: Array.from({ length: 8 }, (_, i) => ((input.length + i) % 10) / 10),
    mode: 'stub',
    latencyMs: 0,
    fallbackReason: null,
  }
}
