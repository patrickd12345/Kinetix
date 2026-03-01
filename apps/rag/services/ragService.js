/**
 * RAG (Retrieval Augmented Generation) service
 * Combines vector search with LLM generation
 */

import { EmbeddingService } from './embeddingService.js';
import { vectorDB } from './vectorDB.js';
import { getLLMClient } from './ai/llmClient.js';

export class RAGService {
  static async analyzeRunWithRAG(run, targetKPS, options = {}) {
    const { includeSimilarRuns = 5, useRAG = true } = options;
    const runEmbedding = await EmbeddingService.embedRun(run);

    let similarRuns = [];
    if (useRAG) {
      try {
        const results = await vectorDB.findSimilarRuns(runEmbedding, {
          topK: includeSimilarRuns,
          minDistance: run.distance * 0.9,
          maxDistance: run.distance * 1.1,
        });
        similarRuns = results.runs;
        console.info('[RAG]', { retrieved: similarRuns.length });
      } catch (error) {
        console.warn('Vector search failed, continuing without RAG:', error);
      }
    }

    const prompt = this.buildRAGPrompt(run, similarRuns, targetKPS);
    return this.generateResponse(prompt, similarRuns);
  }

  static buildRAGPrompt(run, similarRuns, targetKPS) {
    const distance = (run.distance / 1000).toFixed(2);
    const paceMin = Math.floor(run.avgPace / 60);
    const paceSec = Math.floor(run.avgPace % 60);
    const pace = `${paceMin}:${paceSec.toString().padStart(2, '0')}`;
    const kps = Math.floor(run.avgKPS ?? run.avgNPI ?? 0);
    const target = Math.floor(targetKPS);
    const hr = run.avgHeartRate ? Math.floor(run.avgHeartRate) : 'N/A';

    let prompt = `You are Kinetix AI, an intelligent running coach. Analyze this run:

CURRENT RUN:
- Distance: ${distance}km
- Average Pace: ${pace} per km
- KPS: ${kps} (Target: ${target})
- Heart Rate: ${hr} bpm
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
        const simKPS = Math.floor(similar.metadata.kps ?? similar.metadata.npi ?? 0);
        const simDate = new Date(similar.metadata.date).toLocaleDateString();
        const similarity = Math.round(similar.similarity * 100);
        prompt += `${index + 1}. ${simDistance}km, KPS ${simKPS}, pace ${simPace}/km, ${simDate} (${similarity}% similar)\n`;
      });

      const avgKPS = similarRuns.reduce((sum, r) => sum + (r.metadata.kps ?? r.metadata.npi ?? 0), 0) / similarRuns.length;
      const bestKPS = Math.max(...similarRuns.map((r) => r.metadata.kps ?? r.metadata.npi ?? 0));
      const improvement = kps - avgKPS;
      prompt += `\nPATTERN ANALYSIS:\n`;
      prompt += `- Average KPS of similar runs: ${Math.floor(avgKPS)}\n`;
      prompt += `- Best KPS on similar runs: ${Math.floor(bestKPS)}\n`;
      if (improvement > 0) prompt += `- Current run is ${Math.floor(improvement)} KPS points better than average\n`;
      else if (improvement < 0) prompt += `- Current run is ${Math.floor(Math.abs(improvement))} KPS points below average\n`;
      else prompt += '- Current run matches average performance\n';
    }

    prompt += `\nProvide a concise analysis with:
1. A brief title
2. Key insights on performance (use historical context if available)
3. Specific recommendations for improvement (reference past runs if relevant)

Format as JSON: {"title": "...", "insight": "..."}`;

    return prompt;
  }

  static async generateResponse(prompt, similarRuns) {
    const client = getLLMClient();
    const { text } = await client.executeChat(
      [{ role: 'user', content: prompt }],
      { temperature: 0.7, maxTokens: 1024 }
    );
    const raw = text?.trim() || '';
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch {
      // fallback to text response below
    }
    return {
      title: 'Run Analysis',
      insight: raw,
      similarRunsCount: similarRuns.length,
    };
  }

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
