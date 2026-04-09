import type { IntelligenceResult } from '../lib/intelligence/types'

interface KinetixIntelligenceCardProps {
  result: IntelligenceResult | null
  loading: boolean
  error?: string | null
}

function formatTrend(trend: number): string {
  const rounded = trend.toFixed(1)
  return trend > 0 ? `+${rounded}` : rounded
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function KinetixIntelligenceCard({ result, loading, error = null }: KinetixIntelligenceCardProps) {
  if (loading) {
    return (
      <section className="glass rounded-2xl p-5 border border-white/10" aria-live="polite">
        <p className="text-sm text-gray-400">Computing performance intelligence…</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="glass rounded-2xl p-5 border border-red-500/30" aria-live="polite">
        <p className="text-sm text-red-300">Unable to compute intelligence: {error}</p>
      </section>
    )
  }

  if (!result) {
    return (
      <section className="glass rounded-2xl p-5 border border-white/10" aria-live="polite">
        <p className="text-sm text-gray-400">Not enough data to compute intelligence yet.</p>
      </section>
    )
  }

  return (
    <section className="glass rounded-2xl p-5 border border-cyan-500/20 space-y-4" aria-label="Kinetix intelligence">
      <div>
        <h3 className="text-lg font-black text-white">Kinetix Intelligence</h3>
        <p className="text-xs text-gray-400">Performance Intelligence Engine (KPS-based)</p>
      </div>

      <dl className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-gray-400">Readiness</dt>
          <dd className="font-semibold text-white">{result.readiness.score} ({titleCase(result.readiness.status)})</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-gray-400">Fatigue</dt>
          <dd className="font-semibold text-white">{titleCase(result.fatigue.level)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-gray-400">Recommendation</dt>
          <dd className="font-semibold text-cyan-300">{result.recommendation.message}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-gray-400">Trend</dt>
          <dd className="font-semibold text-white">{formatTrend(result.trend)}</dd>
        </div>
      </dl>
    </section>
  )
}
