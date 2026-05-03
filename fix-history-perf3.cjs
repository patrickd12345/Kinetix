const fs = require('fs');
let code = fs.readFileSync('apps/web/src/pages/History.tsx', 'utf8');

// The absoluteKpsMapLocal is defined inside the useEffect, so it's out of scope for loadChartRuns.
// However, the issue is loadChartRuns is already doing the achievements calculation.
// But wait, in loadChartRuns, medalSourceRuns is NOT defined locally, it's defined in state if it's there. But we don't have medalSourceRuns in state. It might be implicitly capturing a stale closure or erroring. Let's look.

code = code.replace("achievementsMap.set(run.id, calculateAchievementsSync(run, previousRuns, runAbs, absoluteKpsMapLocal))", `
          const prevMap = new Map<number, number>()
          for (const pr of previousRuns) {
             if (pr.id) {
               prevMap.set(pr.id, calculateAbsoluteKPS(pr, resolveProfileForRunWithWeightCache(weightMap, pr)))
             }
          }
          achievementsMap.set(run.id, calculateAchievementsSync(run, previousRuns, runAbs, prevMap))`);

fs.writeFileSync('apps/web/src/pages/History.tsx', code);
