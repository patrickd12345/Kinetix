import React from 'react'
import { KinetixCoachingContext, useKinetixCoachingContextState } from '../hooks/useKinetixCoachingContext'

export function KinetixCoachingContextProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const value = useKinetixCoachingContextState()
  return (
    <KinetixCoachingContext.Provider value={value}>
      {children}
    </KinetixCoachingContext.Provider>
  )
}
