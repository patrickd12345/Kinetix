cat << 'PATCH' > kpsUtils.patch
--- apps/web/src/lib/kpsUtils.ts
+++ apps/web/src/lib/kpsUtils.ts
@@ -2,7 +2,7 @@
 import type { UserProfile } from '@kinetix/core'
-import { getProfileForRun } from './authState'
+import { getProfileForRun, resolveProfileForRunWithWeightCache } from './authState'
-import { db, RUN_VISIBLE } from './database'
+import { db, RUN_VISIBLE, getWeightsForDates } from './database'
 import type { RunRecord, PBRecord } from './database'

 /**
@@ -118,10 +118,12 @@
   const pbAbsoluteKPS = calculateAbsoluteKPS(pbRun, pb.profileSnapshot)
   if (!isValidKPS(pbAbsoluteKPS)) return []
   const threshold = pbAbsoluteKPS * OUTLIER_KPS_RATIO
   const result: RunRecord[] = []
+  const runDates = runs.filter(r => !!r.id).map(r => r.date)
+  const weightByDate = await getWeightsForDates(runDates)
   for (const r of runs) {
     if (!r.id) continue
-    const profileForRun = await getProfileForRun(r)
+    const profileForRun = resolveProfileForRunWithWeightCache(weightByDate, r)
     const kps = calculateAbsoluteKPS(r, profileForRun)
     if (isValidKPS(kps) && kps > threshold) result.push(r)
   }
PATCH
patch apps/web/src/lib/kpsUtils.ts < kpsUtils.patch
