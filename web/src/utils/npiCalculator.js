/**
 * NPI (Normalized Performance Index) calculation
 * Matches the iOS implementation
 */

/**
 * Calculate NPI from distance and pace
 * @param {number} distanceKm - Distance in kilometers
 * @param {number} paceSeconds - Pace in seconds per km
 * @returns {number} NPI value
 */
export function calculateNPI(distanceKm, paceSeconds) {
  if (distanceKm <= 0 || paceSeconds <= 0) return 0;
  
  // Speed in km/h
  const speedKmH = (1000 / paceSeconds) * 3.6;
  
  // Distance factor (fatigue adjustment)
  const factor = Math.pow(distanceKm, 0.06);
  
  // NPI formula
  const npi = speedKmH * factor * 10.0;
  
  return npi;
}

/**
 * Calculate NPI from race data
 * @param {number} distance - Distance (km or miles)
 * @param {string} timeString - Time in format "MM:SS" or "HH:MM:SS"
 * @param {string} unit - "metric" or "imperial"
 * @returns {number} NPI value
 */
export function calculateNPIFromRace(distance, timeString, unit = 'metric') {
  // Convert to km
  const distanceKm = unit === 'metric' ? distance : distance * 1.60934;
  
  // Parse time
  const parts = timeString.split(':').map(Number);
  let timeInSeconds;
  
  if (parts.length === 2) {
    // MM:SS format
    timeInSeconds = parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    // HH:MM:SS format
    timeInSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else {
    throw new Error('Invalid time format');
  }
  
  // Calculate pace (seconds per km)
  const paceSeconds = timeInSeconds / distanceKm;
  
  return calculateNPI(distanceKm, paceSeconds);
}

/**
 * Calculate projected time to beat target NPI
 * @param {number} currentNPI - Current NPI
 * @param {number} targetNPI - Target NPI
 * @param {number} distanceKm - Current distance in km
 * @param {number} durationSeconds - Current duration in seconds
 * @param {number} currentPaceSeconds - Current pace in seconds per km
 * @returns {Object} { timeToBeat: string, progress: number } or null if target reached
 */
export function calculateTimeToBeat(currentNPI, targetNPI, distanceKm, durationSeconds, currentPaceSeconds) {
  if (currentNPI >= targetNPI) {
    return { timeToBeat: 'TARGET REACHED!', progress: 1.0 };
  }
  
  if (distanceKm < 0.05) {
    // During initial calibration (first 50m)
    return { timeToBeat: null, progress: 0 };
  }
  
  const roundingThreshold = targetNPI - 0.5;
  const term = 10 * ((roundingThreshold * (durationSeconds / 60) / distanceKm) / 500 - 1);
  
  if (term < 5) {
    const distNeeded = Math.exp(term) - 0.1;
    const distRemaining = distNeeded - distanceKm;
    
    if (distRemaining > 0) {
      const timeSecs = distRemaining * currentPaceSeconds;
      const m = Math.floor(timeSecs / 60);
      const s = Math.floor(timeSecs % 60);
      
      const paceMin = Math.floor(currentPaceSeconds / 60);
      const paceSec = Math.floor(currentPaceSeconds % 60);
      
      const timeToBeat = `${m}:${s.toString().padStart(2, '0')} @ AVG ${paceMin}:${paceSec.toString().padStart(2, '0')}`;
      
      const totalExpectedTime = durationSeconds + timeSecs;
      const progress = totalExpectedTime > 0 ? durationSeconds / totalExpectedTime : 0;
      
      return { timeToBeat, progress: Math.min(progress, 1.0) };
    } else {
      return { timeToBeat: 'TARGET REACHED!', progress: 1.0 };
    }
  } else {
    return { timeToBeat: 'INCREASE PACE', progress: 0.02 };
  }
}






