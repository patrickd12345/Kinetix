/**
 * RAG Service API Server
 * Provides RAG endpoints for the web app
 */

import { spawn } from 'node:child_process';
import { createRagApp } from './ragHttpApp.js';
import { resolveKinetixRuntimeEnvFromObject } from '../../api/_lib/env/runtime.shared.mjs';

const runtimeConsole = globalThis.console ?? console;

function getRuntime() {
  return resolveKinetixRuntimeEnvFromObject();
}

const app = createRagApp();

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
    child.stderr?.on('data', (d) => {
      stderr += d.toString();
    });
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
        '[RAG] Could not start Chroma. Options: 1) Run Docker 2) Install Chroma (pip install chromadb) and run: chroma run --path ./chroma_db 3) Set CHROMA_AUTO_START=0 to disable. RAG vector features will return 503 until Chroma is available.',
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
