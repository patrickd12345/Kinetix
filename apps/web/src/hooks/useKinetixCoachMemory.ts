import { useEffect, useMemo, useRef, useState } from 'react'
import { useKinetixCoachingContext } from './useKinetixCoachingContext'
import { buildTrendSummary } from '../lib/coachMemory/trendSummary'
import { appendCoachMemory, readCoachMemory } from '../lib/coachMemory/memoryStore'
import type { CoachMemoryResult } from '../lib/coachMemory/types'
import { useOptionalKinetixCoachingContextFromProvider } from '../context/KinetixCoachingContextProvider'

function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function useKinetixCoachMemory(): {
  loading: boolean
  error: string | null
  memory: CoachMemoryResult | null
  insufficientData: boolean
}
export function useKinetixCoachMemory(options: { persist?: boolean }): {
  loading: boolean
  error: string | null
  memory: CoachMemoryResult | null
  insufficientData: boolean
} 
export function useKinetixCoachMemory(options: { persist?: boolean } = {}) {
  const persist = options.persist ?? true
  const provided = useOptionalKinetixCoachingContextFromProvider()
  const { loading, error, data } = provided ?? useKinetixCoachingContext()
  const [history, setHistory] = useState(() => {
    if (typeof window === 'undefined') return []
    return readCoachMemory(window.localStorage)
  })
  const lastWriteKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!persist) return
    if (!data.coach || typeof window === 'undefined') return
    const day = toDayKey(new Date())
    const writeKey = `${day}:${data.coach.decision}:${data.coach.confidence}`
    if (lastWriteKeyRef.current === writeKey) return
    lastWriteKeyRef.current = writeKey
    const next = appendCoachMemory(
      {
        date: new Date().toISOString(),
        decision: data.coach.decision,
        confidence: data.coach.confidence,
        reasonSummary: data.coach.reason,
      },
      window.localStorage
    )
    setHistory(next)
  }, [data.coach, persist])

  const memory = useMemo<CoachMemoryResult | null>(() => {
    if (!data.coach && history.length === 0) return null
    return {
      history,
      latest: history.at(-1) ?? null,
      trendSummary: buildTrendSummary(history),
    }
  }, [data.coach, history])

  return {
    loading,
    error,
    memory,
    insufficientData: !loading && !error && memory == null,
  }
}
