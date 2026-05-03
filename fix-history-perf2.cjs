const fs = require('fs');
let code = fs.readFileSync('apps/web/src/pages/History.tsx', 'utf8');

// To fix the performance issue properly:
// We compute all absolute KPS once before the loop.

const oldBlock1 = `const weightByRunDateLocal = await getWeightsForDates(medalSourceRuns.map((r) => r.date))
        if (cancelled) return
        const tierKey = buildHistoryKpsTierKey({`;

const newBlock1 = `const weightByRunDateLocal = await getWeightsForDates(medalSourceRuns.map((r) => r.date))
        if (cancelled) return

        const absoluteKpsMapLocal = new Map<number, number>()
        for (const r of medalSourceRuns) {
          if (r.id) {
            absoluteKpsMapLocal.set(r.id, calculateAbsoluteKPS(r, resolveProfileForRunWithWeightCache(weightByRunDateLocal, r)))
          }
        }

        const tierKey = buildHistoryKpsTierKey({`;

code = code.replace(oldBlock1, newBlock1);


const oldLoop1 = `if (run.id) {
          const resolved = resolveProfileForRunWithWeightCache(weightMap, run)
          kpsMap.set(run.id, calculateRelativeKPSSync(run, resolved, pb ?? null, pbRun ?? null))
          const previousRuns = medalSourceRuns.filter(r => r.id !== run.id && new Date(r.date) < new Date(run.date))
          const runAbs = calculateAbsoluteKPS(run, resolved)
          const prevMap = new Map<number, number>()
          for (const pr of previousRuns) {
             if (pr.id) {
               prevMap.set(pr.id, calculateAbsoluteKPS(pr, resolveProfileForRunWithWeightCache(weightMap, pr)))
             }
          }
          achievementsMap.set(run.id, calculateAchievementsSync(run, previousRuns, runAbs, prevMap))
        }`;

const newLoop1 = `if (run.id) {
          const resolved = resolveProfileForRunWithWeightCache(weightMap, run)
          kpsMap.set(run.id, calculateRelativeKPSSync(run, resolved, pb ?? null, pbRun ?? null))
          const previousRuns = medalSourceRuns.filter(r => r.id !== run.id && new Date(r.date) < new Date(run.date))
          const runAbs = calculateAbsoluteKPS(run, resolved)
          achievementsMap.set(run.id, calculateAchievementsSync(run, previousRuns, runAbs, absoluteKpsMapLocal))
        }`;

code = code.replace(oldLoop1, newLoop1);

fs.writeFileSync('apps/web/src/pages/History.tsx', code);
