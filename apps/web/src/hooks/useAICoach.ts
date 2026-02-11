/// <reference types="vite/client" />
import { useState } from 'react'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || 'PASTE_KEY_HERE'

const GEMINI_KEY_HELP = 'Get a free API key at https://aistudio.google.com/apikey and set VITE_GEMINI_API_KEY in apps/web/.env, then restart the dev server.'

function parseGeminiError(status: number, body: string): string {
  if (status === 400) {
    try {
      const data = JSON.parse(body)
      const reason = data?.error?.details?.[0]?.reason ?? ''
      const msg = data?.error?.message ?? ''
      if (reason === 'API_KEY_INVALID' || msg.includes('API key not valid')) return GEMINI_KEY_HELP
      return msg || body
    } catch {
      return body || `Request failed (${status})`
    }
  }
  return body || `Request failed (${status})`
}

export interface AIResult {
  title: string
  insight: string
}

export function useAICoach() {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [aiResult, setAiResult] = useState<AIResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const analyzeRun = async (
    distance: number,
    pace: string,
    kps: number,
    target: number,
    duration: number,
    heartRate?: number
  ) => {
    if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('PASTE')) {
      setError(GEMINI_KEY_HELP)
      return
    }

    setIsAnalyzing(true)
    setError(null)
    setAiResult(null)

    const prompt = `You are Kinetix AI, a scientific running coach. Analyze this run performance:

Distance: ${distance.toFixed(2)} km
Time: ${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}
Pace: ${pace} per km
Kinetix Performance Score: ${Math.floor(kps)}
Target score: ${Math.round(target)}
${heartRate ? `Average Heart Rate: ${Math.floor(heartRate)} BPM` : ''}

Provide a JSON response with:
{
  "title": "A concise scientific title (max 50 chars)",
  "insight": "Detailed feedback on performance, what went well, areas for improvement, and specific recommendations based on Kinetix Performance Score analysis (2-3 sentences)"
}`

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        }
      )

      const bodyText = await response.text()
      if (!response.ok) {
        throw new Error(parseGeminiError(response.status, bodyText))
      }

      const data = JSON.parse(bodyText)
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text

      if (text) {
        try {
          const result = JSON.parse(text)
          setAiResult(result)
        } catch (parseError) {
          // Fallback if JSON parsing fails
          setAiResult({
            title: 'Analysis Complete',
            insight: text.substring(0, 200),
          })
        }
      } else {
        throw new Error('No response from AI')
      }
    } catch (err) {
      console.error('AI Coach Error:', err)
      setError(err instanceof Error ? err.message : 'Failed to analyze run')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const clearResult = () => {
    setAiResult(null)
    setError(null)
  }

  return {
    isAnalyzing,
    aiResult,
    error,
    analyzeRun,
    clearResult,
  }
}
