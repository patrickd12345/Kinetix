/**
 * Browser-side Garmin ZIP import: unzip, scan DI_CONNECT/DI-Connect-Fitness/,
 * parse *_summarizedActivities.json, normalize and dedupe by external_id.
 */

import JSZip from 'jszip'
import type { GarminNormalizedRun } from './garmin'
import { parseSummarizedActivitiesJson } from './garmin'

const FITNESS_PATH_PREFIX = 'DI_CONNECT/DI-Connect-Fitness/'
const SUMMARIZED_PATTERN = /_summarizedActivities\.json$/i

export interface GarminImportStats {
  filesScanned: number
  activitiesParsed: number
  runningActivities: number
  duplicatesSkipped: number
  imported: number
}

export interface GarminImportResult {
  runs: GarminNormalizedRun[]
  stats: GarminImportStats
}

const DEFAULT_KPS = 100
const DEFAULT_TARGET_KPS = 135

/**
 * Extract and parse Garmin running activities from a ZIP File (browser).
 * Only scans DI_CONNECT/DI-Connect-Fitness/*_summarizedActivities.json.
 */
export async function importGarminFromZipFile(
  file: File,
  targetKPS: number = DEFAULT_TARGET_KPS
): Promise<GarminImportResult> {
  const stats: GarminImportStats = {
    filesScanned: 0,
    activitiesParsed: 0,
    runningActivities: 0,
    duplicatesSkipped: 0,
    imported: 0,
  }
  const allRuns: GarminNormalizedRun[] = []
  const seenIds = new Set<string>()

  const zip = await JSZip.loadAsync(file)
  const fitnessPrefix = FITNESS_PATH_PREFIX
  for (const [path, entry] of Object.entries(zip.files)) {
    if (!path.startsWith(fitnessPrefix) || entry.dir) continue
    if (!SUMMARIZED_PATTERN.test(path)) continue
    stats.filesScanned += 1
    try {
      const text = await entry.async('string')
      const { runs, totalActivities } = parseSummarizedActivitiesJson(text, targetKPS, DEFAULT_KPS)
      stats.activitiesParsed += totalActivities
      stats.runningActivities += runs.length
      for (const run of runs) {
        if (seenIds.has(run.external_id)) {
          stats.duplicatesSkipped += 1
          continue
        }
        seenIds.add(run.external_id)
        allRuns.push(run)
      }
    } catch (e) {
      throw new Error(
        `Failed to parse ${path}: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }
  stats.imported = allRuns.length
  return { runs: allRuns, stats }
}
