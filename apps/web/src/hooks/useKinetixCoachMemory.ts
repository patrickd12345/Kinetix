import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../components/providers/useAuth'
import { useKinetixCoachingContext } from './useKinetixCoachingContext'
import { buildTrendSummary } from '../lib/coachMemory/trendSummary'
import { appendCoachMemory, readCoachMemory } from '../lib/coachMemory/memoryStore'
import type { CoachDecisionSnapshot, CoachMemoryResult } from '../lib/coachMemory/types'

function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function useKinetixCoachMemory(options: { persist?: boolean } = {}): {
  loading: boolean
  error: string | null
  memory: CoachMemoryResult | null
  insufficientData: boolean
} {
  const persist = options.persist ?? true
  const { session } = useAuth()
  const authUserId = session?.user?.id ?? ''
  const { loading, error, data } = useKinetixCoachingContext()
  const [history, setHistory] = useState<CoachDecisionSnapshot[]>([])
  const lastWriteKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!authUserId || typeof window === 'undefined') {
      setHistory([])
      lastWriteKeyRef.current = null
      return
    }
    setHistory(readCoachMemory(authUserId, window.localStorage))
    lastWriteKeyRef.current = null
  }, [authUserId])

  useEffect(() => {
    if (!persist) return
    if (!authUserId || !data.coach || typeof window === 'undefined') return
    const day = toDayKey(new Date())
    const writeKey = `${day}:${data.coach.decision}:${data.coach.confidence}`
    if (lastWriteKeyRef.current === writeKey) return
    lastWriteKeyRef.current = writeKey
    const next = appendCoachMemory(
      authUserId,
      {
        date: new Date().toISOString(),
        decision: data.coach.decision,
        confidence: data.coach.confidence,
        reasonSummary: data.coach.reason,
      },
      window.localStorage
    )
    setHistory(next)
  }, [authUserId, data.coach, persist])

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
