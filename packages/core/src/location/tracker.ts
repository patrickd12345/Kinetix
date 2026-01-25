/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate pace from distance and time
 * @param distanceMeters Distance in meters
 * @param timeSeconds Time in seconds
 * @returns Pace in seconds per kilometer
 */
export function calculatePace(distanceMeters: number, timeSeconds: number): number {
  if (distanceMeters <= 0 || timeSeconds <= 0) return 0;
  const distanceKm = distanceMeters / 1000;
  return timeSeconds / distanceKm;
}

/**
 * Format pace as MM:SS
 */
export function formatPace(paceSecondsPerKm: number, unit: 'metric' | 'imperial' = 'metric'): string {
  const pace = unit === 'metric' ? paceSecondsPerKm : paceSecondsPerKm * 1.60934;
  if (!isFinite(pace) || isNaN(pace) || pace <= 0) return '0:00';
  const minutes = Math.floor(pace / 60);
  const seconds = Math.floor(pace % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format distance
 */
export function formatDistance(distanceMeters: number, unit: 'metric' | 'imperial' = 'metric'): string {
  const distance = unit === 'metric' 
    ? distanceMeters / 1000 
    : (distanceMeters / 1000) * 0.621371;
  return distance.toFixed(2);
}

/**
 * Format time as HH:MM:SS or MM:SS
 */
export function formatTime(timeSeconds: number): string {
  const hours = Math.floor(timeSeconds / 3600);
  const minutes = Math.floor((timeSeconds % 3600) / 60);
  const seconds = Math.floor(timeSeconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
