#!/usr/bin/env tsx
/**
 * CLI: Import Garmin export ZIP or a single .fit into normalized runs JSON.
 * Usage: pnpm garmin:import [path/to/garmin.zip|.fit] [output.json]
 *
 * ZIP: scans DI_CONNECT/DI-Connect-Fitness/*_summarizedActivities.json (running)
 *      and any *.fit entries in the archive (deduped by external_id).
 * .fit: single activity file (running sessions only).
 */

import AdmZip from 'adm-zip'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { parseSummarizedActivitiesJson, type GarminNormalizedRun } from '../src/lib/garmin'
import { parseFitArrayBufferToNormalizedRuns } from '../src/lib/garminFit'

const FITNESS_PATH_PREFIX = 'DI_CONNECT/DI-Connect-Fitness/'
const SUMMARIZED_PATTERN = /_summarizedActivities\.json$/i
const FIT_PATTERN = /\.fit$/i
const DEFAULT_TARGET_KPS = 135

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  const u8 = new Uint8Array(buf.byteLength)
  u8.set(buf)
  return u8.buffer
}

function isFitPath(filePath: string): boolean {
  return FIT_PATTERN.test(filePath)
}

async function importFromZip(zipPath: string): Promise<{
  allRuns: GarminNormalizedRun[]
  filesScanned: number
  fitFilesScanned: number
  activitiesParsed: number
  duplicatesSkipped: number
}> {
  const zip = new AdmZip(zipPath)
  const entries = zip.getEntries()
  const seenIds = new Set<string>()
  const allRuns: GarminNormalizedRun[] = []
  let filesScanned = 0
  let fitFilesScanned = 0
  let activitiesParsed = 0
  let duplicatesSkipped = 0

  for (const entry of entries) {
    if (entry.isDirectory) continue
    const path = entry.entryName.replace(/\\/g, '/')
    if (!path.startsWith(FITNESS_PATH_PREFIX) || !SUMMARIZED_PATTERN.test(path)) continue
    filesScanned += 1
    try {
      const text = entry.getData().toString('utf8')
      const { runs, totalActivities } = parseSummarizedActivitiesJson(text, DEFAULT_TARGET_KPS)
      activitiesParsed += totalActivities
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

  for (const entry of entries) {
    if (entry.isDirectory) continue
    const path = entry.entryName.replace(/\\/g, '/')
    if (!FIT_PATTERN.test(path)) continue
    fitFilesScanned += 1
    try {
      const buf = entry.getData()
      const ab = toArrayBuffer(buf)
      const fitRuns = await parseFitArrayBufferToNormalizedRuns(ab, DEFAULT_TARGET_KPS, {
        filenameHint: path,
      })
      for (const run of fitRuns) {
        if (seenIds.has(run.external_id)) {
          duplicatesSkipped += 1
          continue
        }
        seenIds.add(run.external_id)
        allRuns.push(run)
      }
    } catch (e) {
      console.error('Parse error (FIT)', path, e)
      process.exit(1)
    }
  }

  return {
    allRuns,
    filesScanned,
    fitFilesScanned,
    activitiesParsed,
    duplicatesSkipped,
  }
}

async function importFromFitFile(fitPath: string): Promise<GarminNormalizedRun[]> {
  const buf = readFileSync(fitPath)
  const ab = toArrayBuffer(buf)
  return parseFitArrayBufferToNormalizedRuns(ab, DEFAULT_TARGET_KPS, { filenameHint: fitPath })
}

async function main() {
  const inputPath = process.argv[2] || join(process.cwd(), 'garmin.zip')
  const outPath = process.argv[3] || join(process.cwd(), 'garmin-runs.json')

  if (!existsSync(inputPath)) {
    console.error('File not found:', inputPath)
    process.exit(1)
  }

  if (isFitPath(inputPath)) {
    const runs = await importFromFitFile(inputPath)
    writeFileSync(outPath, JSON.stringify(runs, null, 2), 'utf8')
    console.log('Garmin import summary (.fit):')
    console.log('  Input file:              ', inputPath)
    console.log('  Runs written:            ', runs.length)
    console.log('  Output file:             ', outPath)
    return
  }

  const { allRuns, filesScanned, fitFilesScanned, activitiesParsed, duplicatesSkipped } =
    await importFromZip(inputPath)

  writeFileSync(outPath, JSON.stringify(allRuns, null, 2), 'utf8')

  console.log('Garmin import summary (ZIP):')
  console.log('  Summarized JSON files:   ', filesScanned)
  console.log('  FIT files in archive:    ', fitFilesScanned)
  console.log('  Activity rows (JSON):    ', activitiesParsed)
  console.log('  Duplicate IDs skipped: ', duplicatesSkipped)
  console.log('  Runs written:            ', allRuns.length)
  console.log('  Output file:             ', outPath)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
