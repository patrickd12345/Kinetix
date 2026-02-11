/**
 * Index all runs from a JSON file into RAG (POST /index).
 * Run with: node scripts/index-all-from-json.js <path-to-runs.json>
 * JSON can be RunRecord shape (averagePace, kps) or RAG shape (avgPace, avgKPS); both are normalized.
 */

import { readFileSync } from 'fs';

const PORTS = [3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010];

async function findRAGBaseUrl() {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://localhost:${port}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) return `http://localhost:${port}`;
    } catch {
      /* try next */
    }
  }
  return null;
}

function toRAGRun(run, index) {
  const id = run.id ?? run.external_id ?? `run-${index}-${run.date}-${run.distance}`;
  return {
    id: typeof id === 'number' ? id : String(id),
    date: run.date,
    distance: Number(run.distance),
    duration: Number(run.duration),
    avgPace: Number(run.avgPace ?? run.averagePace ?? run.duration / (run.distance / 1000)),
    avgKPS: Number(run.avgKPS ?? run.kps ?? run.npi ?? 0),
    avgHeartRate: run.heartRate ?? run.avgHeartRate ?? null,
    avgCadence: run.avgCadence ?? null,
    formScore: run.formScore ?? null,
  };
}

async function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath) {
    console.log('Usage: node scripts/index-all-from-json.js <path-to-runs.json>');
    process.exit(1);
  }

  console.log('Reading', jsonPath, '...');
  const raw = readFileSync(jsonPath, 'utf-8');
  const runs = JSON.parse(raw);
  if (!Array.isArray(runs) || runs.length === 0) {
    console.log('No runs array in file or empty.');
    process.exit(0);
  }

  const base = await findRAGBaseUrl();
  if (!base) {
    console.error('RAG service not found. Start it with: pnpm dev (or pnpm dev:rag)');
    process.exit(1);
  }
  console.log('RAG at', base, '– indexing', runs.length, 'runs...');

  let indexed = 0;
  let errors = 0;
  for (let i = 0; i < runs.length; i++) {
    try {
      const ragRun = toRAGRun(runs[i], i);
      const res = await fetch(`${base}/index`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run: ragRun }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        indexed++;
        if (indexed % 50 === 0) console.log('  ', indexed, '/', runs.length);
      } else {
        errors++;
        if (errors === 1) {
          const text = await res.text();
          console.error('  First failure (run 0):', res.status, text.slice(0, 300));
        }
      }
    } catch (err) {
      errors++;
      if (errors === 1) console.error('  First error (run 0):', err.message);
    }
  }

  console.log('Done. Indexed', indexed, 'runs,', errors, 'errors.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
