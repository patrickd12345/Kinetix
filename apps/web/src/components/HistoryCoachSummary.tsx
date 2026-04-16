import { KinetixCoachingContextProvider } from '../context/KinetixCoachingContextProvider'
import { useKinetixCoach } from '../hooks/useKinetixCoach'
import { KinetixCoachCard } from './KinetixCoachCard'

function HistoryCoachSummaryInner() {
  const { loading: coachLoading, error: coachError, coach } = useKinetixCoach()
  return <KinetixCoachCard loading={coachLoading} error={coachError} coach={coach} />
}

/** Optional coaching summary for History: one coach card with a single shared context build. */
export function HistoryCoachSummaryWithProvider() {
  return (
    <KinetixCoachingContextProvider>
      <HistoryCoachSummaryInner />
    </KinetixCoachingContextProvider>
  )
}
