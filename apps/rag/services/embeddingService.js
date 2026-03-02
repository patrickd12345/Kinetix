/**
 * Embedding service using Ollama
 * Converts runs into vectors for semantic search
 */

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'nomic-embed-text';

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
    const url = `${OLLAMA_API_URL}/api/embed`;
    const body = { model: EMBEDDING_MODEL, input: text };
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
      const response = await fetch(`${OLLAMA_API_URL}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      if (!response.ok) return false;
      const data = await response.json();
      const models = data.models?.map((m) => m.name) || [];
      const hasModel = models.some((name) => name.includes(EMBEDDING_MODEL) || EMBEDDING_MODEL.includes(name));
      return hasModel;
    } catch {
      return false;
    }
  }
}
