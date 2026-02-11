# RAG Quick Start Guide

## ✅ Setup Complete!

RAG service is ready. Here's how to use it:

## Step 1: Start RAG Service

```bash
cd web/rag
CHROMA_MODE=in-memory npm start
```

Service runs on `http://localhost:3001`

**Note**: If you get Chroma connection errors, Chroma may need to run as a separate server. The Node.js chromadb client should handle in-memory mode, but if issues persist, you can:
1. Use persistent mode: `CHROMA_MODE=persistent npm start`
2. Or start Chroma server separately (see Chroma docs)

## Step 2: Index Your Runs

### Option A: From Browser Console (Easiest)

1. **Open your web app** in browser
2. **Open browser console** (F12 or Cmd+Option+I)
3. **Copy and paste** this code:

```javascript
// Index runs from browser
const RAG_SERVICE_URL = 'http://localhost:3001';

async function indexRuns() {
  const runs = await new Promise((resolve, reject) => {
    const request = indexedDB.open('kinetix_db', 1);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(['runs'], 'readonly');
      const store = tx.objectStore('runs');
      const getAllRequest = store.getAll();
      getAllRequest.onsuccess = () => resolve(getAllRequest.result || []);
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
    request.onerror = () => reject(request.error);
  });

  console.log(`📊 Found ${runs.length} runs to index`);
  let indexed = 0;
  let errors = 0;

  for (const run of runs) {
    try {
      const response = await fetch(`${RAG_SERVICE_URL}/index`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run }),
      });
      if (response.ok) {
        indexed++;
        if (indexed % 10 === 0) {
          console.log(`✅ Indexed ${indexed}/${runs.length}...`);
        }
      } else {
        errors++;
      }
    } catch (error) {
      errors++;
    }
  }
  console.log(`✨ Done! Indexed ${indexed} runs, ${errors} errors`);
}

indexRuns();
```

4. **Press Enter** - it will index all your runs!

### Option B: Export Then Index

1. **Export runs** from browser console:
```javascript
// Export runs
const request = indexedDB.open('kinetix_db', 1);
request.onsuccess = () => {
  const db = request.result;
  const tx = db.transaction(['runs'], 'readonly');
  const store = tx.objectStore('runs');
  store.getAll().onsuccess = (e) => {
    const runs = e.target.result;
    const blob = new Blob([JSON.stringify(runs, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'runs.json';
    a.click();
  };
};
```

2. **Index from file:**
```bash
cd web/rag
node scripts/index-runs.js path/to/runs.json
```

## Step 3: Use RAG!

Once indexed, the web app will automatically use RAG when analyzing runs:

- **Open any run** in History
- **Click "Analyze Run"**
- **See enhanced analysis** with historical context!

## Verify It's Working

Check RAG service stats:
```bash
curl http://localhost:3001/stats
```

Should show: `{"runCount": <number>}`

## Troubleshooting

### "RAG service unavailable"
- Make sure RAG service is running: `cd web/rag && npm start`
- Check it's on port 3001

### "Embedding model not found"
- Pull the model: `ollama pull nomic-embed-text`

### "Chroma error"
- Install Chroma: `pip3 install chromadb`

### Indexing is slow
- Normal! Each run needs embedding generation
- With thousands of runs, expect 1-2 seconds per run
- Progress updates every 10 runs

## What You Get

With RAG enabled, AI analysis includes:
- ✅ Comparison to similar past runs
- ✅ Pattern recognition
- ✅ Historical context
- ✅ Personalized recommendations
- ✅ Progress tracking

**Example:**
> "Your NPI of 142 is your 2nd best out of 247 similar 5km runs, just 3 points below your PB from 3 weeks ago. You're on a 4-run improvement streak!"

---

**Ready to index your thousands of runs?** 🚀

