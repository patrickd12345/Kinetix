/**
 * One-time migration from shared `KinetixDB` → per-user `KinetixDB__<authUserId>`.
 * When this marker exists in localStorage, legacy import NEVER runs again for any user.
 */

export const LEGACY_IDB_MIGRATION_MARKER_KEY = 'kinetix-idb-legacy-import-v1'

export const LEGACY_IDB_MIGRATION_SCHEMA_VERSION = 1 as const

export type LegacyIdbMigrationMarkerV1 = {
  version: typeof LEGACY_IDB_MIGRATION_SCHEMA_VERSION
  /** User id that received legacy IndexedDB rows when `importedFromLegacySharedDb` is true; otherwise null. */
  migrationOwnerUserId: string | null
  migratedAt: string
  importedFromLegacySharedDb: boolean
  /** True when no legacy shared `KinetixDB` existed at migration check time. */
  legacyDexieAbsent: boolean
}

export function parseLegacyMigrationMarker(raw: string | null): LegacyIdbMigrationMarkerV1 | null {
  if (!raw?.trim()) return null
  try {
    const v = JSON.parse(raw) as LegacyIdbMigrationMarkerV1
    if (v?.version !== LEGACY_IDB_MIGRATION_SCHEMA_VERSION) return null
    return v
  } catch {
    return null
  }
}
