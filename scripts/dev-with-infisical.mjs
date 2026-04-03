import { execFileSync, spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function projectIdArgs() {
  const fromEnv = process.env.INFISICAL_PROJECT_ID?.trim();
  if (fromEnv) {
    return ["--projectId", fromEnv];
  }
  try {
    const cfgPath = join(process.cwd(), ".infisical.json");
    if (!existsSync(cfgPath)) {
      return [];
    }
    const j = JSON.parse(readFileSync(cfgPath, "utf8"));
    if (j.workspaceId) {
      return ["--projectId", j.workspaceId];
    }
  } catch {
    return [];
  }
  return [];
}

function exportSecrets(secretPath, envName) {
  const output = execFileSync(
    "infisical",
    [...projectIdArgs(), "export", "--env", envName, "--path", secretPath, "--format", "json"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  const parsed = JSON.parse(output);
  if (!Array.isArray(parsed)) {
    throw new Error(`Unexpected Infisical export payload for path ${secretPath}`);
  }

  return Object.fromEntries(
    parsed
      .filter((entry) => entry && typeof entry.key === "string")
      .map((entry) => [entry.key, typeof entry.value === "string" ? entry.value : ""])
  );
}

function resolveEnvName() {
  return process.env.INFISICAL_ENV?.trim() || "dev";
}

/**
 * Bookiji Inc /platform uses SUPABASE_SECRET_KEY; Kinetix runtime resolves
 * SUPABASE_SERVICE_ROLE_KEY | SUPABASE_SERVICE_KEY only. Alias for local dev merge.
 */
function applyPlatformServiceKeyAlias(env) {
  const secret = env.SUPABASE_SECRET_KEY?.trim();
  const hasLegacy =
    env.SUPABASE_SERVICE_ROLE_KEY?.trim() || env.SUPABASE_SERVICE_KEY?.trim();
  if (secret && !hasLegacy) {
    env.SUPABASE_SERVICE_ROLE_KEY = secret;
  }
}

function main() {
  const envName = resolveEnvName();
  const platformSecrets = exportSecrets("/platform", envName);
  const kinetixSecrets = exportSecrets("/kinetix", envName);
  const mergedEnv = {
    ...process.env,
    ...platformSecrets,
    ...kinetixSecrets,
  };
  applyPlatformServiceKeyAlias(mergedEnv);

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
