/**
 * RAG (Retrieval Augmented Generation) service
 * Combines vector search with LLM generation
 */

import { EmbeddingService } from './embeddingService.js';
import { vectorDB } from './vectorDB.js';

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434';
const LLM_MODEL = process.env.LLM_MODEL || 'llama3.2';

export class RAGService {
  /**
   * Analyze a run using RAG (with historical context)
   */
  static async analyzeRunWithRAG(run, targetNPI, options = {}) {
    const { includeSimilarRuns = 5, useRAG = true } = options;

    // Step 1: Generate embedding for current run
    const runEmbedding = await EmbeddingService.embedRun(run);

    // Step 2: Find similar runs (if RAG enabled)
    let similarRuns = [];
    if (useRAG) {
      try {
        const results = await vectorDB.findSimilarRuns(runEmbedding, {
          topK: includeSimilarRuns,
          minDistance: run.distance * 0.9, // ±10% distance
          maxDistance: run.distance * 1.1,
        });
        similarRuns = results.runs;
      } catch (error) {
        console.warn('Vector search failed, continuing without RAG:', error);
        // Continue without RAG if vector search fails
      }
    }

    // Step 3: Build augmented prompt
    const prompt = this.buildRAGPrompt(run, similarRuns, targetNPI);

    // Step 4: Generate response using LLM
    return await this.generateResponse(prompt, run, similarRuns);
  }

  /**
   * Build RAG prompt with context from similar runs
   */
  static buildRAGPrompt(run, similarRuns, targetNPI) {
    const distance = (run.distance / 1000).toFixed(2);
    const paceMin = Math.floor(run.avgPace / 60);
    const paceSec = Math.floor(run.avgPace % 60);
    const pace = `${paceMin}:${paceSec.toString().padStart(2, '0')}`;
    const npi = Math.floor(run.avgNPI);
    const target = Math.floor(targetNPI);

    let prompt = `You are Kinetix AI, an intelligent running coach. Analyze this run:

CURRENT RUN:
- Distance: ${distance}km
- Average Pace: ${pace} per km
- NPI: ${npi} (Target: ${target})
- Heart Rate: ${Math.floor(run.avgHeartRate)} bpm
${run.avgCadence ? `- Cadence: ${Math.floor(run.avgCadence)} spm` : ''}
${run.formScore ? `- Form Score: ${Math.floor(run.formScore)}/100` : ''}
- Date: ${new Date(run.date).toLocaleDateString()}
`;

    if (similarRuns.length > 0) {
      prompt += `\nRELEVANT PAST RUNS (for context):\n`;
      
      similarRuns.forEach((similar, index) => {
        const simDistance = (similar.metadata.distance / 1000).toFixed(2);
        const simPaceMin = Math.floor(similar.metadata.pace / 60);
        const simPaceSec = Math.floor(similar.metadata.pace % 60);
        const simPace = `${simPaceMin}:${simPaceSec.toString().padStart(2, '0')}`;
        const simNPI = Math.floor(similar.metadata.npi);
        const simDate = new Date(similar.metadata.date).toLocaleDateString();
        const similarity = Math.round(similar.similarity * 100);
        
        prompt += `${index + 1}. ${simDistance}km, NPI ${simNPI}, pace ${simPace}/km, ${simDate} (${similarity}% similar)\n`;
      });

      // Add pattern analysis
      const avgNPI = similarRuns.reduce((sum, r) => sum + r.metadata.npi, 0) / similarRuns.length;
      const bestNPI = Math.max(...similarRuns.map(r => r.metadata.npi));
      const improvement = npi - avgNPI;

      prompt += `\nPATTERN ANALYSIS:\n`;
      prompt += `- Average NPI of similar runs: ${Math.floor(avgNPI)}\n`;
      prompt += `- Best NPI on similar runs: ${Math.floor(bestNPI)}\n`;
      if (improvement > 0) {
        prompt += `- Current run is ${Math.floor(improvement)} NPI points better than average\n`;
      } else if (improvement < 0) {
        prompt += `- Current run is ${Math.floor(Math.abs(improvement))} NPI points below average\n`;
      } else {
        prompt += `- Current run matches average performance\n`;
      }
    }

    prompt += `\nProvide a concise analysis with:
1. A brief title
2. Key insights on performance (use historical context if available)
3. Specific recommendations for improvement (reference past runs if relevant)

Format as JSON: {"title": "...", "insight": "..."}`;

    return prompt;
  }

  /**
   * Generate LLM response
   */
  static async generateResponse(prompt, run, similarRuns) {
    try {
      const response = await fetch(`${OLLAMA_API_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: LLM_MODEL,
          prompt,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
          },
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      const text = data.response?.trim() || '';

      // Try to extract JSON
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch {
        // Not JSON, return as text
      }

      return {
        title: 'Run Analysis',
        insight: text,
        similarRunsCount: similarRuns.length,
      };
    } catch (error) {
      console.error('RAG generation error:', error);
      throw error;
    }
  }

  /**
   * Find similar runs (standalone feature)
   */
  static async findSimilarRuns(run, options = {}) {
    const embedding = await EmbeddingService.embedRun(run);
    const results = await vectorDB.findSimilarRuns(embedding, {
      topK: options.topK || 10,
      minDistance: options.minDistance,
      maxDistance: options.maxDistance,
    });
    return results.runs;
  }
}






