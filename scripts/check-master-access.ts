/**
 * Fail CI / prebuild if master-access env vars leak into the build environment.
 * Intended for root prebuild, Vercel buildCommand prefix, and @kinetix/web prebuild.
 */
const FORBIDDEN = ['VITE_MASTER_ACCESS', 'KINETIX_MASTER_ACCESS'] as const

for (const key of FORBIDDEN) {
  if (process.env[key]) {
    console.error(
      `[check-master-access] Refusing to build: ${key} must not be set in this environment.`,
    )
    process.exit(1)
  }
}
