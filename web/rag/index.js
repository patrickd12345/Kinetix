/**
 * RAG Service API Server
 * Provides RAG endpoints for the web app
 */

import express from 'express';
import cors from 'cors';
import { RAGService } from './services/ragService.js';
import { EmbeddingService } from './services/embeddingService.js';
import { vectorDB } from './services/vectorDB.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'kinetix-rag' });
});

// Check if RAG is available
app.get('/available', async (req, res) => {
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

// Analyze run with RAG
app.post('/analyze', async (req, res) => {
  try {
    const { run, targetNPI, options = {} } = req.body;
    
    if (!run || !targetNPI) {
      return res.status(400).json({ error: 'run and targetNPI required' });
    }

    const result = await RAGService.analyzeRunWithRAG(run, targetNPI, options);
    res.json(result);
  } catch (error) {
    console.error('RAG analyze error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Find similar runs
app.post('/similar', async (req, res) => {
  try {
    const { run, options = {} } = req.body;
    
    if (!run) {
      return res.status(400).json({ error: 'run required' });
    }

    const similar = await RAGService.findSimilarRuns(run, options);
    res.json({ similarRuns: similar });
  } catch (error) {
    console.error('Find similar error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Index a run (add to vector DB)
app.post('/index', async (req, res) => {
  try {
    const { run } = req.body;
    
    if (!run) {
      return res.status(400).json({ error: 'run required' });
    }

    const embedding = await EmbeddingService.embedRun(run);
    await vectorDB.addRun(run, embedding);
    
    res.json({ success: true, runId: run.id });
  } catch (error) {
    console.error('Index error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get vector DB stats
app.get('/stats', async (req, res) => {
  try {
    const count = await vectorDB.getCount();
    res.json({ runCount: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Kinetix RAG Service running on http://localhost:${PORT}`);
  console.log(`📊 Vector DB: ${process.env.CHROMA_PATH || './chroma_db'}`);
  console.log(`🤖 Ollama: ${process.env.OLLAMA_API_URL || 'http://localhost:11434'}`);
});

