# Kinetix RAG Service

RAG (Retrieval Augmented Generation) service for personalized run analysis using historical context.

## Setup

### 1. Install Dependencies

```bash
cd rag
npm install
```

### 2. Install Chroma

```bash
pip install chromadb
```

Or using conda:
```bash
conda install -c conda-forge chromadb
```

### 3. Install Ollama Embedding Model

```bash
ollama pull nomic-embed-text
```

### 4. Start the Service

```bash
npm start
```

Service runs on `http://localhost:3001`

## Usage

### From Web App

The web app will call the RAG service API:

```javascript
// Analyze run with RAG
const response = await fetch('http://localhost:3001/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    run: runData,
    targetNPI: 135,
    options: { includeSimilarRuns: 5 }
  })
});
```

### Index Existing Runs

```bash
# Export runs from web app (localStorage)
# Then index them:
node scripts/index-runs.js runs.json
```

## API Endpoints

### `GET /health`
Health check

### `GET /available`
Check if RAG is available (Ollama + Chroma)

### `POST /analyze`
Analyze a run with RAG context
```json
{
  "run": { /* Run object */ },
  "targetNPI": 135,
  "options": { "includeSimilarRuns": 5 }
}
```

### `POST /similar`
Find similar runs
```json
{
  "run": { /* Run object */ },
  "options": { "topK": 10 }
}
```

### `POST /index`
Index a run (add to vector DB)
```json
{
  "run": { /* Run object */ }
}
```

### `GET /stats`
Get vector DB statistics

## Environment Variables

- `OLLAMA_API_URL` - Ollama API URL (default: http://localhost:11434)
- `EMBEDDING_MODEL` - Embedding model (default: nomic-embed-text)
- `LLM_MODEL` - LLM model for generation (default: llama3.2)
- `CHROMA_PATH` - Chroma database path (default: ./chroma_db)
- `PORT` - Service port (default: 3001)

## Architecture

```
Web App → RAG Service → Chroma DB
              ↓
          Ollama (embeddings)
              ↓
          Ollama (LLM)
```

## Next Steps

1. Integrate RAG service into web app
2. Index existing runs
3. Add "Find Similar Runs" UI
4. Test with thousands of runs!

