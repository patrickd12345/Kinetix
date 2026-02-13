import type { UserProfile } from '@kinetix/core'

export interface PlatformProfileRecord {
  id: string
  email?: string | null
  full_name?: string | null
  display_name?: string | null
  age?: number | null
  weight_kg?: number | null
  weightKg?: number | null
  metadata?: Record<string, unknown> | null
  [key: string]: unknown
}

function asPositiveNumber(value: unknown): number | null {
  if (typeof value === 'number' && isFinite(value) && value > 0) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (isFinite(parsed) && parsed > 0) return parsed
  }
  return null
}

export function toKinetixUserProfile(profile: PlatformProfileRecord): UserProfile {
  const metadata = (profile.metadata ?? {}) as Record<string, unknown>
  const age =
    asPositiveNumber(profile.age) ??
    asPositiveNumber(metadata.age) ??
    30
  const weightKg =
    asPositiveNumber(profile.weight_kg) ??
    asPositiveNumber(profile.weightKg) ??
    asPositiveNumber(metadata.weight_kg) ??
    asPositiveNumber(metadata.weightKg) ??
    70

  return { age, weightKg }
}

export function getProfileLabel(profile: PlatformProfileRecord, fallbackEmail?: string | null): string {
  return (
    profile.display_name ??
    profile.full_name ??
    profile.email ??
    fallbackEmail ??
    profile.id
  )
}
