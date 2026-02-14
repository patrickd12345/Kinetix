/// <reference types="vite/client" />
import { useState, useCallback } from 'react'
import { getCoachContext } from '../lib/ragClient'
import { getPBRun } from '../lib/kpsUtils'
import { useAuth } from '../components/providers/useAuth'
import { toKinetixUserProfile } from '../lib/kinetixProfile'

export interface ChatMessage {
  id: string
  role: 'user' | 'model'
  content: string
  timestamp: number
}

const SYSTEM_INSTRUCTION_BASE = `You are Kinetix AI, a friendly and knowledgeable running coach. You help with training, pacing, Kinetix Performance Score (KPS, the app's normalized performance index), recovery, and form. Keep answers concise and actionable. Use only the COACH CONTEXT below when referring to the user's runs or pacing targets; do not invent NPI, KPS, or pace numbers.`

function buildContents(messages: ChatMessage[]): Array<{ role: string; parts: Array<{ text: string }> }> {
  return messages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }))
}

export function useChat() {
  const { profile } = useAuth()
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
      const ragContext = await getCoachContext(trimmed, userProfile, pbRun)
      const systemInstruction =
        SYSTEM_INSTRUCTION_BASE +
        `\n\nCOACH CONTEXT (from RAG — use this data; do not invent run data):\n${ragContext}`

      const history = [...messages, userMessage]
      const contents = buildContents(history)

      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemInstruction, contents }),
      })

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}))
        throw new Error(errBody.error || 'Failed to get reply from AI.')
      }

      const data = await response.json()
      const text = data.text?.trim() || ''

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
  }, [messages, profile])

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
