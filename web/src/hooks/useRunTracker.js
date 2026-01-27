import { useState, useEffect, useRef, useCallback } from 'react';
import { gpsService } from '../services/gpsService';
import { computeKpsWithPb, calculateTimeToBeatKps } from '../utils/kpsCalculator';
import { Run } from '../models/Run';

/**
 * Hook for tracking runs with GPS and calculating metrics
 */
export function useRunTracker(targetKps, pbEq5kSec, _unitSystem) {
  const [isRunning, setIsRunning] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('unknown');
  const [distance, setDistance] = useState(0); // meters
  const [duration, setDuration] = useState(0); // seconds
  const [pace, setPace] = useState(0); // seconds per km
  const [kps, setKps] = useState(0);
  const [heartRate, setHeartRate] = useState(70); // Simulated for now
  const [timeToBeat, setTimeToBeat] = useState(null);
  const [progress, setProgress] = useState(0);
  const [routePoints, setRoutePoints] = useState([]);

  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const lastPositionRef = useRef(null);

  // GPS subscription
  useEffect(() => {
    if (!isRunning) return;

    const unsubscribe = gpsService.subscribe((position, routePoint) => {
      setGpsStatus(gpsService.status);
      
      if (lastPositionRef.current) {
        const dist = gpsService.calculateDistance(
          lastPositionRef.current.coords.latitude,
          lastPositionRef.current.coords.longitude,
          position.coords.latitude,
          position.coords.longitude
        );
        setDistance((prev) => prev + dist);
      }
      
      lastPositionRef.current = position;
      setRoutePoints((prev) => [...prev, routePoint]);
    });

    return unsubscribe;
  }, [isRunning]);

  // Timer for duration and simulated heart rate
  useEffect(() => {
    if (!isRunning) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    startTimeRef.current = Date.now() - duration * 1000;

    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setDuration(elapsed);
      
      // Simulate heart rate (will be replaced with real sensor data)
      setHeartRate(140 + elapsed * 0.1);
    }, 100);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRunning, duration]);

  // Calculate pace and KPS
  useEffect(() => {
    if (distance > 0 && duration > 0) {
      const distanceKm = distance / 1000;
      const currentPace = duration / distanceKm;
      setPace(currentPace);
      
      if (distance > 50) {
        // Calculate KPS (PB-aware; PB updates only on save)
        const calculatedKps = pbEq5kSec
          ? computeKpsWithPb(distanceKm, duration, pbEq5kSec).kps
          : 0;
        setKps(calculatedKps);
        
        // Calculate time to beat
        const projection = calculateTimeToBeatKps(
          distanceKm,
          duration,
          currentPace,
          targetKps,
          pbEq5kSec
        );
        
        if (projection) {
          setTimeToBeat(projection.timeToBeat);
          setProgress(projection.progress);
        }
      } else {
        setKps(0);
        setTimeToBeat(null);
        setProgress(0);
      }
    } else {
      setPace(0);
      setKps(0);
      setTimeToBeat(null);
      setProgress(0);
    }
  }, [distance, duration, targetKps, pbEq5kSec]);

  const start = useCallback(async () => {
    try {
      // Request GPS permission
      await gpsService.requestPermission();
      setGpsStatus(gpsService.status);
      
      // Start tracking
      gpsService.startTracking({ interval: 1000 });
      setGpsStatus('searching');
      
      // Reset state
      setDistance(0);
      setDuration(0);
      setKps(0);
      setPace(0);
      setProgress(0);
      setTimeToBeat(null);
      setRoutePoints([]);
      lastPositionRef.current = null;
      gpsService.clearRoute();
      
      setIsRunning(true);
    } catch (error) {
      console.error('Failed to start tracking:', error);
      setGpsStatus('denied');
    }
  }, []);

  const stop = useCallback(() => {
    gpsService.stopTracking();
    setIsRunning(false);
  }, []);

  const pause = useCallback(() => {
    gpsService.stopTracking();
    setIsRunning(false);
  }, []);

  const resume = useCallback(() => {
    gpsService.startTracking({ interval: 1000 });
    setIsRunning(true);
  }, []);

  const reset = useCallback(() => {
    stop();
    setDistance(0);
    setDuration(0);
    setKps(0);
    setPace(0);
    setProgress(0);
    setTimeToBeat(null);
    setRoutePoints([]);
    lastPositionRef.current = null;
    gpsService.clearRoute();
  }, [stop]);

  const getRunSummary = useCallback(() => {
    return new Run({
      date: new Date(),
      source: 'web',
      distance,
      duration,
      avgPace: pace,
      kps,
      avgHeartRate: heartRate,
      routeData: routePoints.map((p) => ({ lat: p.lat, lon: p.lon })),
    });
  }, [distance, duration, pace, kps, heartRate, routePoints]);

  return {
    isRunning,
    gpsStatus,
    distance,
    duration,
    pace,
    kps,
    heartRate,
    timeToBeat,
    progress,
    routePoints,
    start,
    stop,
    pause,
    resume,
    reset,
    getRunSummary,
  };
}








