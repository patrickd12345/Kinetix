/**
 * Browser-side Garmin import:
 * - Full export: DI_CONNECT/DI-Connect-Fitness/*_summarizedActivities.json
 * - Single / extra: any *.fit in the ZIP (or a lone .FIT file upload)
 */

import JSZip from 'jszip'
import type { GarminNormalizedRun } from './garmin'
import { parseSummarizedActivitiesJson } from './garmin'
import { parseFitArrayBufferToNormalizedRuns } from './garminFit'

const FITNESS_PATH_PREFIX = 'DI_CONNECT/DI-Connect-Fitness/'
const SUMMARIZED_PATTERN = /_summarizedActivities\.json$/i
const FIT_PATTERN = /\.fit$/i

export interface GarminImportStats {
  /** SummarizedActivities JSON files read */
  filesScanned: number
  /** .fit files read (inside ZIP or single-file upload) */
  fitFilesScanned: number
  activitiesParsed: number
  runningActivities: number
  duplicatesSkipped: number
  imported: number
}

export interface GarminImportResult {
  runs: GarminNormalizedRun[]
  stats: GarminImportStats
}

const DEFAULT_TARGET_KPS = 135

/**
 * Extract running activities from a Garmin export ZIP: JSON dump and/or embedded .fit files.
 */
export async function importGarminFromZipFile(
  file: File,
  targetKPS: number = DEFAULT_TARGET_KPS
): Promise<GarminImportResult> {
  const stats: GarminImportStats = {
    filesScanned: 0,
    fitFilesScanned: 0,
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
      const { runs, totalActivities } = parseSummarizedActivitiesJson(text, targetKPS)
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

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || !FIT_PATTERN.test(path)) continue
    stats.fitFilesScanned += 1
    try {
      const buf = await entry.async('arraybuffer')
      const fitRuns = await parseFitArrayBufferToNormalizedRuns(buf, targetKPS, { filenameHint: path })
      stats.runningActivities += fitRuns.length
      for (const run of fitRuns) {
        if (seenIds.has(run.external_id)) {
          stats.duplicatesSkipped += 1
          continue
        }
        seenIds.add(run.external_id)
        allRuns.push(run)
      }
    } catch (e) {
      throw new Error(
        `Failed to parse FIT ${path}: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  stats.imported = allRuns.length
  return { runs: allRuns, stats }
}

/**
 * Single .fit file (not wrapped in ZIP).
 */
export async function importGarminFromFitFile(
  file: File,
  targetKPS: number = DEFAULT_TARGET_KPS
): Promise<GarminImportResult> {
  const buf = await file.arrayBuffer()
  const runs = await parseFitArrayBufferToNormalizedRuns(buf, targetKPS, { filenameHint: file.name })
  return {
    runs,
    stats: {
      filesScanned: 0,
      fitFilesScanned: 1,
      activitiesParsed: 0,
      runningActivities: runs.length,
      duplicatesSkipped: 0,
      imported: runs.length,
    },
  }
}

/** True if the file should be handled as a raw .fit upload (not a ZIP). */
export function isGarminFitFile(file: File): boolean {
  return FIT_PATTERN.test(file.name)
}
