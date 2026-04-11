import type { CoachExplanationResult } from '../lib/explainability/types'

interface KinetixCoachExplanationCardProps {
  loading: boolean
  error: string | null
  explanation: CoachExplanationResult | null
  insufficientData: boolean
}

function titleCase(value: string): string {
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

export function KinetixCoachExplanationCard({
  loading,
  error,
  explanation,
  insufficientData,
}: KinetixCoachExplanationCardProps) {
  if (loading) {
    return (
      <section className="glass rounded-2xl p-5 border border-white/10" aria-live="polite">
        <p className="text-sm text-slate-600 dark:text-gray-400">Building coach explanation…</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="glass rounded-2xl p-5 border border-red-500/30" aria-live="polite">
        <p className="text-sm text-red-300">Unable to explain coaching decision: {error}</p>
      </section>
    )
  }

  if (insufficientData || !explanation) {
    return (
      <section className="glass rounded-2xl p-5 border border-white/10" aria-live="polite">
        <p className="text-sm text-slate-600 dark:text-gray-400">Not enough data to explain the coaching decision yet.</p>
      </section>
    )
  }

  return (
    <section className="glass rounded-2xl p-5 border border-sky-500/20 space-y-4" aria-label="Kinetix coach explanation">
      <header>
        <h3 className="text-lg font-black text-slate-900 dark:text-white">Coach Explanation</h3>
        <p className="text-xs text-slate-600 dark:text-gray-400">Decision trace from deterministic evidence.</p>
      </header>

      <dl className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-slate-600 dark:text-gray-400">Decision</dt>
          <dd className="font-semibold text-slate-900 dark:text-white">{titleCase(explanation.decision)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-slate-600 dark:text-gray-400">Confidence</dt>
          <dd className="font-semibold text-slate-900 dark:text-white">{titleCase(explanation.confidence)}</dd>
        </div>
      </dl>

      <p className="text-xs text-sky-800 dark:text-sky-200">{explanation.summary}</p>

      <ul className="space-y-1 text-xs">
        {explanation.evidence.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-3">
            <span className={item.impact === 'primary' ? 'text-slate-900 font-semibold dark:text-white' : 'text-slate-700 dark:text-gray-300'}>
              {item.label}
            </span>
            <span className={item.impact === 'primary' ? 'text-slate-900 font-semibold dark:text-white' : 'text-slate-700 dark:text-gray-300'}>
              {item.value}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
