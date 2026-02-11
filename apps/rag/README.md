# Kinetix RAG Service (`apps/rag`)

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
- `OLLAMA_API_URL` (default `http://localhost:11434`)
- `EMBEDDING_MODEL` (default `nomic-embed-text`)
- `LLM_MODEL` (default `llama3.2`)
- `CHROMA_MODE` (`in-memory` or `persistent`)
- `CHROMA_PATH` (default `./chroma_db`)

## API

- `GET /health`
- `GET /available`
- `POST /index`
- `POST /similar`
- `POST /analyze`
- `GET /stats`
