const fs = require('fs');
let code = fs.readFileSync('apps/web/src/pages/History.tsx', 'utf8');

// The N+1 query issue in loadChartRuns needs to be resolved by fetching the previous runs differently, or we can just fetch allVisible once in loadChartRuns.
let find = `const kpsMap = new Map<number, number>()
      const achievementsMap = new Map<number, AchievementLabel[]>()
      for (const run of meaningfulRuns) {
        if (run.id) {
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
        }
      }`;

let replace = `const kpsMap = new Map<number, number>()
      const achievementsMap = new Map<number, AchievementLabel[]>()

      const allVisible = await getAllVisibleRunsOrdered()
      const globalWeightMap = await getWeightsForDates(allVisible.map((r) => r.date))
      const absoluteKpsMapGlobal = new Map<number, number>()
      for (const r of allVisible) {
        if (r.id) {
          absoluteKpsMapGlobal.set(r.id, calculateAbsoluteKPS(r, resolveProfileForRunWithWeightCache(globalWeightMap, r)))
        }
      }

      for (const run of meaningfulRuns) {
        if (run.id) {
          const resolved = resolveProfileForRunWithWeightCache(weightMap, run)
          kpsMap.set(run.id, calculateRelativeKPSSync(run, resolved, pb ?? null, pbRun ?? null))
          const previousRuns = allVisible.filter(r => r.id !== run.id && new Date(r.date) < new Date(run.date))
          const runAbs = calculateAbsoluteKPS(run, resolved)
          achievementsMap.set(run.id, calculateAchievementsSync(run, previousRuns, runAbs, absoluteKpsMapGlobal))
        }
      }`;

code = code.replace(find, replace);
fs.writeFileSync('apps/web/src/pages/History.tsx', code);
