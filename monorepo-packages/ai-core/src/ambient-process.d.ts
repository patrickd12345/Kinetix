/**
 * Minimal `process.env` typing for this package so `tsup` DTS does not depend on
 * `@types/node` being present in the package tree (Vercel + pnpm + workers).
 */
declare namespace NodeJS {
  interface ProcessEnv {
    [key: string]: string | undefined
  }
}

declare var process: {
  env: NodeJS.ProcessEnv
}
