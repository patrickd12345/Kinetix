// @ts-expect-error - TS7016
import { resolveKinetixRuntimeEnvFromObject } from "./runtime.shared.mjs";
// @ts-expect-error - TS7016
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
  /** Ops-only: RAG PATCH /support/ticket/:id/status (see apps/rag README) */
  kinetixSupportOpsSecret: string;
};

function getDefaultEnv(): EnvSource {
  return typeof globalThis !== "undefined" && globalThis["process"]?.env ? globalThis["process"].env : {};
}

export function resolveKinetixRuntimeEnv(env: EnvSource = getDefaultEnv()): KinetixRuntimeEnv {
  const resolved = resolveKinetixRuntimeEnvFromObject(env) as KinetixRuntimeEnv & { apiRequireAuthRaw?: string };
  return {
    ...resolved,
    apiRequireAuth: resolved.apiRequireAuthRaw === "1" || resolved.apiRequireAuthRaw === "true",
  };
}
