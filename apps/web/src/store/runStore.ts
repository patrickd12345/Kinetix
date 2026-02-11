import { create } from 'zustand'
import { calculateKPS, calculateTimeToBeat, calculatePace, calculateDistance } from '@kinetix/core'
import { useSettingsStore } from './settingsStore'
import { db, RunRecord } from '../lib/database'

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
      const absoluteKPS = calculateKPS(
        { distanceKm: state.distance / 1000, timeSeconds: state.duration },
        settings.userProfile
      )

      const runRecord: RunRecord = {
        date: new Date().toISOString(),
        distance: state.distance,
        duration: state.duration,
        averagePace: state.averagePace,
        kps: absoluteKPS,
        targetKPS: settings.targetKPS,
        locations: state.locations,
        splits: state.splits,
        heartRate: state.heartRate > 70 ? state.heartRate : undefined,
      }

      db.runs.add(runRecord).then(async (runId) => {
        const numericRunId = typeof runId === 'number' ? runId : Number(runId)
        if (!numericRunId || isNaN(numericRunId)) {
          return
        }

        const savedRunRecord: RunRecord = { ...runRecord, id: numericRunId }

        import('../lib/kpsUtils').then(({ checkAndUpdatePB }) => {
          checkAndUpdatePB(savedRunRecord, settings.userProfile).then((isNewPB) => {
            if (isNewPB) {
              console.log('New Personal Best! This run is now your PB (KPS = 100)')
            }
          })
        })
        import('../lib/ragClient').then(({ indexRunsAfterSave }) => {
          indexRunsAfterSave([savedRunRecord], settings.userProfile).catch(() => {})
        })
      }).catch((error) => {
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
    const liveKPS = calculateKPS(
      { distanceKm: newDistance / 1000, timeSeconds: state.duration },
      settings.userProfile
    )

    const projection = calculateTimeToBeat(
      newDistance / 1000,
      state.duration,
      newAveragePace,
      settings.targetKPS,
      settings.userProfile
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
    const liveKPS = calculateKPS(
      { distanceKm: state.distance / 1000, timeSeconds: newDuration },
      settings.userProfile
    )

    const projection = calculateTimeToBeat(
      state.distance / 1000,
      newDuration,
      newAveragePace,
      settings.targetKPS,
      settings.userProfile
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
