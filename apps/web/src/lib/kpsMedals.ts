import type { RunRecord } from './database'
import { isMeaningfulRunForKPS } from './kpsUtils'

export type KpsMedal = 'gold' | 'silver' | 'bronze'

/**
 * History run-card medals — **contract** (do not change casually):
 *
 * 1. Consider only runs in `runs` with meaningful KPS + a finite relative score in `relativeKPSMap`
 *    (same rows the History list uses for that load).
 * 2. Use **rounded** relative KPS (`Math.round`) — same as the big number on the card.
 * 3. If rounded `100` is present, it is always the **gold** tier by definition.
 * 4. **Silver** and **bronze** come from the next two lower distinct rounded scores.
 * 5. **Ties**: every run whose rounded score equals that tier gets the same medal
 *    (e.g. two runs at 100 → both gold; all runs at 56 → same medal for that tier).
 *
 * There is no separate “podium by row index”; only distinct score tiers matter.
 */
export function computeKpsMedalsForRuns(
  runs: RunRecord[],
  relativeKPSMap: Map<number, number>
): Map<number, KpsMedal> {
  const rows: { id: number; rounded: number }[] = []
  for (const run of runs) {
    if (run.id == null) continue
    if (!isMeaningfulRunForKPS(run)) continue
    const rel = relativeKPSMap.get(run.id)
    if (rel == null || !Number.isFinite(rel)) continue
    const rounded = Math.round(rel)
    if (rounded <= 0) continue
    rows.push({ id: run.id, rounded })
  }
  if (rows.length === 0) return new Map()

  const distinctSorted = [...new Set(rows.map((r) => r.rounded))].sort((a, b) => b - a)
  const medalOrder = distinctSorted.includes(100)
    ? [100, ...distinctSorted.filter((score) => score < 100)]
    : distinctSorted
  const medalByRoundedScore = new Map<number, KpsMedal>()
  const tiers: KpsMedal[] = ['gold', 'silver', 'bronze']
  for (let i = 0; i < Math.min(3, medalOrder.length); i++) {
    medalByRoundedScore.set(medalOrder[i], tiers[i])
  }

  const out = new Map<number, KpsMedal>()
  for (const row of rows) {
    const m = medalByRoundedScore.get(row.rounded)
    if (m) out.set(row.id, m)
  }
  return out
}
