/**
 * Browser-based Strava Import
 * Run this in your browser console after getting the JSON file
 * 
 * Usage:
 * 1. Run strava-import.js to generate strava-runs-import.json
 * 2. Copy strava-runs-import.json to web/public/ (or serve it)
 * 3. Open web app in browser
 * 4. Open console (F12)
 * 5. Copy and paste this entire file
 * 6. Run: importStravaRuns()
 */

async function importStravaRuns() {
  try {
    // Load runs from JSON file
    const response = await fetch('/strava-runs-import.json');
    if (!response.ok) {
      throw new Error('Failed to load strava-runs-import.json. Make sure it\'s in the public folder.');
    }
    
    const runsData = await response.json();
    console.log(`📥 Loaded ${runsData.length} runs from Strava`);

    // Import storage service and Run model
    const { StorageService } = await import('/src/services/storageService.js');
    const { Run } = await import('/src/models/Run.js');
    const { RAGIndexService } = await import('/src/services/ragIndexService.js');

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    console.log('\n🔄 Importing runs...');

    for (let i = 0; i < runsData.length; i++) {
      const runData = runsData[i];
      
      try {
        // Check if run already exists
        const existing = await StorageService.getRun(runData.id);
        if (existing) {
          console.log(`⏭️  Skipping ${runData.id} (already exists)`);
          skipped++;
          continue;
        }

        // Create Run instance
        const run = Run.fromJSON(runData);
        
        // Save to IndexedDB
        const saved = await StorageService.saveRun(run);
        if (saved) {
          imported++;
          
          // Optionally index in RAG
          try {
            const ragAvailable = await RAGIndexService.isAvailable();
            if (ragAvailable) {
              await RAGIndexService.indexRun(runData);
            }
          } catch (ragError) {
            // Silent fail - RAG is optional
            console.warn(`RAG indexing failed for ${runData.id}:`, ragError);
          }

          if (imported % 10 === 0) {
            console.log(`✅ Imported ${imported}/${runsData.length}...`);
          }
        } else {
          errors++;
          console.error(`❌ Failed to save ${runData.id}`);
        }
      } catch (error) {
        errors++;
        console.error(`❌ Error importing ${runData.id}:`, error);
      }
    }

    console.log('\n✨ Import complete!');
    console.log(`   ✅ Imported: ${imported}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    
    // Reload page to see new runs
    console.log('\n💡 Reload the page to see your imported runs!');
    
    return { imported, skipped, errors };
  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  }
}

// Alternative: Import directly from array (if you paste the JSON)
async function importStravaRunsFromArray(runsArray) {
  const { StorageService } = await import('/src/services/storageService.js');
  const { Run } = await import('/src/models/Run.js');
  const { RAGIndexService } = await import('/src/services/ragIndexService.js');

  let imported = 0;
  let skipped = 0;

  for (const runData of runsArray) {
    try {
      const existing = await StorageService.getRun(runData.id);
      if (existing) {
        skipped++;
        continue;
      }

      const run = Run.fromJSON(runData);
      const saved = await StorageService.saveRun(run);
      
      if (saved) {
        imported++;
        
        // Index in RAG if available
        try {
          if (await RAGIndexService.isAvailable()) {
            await RAGIndexService.indexRun(runData);
          }
        } catch {}
      }
    } catch (error) {
      console.error(`Error importing ${runData.id}:`, error);
    }
  }

  console.log(`✅ Imported ${imported}, skipped ${skipped}`);
  return { imported, skipped };
}

// Make available globally
if (typeof window !== 'undefined') {
  window.importStravaRuns = importStravaRuns;
  window.importStravaRunsFromArray = importStravaRunsFromArray;
  console.log('✅ Strava import functions loaded!');
  console.log('   Run: importStravaRuns()');
  console.log('   Or: importStravaRunsFromArray([...runs...])');
}


