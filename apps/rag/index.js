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
function getChromaUrl() {
  return process.env.CHROMA_SERVER_URL || process.env.CHROMA_API_URL || 'http://localhost:8000';
}
const CHROMA_AUTO_START = process.env.CHROMA_AUTO_START !== '0' && process.env.CHROMA_AUTO_START !== 'false';
const OLLAMA_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434';
const OLLAMA_AUTO_START = process.env.OLLAMA_AUTO_START !== '0' && process.env.OLLAMA_AUTO_START !== 'false';

async function chromaHeartbeat(url) {
  const base = url || getChromaUrl();
  for (const path of ['/api/v2/heartbeat', '/api/v1/heartbeat']) {
    try {
      const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return true;
    } catch {
      /* try next */
    }
  }
  return false;
}

const CHROMA_CONTAINER_NAME = 'kinetix-chroma';

function runDocker(args) {
  return new Promise((resolve) => {
    const child = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => {
      console.warn('[RAG] Docker spawn error:', err.message);
      resolve({ ok: false, stderr: '' });
    });
    child.on('close', (code) => {
      if (code !== 0 && stderr.trim()) {
        console.warn('[RAG] Docker command failed:', args.join(' '), '|', stderr.trim().slice(0, 200));
      }
      resolve({ ok: code === 0, stderr });
    });
  });
}

async function startChromaWithDocker() {
  const image = process.env.CHROMA_DOCKER_IMAGE || 'chromadb/chroma';
  const ports = [8000, 8001, 8002];

  for (const port of ports) {
    await runDocker(['rm', '-f', CHROMA_CONTAINER_NAME]);
    const { ok, stderr } = await runDocker([
      'run',
      '-d',
      '--rm',
      '-p',
      `${port}:8000`,
      '--name',
      CHROMA_CONTAINER_NAME,
      image,
    ]);
    if (ok) {
      const url = `http://localhost:${port}`;
      process.env.CHROMA_API_URL = url;
      process.env.CHROMA_SERVER_URL = url;
      return url;
    }
    const isNetworkingError = stderr.includes('external connectivity') || stderr.includes('port is already allocated');
    if (!isNetworkingError) {
      const started = await runDocker(['start', CHROMA_CONTAINER_NAME]);
      if (started.ok) return getChromaUrl();
      break;
    }
  }
  return null;
}

function startChromaWithPython() {
  return new Promise((resolve) => {
    const chromaPath = process.env.CHROMA_PATH || './chroma_db';
    const args = ['run', '--path', chromaPath, '--port', '8000'];

    const child = spawn('chroma', args, { stdio: 'ignore', cwd: process.cwd() });
    child.on('error', () => {
      const py = process.platform === 'win32' ? 'py' : 'python3';
      const fallback = spawn(py, ['-m', 'chromadb.cli.app', ...args], { stdio: 'ignore', cwd: process.cwd() });
      fallback.on('error', () => resolve(false));
      fallback.unref();
      resolve(true);
    });
    child.unref();
    resolve(true);
  });
}

async function ensureChromaRunning() {
  if (!CHROMA_AUTO_START) return;
  let host;
  try {
    host = new URL(getChromaUrl()).hostname;
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
  let chromaUrl = await startChromaWithDocker();
  if (!chromaUrl) {
    console.log('[RAG] Docker failed. Trying Python chroma run...');
    const pyStarted = await startChromaWithPython();
    if (!pyStarted) {
      console.warn(
        '[RAG] Could not start Chroma. Options: 1) Run Docker 2) Install Chroma (pip install chromadb) and run: chroma run --path ./chroma_db 3) Set CHROMA_AUTO_START=0 to disable. RAG vector features will return 503 until Chroma is available.'
      );
      return;
    }
    chromaUrl = getChromaUrl();
  }
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await chromaHeartbeat(chromaUrl)) {
      console.log('[RAG] Chroma server started.', chromaUrl !== 'http://localhost:8000' ? `(${chromaUrl})` : '');
      return;
    }
  }
  console.warn('[RAG] Chroma started but not ready in time. It may become available shortly.');
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
    console.log(`Chroma: ${getChromaUrl()} (auto-start: ${CHROMA_AUTO_START})`);
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
