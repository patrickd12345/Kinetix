/**
 * Vector database service using Chroma
 * Stores and queries run embeddings
 */

import { ChromaClient } from 'chromadb';

// Chroma configuration
// For local dev, Chroma runs in-memory by default
// For production, use a persistent directory
const CHROMA_MODE = process.env.CHROMA_MODE || 'in-memory'; // 'in-memory' or 'persistent'
const CHROMA_PATH = process.env.CHROMA_PATH || './chroma_db';
const COLLECTION_NAME = 'kinetix_runs';

export class VectorDB {
  constructor() {
    // ChromaClient initialization
    // Note: chromadb Node.js client may need explicit configuration
    try {
      if (CHROMA_MODE === 'persistent') {
        this.client = new ChromaClient({ 
          path: CHROMA_PATH,
        });
      } else {
        // For in-memory, try without path first
        // If that fails, Chroma may need to run as a server
        this.client = new ChromaClient();
      }
    } catch (error) {
      console.warn('ChromaClient init error, trying default:', error);
      // Fallback: try with default settings
      this.client = new ChromaClient();
    }
    this.collection = null;
  }

  /**
   * Initialize and get collection
   */
  async initialize() {
    try {
      // Try to get existing collection
      this.collection = await this.client.getCollection({ name: COLLECTION_NAME });
    } catch (error) {
      // Create collection if it doesn't exist
      this.collection = await this.client.createCollection({
        name: COLLECTION_NAME,
        metadata: { description: 'Kinetix run embeddings' }
      });
    }
    return this.collection;
  }

  /**
   * Add a run to the vector database
   */
  async addRun(run, embedding) {
    if (!this.collection) {
      await this.initialize();
    }

    const metadata = {
      id: run.id,
      distance: run.distance,
      pace: run.avgPace,
      kps: run.kps,
      heartRate: run.avgHeartRate || null,
      cadence: run.avgCadence || null,
      formScore: run.formScore || null,
      date: run.date instanceof Date ? run.date.toISOString() : run.date,
      duration: run.duration,
    };

    await this.collection.add({
      ids: [run.id],
      embeddings: [embedding],
      metadatas: [metadata],
    });
  }

  /**
   * Update a run in the vector database
   */
  async updateRun(run, embedding) {
    // Chroma doesn't have update, so we delete and re-add
    await this.deleteRun(run.id);
    await this.addRun(run, embedding);
  }

  /**
   * Delete a run from the vector database
   */
  async deleteRun(runId) {
    if (!this.collection) {
      await this.initialize();
    }

    try {
      await this.collection.delete({ ids: [runId] });
    } catch (error) {
      // Run might not exist, that's okay
      console.warn(`Run ${runId} not found in vector DB:`, error.message);
    }
  }

  /**
   * Find similar runs
   */
  async findSimilarRuns(embedding, options = {}) {
    if (!this.collection) {
      await this.initialize();
    }

    const {
      topK = 5,
      minDistance = null,
      maxDistance = null,
      minDate = null,
      maxDate = null,
    } = options;

    // Build where clause for filtering
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

    // Format results
    return {
      runs: results.ids[0].map((id, index) => ({
        id,
        distance: results.metadatas[0][index].distance,
        similarity: 1 - results.distances[0][index], // Convert distance to similarity
        metadata: results.metadatas[0][index],
      })),
      distances: results.distances[0],
    };
  }

  /**
   * Get all run IDs in the database
   */
  async getAllRunIds() {
    if (!this.collection) {
      await this.initialize();
    }

    const results = await this.collection.get();
    return results.ids || [];
  }

  /**
   * Get run count
   */
  async getCount() {
    if (!this.collection) {
      await this.initialize();
    }

    const results = await this.collection.get();
    return results.ids?.length || 0;
  }

  /**
   * Clear all runs (for testing/reset)
   */
  async clearAll() {
    if (!this.collection) {
      await this.initialize();
    }

    const allIds = await this.getAllRunIds();
    if (allIds.length > 0) {
      await this.collection.delete({ ids: allIds });
    }
  }
}

// Singleton instance
export const vectorDB = new VectorDB();

