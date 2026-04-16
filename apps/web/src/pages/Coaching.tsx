import { KinetixIntelligenceCard } from '../components/KinetixIntelligenceCard'
import { KinetixTrainingPlanCard } from '../components/KinetixTrainingPlanCard'
import { KinetixGoalProgressCard } from '../components/KinetixGoalProgressCard'
import { KinetixRaceSimulationCard } from '../components/KinetixRaceSimulationCard'
import { KinetixPeriodizationCard } from '../components/KinetixPeriodizationCard'
import { KinetixLoadControlCard } from '../components/KinetixLoadControlCard'
import { KinetixCoachCard } from '../components/KinetixCoachCard'
import { KinetixCoachExplanationCard } from '../components/KinetixCoachExplanationCard'
import { KinetixCoachMemoryCard } from '../components/KinetixCoachMemoryCard'
import { KinetixRaceReadinessCard } from '../components/KinetixRaceReadinessCard'
import { KinetixCoachAlertsCard } from '../components/KinetixCoachAlertsCard'
import { KinetixWeeklyCoachReportCard } from '../components/KinetixWeeklyCoachReportCard'
import { KinetixTimelineCard } from '../components/KinetixTimelineCard'
import { KinetixGoalProbabilityCard } from '../components/KinetixGoalProbabilityCard'
import { KinetixTrainingCalendarCard } from '../components/KinetixTrainingCalendarCard'
import { useKinetixIntelligence } from '../hooks/useKinetixIntelligence'
import { useKinetixTrainingPlanFromIntelligence } from '../hooks/useKinetixTrainingPlan'
import { useKinetixRaceSimulation } from '../hooks/useKinetixRaceSimulation'
import { useKinetixPeriodization } from '../hooks/useKinetixPeriodization'
import { useKinetixLoadControl } from '../hooks/useKinetixLoadControl'
import { useKinetixCoach } from '../hooks/useKinetixCoach'
import { useKinetixCoachExplanation } from '../hooks/useKinetixCoachExplanation'
import { useKinetixCoachMemory } from '../hooks/useKinetixCoachMemory'
import { useKinetixRaceReadiness } from '../hooks/useKinetixRaceReadiness'
import { useKinetixCoachAlerts } from '../hooks/useKinetixCoachAlerts'
import { useKinetixWeeklyCoachReport } from '../hooks/useKinetixWeeklyCoachReport'
import { useKinetixTimeline } from '../hooks/useKinetixTimeline'
import { useKinetixGoalProbability } from '../hooks/useKinetixGoalProbability'
import { useKinetixTrainingCalendar } from '../hooks/useKinetixTrainingCalendar'
import { KinetixCoachingContextProvider } from '../context/KinetixCoachingContextProvider'

