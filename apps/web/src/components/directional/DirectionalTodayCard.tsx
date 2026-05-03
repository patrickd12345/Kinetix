import { Trophy } from 'lucide-react'
import type { AchievementLabel } from '../../lib/achievements'
export interface DirectionalTodayCardProps {
  kps: {
    value: string
    label: string
  }
  readiness: string
  fatigue: string
  lastRun: string
  suggestedTraining: string
  onStartRun: () => void
  title?: string
  error?: string | null
  isRunning?: boolean
  disabled?: boolean
  achievement?: AchievementLabel | null
}

export function DirectionalTodayCard({
  kps,
  readiness,
  fatigue,
  lastRun,
  suggestedTraining,
  onStartRun,
  title = 'Build your KPS with control',
  error = null,
  isRunning = false,
  disabled = false,
  achievement = null,
}: DirectionalTodayCardProps) {
  return (
    <section className="glass rounded-2xl p-6 mb-4 border border-cyan-500/20" aria-labelledby="today-heading">
      <div className="lg:grid lg:grid-cols-[220px,1fr,220px] lg:gap-6 lg:items-center">
        <div className="mb-5 rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-5 text-center lg:mb-0">
          <div className="text-6xl font-black leading-none text-slate-900 dark:text-white" aria-label={`${kps.label}: ${kps.value}`}>
            {kps.value}
          </div>
          <div className="mt-2 text-xs font-black uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300">
            {kps.label}
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-700 dark:text-cyan-300">Today</p>
          <h2 id="today-heading" className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {title}
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-gray-300">Suggested: {suggestedTraining}</p>
          {error ? (
            <p className="mt-2 text-sm text-amber-700 dark:text-amber-300" role="status">{error}</p>
          ) : null}

          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
            <div className="rounded-lg border border-white/10 bg-black/5 p-3 dark:bg-black/20">
              <dt className="text-xs uppercase text-slate-500 dark:text-gray-400">Readiness</dt>
              <dd className="mt-1 font-bold text-slate-900 dark:text-white">{readiness}</dd>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/5 p-3 dark:bg-black/20">
              <dt className="text-xs uppercase text-slate-500 dark:text-gray-400">Fatigue</dt>
              <dd className="mt-1 font-bold text-slate-900 dark:text-white">{fatigue}</dd>
            </div>
            <div className="col-span-2 rounded-lg border border-white/10 bg-black/5 p-3 dark:bg-black/20 lg:col-span-2">
              <dt className="text-xs uppercase text-slate-500 dark:text-gray-400">Last run</dt>
              <dd className="mt-1 font-bold text-slate-900 dark:text-white">{lastRun}</dd>
              {achievement && (
                <div className="mt-2 flex items-center gap-1 text-xs font-bold text-amber-500">
                  <Trophy size={12} />
                  {achievement}
                </div>
              )}
            </div>
          </dl>
        </div>

        <div className="mt-5 flex justify-center lg:mt-0">
          {!isRunning ? (
            <button
              type="button"
              onClick={onStartRun}
              aria-label="Start suggested run"
              disabled={disabled}
              className="w-full rounded-lg bg-green-700 px-5 py-4 text-base font-black text-white shadow-lg shadow-green-500/30 transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
            >
              Start Run
            </button>
          ) : (
            <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-5 py-4 text-sm font-bold text-cyan-900 dark:text-cyan-100" role="status">
              Run in progress
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
