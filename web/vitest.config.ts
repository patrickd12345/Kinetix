import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/ops/**/*.test.ts', 'src/ops/**/*.test.tsx', 'src/ops/**/__tests__/**/*.test.ts'],
    setupFiles: [],
  },
});
