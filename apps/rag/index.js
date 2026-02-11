/**
 * RAG Service API Server
 * Provides RAG endpoints for the web app
 */

import cors from 'cors';
import express from 'express';
import { EmbeddingService } from './services/embeddingService.js';
import { RAGService } from './services/ragService.js';
import { vectorDB } from './services/vectorDB.js';
import { getCoachContext } from './services/coachContext.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'kinetix-rag' });
});

app.get('/available', async (_req, res) => {
  try {
    const embeddingAvailable = await EmbeddingService.isAvailable();
    const vectorDBAvailable = await vectorDB.initialize().then(() => true).catch(() => false);

    res.json({
      available: embeddingAvailable && vectorDBAvailable,
      embedding: embeddingAvailable,
      vectorDB: vectorDBAvailable,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/analyze', async (req, res) => {
  try {
    const { run, targetKPS, targetNPI, options = {} } = req.body;
    const target = targetKPS ?? targetNPI;
    if (!run || target == null) {
      return res.status(400).json({ error: 'run and targetKPS (or targetNPI) required' });
    }
    const result = await RAGService.analyzeRunWithRAG(run, target, options);
    return res.json(result);
  } catch (error) {
    console.error('RAG analyze error:', error);
    return res.status(500).json({ error: error.message });
  }
});

app.post('/similar', async (req, res) => {
  try {
    const { run, options = {} } = req.body;
    if (!run) {
      return res.status(400).json({ error: 'run required' });
    }
    const similar = await RAGService.findSimilarRuns(run, options);
    return res.json({ similarRuns: similar });
  } catch (error) {
    console.error('Find similar error:', error);
    return res.status(500).json({ error: error.message });
  }
});

app.post('/index', async (req, res) => {
  try {
    const { run } = req.body;
    if (!run) {
      return res.status(400).json({ error: 'run required' });
    }
    const embedding = await EmbeddingService.embedRun(run);
    await vectorDB.addRun(run, embedding);
    return res.json({ success: true, runId: run.id });
  } catch (error) {
    console.error('Index error:', error);
    return res.status(500).json({ error: error.message });
  }
});

app.get('/stats', async (_req, res) => {
  try {
    const count = await vectorDB.getCount();
    res.json({ runCount: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/coach-context', async (req, res) => {
  try {
    const { message = '', userProfile, pbRun } = req.body;
    const result = await getCoachContext(message, userProfile || null, pbRun || null);
    res.json(result);
  } catch (error) {
    console.error('Coach context error:', error);
    res.status(500).json({
      context: 'RAG unavailable. Give general advice only. Do not invent NPI or pace from the user\'s runs.',
    });
  }
});

app.listen(PORT, () => {
  console.log(`Kinetix RAG service running on http://localhost:${PORT}`);
  console.log(`Vector DB path: ${process.env.CHROMA_PATH || './chroma_db'}`);
  console.log(`Ollama URL: ${process.env.OLLAMA_API_URL || 'http://localhost:11434'}`);
});
