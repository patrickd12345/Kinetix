export async function executeChat({ messages }) {
  const last = [...messages].reverse().find((m) => m.role === 'user')
  return {
    text: last?.content ?? '',
    mode: 'gateway',
    latencyMs: 0,
    fallbackReason: null,
  }
}

export async function executeEmbedding({ input }) {
  return {
    embedding: Array.from({ length: 8 }, (_, i) => ((input.length + i) % 10) / 10),
    mode: 'gateway',
    latencyMs: 0,
    fallbackReason: null,
  }
}
