/**
 * Chroma collection for curated support KB only — never used for runs.
 * Collection name is distinct from kinetix_runs (see vectorDB.js).
 */

import { ChromaClient } from 'chromadb';
import { resolveKinetixRuntimeEnvFromObject } from '../../../api/_lib/env/runtime.shared.mjs';

const runtimeConsole = globalThis.console ?? console;

/** Exposed for tests — must never equal kinetix_runs */
export const SUPPORT_KB_COLLECTION_NAME = 'kinetix_support_kb';

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
    runtimeConsole.warn('[supportKB] ChromaClient init error, trying default:', error);
    return new ChromaClient();
  }
}

export class SupportVectorDB {
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
      this.collection = await this.client.getCollection({ name: SUPPORT_KB_COLLECTION_NAME });
    } catch {
      this.collection = await this.client.createCollection({
        name: SUPPORT_KB_COLLECTION_NAME,
        metadata: { description: 'Kinetix curated support knowledge (not runs)' },
      });
    }
    return this.collection;
  }

  /**
   * Remove all chunks for an artifact (any version) before re-ingest.
   */
  async deleteByArtifactId(artifactId) {
    if (!this.collection) await this.initialize();
    try {
      const data = await this.collection.get({
        where: { artifact_id: artifactId },
      });
      const ids = data.ids || [];
      if (ids.length > 0) {
        await this.collection.delete({ ids });
      }
    } catch (e) {
      runtimeConsole.warn(`[supportKB] deleteByArtifactId(${artifactId}):`, e.message);
    }
  }

  /**
   * @param {{ id: string, embedding: number[], document: string, metadata: Record<string, unknown> }} chunk
   */
  async addChunk(chunk) {
    if (!this.collection) await this.initialize();
    await this.collection.add({
      ids: [chunk.id],
      embeddings: [chunk.embedding],
      documents: [chunk.document],
      metadatas: [chunk.metadata],
    });
  }

  /**
   * @param {number[]} embedding
   * @param {{ topK?: number, where?: Record<string, unknown> }} options
   */
  async query(embedding, options = {}) {
    if (!this.collection) await this.initialize();
    const { topK = 5, where } = options;
    const results = await this.collection.query({
      queryEmbeddings: [embedding],
      nResults: topK,
      where: where && Object.keys(where).length > 0 ? where : undefined,
    });

    const ids = results.ids[0] || [];
    const distances = results.distances[0] || [];
    const documents = results.documents[0] || [];
    const metadatas = results.metadatas[0] || [];

    return {
      ids,
      distances,
      documents,
      metadatas,
    };
  }

  async getCount() {
    if (!this.collection) await this.initialize();
    const data = await this.collection.get();
    return data.ids?.length || 0;
  }
}

export const supportVectorDB = new SupportVectorDB();
