/**
 * Plain export only — do not `import from 'tsup'`. When tsup bundles this config on CI,
 * it must not resolve the `tsup` package from packages/ai-core (devDeps may be absent).
 */
export default {
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
};
