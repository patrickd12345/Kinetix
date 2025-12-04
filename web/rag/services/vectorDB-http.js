/**
 * Vector database service using Chroma HTTP API
 * Alternative implementation that works with Python Chroma server
 */

const CHROMA_API_URL = process.env.CHROMA_API_URL || 'http://localhost:8000';
const COLLECTION_NAME = 'kinetix_runs';

export class VectorDB {
  constructor() {
    this.collectionId = null;
  }

  /**
   * Initialize and get/create collection
   */
  async initialize() {
    try {
      // Check if collection exists
      const listResponse = await fetch(`${CHROMA_API_URL}/api/v1/collections`);
      if (listResponse.ok) {
        const collections = await listResponse.json();
        const existing = collections.find(c => c.name === COLLECTION_NAME);
        if (existing) {
          this.collectionId = existing.id;
          return;
        }
      }

      // Create collection
      const createResponse = await fetch(`${CHROMA_API_URL}/api/v1/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: COLLECTION_NAME,
          metadata: { description: 'Kinetix run embeddings' }
        }),
      });

      if (createResponse.ok) {
        const collection = await createResponse.json();
        this.collectionId = collection.id;
      } else {
        throw new Error('Failed to create collection');
      }
    } catch (error) {
      console.error('Chroma initialization error:', error);
      throw error;
    }
  }

  /**
   * Add a run to the vector database
   */
  async addRun(run, embedding) {
    if (!this.collectionId) {
      await this.initialize();
    }

    const metadata = {
      id: run.id,
      distance: run.distance,
      pace: run.avgPace,
      npi: run.avgNPI,
      heartRate: run.avgHeartRate || null,
      cadence: run.avgCadence || null,
      formScore: run.formScore || null,
      date: run.date instanceof Date ? run.date.toISOString() : run.date,
      duration: run.duration,
    };

    const response = await fetch(`${CHROMA_API_URL}/api/v1/collections/${this.collectionId}/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: [run.id],
        embeddings: [embedding],
        metadatas: [metadata],
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to add run: ${response.status}`);
    }
  }

  /**
   * Find similar runs
   */
  async findSimilarRuns(embedding, options = {}) {
    if (!this.collectionId) {
      await this.initialize();
    }

    const { topK = 5, minDistance = null, maxDistance = null } = options;

    const where = {};
    if (minDistance !== null) where.distance = { $gte: minDistance };
    if (maxDistance !== null) where.distance = { ...where.distance, $lte: maxDistance };

    const response = await fetch(`${CHROMA_API_URL}/api/v1/collections/${this.collectionId}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queryEmbeddings: [embedding],
        nResults: topK,
        where: Object.keys(where).length > 0 ? where : undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(`Query failed: ${response.status}`);
    }

    const results = await response.json();

    return {
      runs: results.ids[0].map((id, index) => ({
        id,
        distance: results.metadatas[0][index].distance,
        similarity: 1 - (results.distances[0][index] || 0),
        metadata: results.metadatas[0][index],
      })),
      distances: results.distances[0],
    };
  }

  /**
   * Get run count
   */
  async getCount() {
    if (!this.collectionId) {
      await this.initialize();
    }

    const response = await fetch(`${CHROMA_API_URL}/api/v1/collections/${this.collectionId}/count`);
    if (response.ok) {
      const data = await response.json();
      return data.count || 0;
    }
    return 0;
  }
}

