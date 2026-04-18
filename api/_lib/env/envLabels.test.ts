import { describe, expect, it } from 'vitest'
import { resolveEnvironmentLabelFromRaw } from './envLabels'

describe('resolveEnvironmentLabelFromRaw', () => {
  it('identifies production environments', () => {
    expect(resolveEnvironmentLabelFromRaw('production')).toBe('PROD')
    expect(resolveEnvironmentLabelFromRaw('prod')).toBe('PROD')
    expect(resolveEnvironmentLabelFromRaw('  PROD  ')).toBe('PROD')
  })

  it('identifies staging environments', () => {
    expect(resolveEnvironmentLabelFromRaw('staging')).toBe('STAGING')
    expect(resolveEnvironmentLabelFromRaw('stage')).toBe('STAGING')
    expect(resolveEnvironmentLabelFromRaw('preview')).toBe('STAGING')
    expect(resolveEnvironmentLabelFromRaw('STAGING')).toBe('STAGING')
  })

  it('identifies development environments', () => {
    expect(resolveEnvironmentLabelFromRaw('development')).toBe('DEV')
    expect(resolveEnvironmentLabelFromRaw('dev')).toBe('DEV')
    expect(resolveEnvironmentLabelFromRaw('test')).toBe('DEV')
    expect(resolveEnvironmentLabelFromRaw('local')).toBe('DEV')
    expect(resolveEnvironmentLabelFromRaw('LOCAL')).toBe('DEV')
  })

  it('returns UNKNOWN for empty or unrecognized strings', () => {
    expect(resolveEnvironmentLabelFromRaw('')).toBe('UNKNOWN')
    expect(resolveEnvironmentLabelFromRaw(undefined)).toBe('UNKNOWN')
    expect(resolveEnvironmentLabelFromRaw('something-else')).toBe('UNKNOWN')
  })
})
