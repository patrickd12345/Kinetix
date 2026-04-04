#!/usr/bin/env node
/**
 * Validates Infisical `/platform` + `/kinetix` merge for Kinetix without starting the dev server.
 * Does not print secret values. Requires `infisical login` and CLI on PATH.
 *
 * Usage: node scripts/verify-infisical.mjs [--env=dev|prod]
 * Env:   INFISICAL_ENV (default dev)
 */
import { mergeInfisicalForKinetix } from "./infisical-merge-lib.mjs";

function parseEnvArg() {
  const arg = process.argv.find((a) => a.startsWith("--env="));
  if (arg) {
    return arg.slice("--env=".length).trim() || "dev";
  }
  return process.env.INFISICAL_ENV?.trim() || "dev";
}

try {
  const envName = parseEnvArg();
  const { mergedEnv, platformKeyCount, kinetixKeyCount } =
    mergeInfisicalForKinetix(envName);

  const url =
    mergedEnv.VITE_SUPABASE_URL?.trim() ||
    mergedEnv.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "";
  const urlOk = Boolean(url);

  console.log(
    `[verify:infisical] OK — env=${envName} platform_keys=${platformKeyCount} kinetix_keys=${kinetixKeyCount} supabase_url=${urlOk ? "set" : "missing"} service_role_alias=${mergedEnv.SUPABASE_SERVICE_ROLE_KEY ? "yes" : "no"}`
  );
  process.exit(0);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[verify:infisical] FAILED: ${message}`);
  process.exit(1);
}
