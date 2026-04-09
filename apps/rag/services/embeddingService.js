/**
 * Embedding service using Ollama
 * Converts runs into vectors for semantic search
 */

import { resolveKinetixRuntimeEnvFromObject } from '../../../api/_lib/env/runtime.shared.mjs';

const runtimeConsole = globalThis.console ?? console;

function getRuntime() {
  return resolveKinetixRuntimeEnvFromObject();
}

function getOllamaApiUrl() {
  return getRuntime().ollamaApiUrl || 'http://localhost:11434';
}

/** Strip Ollama tag (e.g. `:latest`) for comparisons. */
function modelBase(name) {
  return String(name || '')
    .trim()
    .split(':')[0]
    .toLowerCase();
}

/**
 * True when the name is almost certainly a chat/completion model, not an embedding model.
 * Prevents EMBEDDING_MODEL / OLLAMA_EMBED_MODEL from being set to the same value as OLLAMA_MODEL.
 */
function looksLikeOllamaChatModel(name) {
  const b = modelBase(name);
  if (!b) return false;
  if (b.includes('embed')) return false;
  if (b.startsWith('nomic-embed') || b.startsWith('bge-') || b.includes('mxbai') || b.startsWith('snowflake')) {
    return false;
  }
  return /^(llama|tinyllama|mistral|mixtral|gemma|phi|qwen|vicuna|orca|neural-chat|openchat|wizard|codellama|deepseek)/i.test(
    b,
  );
}

function resolveEmbeddingModel() {
  const rt = getRuntime();
  const configured = (rt.ollamaEmbedModel || 'nomic-embed-text').trim();
  const chat = (rt.ollamaModel || '').trim();
  if (
    looksLikeOllamaChatModel(configured) ||
    (chat && modelBase(configured) === modelBase(chat) && !modelBase(configured).includes('embed'))
  ) {
    runtimeConsole.warn(
      `[RAG] Ollama embedding model "${configured}" looks like a chat LLM (or matches OLLAMA_MODEL). Using "nomic-embed-text" for /api/embed. Set OLLAMA_EMBED_MODEL to an embedding model and run: ollama pull nomic-embed-text`,
    );
    return 'nomic-embed-text';
  }
  return configured || 'nomic-embed-text';
}

function getEmbeddingModel() {
  return resolveEmbeddingModel();
}

export class EmbeddingService {
  static formatRunAsText(run) {
    const distance = (run.distance / 1000).toFixed(2);
    const paceMin = Math.floor(run.avgPace / 60);
    const paceSec = Math.floor(run.avgPace % 60);
    const pace = `${paceMin}:${paceSec.toString().padStart(2, '0')}`;
    const kps = Math.floor(run.avgKPS ?? run.avgNPI ?? 0);
    const date = new Date(run.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    let text = `${distance}km run, pace ${pace} per km, KPS ${kps}`;

    if (run.avgHeartRate) text += `, heart rate ${Math.floor(run.avgHeartRate)} bpm`;
    if (run.avgCadence) text += `, cadence ${Math.floor(run.avgCadence)} spm`;
    const st = run.songTitle || run.song_title;
    const sa = run.songArtist || run.song_artist;
    const sbpm = run.songBpm ?? run.song_bpm;
    if (sbpm != null && sbpm > 0) {
      const who = [sa, st].filter(Boolean).join(' — ') || 'music';
      text += `, music ~${Math.floor(sbpm)} BPM (${who})`;
      if (run.avgCadence) {
        const cad = Math.floor(run.avgCadence);
        const ratio = cad > 0 ? (sbpm / cad).toFixed(2) : '';
        text += `; music BPM to cadence ratio ${ratio} (compare tempo to step rhythm for efficiency)`;
      }
    }
    if (run.formScore) text += `, form score ${Math.floor(run.formScore)}`;
    if (run.avgVerticalOscillation) text += `, vertical oscillation ${run.avgVerticalOscillation.toFixed(1)} cm`;
    if (run.avgGroundContactTime) text += `, ground contact time ${Math.floor(run.avgGroundContactTime)} ms`;

    text += `, date ${date}`;

    const avgKPS = run.avgKPS ?? run.avgNPI ?? 0;
    if (avgKPS >= 140) text += ', excellent performance';
    else if (avgKPS >= 130) text += ', good performance';
    else text += ', moderate performance';

    return text;
  }

  static async embedRun(run) {
    const text = this.formatRunAsText(run);
    return this.embedText(text);
  }

  static async embedText(text) {
    const url = `${getOllamaApiUrl()}/api/embed`;
    const body = { model: getEmbeddingModel(), input: text };
    const attempt = async () => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok) {
        const errBody = await response.text();
        const err = new Error(`Ollama API error: ${response.status}${errBody ? ` - ${errBody.slice(0, 200)}` : ''}`);
        err.status = response.status;
        throw err;
      }
      const data = await response.json();
      const emb = data.embeddings?.[0] ?? data.embedding;
      if (!emb || !Array.isArray(emb)) {
        throw new Error('Ollama embeddings response missing embeddings array');
      }
      return emb;
    };
    try {
      return await attempt();
    } catch (e) {
      if (e?.status === 500) {
        await new Promise((r) => setTimeout(r, 2000));
        return await attempt();
      }
      throw e;
    }
  }

  static async isAvailable() {
    try {
      const response = await fetch(`${getOllamaApiUrl()}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      if (!response.ok) return false;
      const data = await response.json();
      const models = data.models?.map((m) => m.name) || [];
      const embeddingModel = getEmbeddingModel();
      const hasModel = models.some((name) => name.includes(embeddingModel) || embeddingModel.includes(name));
      return hasModel;
    } catch {
      return false;
    }
  }
}
