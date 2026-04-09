import type { WeeklyCoachReport } from '../lib/weeklyReport/types'

interface KinetixWeeklyCoachReportCardProps {
  loading: boolean
  error: string | null
  report: WeeklyCoachReport | null
  insufficientData: boolean
}

export function KinetixWeeklyCoachReportCard({ loading, error, report, insufficientData }: KinetixWeeklyCoachReportCardProps) {
  if (loading) return <section className="glass rounded-2xl p-5 border border-white/10"><p className="text-sm text-gray-400">Building weekly coach report…</p></section>
  if (error) return <section className="glass rounded-2xl p-5 border border-red-500/30"><p className="text-sm text-red-300">Unable to build weekly report: {error}</p></section>
  if (insufficientData || !report) return <section className="glass rounded-2xl p-5 border border-white/10"><p className="text-sm text-gray-400">Not enough data for weekly coach report yet.</p></section>

  return (
    <section className="glass rounded-2xl p-5 border border-sky-500/20 space-y-3" aria-label="Weekly coach report">
      <header>
        <h3 className="text-lg font-black text-white">{report.title}</h3>
        <p className="text-xs text-sky-100">{report.summary}</p>
      </header>
      <dl className="space-y-2 text-sm">
        {report.sections.map((section) => (
          <div key={section.label} className="flex items-start justify-between gap-4 border-b border-white/5 pb-1">
            <dt className="text-gray-400">{section.label}</dt>
            <dd className="text-white text-right">{section.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
