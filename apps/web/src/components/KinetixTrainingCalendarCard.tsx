import type { TrainingCalendarResult } from '../lib/trainingCalendar/types'

interface KinetixTrainingCalendarCardProps {
  loading: boolean
  error: string | null
  calendar: TrainingCalendarResult | null
  insufficientData: boolean
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatDuration(value: number | null): string {
  return value == null ? 'Rest' : `${value} min`
}

export function KinetixTrainingCalendarCard({ loading, error, calendar, insufficientData }: KinetixTrainingCalendarCardProps) {
  if (loading) return <section className="glass rounded-2xl p-5 border border-white/10"><p className="text-sm text-slate-600 dark:text-gray-400">Building adaptive training calendar…</p></section>
  if (error) return <section className="glass rounded-2xl p-5 border border-red-500/30"><p className="text-sm text-red-300">Unable to build training calendar: {error}</p></section>
  if (insufficientData || !calendar || calendar.days.length === 0) return <section className="glass rounded-2xl p-5 border border-white/10"><p className="text-sm text-slate-600 dark:text-gray-400">No calendar horizon available yet.</p></section>

  return (
    <section className="glass rounded-2xl p-5 border border-indigo-500/20 space-y-3" aria-label="Adaptive training calendar">
      <header>
        <h3 className="text-lg font-black text-slate-900 dark:text-white">Adaptive Training Calendar</h3>
        <p className="text-xs text-slate-600 dark:text-gray-400">{calendar.horizonDays}-day deterministic view from current training plan.</p>
      </header>
      <ul className="space-y-2 text-sm">
        {calendar.days.map((day) => (
          <li key={day.date} className="rounded-lg border border-white/10 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-700 dark:text-gray-300">{day.label} · {day.date}</span>
              <span className="font-semibold text-slate-900 dark:text-white">{titleCase(day.sessionType)} · {formatDuration(day.durationMinutes)}</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-gray-400">{day.intensity ? `Intensity: ${titleCase(day.intensity)} · ` : ''}{day.note}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
