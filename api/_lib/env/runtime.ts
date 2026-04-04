import { resolveKinetixRuntimeEnvFromObject } from "./runtime.shared.mjs";
import { runKinetixSharedDbBootstrapOnce } from "./sharedDbEnv.mjs";

runKinetixSharedDbBootstrapOnce();

type EnvSource = NodeJS.ProcessEnv;

export type KinetixRuntimeEnv = {
  aiMode: "gateway" | "ollama" | "fallback";
  aiProvider: "gateway" | "ollama";
  vercelAiBaseUrl: string;
  vercelVirtualKey: string;
  openAiModel: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
  apiRequireAuth: boolean;
  stravaClientId: string;
  stravaClientSecret: string;
  withingsClientId: string;
  withingsClientSecret: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  corsAllowedOrigins: string;
  /** Vercel deployment target: development | preview | production (empty if not on Vercel). */
  vercelEnv: string;
  nodeEnv: string;
  port: string;
  chromaMode: string;
  chromaPath: string;
  chromaApiUrl: string;
  chromaServerUrl: string;
  chromaDockerImage: string;
  chromaAutoStartRaw: string;
  ollamaApiUrl: string;
  ollamaAutoStartRaw: string;
  /** Stripe secret for server-side Checkout (test or live key) */
  stripeSecretKey: string;
  /** Subscription price id for Kinetix (e.g. price_...) */
  kinetixStripePriceId: string;
};

function getDefaultEnv(): EnvSource {
  return typeof globalThis !== "undefined" && globalThis["process"]?.env ? globalThis["process"].env : {};
}

/** Matches strict CORS / deployment-sensitive behavior: prod build or Vercel preview & production. */
function isProductionLikeRuntime(resolved: { nodeEnv: string; vercelEnv: string }): boolean {
  if (resolved.nodeEnv === "production") return true;
  return resolved.vercelEnv === "production" || resolved.vercelEnv === "preview";
}

export function resolveKinetixRuntimeEnv(env: EnvSource = getDefaultEnv()): KinetixRuntimeEnv {
  const resolved = resolveKinetixRuntimeEnvFromObject(env) as KinetixRuntimeEnv & { apiRequireAuthRaw?: string };
  const fromEnv = resolved.apiRequireAuthRaw === "1" || resolved.apiRequireAuthRaw === "true";
  const apiRequireAuth = isProductionLikeRuntime(resolved) ? true : fromEnv;
  return {
    ...resolved,
    apiRequireAuth,
  };
}
