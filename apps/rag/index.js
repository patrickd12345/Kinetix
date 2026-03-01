/**
 * RAG Service API Server
 * Provides RAG endpoints for the web app
 */

import { spawn } from 'node:child_process';
import cors from 'cors';
import express from 'express';
import { EmbeddingService } from './services/embeddingService.js';
import { RAGService } from './services/ragService.js';
import { vectorDB } from './services/vectorDB.js';
import { getCoachContext } from './services/coachContext.js';

const CHROMA_UNAVAILABLE_MSG =
  'Chroma unavailable. Start a Chroma server (e.g. npx chroma run --path ./chroma_data or docker run -p 8000:8000 chromadb/chroma).';

function isChromaConnectionError(err) {
  if (!err) return false;
  if (err.name === 'ChromaConnectionError') return true;
  if (err.cause?.code === 'ECONNREFUSED') return true;
  if (String(err.message || '').includes('Failed to connect to chromadb')) return true;
  return false;
}

function handleVectorDBError(res, error, logLabel) {
  if (isChromaConnectionError(error)) {
    console.warn(`[RAG] ${logLabel}: Chroma unavailable (connection refused).`);
    return res.status(503).json({ error: CHROMA_UNAVAILABLE_MSG });
  }
  console.error(`[RAG] ${logLabel}:`, error);
  return res.status(500).json({ error: error.message });
}

const app = express();

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

app.get('/indexed-ids', async (_req, res) => {
  try {
    const ids = await vectorDB.getAllRunIds();
    res.json({ ids: ids.map((id) => String(id)) });
  } catch (error) {
    return handleVectorDBError(res, error, 'indexed-ids');
  }
});

app.post('/index', async (req, res) => {
  try {
    const { run } = req.body;
    if (!run) {
      return res.status(400).json({ error: 'run required' });
    }
    const embedding = await EmbeddingService.embedRun(run);
    await vectorDB.updateRun(run, embedding);
    return res.json({ success: true, runId: run.id });
  } catch (error) {
    return handleVectorDBError(res, error, 'index');
  }
});

app.get('/stats', async (_req, res) => {
  try {
    const count = await vectorDB.getCount();
    res.json({ runCount: count });
  } catch (error) {
    handleVectorDBError(res, error, 'stats');
  }
});

app.post('/coach-context', async (req, res) => {
  try {
    const { message = '', userProfile, pbRun } = req.body;
    const result = await getCoachContext(message, userProfile || null, pbRun || null);
    res.json(result);
  } catch (error) {
    if (isChromaConnectionError(error)) {
      console.warn('[RAG] coach-context: Chroma unavailable (connection refused).');
    } else {
      console.error('[RAG] Coach context error:', error);
    }
    res.status(200).json({
      context: 'RAG unavailable. Give general advice only. Do not invent NPI or pace from the user\'s runs.',
    });
  }
});

const basePort = Number(process.env.PORT) || 3001;
const maxTries = 10;
const CHROMA_URL = process.env.CHROMA_SERVER_URL || process.env.CHROMA_API_URL || 'http://localhost:8000';
const CHROMA_AUTO_START = process.env.CHROMA_AUTO_START !== '0' && process.env.CHROMA_AUTO_START !== 'false';
const OLLAMA_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434';
const OLLAMA_AUTO_START = process.env.OLLAMA_AUTO_START !== '0' && process.env.OLLAMA_AUTO_START !== 'false';

async function chromaHeartbeat() {
  try {
    const res = await fetch(`${CHROMA_URL}/api/v1/heartbeat`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    try {
      const res = await fetch(`${CHROMA_URL}/api/v2/heartbeat`, { signal: AbortSignal.timeout(2000) });
      return res.ok;
    } catch {
      return false;
    }
  }
}

const CHROMA_CONTAINER_NAME = 'kinetix-chroma';

function runDocker(args) {
  return new Promise((resolve) => {
    const child = spawn('docker', args, { stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}

async function startChromaWithDocker() {
  const image = process.env.CHROMA_DOCKER_IMAGE || 'chromadb/chroma';
  const ok = await runDocker([
    'run',
    '-d',
    '--rm',
    '-p',
    '8000:8000',
    '--name',
    CHROMA_CONTAINER_NAME,
    image,
  ]);
  if (ok) return true;
  const started = await runDocker(['start', CHROMA_CONTAINER_NAME]);
  return started;
}

async function ensureChromaRunning() {
  if (!CHROMA_AUTO_START) return;
  let host;
  try {
    host = new URL(CHROMA_URL).hostname;
  } catch {
    return;
  }
  if (host !== 'localhost' && host !== '127.0.0.1') {
    return;
  }
  if (await chromaHeartbeat()) {
    console.log('[RAG] Chroma server already running.');
    return;
  }
  console.log('[RAG] Chroma not detected. Attempting to start via Docker...');
  const started = await startChromaWithDocker();
  if (!started) {
    console.warn('[RAG] Could not start Chroma (is Docker running?). RAG will return 503 until Chroma is available.');
    return;
  }
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await chromaHeartbeat()) {
      console.log('[RAG] Chroma server started.');
      return;
    }
  }
  console.warn('[RAG] Chroma container started but not ready in time. RAG may return 503 until it responds.');
}

async function ollamaHealth() {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureOllamaRunning() {
  if (!OLLAMA_AUTO_START) return;
  let host;
  try {
    host = new URL(OLLAMA_URL).hostname;
  } catch {
    return;
  }
  if (host !== 'localhost' && host !== '127.0.0.1') return;
  if (await ollamaHealth()) {
    console.log('[RAG] Ollama already running.');
    return;
  }
  console.log('[RAG] Ollama not detected. Attempting to start...');
  const child = spawn('ollama', ['serve'], { stdio: 'ignore' });
  child.on('error', () => {
    console.warn('[RAG] Could not start Ollama (is it installed and on PATH?). Embeddings/LLM will fail until Ollama is running.');
  });
  child.unref();
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await ollamaHealth()) {
      console.log('[RAG] Ollama started.');
      return;
    }
  }
  console.warn('[RAG] Ollama may still be starting. Embeddings will work once it is ready.');
}

function tryListen(port) {
  const server = app.listen(port, () => {
    console.log(`Kinetix RAG service running on http://localhost:${port}`);
    console.log(`Chroma: ${CHROMA_URL} (auto-start: ${CHROMA_AUTO_START})`);
    console.log(`Ollama: ${OLLAMA_URL} (auto-start: ${OLLAMA_AUTO_START})`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && port < basePort + maxTries - 1) {
      tryListen(port + 1);
    } else {
      console.error(err);
      process.exit(1);
    }
  });
}

(async () => {
  await ensureChromaRunning();
  await ensureOllamaRunning();
  tryListen(basePort);
})();
