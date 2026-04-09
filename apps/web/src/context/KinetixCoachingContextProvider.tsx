import React, { createContext, useContext } from 'react'
import {
  useKinetixCoachingContext,
  type KinetixCoachingContextResult,
} from '../hooks/useKinetixCoachingContext'

export const KinetixCoachingContext =
  createContext<KinetixCoachingContextResult | null>(null)

export function KinetixCoachingContextProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const value = useKinetixCoachingContext()
  return (
    <KinetixCoachingContext.Provider value={value}>
      {children}
    </KinetixCoachingContext.Provider>
  )
}

export function useKinetixCoachingContextFromProvider(): KinetixCoachingContextResult {
  const value = useContext(KinetixCoachingContext)
  if (!value) {
    throw new Error('KinetixCoachingContextProvider is required for this hook.')
  }
  return value
}

export function useOptionalKinetixCoachingContextFromProvider(): KinetixCoachingContextResult | null {
  return useContext(KinetixCoachingContext)
}
