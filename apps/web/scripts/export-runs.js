/**
 * Export runs from apps/web IndexedDB to JSON.
 * Usage: paste into browser console and run exportKinetixRuns().
 */

async function exportRunsFromIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('KinetixDB', 3);
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
}

async function exportRuns() {
  const runs = await exportRunsFromIndexedDB();
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
  console.log(`Exported ${runs.length} runs`);
  return runs;
}

if (typeof window !== 'undefined') {
  window.exportKinetixRuns = exportRuns;
  console.log('Run exportKinetixRuns() in console to export your runs');
}
