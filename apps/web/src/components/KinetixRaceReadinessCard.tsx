import type { RaceReadinessResult } from '../lib/readinessScore/types'

interface KinetixRaceReadinessCardProps {
  loading: boolean
  error: string | null
  readiness: RaceReadinessResult | null
  insufficientData: boolean
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function KinetixRaceReadinessCard({
  loading,
  error,
  readiness,
  insufficientData,
}: KinetixRaceReadinessCardProps) {
  if (loading) return <section className="glass rounded-2xl p-5 border border-white/10"><p className="text-sm text-gray-400">Computing race readiness…</p></section>
  if (error) return <section className="glass rounded-2xl p-5 border border-red-500/30"><p className="text-sm text-red-300">Unable to compute race readiness: {error}</p></section>
  if (insufficientData || !readiness) return <section className="glass rounded-2xl p-5 border border-white/10"><p className="text-sm text-gray-400">Not enough data for race readiness yet.</p></section>

  return (
    <section className="glass rounded-2xl p-5 border border-cyan-500/20 space-y-3" aria-label="Race readiness">
      <header>
        <h3 className="text-lg font-black text-white">Race Readiness</h3>
        <p className="text-xs text-gray-400">Deterministic score from fatigue, risk, prediction, and phase alignment.</p>
      </header>
      <div className="flex items-center justify-between">
        <span className="text-3xl font-black text-white">{readiness.score}</span>
        <span className="text-sm font-semibold text-cyan-200">{titleCase(readiness.status)}</span>
      </div>
      <p className="text-xs text-cyan-100">{readiness.summary}</p>
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div><dt className="text-gray-400">Fatigue</dt><dd className="text-white">{readiness.components.fatigue}/30</dd></div>
        <div><dt className="text-gray-400">Load risk</dt><dd className="text-white">{readiness.components.loadRisk}/20</dd></div>
        <div><dt className="text-gray-400">Prediction</dt><dd className="text-white">{readiness.components.predictionTrend}/20</dd></div>
        <div><dt className="text-gray-400">Phase</dt><dd className="text-white">{readiness.components.phaseAlignment}/15</dd></div>
        <div><dt className="text-gray-400">Goal</dt><dd className="text-white">{readiness.components.goalProximity}/15</dd></div>
      </dl>
    </section>
  )
}
