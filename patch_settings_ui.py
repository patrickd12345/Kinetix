import re

with open('apps/web/src/pages/Settings.tsx', 'r') as f:
    content = f.read()

# Make sure imports are present
if "import { listPlannedRacesForProfile" not in content:
    imports_to_add = """
import { listPlannedRacesForProfile, createPlannedRace, updatePlannedRace, deletePlannedRace, type PlannedRace, type CreatePlannedRaceInput } from '../lib/plannedRaces'
"""
    content = content.replace("import { useSettingsStore } from '../store/settingsStore'", imports_to_add.strip() + "\nimport { useSettingsStore } from '../store/settingsStore'")

# Add state hook for Planned Races
state_hook_search = """  const fileInputRef = useRef<HTMLInputElement>(null)
  const fitFileInputRef = useRef<HTMLInputElement>(null)"""

state_hook_replacement = """  const fileInputRef = useRef<HTMLInputElement>(null)
  const fitFileInputRef = useRef<HTMLInputElement>(null)

  const [plannedRaces, setPlannedRaces] = useState<PlannedRace[]>([])
  const [plannedRacesLoading, setPlannedRacesLoading] = useState(false)
  const [plannedRacesError, setPlannedRacesError] = useState<string | null>(null)
  const [showRaceForm, setShowRaceForm] = useState(false)
  const [editingRaceId, setEditingRaceId] = useState<string | null>(null)

  const [raceFormName, setRaceFormName] = useState('')
  const [raceFormDate, setRaceFormDate] = useState('')
  const [raceFormDistanceKm, setRaceFormDistanceKm] = useState('')
  const [raceFormGoalTime, setRaceFormGoalTime] = useState('')
  const [raceFormNotes, setRaceFormNotes] = useState('')
  const [raceFormSaving, setRaceFormSaving] = useState(false)

  const loadPlannedRaces = useCallback(async () => {
    if (!profile) return
    setPlannedRacesLoading(true)
    setPlannedRacesError(null)
    try {
      const races = await listPlannedRacesForProfile(profile.id)
      setPlannedRaces(races)
    } catch (err) {
      setPlannedRacesError(err instanceof Error ? err.message : 'Failed to load planned races')
    } finally {
      setPlannedRacesLoading(false)
    }
  }, [profile])

  useEffect(() => {
    loadPlannedRaces()
  }, [loadPlannedRaces])

  const handleOpenRaceForm = (race?: PlannedRace) => {
    if (race) {
      setEditingRaceId(race.id)
      setRaceFormName(race.race_name)
      setRaceFormDate(race.race_date)
      setRaceFormDistanceKm((race.distance_meters / 1000).toString())
      setRaceFormGoalTime(race.goal_time_seconds ? race.goal_time_seconds.toString() : '')
      setRaceFormNotes(race.notes || '')
    } else {
      setEditingRaceId(null)
      setRaceFormName('')
      setRaceFormDate('')
      setRaceFormDistanceKm('')
      setRaceFormGoalTime('')
      setRaceFormNotes('')
    }
    setShowRaceForm(true)
  }

  const handleSaveRace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    setRaceFormSaving(true)
    try {
      const distanceMeters = Math.round(parseFloat(raceFormDistanceKm) * 1000)
      if (isNaN(distanceMeters) || distanceMeters < 1500 || distanceMeters > 50000) {
        throw new Error('Distance must be between 1.5km and 50km')
      }

      const goalTime = raceFormGoalTime ? parseInt(raceFormGoalTime, 10) : null
      if (goalTime !== null && (isNaN(goalTime) || goalTime <= 0)) {
        throw new Error('Goal time must be a positive integer (seconds)')
      }

      const input: CreatePlannedRaceInput = {
        race_name: raceFormName.trim(),
        race_date: raceFormDate,
        distance_meters: distanceMeters,
        goal_time_seconds: goalTime,
        notes: raceFormNotes.trim() || null
      }

      if (editingRaceId) {
        await updatePlannedRace(profile.id, editingRaceId, input)
      } else {
        await createPlannedRace(profile.id, input)
      }

      await loadPlannedRaces()
      setShowRaceForm(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save planned race')
    } finally {
      setRaceFormSaving(false)
    }
  }

  const handleDeleteRace = async (raceId: string) => {
    if (!profile || !confirm('Are you sure you want to delete this planned race?')) return

    try {
      await deletePlannedRace(profile.id, raceId)
      await loadPlannedRaces()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete planned race')
    }
  }
"""

if "const [plannedRaces, setPlannedRaces]" not in content:
    content = content.replace(state_hook_search, state_hook_replacement)


ui_block = """        <div className="glass rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Planned Races</h2>
            {!showRaceForm && (
              <button
                onClick={() => handleOpenRaceForm()}
                className="px-3 py-1 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg"
              >
                Add Race
              </button>
            )}
          </div>

          {plannedRacesError && (
            <div className="text-red-400 text-sm p-3 border border-red-500/30 rounded-lg bg-red-500/10">
              {plannedRacesError}
            </div>
          )}

          {showRaceForm ? (
            <form onSubmit={handleSaveRace} className="border border-white/10 rounded-xl p-4 space-y-4 bg-gray-900/30">
              <h3 className="font-semibold text-lg">{editingRaceId ? 'Edit Race' : 'Add Race'}</h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Race Name</label>
                  <input
                    required maxLength={100}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                    value={raceFormName} onChange={e => setRaceFormName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Date</label>
                    <input
                      type="date" required
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                      value={raceFormDate} onChange={e => setRaceFormDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Distance (km)</label>
                    <input
                      type="number" step="0.1" required min="1.5" max="50"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                      value={raceFormDistanceKm} onChange={e => setRaceFormDistanceKm(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Goal Time (seconds)</label>
                  <input
                    type="number" min="1"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                    placeholder="Optional"
                    value={raceFormGoalTime} onChange={e => setRaceFormGoalTime(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <input
                    maxLength={500}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                    placeholder="Optional"
                    value={raceFormNotes} onChange={e => setRaceFormNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRaceForm(false)}
                  className="px-4 py-2 border border-gray-600 rounded-lg text-sm text-gray-300 hover:bg-gray-800"
                  disabled={raceFormSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  disabled={raceFormSaving}
                >
                  {raceFormSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              {plannedRacesLoading ? (
                <div className="text-sm text-gray-400">Loading races...</div>
              ) : plannedRaces.length === 0 ? (
                <div className="text-sm text-gray-400">No planned races.</div>
              ) : (
                plannedRaces.map((race, i) => (
                  <div key={race.id} className="flex items-center justify-between p-3 border border-white/10 rounded-xl bg-gray-900/30">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {race.race_name}
                        {i === 0 && race.race_date >= new Date().toISOString().split('T')[0] && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-teal-500/20 text-teal-300 rounded uppercase">Next Race</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {race.race_date} • {(race.distance_meters / 1000).toFixed(1)}km
                        {race.goal_time_seconds && ` • Goal: ${race.goal_time_seconds}s`}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenRaceForm(race)}
                        className="p-2 text-gray-400 hover:text-white"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button
                        onClick={() => handleDeleteRace(race.id)}
                        className="p-2 text-gray-400 hover:text-red-400"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
"""

# Insert right before the closing div of the content wrapper
if "Planned Races" not in content:
    insert_target = """      <div className="max-w-md lg:max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Settings</h1>"""
    content = content.replace(insert_target, insert_target + "\n\n" + ui_block)

with open('apps/web/src/pages/Settings.tsx', 'w') as f:
    f.write(content)

print("Patched Settings.tsx correctly")
