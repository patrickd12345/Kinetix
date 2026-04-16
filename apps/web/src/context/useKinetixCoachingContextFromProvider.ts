import { useContext } from 'react'
import {
  KinetixCoachingContext,
  type KinetixCoachingContextResult,
} from '../hooks/useKinetixCoachingContext'

export function useKinetixCoachingContextFromProvider(): KinetixCoachingContextResult {
  const value = useContext(KinetixCoachingContext)
  if (!value) {
    throw new Error('KinetixCoachingContextProvider is required for this hook.')
  }
  return value
}
