import re

with open('apps/web/src/pages/Settings.tsx', 'r') as f:
    content = f.read()

# Verify the hook wasn't properly injected inside the component
if "const [showRaceForm" not in content:
    hook_inject = """  const fileInputRef = useRef<HTMLInputElement>(null)
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
    content = content.replace("  const fileInputRef = useRef<HTMLInputElement>(null)\n  const fitFileInputRef = useRef<HTMLInputElement>(null)", hook_inject)

with open('apps/web/src/pages/Settings.tsx', 'w') as f:
    f.write(content)

print("Patched Settings hooks")
