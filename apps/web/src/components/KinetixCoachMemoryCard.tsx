import type { CoachMemoryResult } from '../lib/coachMemory/types'

interface KinetixCoachMemoryCardProps {
  loading: boolean
  error: string | null
  memory: CoachMemoryResult | null
  insufficientData: boolean
}

function titleCase(value: string): string {
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

export function KinetixCoachMemoryCard({
  loading,
  error,
  memory,
  insufficientData,
}: KinetixCoachMemoryCardProps) {
  if (loading) {
    return (
      <section className="glass rounded-2xl p-5 border border-white/10" aria-live="polite">
        <p className="text-sm text-slate-600 dark:text-gray-400">Loading coaching memory…</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="glass rounded-2xl p-5 border border-red-500/30" aria-live="polite">
        <p className="text-sm text-red-300">Unable to load coaching memory: {error}</p>
      </section>
    )
  }

  if (insufficientData || !memory) {
    return (
      <section className="glass rounded-2xl p-5 border border-white/10" aria-live="polite">
        <p className="text-sm text-slate-600 dark:text-gray-400">No coaching memory yet.</p>
      </section>
    )
  }

  return (
    <section className="glass rounded-2xl p-5 border border-violet-500/20 space-y-3" aria-label="Kinetix coach memory">
      <header>
        <h3 className="text-lg font-black text-slate-900 dark:text-white">Coach Memory</h3>
      </header>
      <p className="text-xs text-violet-200">{memory.trendSummary}</p>
      <div className="text-xs text-slate-700 dark:text-gray-300">
        Latest: {memory.latest ? titleCase(memory.latest.decision) : '—'}
      </div>
      <ul className="space-y-1 text-xs text-slate-700 dark:text-gray-300">
        {memory.history.slice(-4).map((item) => (
          <li key={`${item.date}:${item.decision}`} className="flex items-center justify-between">
            <span>{item.date.slice(0, 10)}</span>
            <span>{titleCase(item.decision)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
