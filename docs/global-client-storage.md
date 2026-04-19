# Intentionally global client storage keys (Kinetix web)

These keys are **not** namespaced by `session.user.id` by design.

| Key / prefix | Surface | Why global is safe |
|--------------|---------|---------------------|
| `kinetix-theme` | localStorage (Zustand persist) | UI preference only (light/dark/system); no account or health data. |
| `kinetix-idb-legacy-import-v1` | localStorage | One-time Dexie migration marker; records schema version + whether legacy shared DB existed; prevents re-import for any subsequent user. |
| `LEGACY_COACH_MEMORY_KEY` (`kinetix-coach-memory-v1`) | localStorage | Legacy unscoped coach snapshot; read once to migrate into scoped keys then removed. |

Namespaced per user (not global):

| Prefix | Purpose |
|--------|---------|
| `kinetix-settings:<userId>` | Zustand settings (training prefs + integrations after login-scoped hydration). |
| `kinetix-coach-memory-v1:<userId>` | Coach decision memory snapshots. |
| `kinetix.historyKpsDerived.v1:<userId>` | History derived relative KPS cache (`historyKpsDerivedCache.ts`). |

Session-only keys without auth scope (e.g. transient OAuth state before callback completes) should prefer user-scoped keys when `session.user.id` is known.

Vitest uses `fake-indexeddb/auto` in `apps/web/src/test/setup.ts` so Dexie APIs work under jsdom.
