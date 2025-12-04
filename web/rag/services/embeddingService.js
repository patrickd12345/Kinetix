/**
 * Embedding service using Ollama
 * Converts runs into vectors for semantic search
 */

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'nomic-embed-text';

export class EmbeddingService {
  /**
   * Format a run as text for embedding
   */
  static formatRunAsText(run) {
    const distance = (run.distance / 1000).toFixed(2);
    const paceMin = Math.floor(run.avgPace / 60);
    const paceSec = Math.floor(run.avgPace % 60);
    const pace = `${paceMin}:${paceSec.toString().padStart(2, '0')}`;
    const npi = Math.floor(run.avgNPI);
    const date = new Date(run.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    let text = `${distance}km run, pace ${pace} per km, NPI ${npi}`;
    
    if (run.avgHeartRate) {
      text += `, heart rate ${Math.floor(run.avgHeartRate)} bpm`;
    }
    
    if (run.avgCadence) {
      text += `, cadence ${Math.floor(run.avgCadence)} spm`;
    }
    
    if (run.formScore) {
      text += `, form score ${Math.floor(run.formScore)}`;
    }
    
    if (run.avgVerticalOscillation) {
      text += `, vertical oscillation ${run.avgVerticalOscillation.toFixed(1)} cm`;
    }
    
    if (run.avgGroundContactTime) {
      text += `, ground contact time ${Math.floor(run.avgGroundContactTime)} ms`;
    }
    
    text += `, date ${date}`;
    
    // Add context about performance
    if (run.avgNPI >= 140) {
      text += ', excellent performance';
    } else if (run.avgNPI >= 130) {
      text += ', good performance';
    } else {
      text += ', moderate performance';
    }
    
    return text;
  }

  /**
   * Generate embedding for a run
   */
  static async embedRun(run) {
    const text = this.formatRunAsText(run);
    return await this.embedText(text);
  }

  /**
   * Generate embedding for text
   */
  static async embedText(text) {
    try {
      const response = await fetch(`${OLLAMA_API_URL}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          prompt: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      return data.embedding;
    } catch (error) {
      console.error('Embedding error:', error);
      throw error;
    }
  }

  /**
   * Check if embedding model is available
   */
  static async isAvailable() {
    try {
      const response = await fetch(`${OLLAMA_API_URL}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      
      if (!response.ok) return false;
      
      const data = await response.json();
      const models = data.models?.map(m => m.name) || [];
      return models.some(name => name.includes(EMBEDDING_MODEL));
    } catch {
      return false;
    }
  }
}



