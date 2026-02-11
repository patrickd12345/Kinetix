/**
 * Vector database service using Chroma
 * Stores and queries run embeddings
 */

import { ChromaClient } from 'chromadb';

const CHROMA_MODE = process.env.CHROMA_MODE || 'in-memory';
const CHROMA_PATH = process.env.CHROMA_PATH || './chroma_db';
const COLLECTION_NAME = 'kinetix_runs';

export class VectorDB {
  constructor() {
    try {
      if (CHROMA_MODE === 'persistent') {
        this.client = new ChromaClient({ path: CHROMA_PATH });
      } else {
        this.client = new ChromaClient();
      }
    } catch (error) {
      console.warn('ChromaClient init error, trying default:', error);
      this.client = new ChromaClient();
    }
    this.collection = null;
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

    const metadata = {
      id: run.id,
      distance: run.distance,
      pace: run.avgPace,
      kps: run.avgKPS ?? run.avgNPI,
      heartRate: run.avgHeartRate || null,
      cadence: run.avgCadence || null,
      formScore: run.formScore || null,
      date: run.date instanceof Date ? run.date.toISOString() : run.date,
      duration: run.duration,
    };

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
      console.warn(`Run ${runId} not found in vector DB:`, error.message);
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
