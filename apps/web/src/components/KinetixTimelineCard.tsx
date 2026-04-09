import type { TimelineEngineResult, TimelineEventType } from '../lib/timeline/types'

interface KinetixTimelineCardProps {
  loading: boolean
  error: string | null
  timeline: TimelineEngineResult | null
  insufficientData: boolean
}

function labelForType(type: TimelineEventType): string {
  switch (type) {
    case 'peak_window':
      return 'Peak window'
    case 'fatigue_risk':
      return 'Fatigue risk'
    case 'performance_projection':
      return 'Performance'
    case 'taper_window':
      return 'Taper'
    case 'readiness_shift':
      return 'Readiness'
    default: {
      const _exhaustive: never = type
      return _exhaustive
    }
  }
}

export function KinetixTimelineCard({
  loading,
  error,
  timeline,
  insufficientData,
}: KinetixTimelineCardProps) {
  if (loading) {
    return (
      <section className="glass rounded-2xl p-5 border border-white/10">
        <p className="text-sm text-gray-400">Building coaching timeline…</p>
      </section>
    )
  }
  if (error) {
    return (
      <section className="glass rounded-2xl p-5 border border-red-500/30">
        <p className="text-sm text-red-300">Unable to build coaching timeline: {error}</p>
      </section>
    )
  }
  if (insufficientData || !timeline) {
    return (
      <section className="glass rounded-2xl p-5 border border-white/10">
        <p className="text-sm text-gray-400">Not enough data for coaching timeline yet.</p>
      </section>
    )
  }

  const { projection, events } = timeline

  return (
    <section className="glass rounded-2xl p-5 border border-violet-500/25 space-y-3" aria-label="Coaching timeline">
      <header>
        <h3 className="text-lg font-black text-white">Coaching timeline</h3>
        <p className="text-xs text-gray-400">
          Deterministic {projection.minHorizonDays}–{projection.maxHorizonDays} day outlook (no AI). Anchor:{' '}
          {projection.anchorDate}.
        </p>
      </header>
      {events.length === 0 ? (
        <p className="text-sm text-gray-400">No forward events match current signals — check back after more runs.</p>
      ) : (
        <ol className="space-y-3">
          {events.map((ev) => (
            <li
              key={`${ev.type}-${ev.targetDate}`}
              className="rounded-xl border border-white/10 bg-white/5 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-violet-200">
                  {labelForType(ev.type)}
                </span>
                <span className="text-xs text-gray-400 shrink-0">
                  Day +{ev.dayOffset} · {ev.targetDate}
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-white">{ev.title}</p>
              <p className="mt-1 text-xs text-gray-300 leading-relaxed">{ev.detail}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
