import { spawn } from "node:child_process";
import { mergeLocalOnlyDevEnv } from "./infisical-merge-lib.mjs";

function main() {
  const { mergedEnv } = mergeLocalOnlyDevEnv();
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

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[dev:local] ${message}`);
  console.error("");
  console.error(
    "Set apps/web/.env.local (see apps/web/.env.example). Required: Supabase URL and publishable/anon key (VITE_* or NEXT_PUBLIC_*)."
  );
  process.exit(1);
}
