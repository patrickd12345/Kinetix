import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('development'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@api': path.resolve(__dirname, '../../api'),
      '@kinetix/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
      '@bookiji-inc/error-contract': path.resolve(__dirname, '../../monorepo-packages/error-contract/src'),
      '@bookiji-inc/ai-runtime': path.resolve(__dirname, '../../monorepo-packages/ai-runtime/src'),
      '@bookiji-inc/observability': path.resolve(__dirname, '../../monorepo-packages/observability/src'),
      '@bookiji-inc/persistent-memory-runtime': path.resolve(__dirname, '../../monorepo-packages/persistent-memory-runtime/src'),
      '@bookiji-inc/platform-auth': path.resolve(__dirname, '../../monorepo-packages/platform-auth/src'),
      '@bookiji-inc/stripe-runtime': path.resolve(__dirname, '../../monorepo-packages/stripe-runtime/src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', '../../api/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    globals: true,
  },
})
