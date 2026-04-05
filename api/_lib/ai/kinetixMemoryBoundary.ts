import type { SessionBoundaryPayload } from '@bookiji-inc/persistent-memory-runtime'
import type { ChatMessage } from './llmClient.js'

export function buildKinetixBoundaryFromChat(
  messages: ChatMessage[],
  assistantPreview: string,
  surface: string,
): SessionBoundaryPayload {
  const userLast =
    [...messages].reverse().find((m) => m.role === 'user')?.content?.slice(0, 500) ?? ''
  const summary = assistantPreview.trim().slice(0, 800)
  return {
    sessionSummary: summary || `kinetix:${surface}`,
    decisionsMade: [],
    newlyActiveWork: userLast ? [userLast] : [],
    completedWork: [],
    current_focus: [surface],
    blockers: [],
    in_progress: [],
    next_actions: summary ? [summary.slice(0, 240)] : [],
  }
}
