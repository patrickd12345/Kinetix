/**
 * RAG Index Service
 * Client-side service for indexing runs into the RAG system
 */

const RAG_SERVICE_URL = import.meta.env.VITE_RAG_SERVICE_URL || 'http://localhost:3001';

export class RAGIndexService {
  /**
   * Check if RAG service is available
   */
  static async isAvailable() {
    try {
      const response = await fetch(`${RAG_SERVICE_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000), // 2 second timeout
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get RAG service stats
   */
  static async getStats() {
    try {
      const response = await fetch(`${RAG_SERVICE_URL}/stats`);
      if (response.ok) {
        return await response.json();
      }
      return { runCount: 0 };
    } catch (error) {
      return { runCount: 0 };
    }
  }

  /**
   * Index a single run
   */
  static async indexRun(run) {
    try {
      const response = await fetch(`${RAG_SERVICE_URL}/index`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run }),
      });
      return response.ok;
    } catch (error) {
      console.error('Index error:', error);
      return false;
    }
  }

  /**
   * Index multiple runs
   */
  static async indexRuns(runs) {
    const results = { success: 0, errors: 0 };
    
    for (const run of runs) {
      const success = await this.indexRun(run);
      if (success) {
        results.success++;
      } else {
        results.errors++;
      }
    }
    
    return results;
  }
}
