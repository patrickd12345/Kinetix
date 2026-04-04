import { spawn } from "node:child_process";
import { mergeInfisicalForKinetix } from "./infisical-merge-lib.mjs";

function resolveEnvName() {
  return process.env.INFISICAL_ENV?.trim() || "dev";
}

function main() {
  const envName = resolveEnvName();
  const { mergedEnv } = mergeInfisicalForKinetix(envName);

  const child = spawn("pnpm", ["dev"], {
    env: mergedEnv,
    stdio: "inherit",
    shell: true,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    `[infisical] Failed to start Kinetix with merged /platform + /kinetix secrets: ${message}`
  );
  process.exit(1);
}
