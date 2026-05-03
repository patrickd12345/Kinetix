export interface KpsMarker {
  kmIndex: number
  elapsedSec: number
  splitSec: number
  avgPaceSecPerKm: number
  liveKps: number
  distanceKm: number
  createdAt: string
}

export function captureKpsMarker(
  markers: KpsMarker[],
  currentDistanceKm: number,
  elapsedSec: number,
  liveKps: number,
  avgPaceSecPerKm: number,
  nowIsoString: string
): KpsMarker[] {
  const kmIndex = Math.floor(currentDistanceKm)

  // Only capture at full kilometer boundaries (e.g. 1.0, 2.0)
  if (kmIndex < 1 || currentDistanceKm < kmIndex) {
    return markers
  }

  // Prevent duplicates for the same kmIndex
  const hasCaptured = markers.some((m) => m.kmIndex === kmIndex)
  if (hasCaptured) {
    return markers
  }

  const prevElapsed = markers.length > 0 ? markers[markers.length - 1].elapsedSec : 0
  const splitSec = elapsedSec - prevElapsed

  const newMarker: KpsMarker = {
    kmIndex,
    elapsedSec,
    splitSec,
    avgPaceSecPerKm,
    liveKps,
    distanceKm: currentDistanceKm,
    createdAt: nowIsoString,
  }

  return [...markers, newMarker]
}
