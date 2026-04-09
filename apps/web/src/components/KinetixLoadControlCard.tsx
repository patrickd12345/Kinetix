import type { LoadControlResult } from '../lib/loadControl/types'

interface KinetixLoadControlCardProps {
  loading: boolean
  error: string | null
  loadControl: LoadControlResult | null
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function KinetixLoadControlCard({ loading, error, loadControl }: KinetixLoadControlCardProps) {
  if (loading) {
    return (
      <section className="glass rounded-2xl p-5 border border-white/10" aria-live="polite">
        <p className="text-sm text-gray-400">Computing adaptive load control…</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="glass rounded-2xl p-5 border border-red-500/30" aria-live="polite">
        <p className="text-sm text-red-300">Unable to compute load control: {error}</p>
      </section>
    )
  }

  if (!loadControl) {
    return (
      <section className="glass rounded-2xl p-5 border border-white/10" aria-live="polite">
        <p className="text-sm text-gray-400">Not enough data to compute load-control guidance yet.</p>
      </section>
    )
  }

  return (
    <section className="glass rounded-2xl p-5 border border-rose-500/20 space-y-4" aria-label="Kinetix load control">
      <header>
        <h3 className="text-lg font-black text-white">Adaptive Load Controller</h3>
        <p className="text-xs text-gray-400">Deterministic injury-risk and load-progression guardrails.</p>
      </header>

      <dl className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-gray-400">Current weekly load</dt>
          <dd className="font-semibold text-white">{loadControl.currentWeeklyLoad.toFixed(1)} km</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-gray-400">Ramp rate</dt>
          <dd className="font-semibold text-white">{loadControl.rampRate.toFixed(1)}%</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-gray-400">Risk</dt>
          <dd className="font-semibold text-white">{titleCase(loadControl.riskLevel)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-gray-400">Recommended load</dt>
          <dd className="font-semibold text-white">{loadControl.recommendedLoad.toFixed(1)} km</dd>
        </div>
      </dl>

      <p className="text-xs text-rose-200">{loadControl.recommendation}</p>
    </section>
  )
}
