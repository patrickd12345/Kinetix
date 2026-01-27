import { create } from 'zustand'
import { calculatePace, calculateDistance, computeKpsWithPb, calculateTimeToBeatKps } from '@kinetix/core'
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
  liveKps: number
  heartRate: number // BPM
  currentHR: number // Current BPM
  pbEq5kSec: number | null
  lastRunSetPb: boolean
  lastRunKps: number | null
  
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
  stopRun: () => Promise<void>
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
  liveKps: 0,
  heartRate: 70,
  currentHR: 70,
  pbEq5kSec: null,
  lastRunSetPb: false,
  lastRunKps: null,
  progress: 0,
  timeToBeat: null,
  splits: [],
  locations: [],
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export const useRunStore = create<RunState>((set, get) => ({
  ...initialState,
  
  startRun: () => {
    set({ 
      isRunning: true, 
      isPaused: false,
      distance: 0,
      duration: 0,
      liveKps: 0,
      progress: 0,
      timeToBeat: null,
      splits: [],
      locations: [],
      lastRunSetPb: false,
      lastRunKps: null,
    })
  },
  
  pauseRun: () => {
    set({ isPaused: true })
  },
  
  resumeRun: () => {
    set({ isPaused: false })
  },
  
  stopRun: async () => {
    const state = get()
    const settings = useSettingsStore.getState()
    
    // Save run to database if there's data
    if (state.distance > 0 && state.duration > 0) {
      try {
        await db.transaction('rw', db.runs, db.meta, async () => {
          const meta = await db.meta.get('kps')
          const pbEq5kSec = meta?.pb_eq5k_sec ?? null

          const distanceKm = state.distance / 1000
          const result = computeKpsWithPb({
            distanceKm,
            timeSeconds: state.duration,
            pbEq5kSec,
          })

          const kpsStored = round1(result.kps)
          const runRecord: RunRecord = {
            date: new Date().toISOString(),
            distance: state.distance,
            duration: state.duration,
            averagePace: state.averagePace,
            kps: kpsStored,
            targetKps: settings.targetKps,
            set_pb: result.setPb,
            locations: state.locations,
            splits: state.splits,
            heartRate: state.heartRate > 70 ? state.heartRate : undefined,
          }

          await db.runs.add(runRecord)

          if (result.setPb && result.pbEq5kSecNext && Number.isFinite(result.pbEq5kSecNext)) {
            await db.meta.put({ id: 'kps', pb_eq5k_sec: result.pbEq5kSecNext })
          }

          set({
            lastRunKps: kpsStored,
            lastRunSetPb: result.setPb,
            pbEq5kSec: (result.setPb && result.pbEq5kSecNext) ? result.pbEq5kSecNext : pbEq5kSec,
          })
        })
      } catch (error) {
        console.error('Error saving run:', error)
      }
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
    
    // Calculate live KPS (PB-aware, but never updates PB mid-run)
    const pbEq5kSec = state.pbEq5kSec
    const liveKps = pbEq5kSec
      ? computeKpsWithPb({ distanceKm: newDistance / 1000, timeSeconds: state.duration, pbEq5kSec }).kps
      : 0

    // Calculate time to beat (target KPS)
    const settings = useSettingsStore.getState()
    const projection = calculateTimeToBeatKps({
      currentDistanceKm: newDistance / 1000,
      currentTimeSeconds: state.duration,
      currentPaceSecondsPerKm: newAveragePace,
      targetKps: settings.targetKps,
      pbEq5kSec,
    })
    
    set({
      hasGPSFix: true,
      distance: newDistance,
      pace: newPace,
      averagePace: newAveragePace,
      liveKps,
      progress: projection.progress,
      timeToBeat: projection.timeToBeat,
      locations: newLocations,
    })
  },
  
  updateDuration: (seconds: number) => {
    const state = get()
    const newDuration = seconds
    const newAveragePace = state.distance > 0 ? newDuration / (state.distance / 1000) : 0
    
    // Recalculate KPS and projections with new duration
    const settings = useSettingsStore.getState()
    const pbEq5kSec = state.pbEq5kSec
    const liveKps = pbEq5kSec
      ? computeKpsWithPb({ distanceKm: state.distance / 1000, timeSeconds: newDuration, pbEq5kSec }).kps
      : 0

    const projection = calculateTimeToBeatKps({
      currentDistanceKm: state.distance / 1000,
      currentTimeSeconds: newDuration,
      currentPaceSecondsPerKm: newAveragePace,
      targetKps: settings.targetKps,
      pbEq5kSec,
    })
    
    set({
      duration: newDuration,
      averagePace: newAveragePace,
      liveKps,
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

// Bootstrap PB reference from storage once at startup.
db.meta
  .get('kps')
  .then((meta) => {
    if (meta?.pb_eq5k_sec && Number.isFinite(meta.pb_eq5k_sec)) {
      useRunStore.setState({ pbEq5kSec: meta.pb_eq5k_sec })
    }
  })
  .catch(() => {
    // ignore
  })
