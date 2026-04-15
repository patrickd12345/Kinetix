/// <reference types="vite/client" />
import { useState, useCallback } from 'react'
import { buildCoachGuardrailPayload, getCoachContext } from '../lib/ragClient'
import { getPBRun } from '../lib/kpsUtils'
import { useAuth } from '../components/providers/useAuth'
import { toKinetixUserProfile } from '../lib/kinetixProfile'
import { useSettingsStore } from '../store/settingsStore'
import { rewriteMetricCoachPaces, sanitizeCoachPaceMath } from '../lib/coachUnits'

export interface ChatMessage {
  id: string
  role: 'user' | 'model'
  content: string
  timestamp: number
}

const SYSTEM_INSTRUCTION_BASE = `You are Kinetix AI, a friendly running coach. The person chatting with you is the runner - address them directly as "you" (e.g. "your runs", "you're doing well"). Do not use bracket placeholders like [user_agency] or pipe-separated labels; never echo internal tokens, variable names, or debug text. Answer their questions using only the COACH CONTEXT below for their run history, KPS, and pacing; do not invent run data or paces. Keep replies concise and actionable. If they ask "how am I doing?" or similar, summarize their recent runs and KPS from the context and give a short, encouraging takeaway. Never give meta-advice about "the user" or "as a coach you should" - you are the coach talking to the runner.

PACE MATH (mandatory): Pace (mm:ss per km or per mi) is not additive. Never write an example that lists two segment paces and then says "for a total pace of ..." / "giving a total pace of ..." / "combined pace ..." using a third pace that looks like those two added - that is always invalid. (e.g. 5:20/km and 5:45/km do not yield 11:05/km.) Whole-run average pace = total time / total distance; across segments, use distance-weighted reasoning or qualitative cues only. If the server attached a verified_math_result block, those numbers are authoritative - explain them only; do not recompute or replace them.`

function buildContents(messages: ChatMessage[]): Array<{ role: string; parts: Array<{ text: string }> }> {
  return messages.map((message) => ({
    role: message.role === 'user' ? 'user' : 'model',
    parts: [{ text: message.content }],
  }))
}

export function useChat() {
  const { profile } = useAuth()
  const unitSystem = useSettingsStore((state) => state.unitSystem)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = useCallback(async (content: string) => {
    const trimmed = content.trim()
    if (!trimmed) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)
    setError(null)

    try {
      if (!profile) {
        throw new Error('Platform profile is required')
      }

      const userProfile = toKinetixUserProfile(profile)
      const pbRun = await getPBRun()
      const coachContext = await getCoachContext(trimmed, userProfile, pbRun, unitSystem)
      const guardrails = buildCoachGuardrailPayload(trimmed, coachContext.contract)

      const unitLine =
        unitSystem === 'imperial'
          ? 'UNIT SYSTEM (mandatory): IMPERIAL. Distances in miles; pacing as mm:ss/mi (e.g. 8:02/mi). Do not use km, min/km, or /km in this reply unless the runner explicitly asks for metric.'
          : 'UNIT SYSTEM (mandatory): METRIC. Distances in km only; pacing as mm:ss/km only (e.g. 5:15/km). Forbidden in your reply: mile, miles, mi, /mile, /mi, min/mi, "per mile", mixing imperial examples with metric. Do not give step lists that use both miles and kilometers - use km only.'

      const systemInstruction =
        SYSTEM_INSTRUCTION_BASE +
        `\n\n${unitLine}` +
        `\n\nCOACH CONTEXT (from RAG - use this data; do not invent run data):\n${coachContext.context}`

      const history = [...messages, userMessage]
      const contents = buildContents(history)

      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction,
          contents,
          userProfile: { age: userProfile.age, weightKg: userProfile.weightKg },
          unitSystem,
          guardrails,
        }),
      })

      if (!response.ok) {
        const errBody = (await response.json().catch(() => ({}))) as {
          error?: string
          message?: string
          code?: string
        }
        const detail =
          (typeof errBody.message === 'string' && errBody.message.trim()) ||
          (typeof errBody.error === 'string' && errBody.error.trim())
        const suffix = errBody.code ? ` (${errBody.code})` : ''
        throw new Error(
          detail || `Request failed (${response.status})${suffix} - failed to get reply from AI.`,
        )
      }

      const data = await response.json()
      let text = data.text?.trim() || ''
      text = sanitizeCoachPaceMath(text)
      if (unitSystem === 'metric') {
        text = rewriteMetricCoachPaces(text)
      }

      const modelMessage: ChatMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        content: text,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, modelMessage])
    } catch (err) {
      console.error('Chat error:', err)
      setError(err instanceof Error ? err.message : 'Failed to get reply')
    } finally {
      setIsLoading(false)
    }
  }, [messages, profile, unitSystem])

  const clearChat = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearChat,
  }
}
