function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Returns additive pace offsets per segment:
 * - positive value => slower than baseline pace
 * - negative value => faster than baseline pace
 */
export function pacingOffsets(
  segmentCount: number,
  fadeRisk: 'low' | 'moderate' | 'high',
  trend: number
): number[] {
  const count = Math.max(1, segmentCount)
  const offsets = new Array(count).fill(0)

  // Start conservatively when fade risk is high.
  const conservativeStart =
    fadeRisk === 'high' ? 0.025 : fadeRisk === 'moderate' ? 0.012 : 0
  // Slightly stronger finish when trend is improving and fade risk is low/moderate.
  const negativeSplit =
    trend > 2 && fadeRisk !== 'high' ? (fadeRisk === 'low' ? 0.014 : 0.008) : 0

  for (let i = 0; i < count; i += 1) {
    const progress = count === 1 ? 1 : i / (count - 1)
    const frontLoad = conservativeStart * (1 - progress)
    const endKick = -negativeSplit * progress
    offsets[i] = clamp(frontLoad + endKick, -0.04, 0.05)
  }

  return offsets
}

export function pacingRecommendation(
  fadeRisk: 'low' | 'moderate' | 'high',
  trend: number
): string {
  if (fadeRisk === 'high') return 'Start conservatively and protect the middle kilometers.'
  if (trend > 2 && fadeRisk === 'low') return 'Run even early, then execute a slight negative split.'
  if (fadeRisk === 'moderate') return 'Keep the first third controlled, then settle into even pacing.'
  return 'Aim for even pacing with controlled opening effort.'
}
