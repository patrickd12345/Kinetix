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
      '@bookiji-inc/error-contract': path.resolve(__dirname, '../../packages/error-contract/src'),
      '@bookiji-inc/ai-runtime': path.resolve(__dirname, '../../packages/ai-runtime/src'),
      '@bookiji-inc/observability': path.resolve(__dirname, '../../packages/observability/src'),
      '@bookiji-inc/persistent-memory-runtime': path.resolve(__dirname, '../../packages/persistent-memory-runtime/src'),
      '@bookiji-inc/platform-auth': path.resolve(__dirname, '../../packages/platform-auth/src'),
      '@bookiji-inc/stripe-runtime': path.resolve(__dirname, '../../packages/stripe-runtime/src'),
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
