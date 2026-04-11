/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADSENSE_CLIENT?: string
  readonly VITE_ADSENSE_SLOT?: string
  readonly VITE_ADSENSE_GLOBAL_OFF?: string
  readonly VITE_ADSENSE_APPROVAL_MODE?: string
  readonly VITE_ESCALATION_PROXY_URL?: string
  readonly VITE_ENABLE_OPERATOR_DASHBOARD?: string
  readonly VITE_ENABLE_SLA_METRICS?: string
  readonly VITE_ENABLE_ESCALATION?: string
  /** Withings expanded sync (scheduled slots, multi-domain ingest). Production: default off unless "true". */
  readonly VITE_ENABLE_WITHINGS_EXPANDED_INGESTION?: string
  /** Audit: bypass entitlement gate + enable all feature flags (never ship enabled). */
  readonly VITE_MASTER_ACCESS?: string
  readonly VITE_SKIP_AUTH?: string
  readonly VITE_AUTH_GOOGLE_ENABLED?: string
  readonly VITE_AUTH_APPLE_ENABLED?: string
  readonly VITE_AUTH_MICROSOFT_ENABLED?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  adsbygoogle?: unknown[]
}
