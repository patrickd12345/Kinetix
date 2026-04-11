/**
 * Fail CI / prebuild if bypass env vars leak into the build environment.
 * Intended for root prebuild, Vercel buildCommand prefix, and @kinetix/web prebuild.
 */
const FORBIDDEN = [
  'VITE_MASTER_ACCESS',
  'KINETIX_MASTER_ACCESS',
  'VITE_SKIP_AUTH',
  'ADMLOG_ENABLED',
  'BOOKIJI_TEST_MODE',
] as const

for (const key of FORBIDDEN) {
  const value = process.env[key]?.trim().toLowerCase()
  if (value && !['0', 'false', 'no', 'off'].includes(value)) {
    console.error(
      `[check-master-access] Refusing to build: ${key} must not be set in this environment.`,
    )
    process.exit(1)
  }
}
