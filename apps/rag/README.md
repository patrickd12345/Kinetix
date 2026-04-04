# Kinetix RAG Service (`apps/rag`)

**Platform layer:** This service does not implement end-user auth or billing; the web app enforces access. See [SPINE_CONTRACT.md](../../../../SPINE_CONTRACT.md) and [APP_INTEGRATION_STANDARD.md](../../../../docs/platform/APP_INTEGRATION_STANDARD.md) at the workspace root.

RAG (Retrieval Augmented Generation) backend used by `apps/web` for:

- **Run analysis (default):** indexing runs (`POST /index`), similar runs (`POST /similar`), analysis (`POST /analyze`), coach context (`POST /coach-context`). Stored in Chroma collection **`kinetix_runs`** (`services/vectorDB.js`).
- **Curated Help Center support KB:** separate collection **`kinetix_support_kb`** (`services/supportVectorDB.js`) — **never** mixes with run embeddings.

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

## Tests

```bash
pnpm test
```

Runs `node --test` on `services/*.test.js` (artifact validation + collection name checks; no live Chroma required).

## Environment Variables

- `PORT` (default `3001`)
- `KINETIX_LLM_PROVIDER` – `ollama` or `gateway`. If unset: `VERCEL=1` -> gateway, else ollama.
- `OLLAMA_API_URL` / `OLLAMA_BASE_URL` (default `http://localhost:11434`)
- `OLLAMA_MODEL` / `LLM_MODEL` (default `llama3.2`)
- `EMBEDDING_MODEL` (default `nomic-embed-text`) — used for **both** run and support embeddings.
- Gateway (when provider is gateway): `AI_GATEWAY_BASE_URL`, `AI_GATEWAY_API_KEY`, optional `AI_GATEWAY_MODEL`
- `CHROMA_MODE` (`in-memory` or `persistent`)
- `CHROMA_PATH` (default `./chroma_db`)
- `CHROMA_SERVER_URL` / `CHROMA_API_URL` (default `http://localhost:8000`) – Chroma server URL (Node client connects here).
- `CHROMA_AUTO_START` – If not `0` or `false`, the RAG service will try to start Chroma (Docker first, then Python `chroma run`) when it is not already running. Set to `0` to disable. Requires Docker, or `pip install chromadb` for Python fallback.
- `CHROMA_DOCKER_IMAGE` (default `chromadb/chroma`) – Docker image used when auto-starting Chroma.
- `OLLAMA_AUTO_START` – If not `0` or `false`, the RAG service will try to start Ollama (`ollama serve`) when it is not already running (only when Ollama URL is localhost). Requires Ollama on PATH. Set to `0` or `false` to disable.

## API — Runs (unchanged)

- `GET /health`
- `GET /available` — includes `supportKb: boolean` (Chroma reachable for support collection).
- `POST /index` — index one run into **`kinetix_runs`**
- `POST /similar`
- `POST /analyze`
- `GET /indexed-ids`
- `GET /stats` — run count in **`kinetix_runs`**
- `POST /coach-context`

## API — Curated support KB (`kinetix_support_kb`)

All bodies are JSON. **Ingest** only accepts **approved** curated artifacts (see `services/supportArtifact.js` and `apps/web/HELP_CENTER_ARCHITECTURE.md`). No ticket-dump endpoint.

- `POST /support/kb/ingest` — body: `{ "artifact": { ... } }`  
  Required fields include: `artifact_id`, `title`, `body_markdown`, `version` (≥ 1), `review_status: "approved"`, `topic`, `intent`, `source_type`, `product: "kinetix"`.  
  Response: `{ success, chunkId, artifact_id, version }`.

- `POST /support/kb/query` — body: `{ "query": "how do I connect Strava?", "topK": 5, "topic": "sync" }`  
  `topic` is optional; filters to that topic when set.  
  Response: `{ collection, query, topK, filters, results: [{ chunkId, distance, similarity, document, metadata }] }`.

- `GET /support/kb/stats` — `{ collection: "kinetix_support_kb", chunkCount }`.

### Example: ingest one article

```bash
curl -s -X POST http://localhost:3001/support/kb/ingest -H "Content-Type: application/json" -d "{\"artifact\":{\"artifact_id\":\"support-strava-sync\",\"title\":\"Strava\",\"body_markdown\":\"Open Settings and connect Strava OAuth.\",\"version\":1,\"review_status\":\"approved\",\"topic\":\"sync\",\"intent\":\"howto\",\"source_type\":\"editorial\"}}"
```

### Example: query

```bash
curl -s -X POST http://localhost:3001/support/kb/query -H "Content-Type: application/json" -d "{\"query\":\"strava connection\",\"topK\":3}"
```
