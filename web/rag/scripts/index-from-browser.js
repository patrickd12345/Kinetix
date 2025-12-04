/**
 * Index runs directly from browser (runs in browser console)
 * Usage: Copy this into browser console, then call indexRuns()
 */

const RAG_SERVICE_URL = 'http://localhost:3001';

async function indexRuns() {
  // Get runs from IndexedDB
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
          console.log(`✅ Indexed ${indexed}/${runs.length} runs...`);
        }
      } else {
        errors++;
        console.warn(`❌ Failed to index run ${run.id}`);
      }
    } catch (error) {
      errors++;
      console.error(`❌ Error indexing run ${run.id}:`, error);
    }
  }

  console.log(`\n✨ Done! Indexed ${indexed} runs, ${errors} errors`);
  return { indexed, errors, total: runs.length };
}

// Make available in browser
if (typeof window !== 'undefined') {
  window.indexKinetixRuns = indexRuns;
  console.log('Run indexKinetixRuns() in console to index your runs');
}


