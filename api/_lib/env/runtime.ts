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
  /** Ollama embedding model for RAG (`/api/embed`); not the chat LLM. */
  ollamaEmbedModel: string;
  apiRequireAuth: boolean;
  stravaClientId: string;
  stravaClientSecret: string;
  googleClientId: string;
  googleClientSecret: string;
  withingsClientId: string;
  withingsClientSecret: string;
  /** Optional; must match Withings partner callback URL (e.g. https://kinetix.bookiji.com/api/withings-oauth) */
  withingsRedirectUri: string;
  garminConnectClientId: string;
  garminConnectClientSecret: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** Next-gen `SUPABASE_SECRET_KEY` (`sb_secret_...`) preferred; legacy JWT service_role last. */
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
  kinetixSupportOperatorUserIds: string;
  kinetixSupportSlackWebhookUrl: string;
  kinetixSupportEmailTo: string;
  kinetixSupportEmailFrom: string;
  resendApiKey: string;
  kinetixAppBaseUrl: string;
  kinetixRagBaseUrl: string;
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
