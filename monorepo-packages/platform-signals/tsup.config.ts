/**
 * Plain export only — avoid importing `tsup` from package-local config.
 * CI/Vercel builds this package from the app root where package devDeps may be absent.
 */
export default {
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
}
