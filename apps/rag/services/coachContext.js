/**
 * Coach context: retrieval + pace-to-beat from PB KPS
 * Used by POST /coach-context so the agent gets run data from RAG.
 */

import { EmbeddingService } from './embeddingService.js';
import { vectorDB } from './vectorDB.js';

const REF_DISTANCE_KM = 10.0;
const Riegel = 1.06;
const runtimeConsole = globalThis.console ?? console;

function ageAdjustment(age) {
  const peakAge = 27.5;
  if (age <= peakAge) return 1.0;
  return 1.0 + (age - peakAge) * 0.007;
}

function weightAdjustment(weightKg) {
  const ref = 70.0;
  return 1.0 - (weightKg - ref) * 0.004;
}

/**
 * KPS from distance (m), time (s), profile. Matches @kinetix/core formula.
 */
function calculateKPS(distanceM, timeSeconds, profile) {
  const distanceKm = distanceM / 1000;
  if (distanceKm <= 0 || timeSeconds <= 0) return 0;
  const normalizedTime = timeSeconds * Math.pow(REF_DISTANCE_KM / distanceKm, Riegel);
  const ageAdj = ageAdjustment(profile.age);
  const weightAdj = weightAdjustment(profile.weightKg);
  const normalizedPace = normalizedTime / REF_DISTANCE_KM;
  const adjustedPace = normalizedPace * ageAdj * weightAdj;
  if (adjustedPace <= 0) return 0;
  return (3600 / adjustedPace) * 10;
}

/**
 * Time (seconds) needed to achieve targetKPS at distanceKm. Binary search.
 */
function timeSecondsToMatchKPS(distanceKm, targetKPS, profile) {
  if (targetKPS <= 0 || distanceKm <= 0) return null;
  const distanceM = distanceKm * 1000;
  let low = 60;
  let high = 24 * 3600;
  for (let i = 0; i < 80; i++) {
    const mid = (low + high) / 2;
    const kps = calculateKPS(distanceM, mid, profile);
    if (Math.abs(kps - targetKPS) < 0.5) return mid;
    if (kps < targetKPS) high = mid;
    else low = mid;
  }
  return (low + high) / 2;
}

function formatPace(secondsPerKm) {
  const min = Math.floor(secondsPerKm / 60);
  const sec = Math.floor(secondsPerKm % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

/**
 * Build pace-to-beat line for 5K and 10K from PB run and profile.
 * pbRun: { distance (m), duration (s), averagePace (s/km), kps? }; profile: { age, weightKg }.
 */
function buildPaceToBeat(pbRun, profile) {
  if (!pbRun || !profile || !pbRun.distance || !pbRun.duration) {
    return 'No PB set. Do not invent NPI or pace from the user\'s runs.';
  }
  const pbKPS = pbRun.avgKPS ?? pbRun.kps ?? calculateKPS(pbRun.distance, pbRun.duration, profile);
  if (!pbKPS || pbKPS <= 0) {
    return 'No PB set. Do not invent NPI or pace from the user\'s runs.';
  }
  const t5 = timeSecondsToMatchKPS(5, pbKPS, profile);
  const t10 = timeSecondsToMatchKPS(10, pbKPS, profile);
  if (t5 == null || t10 == null) {
    return 'No PB set. Do not invent NPI or pace from the user\'s runs.';
  }
  const pace5 = t5 / 5;
  const pace10 = t10 / 10;
  return `Pace to beat your current best (PB): 5K under ${formatPace(pace5)}/km, 10K under ${formatPace(pace10)}/km. Use these numbers when the user asks about pacing or beating their KPS.`;
}

/**
 * Format retrieved runs into a short summary for context.
 */
function formatRunsSummary(runs) {
  if (!runs || runs.length === 0) {
    return 'No runs in RAG index.';
  }
  const lines = runs.slice(0, 10).map((r, i) => {
    const m = r.metadata || r;
    const distKm = (m.distance / 1000).toFixed(2);
    const pace = m.pace != null ? formatPace(m.pace) : '?';
    const kps = m.kps ?? m.avgKPS ?? m.npi ?? '?';
    const date = m.date ? new Date(m.date).toLocaleDateString() : '?';
    return `${i + 1}. ${distKm}km, KPS ${kps}, pace ${pace}/km, ${date}`;
  });
  return 'Relevant runs from history:\n' + lines.join('\n');
}

/**
 * Get coach context for a user message: retrieval + pace-to-beat.
 * message: string; userProfile: { age, weightKg }?; pbRun: { distance, duration, avgPace?, avgKPS?, kps? }?.
 * Returns { context: string }.
 */
export async function getCoachContext(message, userProfile, pbRun) {
  const parts = [];

  try {
    const embedding = await EmbeddingService.embedText(message || 'running pace');
    const { runs } = await vectorDB.findSimilarRuns(embedding, { topK: 10 });
    runtimeConsole.info('[RAG]', { retrieved: runs.length });
    parts.push(formatRunsSummary(runs));
  } catch (err) {
    runtimeConsole.warn('Coach context retrieval failed:', err.message);
    parts.push('No runs in RAG index (or retrieval failed).');
  }

  if (userProfile && pbRun) {
    parts.push(buildPaceToBeat(pbRun, userProfile));
  } else {
    parts.push('No PB set. Do not invent NPI or pace from the user\'s runs.');
  }

  return {
    context: parts.join('\n\n'),
  };
}
