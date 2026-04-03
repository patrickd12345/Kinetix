/**
 * RAG client: RunRecord → RAGRunShape mapping and downstream embedding text (song metadata).
 * BPM validity 40–240 is enforced in Postgres (see migration); web does not duplicate validation.
 */
import { describe, it, expect } from 'vitest'
import type { RunRecord } from './database'
import type { UserProfile } from '@kinetix/core'
import { runRecordToRAGRun } from './ragClient'
import { EmbeddingService } from '../../../rag/services/embeddingService.js'

const mockUserProfile: UserProfile = {
  age: 35,
  weightKg: 70,
}

const todayISO = new Date().toISOString().slice(0, 10)

function baseRun(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    date: `${todayISO}T10:00:00.000Z`,
    distance: 5000,
    duration: 1500,
    averagePace: 300,
    targetKPS: 120,
    locations: [],
    splits: [],
    ...overrides,
  }
}

describe('runRecordToRAGRun', () => {
  it('maps songTitle, songArtist, songBpm when present', () => {
    const run = baseRun({
      songTitle: 'Test Track',
      songArtist: 'Test Artist',
      songBpm: 160,
    })
    const rag = runRecordToRAGRun(run, mockUserProfile)
    expect(rag.songTitle).toBe('Test Track')
    expect(rag.songArtist).toBe('Test Artist')
    expect(rag.songBpm).toBe(160)
  })

  it('uses null for missing song fields (safe for JSON / RAG)', () => {
    const run = baseRun()
    const rag = runRecordToRAGRun(run, mockUserProfile)
    expect(rag.songTitle).toBeNull()
    expect(rag.songArtist).toBeNull()
    expect(rag.songBpm).toBeNull()
  })

  it('does not throw when song fields are undefined', () => {
    const run = baseRun({ songTitle: undefined, songArtist: undefined, songBpm: undefined })
    expect(() => runRecordToRAGRun(run, mockUserProfile)).not.toThrow()
    const rag = runRecordToRAGRun(run, mockUserProfile)
    expect(rag.songTitle).toBeNull()
    expect(rag.songArtist).toBeNull()
    expect(rag.songBpm).toBeNull()
  })
})

describe('RunRecord JSON round-trip', () => {
  it('preserves optional song fields through JSON serialization', () => {
    const run = baseRun({
      id: 42,
      songTitle: 'Round',
      songArtist: 'Trip',
      songBpm: 120,
    })
    const copy = JSON.parse(JSON.stringify(run)) as RunRecord
    expect(copy.songTitle).toBe('Round')
    expect(copy.songArtist).toBe('Trip')
    expect(copy.songBpm).toBe(120)
    const rag = runRecordToRAGRun(copy, mockUserProfile)
    expect(rag.songBpm).toBe(120)
  })
})

describe('EmbeddingService.formatRunAsText (RAG downstream)', () => {
  it('includes cadence, song metadata, and BPM/cadence ratio when merged into RAG shape', () => {
    const run = baseRun({
      songTitle: 'Energy',
      songArtist: 'Artist',
      songBpm: 160,
    })
    const rag = runRecordToRAGRun(run, mockUserProfile)
    const merged = {
      ...rag,
      avgCadence: 165,
    }
    const text = EmbeddingService.formatRunAsText(merged)
    expect(text).toContain('cadence 165 spm')
    expect(text).toContain('music ~160 BPM')
    expect(text).toContain('Artist — Energy')
    expect(text).toContain('music BPM to cadence ratio')
  })
})
