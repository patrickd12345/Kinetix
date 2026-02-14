/// <reference types="vite/client" />
import { useState } from 'react'

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
      const response = await fetch('/api/ai-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}))
        throw new Error(errBody.error || 'Failed to analyze run')
      }

      const data = await response.json()
      const text = data.text

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
