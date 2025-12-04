/**
 * Export runs from browser localStorage/IndexedDB to JSON
 * Run this in browser console or as a bookmarklet
 */

// For IndexedDB (current implementation)
async function exportRunsFromIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('kinetix_db', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(['runs'], 'readonly');
      const store = tx.objectStore('runs');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => {
        const runs = getAllRequest.result || [];
        resolve(runs);
      };
      
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
    
    request.onerror = () => reject(request.error);
  });
}

// For localStorage (legacy)
function exportRunsFromLocalStorage() {
  const data = localStorage.getItem('kinetix_runs');
  if (data) {
    return JSON.parse(data);
  }
  return [];
}

// Main export function
async function exportRuns() {
  try {
    // Try IndexedDB first
    let runs = await exportRunsFromIndexedDB();
    
    // Fallback to localStorage
    if (!runs || runs.length === 0) {
      runs = exportRunsFromLocalStorage();
    }
    
    // Create download
    const dataStr = JSON.stringify(runs, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kinetix-runs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log(`✅ Exported ${runs.length} runs`);
    return runs;
  } catch (error) {
    console.error('Export error:', error);
    throw error;
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  window.exportKinetixRuns = exportRuns;
  console.log('Run exportKinetixRuns() in console to export your runs');
}

// For Node.js (if running as script)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { exportRuns, exportRunsFromIndexedDB, exportRunsFromLocalStorage };
}






