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
import { resolveKinetixRuntimeEnvFromObject } from '../../api/_lib/env/runtime.shared.mjs';

const runtimeConsole = globalThis.console ?? console;

function getRuntime() {
  return resolveKinetixRuntimeEnvFromObject();
}

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
    runtimeConsole.warn(`[RAG] ${logLabel}: Chroma unavailable (connection refused).`);
    return res.status(503).json({ error: CHROMA_UNAVAILABLE_MSG });
  }
  runtimeConsole.error(`[RAG] ${logLabel}:`, error);
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
    runtimeConsole.error('RAG analyze error:', error);
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
    runtimeConsole.error('Find similar error:', error);
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
      runtimeConsole.warn('[RAG] coach-context: Chroma unavailable (connection refused).');
    } else {
      runtimeConsole.error('[RAG] Coach context error:', error);
    }
    res.status(200).json({
      context: 'RAG unavailable. Give general advice only. Do not invent NPI or pace from the user\'s runs.',
    });
  }
});

const basePort = Number(getRuntime().port) || 3001;
const maxTries = 10;
function getChromaUrl() {
  const runtime = getRuntime();
  return runtime.chromaServerUrl || runtime.chromaApiUrl || 'http://localhost:8000';
}
function isEnabled(raw) {
  return raw !== '0' && raw !== 'false';
}
function isChromaAutoStart() {
  return isEnabled(getRuntime().chromaAutoStartRaw);
}
function getOllamaUrl() {
  return getRuntime().ollamaApiUrl || 'http://localhost:11434';
}
function isOllamaAutoStart() {
  return isEnabled(getRuntime().ollamaAutoStartRaw);
}

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
      runtimeConsole.warn('[RAG] Docker spawn error:', err.message);
      resolve({ ok: false, stderr: '' });
    });
    child.on('close', (code) => {
      if (code !== 0 && stderr.trim()) {
        runtimeConsole.warn('[RAG] Docker command failed:', args.join(' '), '|', stderr.trim().slice(0, 200));
      }
      resolve({ ok: code === 0, stderr });
    });
  });
}

async function startChromaWithDocker() {
  const image = getRuntime().chromaDockerImage || 'chromadb/chroma';
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
      const env = globalThis.process?.env;
      if (env) {
        env.CHROMA_API_URL = url;
        env.CHROMA_SERVER_URL = url;
      }
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
    const chromaPath = getRuntime().chromaPath || './chroma_db';
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
  if (!isChromaAutoStart()) return;
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
    runtimeConsole.log('[RAG] Chroma server already running.');
    return;
  }
  runtimeConsole.log('[RAG] Chroma not detected. Attempting to start via Docker...');
  let chromaUrl = await startChromaWithDocker();
  if (!chromaUrl) {
    runtimeConsole.log('[RAG] Docker failed. Trying Python chroma run...');
    const pyStarted = await startChromaWithPython();
    if (!pyStarted) {
      runtimeConsole.warn(
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
      runtimeConsole.log('[RAG] Chroma server started.', chromaUrl !== 'http://localhost:8000' ? `(${chromaUrl})` : '');
      return;
    }
  }
  runtimeConsole.warn('[RAG] Chroma started but not ready in time. It may become available shortly.');
}

async function ollamaHealth() {
  try {
    const res = await fetch(`${getOllamaUrl()}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureOllamaRunning() {
  if (!isOllamaAutoStart()) return;
  let host;
  try {
    host = new URL(getOllamaUrl()).hostname;
  } catch {
    return;
  }
  if (host !== 'localhost' && host !== '127.0.0.1') return;
  if (await ollamaHealth()) {
    runtimeConsole.log('[RAG] Ollama already running.');
    return;
  }
  runtimeConsole.log('[RAG] Ollama not detected. Attempting to start...');
  const child = spawn('ollama', ['serve'], { stdio: 'ignore' });
  child.on('error', () => {
    runtimeConsole.warn('[RAG] Could not start Ollama (is it installed and on PATH?). Embeddings/LLM will fail until Ollama is running.');
  });
  child.unref();
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await ollamaHealth()) {
      runtimeConsole.log('[RAG] Ollama started.');
      return;
    }
  }
  runtimeConsole.warn('[RAG] Ollama may still be starting. Embeddings will work once it is ready.');
}

function tryListen(port) {
  const server = app.listen(port, () => {
    runtimeConsole.log(`Kinetix RAG service running on http://localhost:${port}`);
    runtimeConsole.log(`Chroma: ${getChromaUrl()} (auto-start: ${isChromaAutoStart()})`);
    runtimeConsole.log(`Ollama: ${getOllamaUrl()} (auto-start: ${isOllamaAutoStart()})`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && port < basePort + maxTries - 1) {
      tryListen(port + 1);
    } else {
      runtimeConsole.error(err);
      process.exit(1);
    }
  });
}

(async () => {
  await ensureChromaRunning();
  await ensureOllamaRunning();
  tryListen(basePort);
})();
