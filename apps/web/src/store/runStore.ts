import { create } from 'zustand'
import { calculateKPS, calculateTimeToBeat, calculatePace, calculateDistance } from '@kinetix/core'
import { useSettingsStore } from './settingsStore'
import { db, RunRecord } from '../lib/database'
import { getActiveKinetixUserProfile } from '../lib/authState'
import { checkAndUpdatePB } from '../lib/kpsUtils'
import { indexRunsAfterSave } from '../lib/ragClient'

export interface RunState {
  // Running state
  isRunning: boolean
  isPaused: boolean
  hasGPSFix: boolean

  // Metrics
  distance: number // meters
  duration: number // seconds
  pace: number // seconds per km
  averagePace: number // seconds per km
  liveKPS: number
  heartRate: number // BPM
  currentHR: number // Current BPM

  // Progress
  progress: number // 0-1
  timeToBeat: string | null

  // Splits
  splits: Array<{ distance: number; time: number; pace: number }>

  // Location tracking
  locations: Array<{ lat: number; lon: number; timestamp: number }>

  // Actions
  startRun: () => void
  pauseRun: () => void
  resumeRun: () => void
  stopRun: () => void
  updateLocation: (lat: number, lon: number) => void
  updateDuration: (seconds: number) => void
  updateHeartRate: (hr: number) => void
  addSplit: () => void
  reset: () => void
}

const initialState = {
  isRunning: false,
  isPaused: false,
  hasGPSFix: false,
  distance: 0,
  duration: 0,
  pace: 0,
  averagePace: 0,
  liveKPS: 0,
  heartRate: 70,
  currentHR: 70,
  progress: 0,
  timeToBeat: null,
  splits: [],
  locations: [],
}

export async function persistStoppedRun(runRecord: RunRecord, userProfile: ReturnType<typeof getActiveKinetixUserProfile>) {
  // SEC-03: Wrap run save and PB update in a single atomic transaction
  let savedRunRecord: RunRecord | undefined
  let isNewPB = false

  await db.transaction('rw', db.runs, db.pb, async () => {
    const runId = await db.runs.add(runRecord)
    const numericRunId = typeof runId === 'number' ? runId : Number(runId)
    if (!numericRunId || isNaN(numericRunId)) {
      throw new Error('Run saved without a numeric IndexedDB id')
    }

    savedRunRecord = { ...runRecord, id: numericRunId }
    isNewPB = await checkAndUpdatePB(savedRunRecord, userProfile)
  })

  // The assignment above guarantees savedRunRecord is initialized if the transaction succeeds
  if (!savedRunRecord) throw new Error('Transaction succeeded but run record is missing')

  if (isNewPB) {
    console.log('New Personal Best! This run is now your PB (KPS = 100)')
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kinetix:runSaved'))
  }

  indexRunsAfterSave([savedRunRecord]).catch((error) => {
    console.warn('[Kinetix] RAG indexing failed after local run save:', error)
  })

  return savedRunRecord
}

export const useRunStore = create<RunState>((set, get) => ({
  ...initialState,
  
  startRun: () => {
    set({
      isRunning: true,
      isPaused: false,
      distance: 0,
      duration: 0,
      liveKPS: 0,
      progress: 0,
      timeToBeat: null,
      splits: [],
      locations: [],
    })
  },
  
  pauseRun: () => {
    set({ isPaused: true })
  },
  
  resumeRun: () => {
    set({ isPaused: false })
  },
  
  stopRun: () => {
    const state = get()
    const settings = useSettingsStore.getState()
    
    // Save run to database if there's data
    if (state.distance > 0 && state.duration > 0) {
      const userProfile = getActiveKinetixUserProfile()
      const runRecord: RunRecord = {
        date: new Date().toISOString(),
        distance: state.distance,
        duration: state.duration,
        averagePace: state.averagePace,
        targetKPS: settings.targetKPS,
        locations: state.locations,
        splits: state.splits,
        heartRate: state.heartRate > 70 ? state.heartRate : undefined,
        weightKg: userProfile.weightKg,
      }

      persistStoppedRun(runRecord, userProfile).catch((error) => {
        console.error('Error saving run:', error)
      })
    }
    
    set({ 
      isRunning: false, 
      isPaused: false,
    })
  },
  
  updateLocation: (lat: number, lon: number) => {
    const state = get()
    const newLocations = [...state.locations, { lat, lon, timestamp: Date.now() }]
    
    let newDistance = state.distance
    if (newLocations.length > 1) {
      const prev = newLocations[newLocations.length - 2]
      const dist = calculateDistance(prev.lat, prev.lon, lat, lon)
      newDistance += dist
    }
    
    // Don't update duration here - it's updated separately via updateDuration
    const newPace = calculatePace(newDistance, state.duration)
    const newAveragePace = newDistance > 0 ? state.duration / (newDistance / 1000) : 0
    
    const settings = useSettingsStore.getState()
    const userProfile = getActiveKinetixUserProfile()
    const liveKPS = calculateKPS(
      { distanceKm: newDistance / 1000, timeSeconds: state.duration },
      userProfile
    )

    const projection = calculateTimeToBeat(
      newDistance / 1000,
      state.duration,
      newAveragePace,
      settings.targetKPS,
      userProfile
    )

    set({
      hasGPSFix: true,
      distance: newDistance,
      pace: newPace,
      averagePace: newAveragePace,
      liveKPS,
      progress: projection.progress,
      timeToBeat: projection.timeToBeat,
      locations: newLocations,
    })
  },

  updateDuration: (seconds: number) => {
    const state = get()
    const newDuration = seconds
    const newAveragePace = state.distance > 0 ? newDuration / (state.distance / 1000) : 0

    const settings = useSettingsStore.getState()
    const userProfile = getActiveKinetixUserProfile()
    const liveKPS = calculateKPS(
      { distanceKm: state.distance / 1000, timeSeconds: newDuration },
      userProfile
    )

    const projection = calculateTimeToBeat(
      state.distance / 1000,
      newDuration,
      newAveragePace,
      settings.targetKPS,
      userProfile
    )

    set({
      duration: newDuration,
      averagePace: newAveragePace,
      liveKPS,
      progress: projection.progress,
      timeToBeat: projection.timeToBeat,
    })
  },
  
  updateHeartRate: (hr: number) => {
    const state = get()
    const newHR = hr
    const avgHR = state.heartRate === 70 ? hr : (state.heartRate + hr) / 2
    
    set({
      currentHR: newHR,
      heartRate: avgHR,
    })
  },
  
  addSplit: () => {
    const state = get()
    set({
      splits: [
        ...state.splits,
        {
          distance: state.distance,
          time: state.duration,
          pace: state.averagePace,
        },
      ],
    })
  },
  
  reset: () => {
    set(initialState)
  },
}))
