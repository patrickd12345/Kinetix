import re

with open('apps/web/src/pages/Coaching.tsx', 'r') as f:
    content = f.read()

imports_to_add = """
import { useKinetixCoachingContext } from '../hooks/useKinetixCoachingContext'
"""
content = content.replace("import { KinetixCoachingContextProvider } from '../context/KinetixCoachingContextProvider'", imports_to_add.strip() + "\nimport { KinetixCoachingContextProvider } from '../context/KinetixCoachingContextProvider'")


next_race_card = """
function KinetixNextRaceCard() {
  const { data } = useKinetixCoachingContext()
  const ctx = data?.plannedRaceContext

  if (!ctx || !ctx.hasUpcomingRace) return null

  return (
    <section className="glass rounded-2xl p-5 border border-amber-500/30 space-y-3" aria-label="Upcoming Race Context">
      <header className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-black text-amber-400">{ctx.headline}</h3>
          <p className="text-sm font-medium text-slate-900 dark:text-white mt-1">
            {ctx.raceName} • {ctx.raceDate}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-amber-500">{ctx.daysToRace}</div>
          <div className="text-[10px] uppercase text-amber-600/70 dark:text-amber-400/70 font-bold tracking-wider">Days Away</div>
        </div>
      </header>

      <div className="text-sm text-slate-600 dark:text-gray-300 flex items-center gap-2">
        <span className="font-semibold text-slate-900 dark:text-white">Distance:</span> {(ctx.raceDistanceMeters! / 1000).toFixed(1)}km
        {ctx.goalTimeSeconds ? (
          <><span className="text-slate-400">•</span> <span className="font-semibold text-slate-900 dark:text-white">Goal:</span> {ctx.goalTimeSeconds}s</>
        ) : null}
      </div>

      {ctx.guidance.length > 0 && (
        <ul className="text-xs text-slate-700 dark:text-gray-300 space-y-1 list-disc list-inside mt-2">
          {ctx.guidance.map((g, i) => (
            <li key={i}>{g}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
"""

content = content.replace("export function CoachingStack() {", next_race_card + "\nexport function CoachingStack() {")

# Insert NextRaceCard above CoachCard
stack_search = """    <>
      <section className="space-y-4" aria-label="Primary coaching">
        <KinetixCoachCard loading={coachLoading} error={coachError} coach={coach} />"""
stack_replace = """    <>
      <section className="space-y-4" aria-label="Primary coaching">
        <KinetixNextRaceCard />
        <KinetixCoachCard loading={coachLoading} error={coachError} coach={coach} />"""
content = content.replace(stack_search, stack_replace)

with open('apps/web/src/pages/Coaching.tsx', 'w') as f:
    f.write(content)

print("Patched Coaching.tsx")
