import re

with open('apps/web/src/components/KinetixCoachCard.tsx', 'r') as f:
    content = f.read()

imports = """import type { CoachResult } from '../lib/coach/types'
import { useKinetixCoachingContext } from '../hooks/useKinetixCoachingContext'
"""
content = content.replace("import type { CoachResult } from '../lib/coach/types'", imports)

hook_inject = """export function KinetixCoachCard({ loading, error, coach }: KinetixCoachCardProps) {
  const { data } = useKinetixCoachingContext()
  const phaseContext = data?.plannedRaceContext
"""
content = content.replace("export function KinetixCoachCard({ loading, error, coach }: KinetixCoachCardProps) {", hook_inject)

ui_inject = """      <header>
        <h3 className="text-lg font-black text-slate-900 dark:text-white">Kinetix Coaching Brain</h3>
        <p className="text-xs text-slate-600 dark:text-gray-400">Deterministic decision orchestrator across risk, fatigue, phase, and prediction.</p>
        {phaseContext?.hasUpcomingRace && (
          <p className="mt-2 text-xs font-bold text-amber-500">
            Adjusted for upcoming race: {phaseContext.phase?.replace(/_/g, ' ')}
          </p>
        )}
      </header>"""
content = content.replace("""      <header>
        <h3 className="text-lg font-black text-slate-900 dark:text-white">Kinetix Coaching Brain</h3>
        <p className="text-xs text-slate-600 dark:text-gray-400">Deterministic decision orchestrator across risk, fatigue, phase, and prediction.</p>
      </header>""", ui_inject)

with open('apps/web/src/components/KinetixCoachCard.tsx', 'w') as f:
    f.write(content)

print("Patched CoachCard.tsx")
