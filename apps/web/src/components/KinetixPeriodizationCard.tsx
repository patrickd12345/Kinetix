import type { PeriodizationResult } from '../lib/periodization/types'

interface KinetixPeriodizationCardProps {
  loading: boolean
  error: string | null
  periodization: PeriodizationResult
  isGoalDriven: boolean
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function KinetixPeriodizationCard({
  loading,
  error,
  periodization,
  isGoalDriven,
}: KinetixPeriodizationCardProps) {
  if (loading) {
    return (
      <section className="glass rounded-2xl p-5 border border-white/10" aria-live="polite">
        <p className="text-sm text-gray-400">Computing adaptive periodization…</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="glass rounded-2xl p-5 border border-red-500/30" aria-live="polite">
        <p className="text-sm text-red-300">Unable to compute periodization: {error}</p>
      </section>
    )
  }

  return (
    <section className="glass rounded-2xl p-5 border border-indigo-500/20 space-y-4" aria-label="Kinetix periodization">
      <header>
        <h3 className="text-lg font-black text-white">Adaptive Periodization</h3>
        <p className="text-xs text-gray-400">
          {isGoalDriven ? 'Goal-driven multi-week phase guidance' : 'Fallback phase guidance (set a goal for adaptive mode)'}
        </p>
      </header>

      <dl className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-gray-400">Phase</dt>
          <dd className="font-semibold text-white">{titleCase(periodization.phase)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-gray-400">Weeks remaining</dt>
          <dd className="font-semibold text-white">{periodization.weeksRemaining}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-gray-400">Next phase</dt>
          <dd className="font-semibold text-white">
            {periodization.nextPhase ? titleCase(periodization.nextPhase) : '—'}
          </dd>
        </div>
      </dl>

      <p className="text-xs text-indigo-200">{periodization.focus}</p>
    </section>
  )
}
