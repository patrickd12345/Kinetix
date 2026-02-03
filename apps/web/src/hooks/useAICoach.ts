/// <reference types="vite/client" />
import { useState, useCallback } from 'react'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || 'PASTE_KEY_HERE'

export interface AIResult {
  title: string
  insight: string
}

export function useAICoach() {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [aiResult, setAiResult] = useState<AIResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const analyzeRun = useCallback(async (
    distance: number,
    pace: string,
    npi: number,
    target: number,
    duration: number,
    heartRate?: number
  ) => {
    if (GEMINI_API_KEY.includes('PASTE')) {
      setError('Please set VITE_GEMINI_API_KEY in your .env file')
      return
    }

    setIsAnalyzing(true)
    setError(null)
    setAiResult(null)

    const prompt = `You are Kinetix AI, a scientific running coach. Analyze this run performance:

Distance: ${distance.toFixed(2)} km
Time: ${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}
Pace: ${pace} per km
NPI (Normalized Performance Index): ${Math.floor(npi)}
Target NPI: ${Math.round(target)}
${heartRate ? `Average Heart Rate: ${Math.floor(heartRate)} BPM` : ''}

Provide a JSON response with:
{
  "title": "A concise scientific title (max 50 chars)",
  "insight": "Detailed feedback on performance, what went well, areas for improvement, and specific recommendations based on NPI analysis (2-3 sentences)"
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

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
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
  }, [])

  const clearResult = useCallback(() => {
    setAiResult(null)
    setError(null)
  }, [])

  return {
    isAnalyzing,
    aiResult,
    error,
    analyzeRun,
    clearResult,
  }
}
