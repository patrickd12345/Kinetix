# Kinetix RAG Service (`apps/rag`)

**Platform Spine Compliance:** This app does not implement auth or billing; it relies on the platform layer. See [SPINE_CONTRACT.md](../../../SPINE_CONTRACT.md) at the workspace root.

RAG (Retrieval Augmented Generation) backend used by `apps/web` for:
- indexing runs (`POST /index`)
- finding similar runs (`POST /similar`)
- analysis with context (`POST /analyze`)

## Install

```bash
cd apps/rag
pnpm install
```

## Run

```bash
pnpm start
```

Service defaults to `http://localhost:3001`.

## Environment Variables

- `PORT` (default `3001`)
- `KINETIX_LLM_PROVIDER` – `ollama` or `gateway`. If unset: `VERCEL=1` -> gateway, else ollama.
- `OLLAMA_API_URL` / `OLLAMA_BASE_URL` (default `http://localhost:11434`)
- `OLLAMA_MODEL` / `LLM_MODEL` (default `llama3.2`)
- `EMBEDDING_MODEL` (default `nomic-embed-text`)
- Gateway (when provider is gateway): `AI_GATEWAY_BASE_URL`, `AI_GATEWAY_API_KEY`, optional `AI_GATEWAY_MODEL`
- `CHROMA_MODE` (`in-memory` or `persistent`)
- `CHROMA_PATH` (default `./chroma_db`)
- `CHROMA_SERVER_URL` / `CHROMA_API_URL` (default `http://localhost:8000`) – Chroma server URL (Node client connects here).
- `CHROMA_AUTO_START` – If not `0` or `false`, the RAG service will try to start Chroma (Docker first, then Python `chroma run`) when it is not already running. Set to `0` to disable. Requires Docker, or `pip install chromadb` for Python fallback.
- `CHROMA_DOCKER_IMAGE` (default `chromadb/chroma`) – Docker image used when auto-starting Chroma.
- `OLLAMA_AUTO_START` – If not `0` or `false`, the RAG service will try to start Ollama (`ollama serve`) when it is not already running (only when Ollama URL is localhost). Requires Ollama on PATH. Set to `0` or `false` to disable.

## API

- `GET /health`
- `GET /available`
- `POST /index`
- `POST /similar`
- `POST /analyze`
- `GET /stats`
