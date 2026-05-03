const fs = require('fs');
let code = fs.readFileSync('apps/web/src/pages/History.tsx', 'utf8');

// The O(N^2) issue and N+1 query issue in History.tsx
// We need to fetch allVisible once, and build the absMap once.

let find = `const allVisible = await getAllVisibleRunsOrdered()
          const previousRuns = allVisible.filter(r => r.id !== run.id && new Date(r.date) < new Date(run.date))
          const runAbs = calculateAbsoluteKPS(run, resolved)
          const prevMap = new Map<number, number>()
          for (const pr of previousRuns) {
             if (pr.id) {
               prevMap.set(pr.id, calculateAbsoluteKPS(pr, resolveProfileForRunWithWeightCache(weightMap, pr)))
             }
          }
          achievementsMap.set(run.id, calculateAchievementsSync(run, previousRuns, runAbs, prevMap))`;

let replace = `const previousRuns = medalSourceRuns.filter(r => r.id !== run.id && new Date(r.date) < new Date(run.date))
          const runAbs = calculateAbsoluteKPS(run, resolved)
          const prevMap = new Map<number, number>()
          for (const pr of previousRuns) {
             if (pr.id) {
               prevMap.set(pr.id, calculateAbsoluteKPS(pr, resolveProfileForRunWithWeightCache(weightMap, pr)))
             }
          }
          achievementsMap.set(run.id, calculateAchievementsSync(run, previousRuns, runAbs, prevMap))`;

// We'll rewrite the whole block in loadChartRuns
code = code.replace(find, replace);
fs.writeFileSync('apps/web/src/pages/History.tsx', code);
