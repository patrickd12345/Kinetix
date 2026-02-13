/// <reference types="vite/client" />
import { useState, useCallback } from 'react'
import { getCoachContext } from '../lib/ragClient'
import { getPBRun } from '../lib/kpsUtils'
import { useAuth } from '../components/providers/useAuth'
import { toKinetixUserProfile } from '../lib/kinetixProfile'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || 'PASTE_KEY_HERE'
const GEMINI_MODEL = 'gemini-2.5-flash-preview-09-2025'

export interface ChatMessage {
  id: string
  role: 'user' | 'model'
  content: string
  timestamp: number
}

const SYSTEM_INSTRUCTION_BASE = `You are Kinetix AI, a friendly and knowledgeable running coach. You help with training, pacing, Kinetix Performance Score (KPS, the app's normalized performance index), recovery, and form. Keep answers concise and actionable. Use only the COACH CONTEXT below when referring to the user's runs or pacing targets; do not invent NPI, KPS, or pace numbers.`

const GEMINI_KEY_HELP = 'Get a free API key at https://aistudio.google.com/apikey and set VITE_GEMINI_API_KEY in apps/web/.env, then restart the dev server.'

function parseGeminiError(status: number, body: string): string {
  if (status === 400) {
    try {
      const data = JSON.parse(body)
      const msg = data?.error?.message ?? ''
      const reason = data?.error?.details?.[0]?.reason ?? ''
      if (reason === 'API_KEY_INVALID' || msg.includes('API key not valid')) {
        return GEMINI_KEY_HELP
      }
      return msg || body
    } catch {
      return body || `Request failed (${status})`
    }
  }
  return body || `Request failed (${status})`
}

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
    if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('PASTE')) {
      setError(GEMINI_KEY_HELP)
      return
    }

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

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1024,
            },
          }),
        }
      )

      if (!response.ok) {
        const errBody = await response.text()
        throw new Error(parseGeminiError(response.status, errBody))
      }

      const data = await response.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''

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
