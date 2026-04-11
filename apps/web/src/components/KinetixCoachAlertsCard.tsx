import type { CoachAlertsResult, CoachAlertPriority } from '../lib/alerts/types'

interface KinetixCoachAlertsCardProps {
  loading: boolean
  error: string | null
  alerts: CoachAlertsResult
  insufficientData: boolean
}

function priorityClass(priority: CoachAlertPriority): string {
  if (priority === 'high') return 'text-red-300'
  if (priority === 'medium') return 'text-amber-300'
  return 'text-emerald-300'
}

export function KinetixCoachAlertsCard({ loading, error, alerts, insufficientData }: KinetixCoachAlertsCardProps) {
  if (loading) return <section className="glass rounded-2xl p-5 border border-white/10"><p className="text-sm text-slate-600 dark:text-gray-400">Checking coaching alerts…</p></section>
  if (error) return <section className="glass rounded-2xl p-5 border border-red-500/30"><p className="text-sm text-red-300">Unable to compute coaching alerts: {error}</p></section>
  if (insufficientData || alerts.alerts.length === 0) return <section className="glass rounded-2xl p-5 border border-white/10"><p className="text-sm text-slate-600 dark:text-gray-400">No coaching alerts right now.</p></section>

  return (
    <section className="glass rounded-2xl p-5 border border-amber-500/20 space-y-3" aria-label="Coaching alerts">
      <header>
        <h3 className="text-lg font-black text-slate-900 dark:text-white">Coaching Alerts</h3>
      </header>
      <ul className="space-y-2">
        {alerts.alerts.map((alert) => (
          <li key={alert.type} className="rounded-lg border border-white/10 px-3 py-2">
            <p className={`text-xs font-semibold uppercase tracking-wide ${priorityClass(alert.priority)}`}>{alert.priority}</p>
            <p className="text-sm text-slate-900 dark:text-white">{alert.message}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
