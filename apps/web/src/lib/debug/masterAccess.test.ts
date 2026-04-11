import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('masterAccess', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  it('enables master access in dev when VITE_MASTER_ACCESS is 1', async () => {
    vi.stubEnv('VITE_MASTER_ACCESS', '1')
    vi.stubEnv('MODE', 'development')
    const mod = await import('./masterAccess')
    expect(mod.MASTER_ACCESS).toBe(true)
  })

  it('disables master access in production when VITE_MASTER_ACCESS is unset', async () => {
    vi.stubEnv('MODE', 'production')
    const mod = await import('./masterAccess')
    expect(mod.MASTER_ACCESS).toBe(false)
  })

  it('throws on module load when production and VITE_MASTER_ACCESS is set', async () => {
    vi.stubEnv('MODE', 'production')
    vi.stubEnv('VITE_MASTER_ACCESS', '1')
    await expect(import('./masterAccess')).rejects.toThrow(
      'MASTER_ACCESS cannot be enabled in production',
    )
  })
})
