import { spawn } from "node:child_process";
import { mergeInfisicalForKinetix } from "./infisical-merge-lib.mjs";

function resolveEnvName() {
  return process.env.INFISICAL_ENV?.trim() || "dev";
}

function main() {
  const envName = resolveEnvName();
  const { mergedEnv } = mergeInfisicalForKinetix(envName);

  const child = spawn("pnpm", ["dev:raw"], {
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

function printInfisicalUnblockHint() {
  console.error("");
  console.error("Without Infisical, you can still run locally if apps/web/.env.local has the required VITE_/NEXT_PUBLIC_ Supabase keys:");
  console.error("  pnpm dev:local     # validates .env.local, then web + RAG (same as pnpm dev:raw after merge)");
  console.error("  pnpm dev:raw        # no preflight; Vite still loads apps/web/.env.local");
  console.error("  pnpm dev:web:host  # web only, bound to 0.0.0.0:5173");
  console.error("");
  console.error("Docs: docs/deployment/INFISICAL_LOCAL_DEV.md");
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    `[infisical] Failed to start Kinetix with merged /platform + /kinetix secrets: ${message}`
  );
  if (
    message.includes("Infisical CLI is not installed") ||
    message.includes("not on PATH")
  ) {
    console.error("");
    console.error("Install the Infisical CLI: https://infisical.com/docs/cli/overview");
    printInfisicalUnblockHint();
  }
  process.exit(1);
}
