module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', 'node_modules', 'api', 'scripts'],
  overrides: [
    {
      files: ['src/test/**/*.ts', 'src/test/**/*.tsx'],
      parserOptions: { project: null },
      rules: { '@typescript-eslint/no-explicit-any': 'off' },
    },
    {
      files: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      parserOptions: { project: null },
      rules: { '@typescript-eslint/no-explicit-any': 'off' },
    },
    {
      files: ['src/lib/withingsOAuthServer.ts'],
      parserOptions: { project: null },
    },
  ],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
}
