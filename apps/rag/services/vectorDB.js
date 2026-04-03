/**
 * Vector database service using Chroma
 * Stores and queries run embeddings
 */

import { ChromaClient } from 'chromadb';
import { resolveKinetixRuntimeEnvFromObject } from '../../../api/_lib/env/runtime.shared.mjs';

const runtimeConsole = globalThis.console ?? console;
const COLLECTION_NAME = 'kinetix_runs';

function getRuntime() {
  return resolveKinetixRuntimeEnvFromObject();
}

function getChromaMode() {
  return getRuntime().chromaMode || 'in-memory';
}

function getChromaPath() {
  return getRuntime().chromaPath || './chroma_db';
}

function getChromaApiUrl() {
  const runtime = getRuntime();
  return runtime.chromaApiUrl || runtime.chromaServerUrl;
}

function createChromaClient() {
  const url = getChromaApiUrl();
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    return new ChromaClient({ path: url });
  }
  try {
    if (getChromaMode() === 'persistent') {
      return new ChromaClient({ path: getChromaPath() });
    }
    return new ChromaClient();
  } catch (error) {
    runtimeConsole.warn('ChromaClient init error, trying default:', error);
    return new ChromaClient();
  }
}

export class VectorDB {
  constructor() {
    this._client = null;
    this.collection = null;
  }

  get client() {
    if (!this._client) this._client = createChromaClient();
    return this._client;
  }

  async initialize() {
    try {
      this.collection = await this.client.getCollection({ name: COLLECTION_NAME });
    } catch {
      this.collection = await this.client.createCollection({
        name: COLLECTION_NAME,
        metadata: { description: 'Kinetix run embeddings' },
      });
    }
    return this.collection;
  }

  async addRun(run, embedding) {
    if (!this.collection) await this.initialize();

    const dateStr =
      run.date instanceof Date ? run.date.toISOString() : String(run.date ?? '');
    const kps = run.avgKPS ?? run.avgNPI ?? 0;
    const metadata = {
      id: String(run.id),
      distance: Number(run.distance) || 0,
      pace: Number(run.avgPace) || 0,
      kps: Number(kps) || 0,
      date: dateStr,
      duration: Number(run.duration) || 0,
    };
    if (run.avgHeartRate != null && run.avgHeartRate !== '') {
      metadata.heartRate = Number(run.avgHeartRate);
    }
    if (run.avgCadence != null && run.avgCadence !== '') {
      metadata.cadence = Number(run.avgCadence);
    }
    if (run.formScore != null && run.formScore !== '') {
      metadata.formScore = Number(run.formScore);
    }
    const songBpm = run.songBpm ?? run.song_bpm;
    if (songBpm != null && songBpm !== '' && Number(songBpm) > 0) {
      metadata.songBpm = Number(songBpm);
    }
    const songLabel = [run.songArtist, run.songTitle].filter(Boolean).join(' — ') || run.song_label;
    if (songLabel && String(songLabel).trim()) {
      metadata.songLabel = String(songLabel).slice(0, 220);
    }

    await this.collection.add({
      ids: [String(run.id)],
      embeddings: [embedding],
      metadatas: [metadata],
    });
  }

  async updateRun(run, embedding) {
    await this.deleteRun(run.id);
    await this.addRun(run, embedding);
  }

  async deleteRun(runId) {
    if (!this.collection) await this.initialize();
    try {
      await this.collection.delete({ ids: [String(runId)] });
    } catch (error) {
      runtimeConsole.warn(`Run ${runId} not found in vector DB:`, error.message);
    }
  }

  async findSimilarRuns(embedding, options = {}) {
    if (!this.collection) await this.initialize();

    const { topK = 5, minDistance = null, maxDistance = null, minDate = null, maxDate = null } = options;
    const where = {};
    if (minDistance !== null) where.distance = { $gte: minDistance };
    if (maxDistance !== null) where.distance = { ...where.distance, $lte: maxDistance };
    if (minDate) where.date = { $gte: minDate };
    if (maxDate) where.date = { ...where.date, $lte: maxDate };

    const results = await this.collection.query({
      queryEmbeddings: [embedding],
      nResults: topK,
      where: Object.keys(where).length > 0 ? where : undefined,
    });

    return {
      runs: results.ids[0].map((id, index) => ({
        id,
        distance: results.metadatas[0][index].distance,
        similarity: 1 - results.distances[0][index],
        metadata: results.metadatas[0][index],
      })),
      distances: results.distances[0],
    };
  }

  async getAllRunIds() {
    if (!this.collection) await this.initialize();
    const results = await this.collection.get();
    return results.ids || [];
  }

  async getCount() {
    if (!this.collection) await this.initialize();
    const results = await this.collection.get();
    return results.ids?.length || 0;
  }

  async clearAll() {
    if (!this.collection) await this.initialize();
    const allIds = await this.getAllRunIds();
    if (allIds.length > 0) {
      await this.collection.delete({ ids: allIds });
    }
  }
}

export const vectorDB = new VectorDB();
