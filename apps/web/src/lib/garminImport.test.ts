import { describe, it, expect } from 'vitest'
import { isGarminFitFile } from './garminImport'

describe('isGarminFitFile', () => {
  it('returns true for .fit / .FIT', () => {
    expect(isGarminFitFile({ name: 'activity.fit' } as File)).toBe(true)
    expect(isGarminFitFile({ name: 'x.FIT' } as File)).toBe(true)
  })
  it('returns false for .zip and others', () => {
    expect(isGarminFitFile({ name: 'export.zip' } as File)).toBe(false)
    expect(isGarminFitFile({ name: 'file.txt' } as File)).toBe(false)
  })
})
