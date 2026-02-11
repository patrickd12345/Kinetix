#!/usr/bin/env tsx
/**
 * CLI: Import Garmin export ZIP into normalized runs JSON.
 * Usage: pnpm garmin:import [path/to/garmin.zip] [output.json]
 * Scans only DI_CONNECT/DI-Connect-Fitness/*_summarizedActivities.json
 * and filters activityType.typeKey === "running". Writes JSON array of
 * normalized runs for loading in the web app (Settings > Import from file).
 */

import AdmZip from 'adm-zip'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { parseSummarizedActivitiesJson, type GarminNormalizedRun } from '../src/lib/garmin'

const FITNESS_PATH_PREFIX = 'DI_CONNECT/DI-Connect-Fitness/'
const SUMMARIZED_PATTERN = /_summarizedActivities\.json$/i
const DEFAULT_TARGET_KPS = 135
const DEFAULT_KPS = 100

function main() {
  const zipPath = process.argv[2] || join(process.cwd(), 'garmin.zip')
  const outPath = process.argv[3] || join(process.cwd(), 'garmin-runs.json')

  let zip: AdmZip
  try {
    zip = new AdmZip(zipPath)
  } catch (e) {
    console.error('Failed to read ZIP:', zipPath, e)
    process.exit(1)
  }

  const entries = zip.getEntries()
  const seenIds = new Set<string>()
  const allRuns: GarminNormalizedRun[] = []
  let filesScanned = 0
  let activitiesParsed = 0
  let runningActivities = 0
  let duplicatesSkipped = 0

  for (const entry of entries) {
    if (entry.isDirectory) continue
    const path = entry.entryName.replace(/\\/g, '/')
    if (!path.startsWith(FITNESS_PATH_PREFIX) || !SUMMARIZED_PATTERN.test(path)) continue
    filesScanned += 1
    try {
      const text = entry.getData().toString('utf8')
      const { runs, totalActivities } = parseSummarizedActivitiesJson(
        text,
        DEFAULT_TARGET_KPS,
        DEFAULT_KPS
      )
      activitiesParsed += totalActivities
      runningActivities += runs.length
      for (const run of runs) {
        if (seenIds.has(run.external_id)) {
          duplicatesSkipped += 1
          continue
        }
        seenIds.add(run.external_id)
        allRuns.push(run)
      }
    } catch (e) {
      console.error('Parse error', path, e)
      process.exit(1)
    }
  }

  writeFileSync(outPath, JSON.stringify(allRuns, null, 2), 'utf8')

  console.log('Garmin import summary:')
  console.log('  Files scanned:           ', filesScanned)
  console.log('  Activities parsed:        ', activitiesParsed)
  console.log('  Running activities:      ', runningActivities)
  console.log('  Duplicates skipped:      ', duplicatesSkipped)
  console.log('  Runs written:            ', allRuns.length)
  console.log('  Output file:             ', outPath)
}

main()
