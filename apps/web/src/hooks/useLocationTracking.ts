import { useEffect, useRef } from 'react'
import { useRunStore } from '../store/runStore'

export function useLocationTracking() {
  const { isRunning, isPaused, updateLocation, updateDuration } = useRunStore()
  const watchIdRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const pausedTimeRef = useRef<number>(0)
  const lastPauseTimeRef = useRef<number>(0)

  // Check GPS availability on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {
          // GPS is available
        },
        () => {
          // GPS not available
        },
        { timeout: 5000, maximumAge: 0 }
      )
    }
  }, [])

  // Start/stop tracking based on run state
  useEffect(() => {
    if (isRunning && !isPaused) {
      startTracking()
    } else if (isPaused) {
      pauseTracking()
    } else {
      stopTracking()
    }

    return () => {
      stopTracking()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, isPaused])

  const startTracking = () => {
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by this browser')
      return
    }

    // Resume from paused time or start fresh
    if (startTimeRef.current === null) {
      startTimeRef.current = Date.now()
    } else {
      // Adjust start time for paused duration
      const pauseDuration = lastPauseTimeRef.current - (startTimeRef.current + pausedTimeRef.current)
      startTimeRef.current = Date.now() - pausedTimeRef.current - pauseDuration
    }

    // Start timer for duration updates
    timerRef.current = window.setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = (Date.now() - startTimeRef.current) / 1000
        updateDuration(elapsed)
      }
    }, 100)

    // Start watching position
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        updateLocation(latitude, longitude)
      },
      (error) => {
        console.error('Geolocation error:', error)
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    )
  }

  const pauseTracking = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (startTimeRef.current) {
      lastPauseTimeRef.current = Date.now()
      pausedTimeRef.current = (lastPauseTimeRef.current - startTimeRef.current) / 1000
    }
  }

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    // Reset tracking refs
    startTimeRef.current = null
    pausedTimeRef.current = 0
    lastPauseTimeRef.current = 0
  }
}
