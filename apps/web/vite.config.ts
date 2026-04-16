import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { sharedViteConfig } from './vite.config.shared'

function manualChunk(id: string): string | undefined {
  const p = id.replace(/\\/g, '/')
  if (!p.includes('node_modules')) return undefined
  if (
    p.includes('/node_modules/recharts') ||
    p.includes('/node_modules/victory') ||
    p.includes('/node_modules/d3-')
  ) {
    return 'recharts-vendor'
  }
  if (p.includes('/node_modules/react-router')) return 'react-router'
  if (p.includes('/node_modules/react-dom') || p.includes('/node_modules/react/')) return 'react-core'
  if (p.includes('/node_modules/lucide-react')) return 'lucide'
  if (p.includes('/node_modules/openai')) return 'openai-sdk'
  return undefined
}

/**
 * Default for `vite build` / Vercel — must not import `vite-plugin-oauth` (pulls in
 * `api/_lib` and `@bookiji-inc/*`, which are monorepo-only). Local dev uses
 * `vite.config.dev.ts` via `pnpm dev`.
 */
export default defineConfig({
  ...sharedViteConfig(),
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', '../../api/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['src/**/*.{ts,tsx}', '../../api/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/e2e/**',
        '**/dist/**',
        '**/node_modules/**',
        '**/vite.config*.ts',
        '**/support-corpus/**',
      ],
      thresholds: {
        lines: 5,
        functions: 5,
        branches: 3,
        statements: 5,
      },
    },
  },
  build: {
    reportCompressedSize: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      maxParallelFileOps: 2,
      output: {
        manualChunks(id) {
          return manualChunk(id)
        },
      },
    },
  },
})
