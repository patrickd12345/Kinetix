/**
 * Script to index existing runs from JSON file into vector DB
 */

import { readFileSync } from 'fs';
import { EmbeddingService } from '../services/embeddingService.js';
import { vectorDB } from '../services/vectorDB.js';

async function indexRunsFromJSON(jsonPath) {
  try {
    console.log('📚 Reading runs from:', jsonPath);
    const data = readFileSync(jsonPath, 'utf-8');
    const runs = JSON.parse(data);
    
    console.log(`📊 Found ${runs.length} runs to index`);
    
    await vectorDB.initialize();
    
    let indexed = 0;
    let errors = 0;
    
    for (const run of runs) {
      try {
        // Convert date string to Date if needed
        if (typeof run.date === 'string') {
          run.date = new Date(run.date);
        }
        
        const embedding = await EmbeddingService.embedRun(run);
        await vectorDB.addRun(run, embedding);
        
        indexed++;
        if (indexed % 10 === 0) {
          console.log(`✅ Indexed ${indexed}/${runs.length} runs...`);
        }
      } catch (error) {
        console.error(`❌ Error indexing run ${run.id}:`, error.message);
        errors++;
      }
    }
    
    console.log(`\n✨ Done! Indexed ${indexed} runs, ${errors} errors`);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
const jsonPath = process.argv[2];
if (jsonPath) {
  indexRunsFromJSON(jsonPath);
} else {
  console.log('Usage: node index-runs.js <path-to-runs.json>');
  console.log('\nOr use the browser script:');
  console.log('1. Open web app in browser');
  console.log('2. Open console');
  console.log('3. Copy and run the code from scripts/index-from-browser.js');
}

