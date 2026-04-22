import re

with open('apps/web/src/hooks/useKinetixCoachingContext.ts', 'r') as f:
    content = f.read()

# Add imports if not present
if "listPlannedRacesForProfile" not in content:
    imports_to_add = """
import { useAuth } from '../components/providers/useAuth'
import { listPlannedRacesForProfile, type PlannedRace } from '../lib/plannedRaces'
import { buildPlannedRaceCoachingContext, getNextRelevantRace, toLocalDateString, type PlannedRaceCoachingContext } from '../lib/coaching/plannedRaceContext'
"""
    content = content.replace("import { useSettingsStore } from '../store/settingsStore'", imports_to_add.strip() + "\nimport { useSettingsStore } from '../store/settingsStore'")

if "plannedRaceContext: PlannedRaceCoachingContext | null" not in content:
    interface_replacement = """export interface KinetixCoachingContextData {
  goal: ReturnType<typeof useSettingsStore.getState>['trainingGoal']
  goalProgress: GoalProgressResult | null
  plannedRaceContext: PlannedRaceCoachingContext | null
  intelligence: ReturnType<typeof useKinetixIntelligence>['result']"""
    content = content.replace("export interface KinetixCoachingContextData {\n  goal: ReturnType<typeof useSettingsStore.getState>['trainingGoal']\n  goalProgress: GoalProgressResult | null\n  intelligence: ReturnType<typeof useKinetixIntelligence>['result']", interface_replacement)

state_hook_search = """export function useKinetixCoachingContextState(): KinetixCoachingContextResult {
  const goal = useSettingsStore((s) => s.trainingGoal)
  const { loading, error, result, samples } = useKinetixIntelligence()
  const [runs, setRuns] = useState<RunRecord[]>([])
  const prediction = useKinetixPredictionFromSamples(samples, mapGoalDistance(goal?.distance))"""

state_hook_replacement = """export function useKinetixCoachingContextState(): KinetixCoachingContextResult {
  const { profile } = useAuth()
  const goal = useSettingsStore((s) => s.trainingGoal)
  const { loading, error, result, samples } = useKinetixIntelligence()
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [plannedRaces, setPlannedRaces] = useState<PlannedRace[]>([])
  const prediction = useKinetixPredictionFromSamples(samples, mapGoalDistance(goal?.distance))"""

if "const { profile } = useAuth()" not in content:
    content = content.replace(state_hook_search, state_hook_replacement)


effect_search = """  useEffect(() => {
    let cancelled = false
    void (async () => {
      const allRuns = await getAllVisibleRunsOrdered()
      if (!cancelled) setRuns(allRuns)
    })()
    return () => {
      cancelled = true
    }
  }, [])"""

effect_replacement = """  useEffect(() => {
    let cancelled = false
    void (async () => {
      const allRuns = await getAllVisibleRunsOrdered()
      if (!cancelled) setRuns(allRuns)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!profile) {
      setPlannedRaces([])
      return
    }
    void (async () => {
      try {
        const races = await listPlannedRacesForProfile(profile.id)
        if (!cancelled) setPlannedRaces(races)
      } catch (err) {
        console.error('Failed to load planned races for coaching context:', err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [profile])"""

if "setPlannedRaces([])" not in content:
    content = content.replace(effect_search, effect_replacement)


memo_search = """  const data = useMemo<KinetixCoachingContextData>(() => {
    const goalProgress = goal && prediction ? computeGoalProgress(goal, runs, prediction) : null"""

memo_replacement = """  const data = useMemo<KinetixCoachingContextData>(() => {
    const goalProgress = goal && prediction ? computeGoalProgress(goal, runs, prediction) : null

    const nextRace = getNextRelevantRace(plannedRaces, toLocalDateString(new Date()))
    const plannedRaceContext = buildPlannedRaceCoachingContext(nextRace, toLocalDateString(new Date()))"""

if "const nextRace = getNextRelevantRace" not in content:
    content = content.replace(memo_search, memo_replacement)


return_search = """    return {
      goal,
      goalProgress,
      intelligence: result,"""

return_replacement = """    return {
      goal,
      goalProgress,
      plannedRaceContext,
      intelligence: result,"""

if "plannedRaceContext," not in content:
    content = content.replace(return_search, return_replacement)

memo_deps_search = """    }
  }, [goal, prediction, result, runs, samples])"""
memo_deps_replacement = """    }
  }, [goal, prediction, result, runs, samples, plannedRaces])"""

if "plannedRaces])" not in content:
    content = content.replace(memo_deps_search, memo_deps_replacement)

build_null_data_search = """  buildNullData: (): Pick<KinetixCoachingContextData, 'coach' | 'prediction' | 'loadControl' | 'goalProgress'> => ({
    coach: null,
    prediction: null,
    loadControl: null,
    goalProgress: null,
  }),"""
build_null_data_replacement = """  buildNullData: (): Pick<KinetixCoachingContextData, 'coach' | 'prediction' | 'loadControl' | 'goalProgress' | 'plannedRaceContext'> => ({
    coach: null,
    prediction: null,
    loadControl: null,
    goalProgress: null,
    plannedRaceContext: null,
  }),"""

if "plannedRaceContext: null" not in content:
    content = content.replace(build_null_data_search, build_null_data_replacement)


with open('apps/web/src/hooks/useKinetixCoachingContext.ts', 'w') as f:
    f.write(content)

print("Patched useKinetixCoachingContext.ts again")
