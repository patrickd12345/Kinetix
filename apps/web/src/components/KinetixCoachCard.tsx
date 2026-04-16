import type { CoachResult } from '../lib/coach/types'

interface KinetixCoachCardProps {
  loading: boolean
  error: string | null
  coach: CoachResult | null
}

function titleCase(value: string): string {
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

export function KinetixCoachCard({ loading, error, coach }: KinetixCoachCardProps) {
  if (loading) {
    return (
      <section className="glass rounded-2xl p-5 border border-white/10" aria-live="polite">
        <p className="text-sm text-slate-600 dark:text-gray-400">Computing coaching decision…</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="glass rounded-2xl p-5 border border-red-500/30" aria-live="polite">
        <p className="text-sm text-red-300">Unable to compute coaching decision: {error}</p>
      </section>
    )
  }

  if (!coach) {
    return (
      <section className="glass rounded-2xl p-5 border border-white/10" aria-live="polite">
        <p className="text-sm text-slate-600 dark:text-gray-400">Not enough data to produce a coaching decision yet.</p>
      </section>
    )
  }

  return (
    <section className="glass rounded-2xl p-5 border border-teal-500/20 space-y-4" aria-label="Kinetix coaching decision">
      <header>
        <h3 className="text-lg font-black text-slate-900 dark:text-white">Kinetix Coaching Brain</h3>
        <p className="text-xs text-slate-600 dark:text-gray-400">Deterministic decision orchestrator across risk, fatigue, phase, and prediction.</p>
      </header>

      <dl className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-slate-600 dark:text-gray-400">Decision</dt>
          <dd className="font-semibold text-slate-900 dark:text-white">{titleCase(coach.decision)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-slate-600 dark:text-gray-400">Confidence</dt>
          <dd className="font-semibold text-slate-900 dark:text-white">{titleCase(coach.confidence)}</dd>
        </div>
      </dl>

      <p className="text-xs text-teal-200">{coach.reason}</p>
    </section>
  )
}
