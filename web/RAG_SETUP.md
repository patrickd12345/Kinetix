# RAG Setup Guide for Kinetix

## Quick Start

### 1. Install Dependencies

```bash
# Install Chroma (Python)
pip install chromadb

# Install RAG service dependencies
cd web/rag
npm install
```

### 2. Install Ollama Embedding Model

```bash
ollama pull nomic-embed-text
```

### 3. Start RAG Service

```bash
cd web/rag
npm start
```

Service will run on `http://localhost:3001`

### 4. Index Your Existing Runs

```bash
# Export runs from web app (localStorage)
# Then index them:
cd web/rag
node scripts/index-runs.js path/to/runs.json
```

### 5. Use RAG in Web App

The web app will automatically use RAG when the service is available!

## What RAG Adds

### Before (Simple AI):
```
"Your NPI of 142 is above target. Good work!"
```

### After (RAG with Historical Context):
```
"Excellent progress! Your NPI of 142 is your second-best 
on a 5km run, just 3 points below your PB from 3 weeks ago. 
You're showing a clear improvement trend - your NPI has 
increased from 138 → 140 → 142 over the past month. To beat 
your PB of 145, try matching that 4:25/km pace from 3 weeks 
ago - you've proven you can do it!"
```

## Architecture

```
Web App (Browser)
    ↓
RAG Service (Node.js on localhost:3001)
    ↓
Chroma DB (Local vector database)
    ↓
Ollama (Embeddings + LLM)
```

## Features

- ✅ **Automatic Indexing**: New runs are indexed automatically
- ✅ **Similar Run Search**: Find runs similar to any run
- ✅ **Historical Context**: AI uses past runs for better coaching
- ✅ **Pattern Recognition**: Identifies trends across runs
- ✅ **Privacy-First**: Everything runs locally

## Troubleshooting

### RAG Service Not Starting
- Check Node.js is installed: `node --version`
- Check dependencies: `cd web/rag && npm install`

### Chroma Not Working
- Check Python is installed: `python --version`
- Install Chroma: `pip install chromadb`
- Check Chroma path in `.env`

### Ollama Embeddings Not Working
- Check Ollama is running: `ollama serve`
- Pull embedding model: `ollama pull nomic-embed-text`
- Verify model: `ollama list`

### Indexing Fails
- Check run data format matches Run model
- Verify Ollama is running
- Check Chroma DB path is writable

## Next Steps

1. ✅ RAG service is set up
2. ⏳ Index your thousands of runs
3. ⏳ Test with a few runs first
4. ⏳ Enjoy personalized coaching!

---

**With thousands of runs, RAG will provide incredible insights!** 🚀







