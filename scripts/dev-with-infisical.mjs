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

function trimNonEmpty(value) {
  if (typeof value !== "string") {
    return "";
  }
  const t = value.trim();
  return t.length > 0 ? t : "";
}

/**
 * Mirrors apps/web/src/lib/supabaseClient.ts — required for a working Supabase client in Vite.
 */
function validateMergedEnvForLocalDev(env) {
  const missing = [];

  const url =
    trimNonEmpty(env.VITE_SUPABASE_URL) ||
    trimNonEmpty(env.NEXT_PUBLIC_SUPABASE_URL);
  if (!url) {
    missing.push(
      "Supabase URL — set a non-empty value for one of: VITE_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_URL"
    );
  }

  const publishable =
    trimNonEmpty(env.VITE_SUPABASE_ANON_KEY) ||
    trimNonEmpty(env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    trimNonEmpty(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (!publishable) {
    missing.push(
      "Supabase publishable/anon key — set a non-empty value for one of: VITE_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );
  }

  if (missing.length === 0) {
    return;
  }

  const detail = missing.map((line) => `  - ${line}`).join("\n");
  throw new Error(
    `Missing required variables after merge (see docs/deployment/INFISICAL_LOCAL_DEV.md):\n${detail}`
  );
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
  validateMergedEnvForLocalDev(mergedEnv);

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
