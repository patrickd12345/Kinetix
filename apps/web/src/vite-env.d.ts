/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADSENSE_CLIENT?: string
  readonly VITE_ADSENSE_SLOT?: string
  readonly VITE_ADSENSE_GLOBAL_OFF?: string
  readonly VITE_ADSENSE_APPROVAL_MODE?: string
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
