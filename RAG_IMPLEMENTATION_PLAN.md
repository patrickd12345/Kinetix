# RAG Implementation Plan for Kinetix

## Context
- **You have thousands of runs** - RAG is highly valuable
- **Current**: Simple prompts analyze single runs
- **Goal**: Use historical context for better coaching

## Implementation Strategy

### Phase 1: Vector Database Setup

#### Option A: Local Vector DB (Recommended for Privacy)
- **Chroma** (Python) - Easy to set up, local-first
- **Qdrant** (Rust) - Fast, can run locally
- **LanceDB** (Rust) - Embedded, no server needed

#### Option B: Cloud Vector DB (If Needed)
- **Pinecone** - Managed, easy to use
- **Weaviate** - Self-hosted option
- **Qdrant Cloud** - Managed Qdrant

**Recommendation**: Start with **Chroma** (local, Python-based, easy integration)

### Phase 2: Embedding Model

#### Options:
1. **Ollama Embeddings** (Recommended)
   - Use same Ollama instance
   - Models: `nomic-embed-text`, `llama3.2` (if supports embeddings)
   - Local, no API keys

2. **Sentence Transformers** (Python)
   - `all-MiniLM-L6-v2` - Fast, good quality
   - Can run locally

3. **OpenAI Embeddings** (If using cloud)
   - `text-embedding-3-small` - Good quality
   - Requires API key

**Recommendation**: Use **Ollama embeddings** to keep everything local

### Phase 3: Run Vectorization

#### What to Vectorize:
```javascript
{
  // Core metrics
  distance: 5.0,
  pace: 4.5,
  npi: 142,
  heartRate: 165,
  
  // Form metrics (if available)
  cadence: 175,
  formScore: 75,
  verticalOscillation: 8.5,
  
  // Context
  date: "2025-01-15",
  timeOfDay: "morning",
  weather: "sunny",
  temperature: 18,
  
  // Derived features
  improvement: "+2", // vs previous similar run
  targetAchieved: true,
  personalBest: false
}
```

#### Embedding Strategy:
1. **Create embedding text**:
   ```
   "5km run, pace 4:30/km, KPS 97.4, heart rate 165 bpm, 
   cadence 175 spm, form score 75, morning run, sunny weather, 
   target achieved, improved by 1.2 KPS points"
   ```

2. **Generate vector** using embedding model

3. **Store in vector DB** with metadata

### Phase 4: RAG Pipeline

#### Flow:
```
1. User requests run analysis
   ↓
2. Vectorize current run
   ↓
3. Search for similar runs (top 5-10)
   ↓
4. Augment prompt with similar runs
   ↓
5. Generate AI response with context
```

#### Implementation:
```javascript
async function analyzeRunWithRAG(run, targetKps) {
  // 1. Vectorize current run
  const runVector = await embedRun(run);
  
  // 2. Find similar runs
  const similarRuns = await vectorDB.query({
    vector: runVector,
    topK: 5,
    filter: {
      distance: { $gte: run.distance * 0.9, $lte: run.distance * 1.1 }
    }
  });
  
  // 3. Build augmented prompt
  const prompt = buildRAGPrompt(run, similarRuns, targetKps);
  
  // 4. Generate response
  return await llm.generate(prompt);
}
```

### Phase 5: Features to Build

#### 1. "Find Similar Runs"
```javascript
async function findSimilarRuns(run, criteria = {}) {
  const runVector = await embedRun(run);
  return await vectorDB.query({
    vector: runVector,
    topK: 10,
    filter: criteria
  });
}
```

#### 2. "Pattern Analysis"
```javascript
async function analyzePatterns(timeframe = '3months') {
  // Find runs in timeframe
  // Cluster by similarity
  // Identify patterns
  // Return insights
}
```

#### 3. "Historical Context"
```javascript
async function getHistoricalContext(run) {
  const similarRuns = await findSimilarRuns(run);
  return {
    averageKps: calculateAverage(similarRuns),
    bestKps: findBest(similarRuns),
    improvement: calculateTrend(similarRuns),
    patterns: identifyPatterns(similarRuns)
  };
}
```

## Technical Stack

### Recommended Stack:
- **Vector DB**: Chroma (local, Python)
- **Embeddings**: Ollama (local LLM)
- **Backend**: Node.js service (or Python if using Chroma)
- **Storage**: Existing run storage + vector DB

### Architecture:
```
Web App → Backend Service → Chroma DB
                ↓
            Ollama (embeddings)
                ↓
            Ollama (LLM for RAG)
```

## Implementation Steps

### Step 1: Set Up Chroma
```bash
pip install chromadb
```

### Step 2: Create Embedding Service
```python
# embedding_service.py
import ollama

def embed_run(run_data):
    text = format_run_as_text(run_data)
    response = ollama.embeddings(model='nomic-embed-text', prompt=text)
    return response['embedding']
```

### Step 3: Index Existing Runs
```python
# index_runs.py
import chromadb
from embedding_service import embed_run

def index_all_runs(runs):
    client = chromadb.Client()
    collection = client.create_collection("runs")
    
    for run in runs:
        vector = embed_run(run)
        collection.add(
            ids=[run.id],
            embeddings=[vector],
            metadatas=[run.to_dict()]
        )
```

### Step 4: Implement RAG Query
```python
# rag_service.py
def analyze_run_with_rag(run, target_npi):
    # Find similar runs
    similar = collection.query(
        query_embeddings=[embed_run(run)],
        n_results=5
    )
    
    # Build prompt
    prompt = build_rag_prompt(run, similar, target_npi)
    
    # Generate response
    response = ollama.generate(
        model='llama3.2',
        prompt=prompt
    )
    
    return response
```

## Migration Strategy

### For Existing Runs:
1. **Export all runs** from current storage
2. **Batch process** to generate embeddings
3. **Index in Chroma** (can be done incrementally)
4. **Verify** search quality

### For New Runs:
1. **On save**: Generate embedding
2. **Index immediately**: Add to vector DB
3. **Update**: Keep in sync with main storage

## Performance Considerations

### With Thousands of Runs:
- **Vector search**: O(log n) with proper indexing
- **Embedding generation**: ~50-100ms per run
- **Initial indexing**: Batch process (can take time)
- **Query time**: < 100ms for top 10 similar runs

### Optimization:
- **Batch embeddings**: Process multiple runs at once
- **Caching**: Cache frequently accessed runs
- **Incremental updates**: Only re-index changed runs

## Privacy & Local-First

### Keep Everything Local:
- ✅ Chroma runs locally
- ✅ Ollama embeddings local
- ✅ No data leaves your machine
- ✅ Matches Kinetix privacy philosophy

## Next Steps

1. **Set up Chroma** locally
2. **Test embeddings** with Ollama
3. **Index sample runs** (100-200) to test
4. **Implement RAG query** for run analysis
5. **Scale up** to all runs
6. **Add features** (find similar, patterns, etc.)

## Estimated Timeline

- **Setup**: 1 day (Chroma + Ollama embeddings)
- **Indexing**: 1 day (batch process thousands of runs)
- **RAG Implementation**: 2 days (query + prompt building)
- **Testing**: 1 day
- **Total**: ~5 days for full RAG system

---

**Ready to implement?** With thousands of runs, this will provide significant value!









