import { describe, expect, it } from 'vitest'
import { getCalibration } from './calibrationEngine'
import { computeDistancePrediction } from './distancePrediction'

describe('distance calibration', () => {
  it('5k calibration differs from marathon', () => {
    const fiveK = getCalibration('5k')
    const marathon = getCalibration('marathon')

    expect(fiveK.speedWeight).toBeGreaterThan(marathon.speedWeight)
    expect(fiveK.enduranceWeight).toBeLessThan(marathon.enduranceWeight)
  })

  it('fatigue affects marathon projection more than 5k', () => {
    const base = { currentKps: 100, projectedKps7d: 104, projectedKps28d: 108 }
    const fiveKHighFatigue = computeDistancePrediction(
      '5k',
      base,
      getCalibration('5k'),
      4,
      'high'
    )
    const marathonHighFatigue = computeDistancePrediction(
      'marathon',
      base,
      getCalibration('marathon'),
      4,
      'high'
    )

    expect(marathonHighFatigue.projectedKps7d).toBeLessThan(fiveKHighFatigue.projectedKps7d)
    expect(marathonHighFatigue.projectedKps28d).toBeLessThan(fiveKHighFatigue.projectedKps28d)
  })

  it('speed trend signal influences 5k more than marathon', () => {
    const base = { currentKps: 100, projectedKps7d: 101, projectedKps28d: 102 }
    const fiveK = computeDistancePrediction('5k', base, getCalibration('5k'), 5, 'low')
    const marathon = computeDistancePrediction('marathon', base, getCalibration('marathon'), 5, 'low')

    expect(fiveK.projectedKps7d - base.projectedKps7d).toBeGreaterThan(
      marathon.projectedKps7d - base.projectedKps7d
    )
  })

  it('clamps unrealistic jumps', () => {
    const base = { currentKps: 100, projectedKps7d: 125, projectedKps28d: 130 }
    const result = computeDistancePrediction(
      'marathon',
      base,
      getCalibration('marathon'),
      20,
      'low'
    )

    expect(result.projectedKps7d).toBeLessThanOrEqual(105)
    expect(result.projectedKps28d).toBeLessThanOrEqual(108)
  })
})
