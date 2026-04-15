import { describe, expect, it } from 'vitest'
import {
  calculateKPS,
  distanceToAchieveKPS,
  timeToAchieveKPS,
  type RunData,
  type UserProfile,
} from './calculator'

const RIEGEL_EXPONENT = 1.06
const REF_KM = 10

function kps5k(timeSeconds: number, profile: UserProfile): number {
  return calculateKPS({ distanceKm: 5, timeSeconds, unit: 'metric' }, profile, REF_KM)
}

describe('calculateKPS (FEAT-KTX-027)', () => {
  const baseProfile: UserProfile = { age: 35, weightKg: 70 }

  it('is deterministic for identical inputs', () => {
    const run: RunData = { distanceKm: 5, timeSeconds: 1500, unit: 'metric' }
    const a = calculateKPS(run, baseProfile)
    const b = calculateKPS(run, baseProfile)
    expect(a).toBe(b)
    expect(Number.isFinite(a)).toBe(true)
  })

  it('matches Riegel-equivalent efforts at different distances (comparable KPS)', () => {
    const t5 = 1500
    const factor = Math.pow(REF_KM / 5, RIEGEL_EXPONENT)
    const t10Equivalent = t5 * factor
    const k5 = kps5k(t5, baseProfile)
    const k10 = calculateKPS({ distanceKm: 10, timeSeconds: t10Equivalent, unit: 'metric' }, baseProfile, REF_KM)
    expect(Math.abs(k5 - k10)).toBeLessThan(1e-6)
  })

  it('does not give heavier runners a higher KPS than reference weight at same raw performance', () => {
    const run: RunData = { distanceKm: 5, timeSeconds: 1500, unit: 'metric' }
    const ref = calculateKPS(run, { age: 40, weightKg: 70 })
    const heavier = calculateKPS(run, { age: 40, weightKg: 90 })
    const lighter = calculateKPS(run, { age: 40, weightKg: 60 })
    expect(heavier).toBeLessThan(ref)
    expect(lighter).toBeGreaterThan(ref)
  })

  it('strictly decreases KPS when weight increases (fixed run and age)', () => {
    const run: RunData = { distanceKm: 10, timeSeconds: 3000, unit: 'metric' }
    const w = [60, 70, 80, 90] as const
    const scores = w.map((kg) => calculateKPS(run, { age: 32, weightKg: kg }))
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThan(scores[i - 1])
    }
  })

  it('documents post-peak age heuristic: same run scores lower when age is past peak', () => {
    const run: RunData = { distanceKm: 5, timeSeconds: 1500, unit: 'metric' }
    const young = calculateKPS(run, { age: 25, weightKg: 70 })
    const older = calculateKPS(run, { age: 55, weightKg: 70 })
    expect(older).toBeLessThan(young)
  })

  it('round-trips timeToAchieveKPS with calculateKPS within rounding tolerance', () => {
    const run: RunData = { distanceKm: 5, timeSeconds: 1500, unit: 'metric' }
    const k = calculateKPS(run, baseProfile)
    const tBack = timeToAchieveKPS(k, 5, baseProfile)
    expect(Math.abs(tBack - 1500)).toBeLessThanOrEqual(1)
  })

  it('round-trips distanceToAchieveKPS with calculateKPS within rounding tolerance', () => {
    const timeSeconds = 1800
    const k = calculateKPS({ distanceKm: 8, timeSeconds, unit: 'metric' }, baseProfile)
    const dBack = distanceToAchieveKPS(k, timeSeconds, baseProfile)
    expect(Math.abs(dBack - 8)).toBeLessThan(0.02)
  })
})
