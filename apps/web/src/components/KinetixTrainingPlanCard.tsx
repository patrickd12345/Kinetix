import type { TrainingPlanResult } from '../lib/trainingPlan/types'

interface KinetixTrainingPlanCardProps {
  loading: boolean
  error: string | null
  plan: TrainingPlanResult | null
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function renderDuration(value: number | null): string {
  return value == null ? 'Rest' : `${value} min`
}

export function KinetixTrainingPlanCard({ loading, error, plan }: KinetixTrainingPlanCardProps) {
  if (loading) {
    return (
      <section className="glass rounded-2xl p-5 border border-white/10" aria-live="polite">
        <p className="text-sm text-slate-600 dark:text-gray-400">Building training prescription…</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="glass rounded-2xl p-5 border border-red-500/30" aria-live="polite">
        <p className="text-sm text-red-300">Unable to build training plan: {error}</p>
      </section>
    )
  }

  if (!plan) {
    return (
      <section className="glass rounded-2xl p-5 border border-white/10" aria-live="polite">
        <p className="text-sm text-slate-600 dark:text-gray-400">Not enough data to prescribe a training plan yet.</p>
      </section>
    )
  }

  return (
    <section className="glass rounded-2xl p-5 border border-purple-500/20 space-y-4" aria-label="Kinetix training plan">
      <header>
        <h3 className="text-lg font-black text-slate-900 dark:text-white">Training Prescription</h3>
        <p className="text-xs text-slate-600 dark:text-gray-400">Deterministic recommendation based on readiness, fatigue, trend, and plan guardrails.</p>
      </header>

      <div className="rounded-xl border border-slate-200/90 bg-slate-50/90 p-3 dark:border-white/10 dark:bg-black/20">
        <p className="text-xs uppercase tracking-wide text-purple-800 mb-1 dark:text-purple-300">Today</p>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          {titleCase(plan.today.sessionType)} · {renderDuration(plan.today.durationMinutes)}
          {plan.today.intensity ? ` · ${titleCase(plan.today.intensity)}` : ''}
        </p>
        <p className="text-xs text-slate-600 dark:text-gray-400 mt-1">{plan.today.rationale}</p>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-slate-600 dark:text-gray-400 mb-2">7-day micro-plan</p>
        {plan.weeklyEmphasis && (
          <p className="mb-2 text-xs text-purple-800 dark:text-purple-300">Weekly emphasis: {plan.weeklyEmphasis}</p>
        )}
        <ul className="space-y-2">
          {plan.week.map((session) => (
            <li key={session.dayOffset} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/90 px-3 py-2 dark:border-white/10">
              <span className="text-sm text-slate-700 dark:text-gray-300">{session.label}</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {titleCase(session.sessionType)} · {renderDuration(session.durationMinutes)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
