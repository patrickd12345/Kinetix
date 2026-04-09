import type { GoalProbabilityResult } from '../lib/goalProbability/types'

interface KinetixGoalProbabilityCardProps {
  loading: boolean
  error: string | null
  goalProbability: GoalProbabilityResult | null
  insufficientData: boolean
}

function titleCaseConfidence(c: GoalProbabilityResult['confidence']): string {
  return c.charAt(0).toUpperCase() + c.slice(1)
}

function titleCaseDirection(d: GoalProbabilityResult['direction']): string {
  return d.charAt(0).toUpperCase() + d.slice(1)
}

export function KinetixGoalProbabilityCard({
  loading,
  error,
  goalProbability,
  insufficientData,
}: KinetixGoalProbabilityCardProps) {
  if (loading) {
    return (
      <section className="glass rounded-2xl p-5 border border-white/10">
        <p className="text-sm text-gray-400">Computing goal probability…</p>
      </section>
    )
  }
  if (error) {
    return (
      <section className="glass rounded-2xl p-5 border border-red-500/30">
        <p className="text-sm text-red-300">Unable to compute goal probability: {error}</p>
      </section>
    )
  }
  if (insufficientData || !goalProbability) {
    return (
      <section className="glass rounded-2xl p-5 border border-white/10">
        <p className="text-sm text-gray-400">Set a race goal with progress to see goal probability.</p>
      </section>
    )
  }

  const gp = goalProbability

  return (
    <section className="glass rounded-2xl p-5 border border-emerald-500/25 space-y-3" aria-label="Goal probability">
      <header>
        <h3 className="text-lg font-black text-white">Goal probability</h3>
        <p className="text-xs text-gray-400">Deterministic blend of prediction, readiness, simulation, timeline, goal progress, and coach memory (no AI).</p>
      </header>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-4xl font-black text-white tabular-nums">{gp.probability}</span>
        <span className="text-xs text-gray-400 shrink-0">/ 100</span>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-emerald-200">
          Confidence: {titleCaseConfidence(gp.confidence)}
        </span>
        <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-emerald-100">
          Direction: {titleCaseDirection(gp.direction)}
        </span>
      </div>
      <p className="text-sm text-gray-200 leading-relaxed">{gp.summary}</p>
    </section>
  )
}