/** Coaching cards + hooks; must render under a single `KinetixCoachingContextProvider`. */
export function CoachingStack() {
  const {
    loading: intelligenceLoading,
    error: intelligenceError,
    result: intelligenceResult,
    samples: intelligenceSamples,
  } = useKinetixIntelligence()
  const {
    loading: trainingPlanLoading,
    error: trainingPlanError,
    plan: trainingPlan,
    goalProgress,
  } = useKinetixTrainingPlanFromIntelligence({
    loading: intelligenceLoading,
    error: intelligenceError,
    result: intelligenceResult,
    samples: intelligenceSamples,
  })
  const { loading: simulationLoading, error: simulationError, simulation } = useKinetixRaceSimulation()
  const {
    loading: periodizationLoading,
    error: periodizationError,
    periodization,
    isGoalDriven: isPeriodizationGoalDriven,
  } = useKinetixPeriodization()
  const { loading: loadControlLoading, error: loadControlError, loadControl } = useKinetixLoadControl()
  const { loading: coachLoading, error: coachError, coach } = useKinetixCoach()
  const {
    loading: coachExplanationLoading,
    error: coachExplanationError,
    explanation: coachExplanation,
    insufficientData: coachExplanationInsufficient,
  } = useKinetixCoachExplanation()
  const {
    loading: coachMemoryLoading,
    error: coachMemoryError,
    memory: coachMemory,
    insufficientData: coachMemoryInsufficient,
  } = useKinetixCoachMemory()
  const {
    loading: readinessLoading,
    error: readinessError,
    readiness,
    insufficientData: readinessInsufficient,
  } = useKinetixRaceReadiness()
  const {
    loading: alertsLoading,
    error: alertsError,
    alerts,
    insufficientData: alertsInsufficient,
  } = useKinetixCoachAlerts()
  const {
    loading: weeklyReportLoading,
    error: weeklyReportError,
    report: weeklyReport,
    insufficientData: weeklyReportInsufficient,
  } = useKinetixWeeklyCoachReport()
  const {
    loading: timelineLoading,
    error: timelineError,
    timeline,
    insufficientData: timelineInsufficient,
  } = useKinetixTimeline()
  const {
    loading: goalProbabilityLoading,
    error: goalProbabilityError,
    goalProbability,
    insufficientData: goalProbabilityInsufficient,
  } = useKinetixGoalProbability({ timeline })
  const {
    loading: trainingCalendarLoading,
    error: trainingCalendarError,
    calendar,
    insufficientData: trainingCalendarInsufficient,
  } = useKinetixTrainingCalendar()

  return (
    <>
      <section className="space-y-4" aria-label="Primary coaching">
        <KinetixCoachCard loading={coachLoading} error={coachError} coach={coach} />
        <KinetixCoachExplanationCard
          loading={coachExplanationLoading}
          error={coachExplanationError}
          explanation={coachExplanation}
          insufficientData={coachExplanationInsufficient}
        />
        <KinetixRaceReadinessCard
          loading={readinessLoading}
          error={readinessError}
          readiness={readiness}
          insufficientData={readinessInsufficient}
        />
        <KinetixCoachAlertsCard
          loading={alertsLoading}
          error={alertsError}
          alerts={alerts}
          insufficientData={alertsInsufficient}
        />
        <KinetixWeeklyCoachReportCard
          loading={weeklyReportLoading}
          error={weeklyReportError}
          report={weeklyReport}
          insufficientData={weeklyReportInsufficient}
        />
        <KinetixTimelineCard
          loading={timelineLoading}
          error={timelineError}
          timeline={timeline}
          insufficientData={timelineInsufficient}
        />
        <KinetixGoalProbabilityCard
          loading={goalProbabilityLoading}
          error={goalProbabilityError}
          goalProbability={goalProbability}
          insufficientData={goalProbabilityInsufficient}
        />
      </section>

      <section className="mt-8 space-y-4" aria-label="Planning">
        <KinetixGoalProgressCard
          loading={trainingPlanLoading}
          error={trainingPlanError}
          progress={goalProgress}
        />
        <KinetixRaceSimulationCard
          loading={simulationLoading}
          error={simulationError}
          simulation={simulation}
        />
        <KinetixPeriodizationCard
          loading={periodizationLoading}
          error={periodizationError}
          periodization={periodization}
          isGoalDriven={isPeriodizationGoalDriven}
        />
        <KinetixLoadControlCard
          loading={loadControlLoading}
          error={loadControlError}
          loadControl={loadControl}
        />
        <KinetixTrainingPlanCard
          loading={trainingPlanLoading}
          error={trainingPlanError}
          plan={trainingPlan}
        />
        <KinetixTrainingCalendarCard
          loading={trainingCalendarLoading}
          error={trainingCalendarError}
          calendar={calendar}
          insufficientData={trainingCalendarInsufficient}
        />
      </section>

      <section className="mt-8 space-y-4" aria-label="Insights">
        <KinetixIntelligenceCard
          loading={intelligenceLoading}
          error={intelligenceError}
          result={intelligenceResult}
        />
        <KinetixCoachMemoryCard
          loading={coachMemoryLoading}
          error={coachMemoryError}
          memory={coachMemory}
          insufficientData={coachMemoryInsufficient}
        />
      </section>
    </>
  )
}

function CoachingPageInner() {
  return (
    <div className="pb-20 lg:pb-4">
      <div className="max-w-md lg:max-w-7xl mx-auto space-y-2">
        <h1 className="text-2xl font-bold mb-6">Coaching</h1>
        <CoachingStack />
      </div>
    </div>
  )
}

export default function Coaching() {
  return (
    <KinetixCoachingContextProvider>
      <CoachingPageInner />
    </KinetixCoachingContextProvider>
  )
}
