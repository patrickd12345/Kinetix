import { create } from 'zustand'
import { calculateNPI, calculateTimeToBeat, calculatePace, calculateDistance } from '@kinetix/core'
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
  liveNPI: number
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
  liveNPI: 0,
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
      liveNPI: 0,
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
      const runRecord: RunRecord = {
        date: new Date().toISOString(),
        distance: state.distance,
        duration: state.duration,
        averagePace: state.averagePace,
        npi: state.liveNPI,
        targetNPI: settings.targetNPI,
        locations: state.locations,
        splits: state.splits,
        heartRate: state.heartRate > 70 ? state.heartRate : undefined,
      }
      
      db.runs.add(runRecord).catch((error) => {
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
    
    // Calculate NPI
    const settings = useSettingsStore.getState()
    const liveNPI = calculateNPI(
      { distanceKm: newDistance / 1000, timeSeconds: state.duration },
      settings.userProfile
    )
    
    // Calculate time to beat
    const projection = calculateTimeToBeat(
      newDistance / 1000,
      state.duration,
      newAveragePace,
      settings.targetNPI,
      settings.userProfile
    )
    
    set({
      hasGPSFix: true,
      distance: newDistance,
      pace: newPace,
      averagePace: newAveragePace,
      liveNPI,
      progress: projection.progress,
      timeToBeat: projection.timeToBeat,
      locations: newLocations,
    })
  },
  
  updateDuration: (seconds: number) => {
    const state = get()
    const newDuration = seconds
    const newAveragePace = state.distance > 0 ? newDuration / (state.distance / 1000) : 0
    
    // Recalculate NPI and projections with new duration
    const settings = useSettingsStore.getState()
    const liveNPI = calculateNPI(
      { distanceKm: state.distance / 1000, timeSeconds: newDuration },
      settings.userProfile
    )
    
    const projection = calculateTimeToBeat(
      state.distance / 1000,
      newDuration,
      newAveragePace,
      settings.targetNPI,
      settings.userProfile
    )
    
    set({
      duration: newDuration,
      averagePace: newAveragePace,
      liveNPI,
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
