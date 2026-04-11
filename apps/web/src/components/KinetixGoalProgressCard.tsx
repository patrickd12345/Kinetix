import { useEffect, useMemo, useState } from 'react'
import { useSettingsStore } from '../store/settingsStore'
import type { GoalDistance, GoalPriority, GoalProgressResult, TrainingGoal } from '../lib/goalRace/types'

interface KinetixGoalProgressCardProps {
  loading: boolean
  error: string | null
  progress: GoalProgressResult | null
}

function parseTargetTime(input: string): number | undefined {
  const normalized = input.trim()
  if (!normalized) return undefined
  const parts = normalized.split(':').map((part) => Number(part))
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return undefined
  if (parts.length === 2) {
    const [minutes, seconds] = parts
    if (seconds >= 60) return undefined
    return minutes * 60 + seconds
  }
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts
    if (minutes >= 60 || seconds >= 60) return undefined
    return hours * 3600 + minutes * 60 + seconds
  }
  return undefined
}

function formatSeconds(value: number | null | undefined): string {
  if (value == null) return '—'
  const h = Math.floor(value / 3600)
  const m = Math.floor((value % 3600) / 60)
  const s = Math.floor(value % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function toClockString(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null) return ''
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.floor(totalSeconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function titleCase(value: string): string {
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

export function KinetixGoalProgressCard({ loading, error, progress }: KinetixGoalProgressCardProps) {
  const goal = useSettingsStore((s) => s.trainingGoal)
  const setGoal = useSettingsStore((s) => s.setTrainingGoal)

  const [distance, setDistance] = useState<GoalDistance>(goal?.distance ?? '10K')
  const [eventDate, setEventDate] = useState(goal?.eventDate?.slice(0, 10) ?? '')
  const [targetTime, setTargetTime] = useState(toClockString(goal?.targetTimeSeconds))
  const [priority, setPriority] = useState<GoalPriority>(goal?.priority ?? 'improve')

  useEffect(() => {
    setDistance(goal?.distance ?? '10K')
    setEventDate(goal?.eventDate?.slice(0, 10) ?? '')
    setTargetTime(toClockString(goal?.targetTimeSeconds))
    setPriority(goal?.priority ?? 'improve')
  }, [goal])

  const parsedTarget = useMemo(() => parseTargetTime(targetTime), [targetTime])

  const saveGoal = () => {
    if (!eventDate) return
    const nextGoal: TrainingGoal = {
      distance,
      eventDate: new Date(`${eventDate}T12:00:00.000Z`).toISOString(),
      targetTimeSeconds: parsedTarget,
      priority,
    }
    setGoal(nextGoal)
  }

  return (
    <section className="glass rounded-2xl p-5 border border-emerald-500/20 space-y-4" aria-label="Goal progress">
      <header>
        <h3 className="text-lg font-black text-white">Goal Progress</h3>
        <p className="text-xs text-gray-400">Define race target, then track projected outcome and weekly emphasis.</p>
      </header>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400">Distance</span>
          <select aria-label="Goal distance" className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5" value={distance} onChange={(e) => setDistance(e.target.value as GoalDistance)}>
            <option value="5K">5K</option>
            <option value="10K">10K</option>
            <option value="Half">Half</option>
            <option value="Marathon">Marathon</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400">Priority</span>
          <select aria-label="Goal priority" className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5" value={priority} onChange={(e) => setPriority(e.target.value as GoalPriority)}>
            <option value="finish">Finish</option>
            <option value="improve">Improve</option>
            <option value="PB">PB</option>
            <option value="peak">Peak</option>
          </select>
        </label>
        <label className="col-span-2 flex flex-col gap-1">
          <span className="text-xs text-gray-400">Event date</span>
          <input aria-label="Goal event date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5" />
        </label>
        <label className="col-span-2 flex flex-col gap-1">
          <span className="text-xs text-gray-400">Target time (optional, mm:ss or hh:mm:ss)</span>
          <input aria-label="Goal target time" type="text" value={targetTime} onChange={(e) => setTargetTime(e.target.value)} placeholder="1:45:00" className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5" />
        </label>
      </div>

      <button type="button" aria-label="Save race goal" onClick={saveGoal} disabled={!eventDate || (targetTime.trim().length > 0 && parsedTarget == null)} className="w-full rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-3 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/30 transition-colors disabled:cursor-not-allowed disabled:opacity-60">
        Save Goal
      </button>
      {targetTime.trim().length > 0 && parsedTarget == null ? (
        <p className="text-xs text-amber-300">Use mm:ss or hh:mm:ss with seconds under 60.</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-gray-400">Computing goal progress…</p>
      ) : error ? (
        <p className="text-sm text-red-300">Unable to compute goal progress: {error}</p>
      ) : !goal ? (
        <p className="text-sm text-gray-400">Set a race goal to activate goal-driven coaching mode.</p>
      ) : (
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-gray-400">Goal</dt><dd className="text-white font-semibold">{goal.distance}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-400">Event Date</dt><dd className="text-white">{new Date(goal.eventDate).toLocaleDateString('en-US')}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-400">Target</dt><dd className="text-white">{formatSeconds(goal.targetTimeSeconds)}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-400">Projected</dt><dd className="text-white">{formatSeconds(progress?.projectedTimeSeconds)}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-400">Gap</dt><dd className="text-white">{progress?.targetDeltaSeconds != null ? `${progress.targetDeltaSeconds > 0 ? '+' : ''}${progress.targetDeltaSeconds}s` : '—'}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-400">Status</dt><dd className="text-white">{titleCase(progress?.status ?? 'unknown')}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-400">Days Remaining</dt><dd className="text-white">{progress?.daysRemaining ?? '—'}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-400">Weekly Emphasis</dt><dd className="text-emerald-200">{titleCase(progress?.weeklyEmphasis ?? 'base_building')}</dd></div>
        </dl>
      )}
    </section>
  )
}
