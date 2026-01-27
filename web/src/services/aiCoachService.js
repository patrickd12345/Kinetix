/**
 * AI Coach service using local LLM (Ollama)
 * Supports RAG (Retrieval Augmented Generation) for personalized coaching
 * Falls back to simple rule-based responses if LLM unavailable
 */
const OLLAMA_API_URL = import.meta.env.VITE_OLLAMA_API_URL || 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = import.meta.env.VITE_OLLAMA_MODEL || 'llama3.2';
const RAG_SERVICE_URL = import.meta.env.VITE_RAG_SERVICE_URL || 'http://localhost:3001';

export class AICoachService {
  /**
   * Check if Ollama is available
   */
  static async isAvailable() {
    try {
      const response = await fetch(`${OLLAMA_API_URL.replace('/api/generate', '')}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Generate response using local LLM
   */
  static async generateResponse(prompt) {
    try {
      const response = await fetch(OLLAMA_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
          },
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      return data.response?.trim() || '';
    } catch (error) {
      console.warn('Local LLM unavailable, using fallback:', error);
      return null;
    }
  }

  /**
   * Check if RAG service is available
   */
  static async isRAGAvailable() {
    try {
      const response = await fetch(`${RAG_SERVICE_URL}/available`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      if (!response.ok) return false;
      const data = await response.json();
      return data.available === true;
    } catch {
      return false;
    }
  }

  /**
   * Analyze a run and provide coaching feedback
   * Uses RAG if available, falls back to simple prompt
   */
  static async analyzeRun(run, targetKps, useRAG = true) {
    // Try RAG first if enabled
    if (useRAG) {
      try {
        const ragAvailable = await this.isRAGAvailable();
        if (ragAvailable) {
          const response = await fetch(`${RAG_SERVICE_URL}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              run,
              targetKps,
              options: { includeSimilarRuns: 5 },
            }),
            signal: AbortSignal.timeout(30000),
          });

          if (response.ok) {
            const result = await response.json();
            return result;
          }
        }
      } catch (error) {
        console.warn('RAG unavailable, falling back to simple analysis:', error);
        // Fall through to simple analysis
      }
    }

    // Fallback to simple prompt-based analysis
    const distance = (run.distance / 1000).toFixed(2);
    const paceMin = Math.floor(run.avgPace / 60);
    const paceSec = Math.floor(run.avgPace % 60);
    const pace = `${paceMin}:${paceSec.toString().padStart(2, '0')}`;
    const kps = run.kps ? Number(run.kps).toFixed(1) : '0.0';
    const target = Math.floor(targetKps);

    const prompt = `You are Kinetix AI, an intelligent running coach. Analyze this run:
- Distance: ${distance}km
- Average Pace: ${pace} per km
- KPS (Kinetix Performance Score): ${kps} (Target: ${target})
- Heart Rate: ${Math.floor(run.avgHeartRate)} bpm
${run.avgCadence ? `- Cadence: ${Math.floor(run.avgCadence)} spm` : ''}
${run.formScore ? `- Form Score: ${Math.floor(run.formScore)}/100` : ''}

Provide a concise analysis with:
1. A brief title
2. Key insights on performance
3. Specific recommendations for improvement

Format as JSON: {"title": "...", "insight": "..."}`;

    const response = await this.generateResponse(prompt);
    
    if (response) {
      try {
        // Try to extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        // If no JSON, create structured response
        return {
          title: 'Run Analysis',
          insight: response,
        };
      } catch {
        return {
          title: 'Run Analysis',
          insight: response,
        };
      }
    }

    // Fallback to rule-based analysis
    return this.fallbackAnalysis(run, targetKps);
  }

  /**
   * Find similar runs using RAG
   */
  static async findSimilarRuns(run, options = {}) {
    try {
      const response = await fetch(`${RAG_SERVICE_URL}/similar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          run,
          options: { topK: options.topK || 10, ...options },
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const data = await response.json();
        return data.similarRuns || [];
      }
    } catch (error) {
      console.warn('Find similar runs failed:', error);
    }
    return [];
  }

  /**
   * Fallback rule-based analysis
   */
  static fallbackAnalysis(run, targetKps) {
    const kps = Number(run.kps || 0);
    const target = Number(targetKps || 0);
    const distance = run.distance / 1000;
    const pace = run.avgPace;

    let title = 'Solid Run';
    let insight = '';

    if (kps >= target) {
      title = 'Target Achieved! 🎉';
      insight = `Excellent work! You hit your target KPS of ${Math.floor(target)} with a score of ${kps.toFixed(1)}. Your pace of ${Math.floor(pace / 60)}:${Math.floor(pace % 60).toString().padStart(2, '0')} per km was strong for this ${distance.toFixed(2)}km distance.`;
    } else if (kps >= target * 0.95) {
      title = 'Close to Target';
      insight = `You're very close! Your KPS of ${kps.toFixed(1)} is just ${Math.max(0, Math.floor(target - kps))} points below your target. Consider slightly increasing your pace or maintaining consistency over the distance.`;
    } else if (kps >= target * 0.85) {
      title = 'Building Progress';
      insight = `Your KPS of ${kps.toFixed(1)} shows good progress. To reach your target of ${Math.floor(target)}, focus on steady pacing and smooth form.`;
    } else {
      title = 'Room for Improvement';
      insight = `Your KPS of ${kps.toFixed(1)} indicates there's potential to improve. Focus on consistent pacing, proper form, and building endurance. Your target of ${Math.floor(target)} is achievable with training.`;
    }

    if (run.avgCadence) {
      if (run.avgCadence < 160) {
        insight += ' Consider increasing your cadence to 170-180 spm for better efficiency.';
      } else if (run.avgCadence > 190) {
        insight += ' Your cadence is quite high - ensure you are not overstriding.';
      }
    }

    return { title, insight };
  }

  /**
   * Generate conversational response
   */
  static async askQuestion(question, context = {}) {
    const prompt = `You are Kinetix AI, a friendly running coach. Answer this question concisely: "${question}"
    
${context.recentRun ? `Context: User just completed a ${(context.recentRun.distance / 1000).toFixed(2)}km run with KPS ${Number(context.recentRun.kps || 0).toFixed(1)}.` : ''}

Provide a helpful, encouraging response in 2-3 sentences.`;

    const response = await this.generateResponse(prompt);
    
    if (response) {
      return response;
    }

    // Fallback
    return "I'm here to help! For the best coaching experience, make sure your local LLM (Ollama) is running. You can still track your runs and view your KPS progress.";
  }
}
