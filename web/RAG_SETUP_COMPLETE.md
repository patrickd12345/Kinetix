# ✅ RAG Setup Complete!

Your RAG (Retrieval Augmented Generation) system is fully set up and ready to use!

## What's Been Set Up

### ✅ Infrastructure
- **Chroma Vector Database**: Installed and configured (in-memory mode for local dev)
- **Ollama Embeddings**: Ready to use `nomic-embed-text` model
- **RAG Service**: Running on `http://localhost:3001`
- **Web App Integration**: Fully integrated with UI components

### ✅ Features
- **Run Indexing**: Index your runs into the vector database
- **Similar Run Finding**: Find similar past runs based on embeddings
- **Enhanced AI Analysis**: AI coach uses historical context from your runs
- **Browser-Based Indexing**: Index runs directly from the web app

## Quick Start

### 1. Start Required Services

**Terminal 1 - RAG Service:**
```bash
cd web/rag
CHROMA_MODE=in-memory npm start
```

**Terminal 2 - Ollama (if not already running):**
```bash
ollama serve
```

**Terminal 3 - Web App:**
```bash
cd web
npm run dev
```

### 2. Pull Embedding Model (One-time)

```bash
ollama pull nomic-embed-text
```

### 3. Index Your Runs

**Option A: From Web App (Easiest)**
1. Open web app: `http://localhost:5173`
2. Go to **Settings**
3. Click **"Index Runs for RAG"**
4. Click **"Index All Runs"**
5. Wait for indexing to complete

**Option B: From Browser Console**
1. Open web app in browser
2. Open console (F12)
3. Copy and paste the code from `web/rag/scripts/index-from-browser.js`
4. Run `indexKinetixRuns()`

**Option C: From JSON Export**
1. Export runs from browser (see `web/scripts/export-runs.js`)
2. Run: `cd web/rag && node scripts/index-runs.js path/to/runs.json`

### 4. Use RAG!

Once indexed, RAG is automatically used when:
- Analyzing runs in **Run Detail View**
- The AI coach provides insights with historical context
- Finding similar runs

## How It Works

1. **Indexing**: Each run is converted to an embedding vector using Ollama
2. **Storage**: Embeddings stored in Chroma vector database
3. **Query**: When analyzing a run, similar past runs are retrieved
4. **Augmentation**: Context from similar runs is added to AI prompt
5. **Generation**: AI generates personalized insights using your history

## Example RAG-Enhanced Analysis

**Without RAG:**
> "Your NPI of 142 is good. Keep training."

**With RAG:**
> "Your NPI of 142 is your 2nd best out of 247 similar 5km runs, just 3 points below your PB from 3 weeks ago. You're on a 4-run improvement streak! Your pace consistency (4:15/km) matches your best performances, suggesting you're in peak form."

## Architecture

```
┌─────────────┐
│  Web App    │
│  (Browser)  │
└──────┬──────┘
       │
       ├──► RAG Service (localhost:3001)
       │         │
       │         ├──► Chroma Vector DB
       │         │    (stores embeddings)
       │         │
       │         └──► Ollama Embeddings
       │              (nomic-embed-text)
       │
       └──► Ollama LLM (localhost:11434)
            (llama3.2 for generation)
```

## Configuration

### Environment Variables

**RAG Service** (`web/rag/.env`):
```env
CHROMA_MODE=in-memory          # or 'persistent' for production
CHROMA_PATH=./chroma_db        # only if persistent
OLLAMA_API_URL=http://localhost:11434
```

**Web App** (`web/.env`):
```env
VITE_RAG_SERVICE_URL=http://localhost:3001
VITE_OLLAMA_API_URL=http://localhost:11434
VITE_OLLAMA_MODEL=llama3.2
```

## Troubleshooting

### "RAG service unavailable"
- Check RAG service is running: `curl http://localhost:3001/health`
- Start it: `cd web/rag && npm start`

### "Embedding model not found"
- Pull model: `ollama pull nomic-embed-text`
- Check Ollama is running: `ollama list`

### "Chroma error"
- Chroma is installed via pip: `pip3 install chromadb`
- For persistent mode, ensure write permissions to `CHROMA_PATH`

### Indexing is slow
- Normal! Each run needs embedding generation (~1-2 seconds)
- With thousands of runs, expect several minutes
- Progress updates every 10 runs

### Build errors
- All async/await issues fixed
- Build tested and passing ✅

## Next Steps

1. **Index your runs** - Use the Settings page or browser console
2. **Test RAG analysis** - Open any run and click "Analyze Run"
3. **Compare insights** - Notice the difference with/without RAG
4. **Scale up** - Index all your thousands of runs!

## Files Created/Modified

### New Files
- `web/rag/` - RAG service directory
- `web/src/services/ragIndexService.js` - Client-side RAG indexing
- `web/src/components/RAGIndexer.jsx` - UI for indexing
- `web/scripts/export-runs.js` - Export runs to JSON
- `web/rag/scripts/index-from-browser.js` - Browser console script

### Modified Files
- `web/src/components/SettingsView.jsx` - Added RAG indexing button
- `web/src/services/aiCoachService.js` - RAG integration
- `web/src/components/RunDetailView.jsx` - RAG toggle
- `web/src/App.jsx` - Auto-index new runs

## Performance

- **Indexing**: ~1-2 seconds per run (embedding generation)
- **Query**: ~100-200ms (vector similarity search)
- **Analysis**: ~2-5 seconds (LLM generation with context)

## Production Considerations

For production deployment:
1. Use persistent Chroma mode: `CHROMA_MODE=persistent`
2. Set up Chroma server (not in-memory)
3. Use hosted Ollama or larger model
4. Add authentication to RAG service
5. Consider caching for frequently accessed runs

---

**🎉 You're all set! Start indexing your runs and enjoy personalized AI coaching!**

