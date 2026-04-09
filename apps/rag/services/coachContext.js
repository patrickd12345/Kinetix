/**
 * Coach context: retrieval + pace-to-beat from PB KPS.
 * Used by POST /coach-context so the agent gets both readable context and
 * structured verified facts from the same deterministic source.
 */

import { EmbeddingService } from './embeddingService.js';
import { vectorDB } from './vectorDB.js';

const REF_DISTANCE_KM = 10.0;
const RIEGEL = 1.06;
const KM_PER_MILE = 1.609344;
const runtimeConsole = globalThis.console ?? console;
const COACH_ALLOWED_OUTPUT_MODES = [
  'explanation',
  'comparison',
  'coaching_summary',
  'motivation',
  'insufficient_data',
  'verified_math',
];
const COACH_FORBIDDEN_OPERATIONS = [
  'invent_numbers',
  'introduce_new_numeric_value',
  'derive_new_numeric_target',
  'modify_verified_values',
  'infer_missing_inputs',
  'medical_diagnosis',
  'unsupported_prediction',
  'future_performance_prediction',
  'physiological_claim',
  'injury_prediction',
  'training_effect_prediction',
  'performance_ranking_claim',
  'trend_claim',
  'improvement_claim',
  'regression_claim',
];

function normalizeUnitSystem(value) {
  return value === 'imperial' ? 'imperial' : 'metric';
}

function ageAdjustment(age) {
  const peakAge = 27.5;
  if (age <= peakAge) return 1.0;
  return 1.0 + (age - peakAge) * 0.007;
}

function weightAdjustment(weightKg) {
  const ref = 70.0;
  return 1.0 - (weightKg - ref) * 0.004;
}

function calculateKPS(distanceM, timeSeconds, profile) {
  const distanceKm = distanceM / 1000;
  if (distanceKm <= 0 || timeSeconds <= 0) return 0;
  const normalizedTime = timeSeconds * Math.pow(REF_DISTANCE_KM / distanceKm, RIEGEL);
  const ageAdj = ageAdjustment(profile.age);
  const weightAdj = weightAdjustment(profile.weightKg);
  const normalizedPace = normalizedTime / REF_DISTANCE_KM;
  const adjustedPace = normalizedPace * ageAdj * weightAdj;
  if (adjustedPace <= 0) return 0;
  return (3600 / adjustedPace) * 10;
}

function timeSecondsToMatchKPS(distanceKm, targetKPS, profile) {
  if (targetKPS <= 0 || distanceKm <= 0) return null;
  const distanceM = distanceKm * 1000;
  let low = 60;
  let high = 24 * 3600;
  for (let i = 0; i < 80; i += 1) {
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

function formatPaceWithUnit(secPerKm, unitSystem) {
  if (secPerKm == null || Number.isNaN(secPerKm)) return '?';
  if (unitSystem === 'imperial') {
    const secPerMi = secPerKm * KM_PER_MILE;
    return `${formatPace(secPerMi)}/mi`;
  }
  return `${formatPace(secPerKm)}/km`;
}

function formatDistanceWithUnit(meters, unitSystem) {
  const value = Number(meters) || 0;
  if (unitSystem === 'imperial') {
    const mi = value / 1609.344;
    return `${mi.toFixed(2)} mi`;
  }
  return `${(value / 1000).toFixed(2)} km`;
}

function buildPaceToBeatFacts(pbRun, profile, unitSystem) {
  const units = normalizeUnitSystem(unitSystem);
  if (!pbRun || !profile || !pbRun.distance || !pbRun.duration) {
    return null;
  }
  const pbKps = pbRun.avgKPS ?? pbRun.kps ?? calculateKPS(pbRun.distance, pbRun.duration, profile);
  if (!pbKps || pbKps <= 0) {
    return null;
  }
  const t5 = timeSecondsToMatchKPS(5, pbKps, profile);
  const t10 = timeSecondsToMatchKPS(10, pbKps, profile);
  if (t5 == null || t10 == null) {
    return null;
  }
  const pace5 = t5 / 5;
  const pace10 = t10 / 10;
  return {
    sourceKps: Number(pbKps.toFixed(2)),
    fiveKSecondsPerKm: Number(pace5.toFixed(2)),
    tenKSecondsPerKm: Number(pace10.toFixed(2)),
    fiveKDisplay: formatPaceWithUnit(pace5, units),
    tenKDisplay: formatPaceWithUnit(pace10, units),
  };
}

function buildPaceToBeatLine(pbFacts, unitSystem) {
  const units = normalizeUnitSystem(unitSystem);
  if (!pbFacts) {
    return 'No PB set. Do not invent NPI or pace from the user\'s runs.';
  }
  return `Pace to beat your current best (PB): 5K under ${pbFacts.fiveKDisplay}, 10K under ${pbFacts.tenKDisplay}. Use these when the user asks about pacing or beating their KPS. All paces above use the runner's app units (${units === 'imperial' ? 'min/mi' : 'min/km'}).`;
}

function buildRetrievedRunFacts(runs, unitSystem) {
  const units = normalizeUnitSystem(unitSystem);
  return (runs || []).slice(0, 5).map((run, index) => {
    const metadata = run.metadata || run;
    const paceSecondsPerKm =
      metadata.pace != null && Number(metadata.pace) > 0
        ? Number(Number(metadata.pace).toFixed(2))
        : null;
    const kpsRaw = metadata.kps ?? metadata.avgKPS ?? metadata.npi;
    const cadenceRaw = metadata.cadence ?? metadata.avgCadence ?? null;
    const songBpmRaw = metadata.songBpm ?? metadata.song_bpm ?? null;
    return {
      id: String(metadata.id ?? `retrieved-run-${index + 1}`),
      date: typeof metadata.date === 'string' ? metadata.date : null,
      distanceMeters: Number(metadata.distance) || 0,
      distanceDisplay: formatDistanceWithUnit(metadata.distance, units),
      paceSecondsPerKm,
      paceDisplay: paceSecondsPerKm != null ? formatPaceWithUnit(paceSecondsPerKm, units) : null,
      kps:
        typeof kpsRaw === 'number' && Number.isFinite(kpsRaw)
          ? Number(kpsRaw.toFixed(2))
          : null,
      cadenceSpm:
        typeof cadenceRaw === 'number' && Number.isFinite(cadenceRaw)
          ? Math.round(cadenceRaw)
          : null,
      songBpm:
        typeof songBpmRaw === 'number' && Number.isFinite(songBpmRaw)
          ? Math.round(songBpmRaw)
          : null,
    };
  });
}

function pushProvenance(list, kind, source, path) {
  list.push(path ? { kind, source, path } : { kind, source });
}

function buildCoachGuardrailContract(retrievedRunFacts, pbFacts, unitSystem) {
  const provenance = [];
  const verifiedFacts = {
    unitSystem: normalizeUnitSystem(unitSystem),
    dataAvailability: {
      hasRetrievedRuns: retrievedRunFacts.length > 0,
      hasPbTargets: !!pbFacts,
    },
    retrievedRunCount: retrievedRunFacts.length,
    retrievedRuns: retrievedRunFacts,
    pbPaceToBeat: pbFacts,
  };

  pushProvenance(provenance, 'verified_fact', 'coach-context', 'verifiedFacts.unitSystem');
  pushProvenance(provenance, 'verified_fact', 'coach-context', 'verifiedFacts.dataAvailability');
  pushProvenance(
    provenance,
    'retrieved_context',
    'coach-context:retrieved-runs',
    'verifiedFacts.retrievedRunCount',
  );
  pushProvenance(
    provenance,
    'retrieved_context',
    'coach-context:retrieved-runs',
    'verifiedFacts.retrievedRuns',
  );
  if (pbFacts) {
    pushProvenance(
      provenance,
      'verified_fact',
      'coach-context:pb-pace-to-beat',
      'verifiedFacts.pbPaceToBeat',
    );
  }

  return {
    verifiedFacts,
    userStatedFacts: {},
    allowedOutputModes: COACH_ALLOWED_OUTPUT_MODES,
    forbiddenOperations: COACH_FORBIDDEN_OPERATIONS,
    provenance,
  };
}

function formatRunsSummary(runs, unitSystem) {
  const units = normalizeUnitSystem(unitSystem);
  if (!runs || runs.length === 0) {
    return 'No runs in RAG index.';
  }
  const lines = runs.slice(0, 10).map((run, index) => {
    const metadata = run.metadata || run;
    const dist = formatDistanceWithUnit(metadata.distance, units);
    const pace =
      metadata.pace != null && metadata.pace > 0
        ? formatPaceWithUnit(Number(metadata.pace), units)
        : '?';
    const kps = metadata.kps ?? metadata.avgKPS ?? metadata.npi ?? '?';
    const date = metadata.date ? new Date(metadata.date).toLocaleDateString() : '?';
    const songBpm = metadata.songBpm ?? metadata.song_bpm;
    const songExtra =
      songBpm != null && songBpm > 0
        ? `, music ${metadata.songLabel ? `${metadata.songLabel} ` : ''}~${Math.floor(songBpm)} BPM`
        : '';
    const cadence = metadata.cadence != null ? `, cadence ${Math.floor(metadata.cadence)} spm` : '';
    return `${index + 1}. ${dist}, KPS ${kps}, pace ${pace}${cadence}${songExtra}, ${date}`;
  });
  const unitNote =
    units === 'imperial'
      ? ' (distances in mi, pace in min/mi)'
      : ' (distances in km, pace in min/km)';
  return `Relevant runs from history${unitNote}:\n${lines.join('\n')}`;
}

export async function getCoachContext(message, userProfile, pbRun, unitSystem = 'metric') {
  const units = normalizeUnitSystem(unitSystem);
  const parts = [];
  let retrievedRuns = [];

  try {
    const embedding = await EmbeddingService.embedText(message || 'running pace');
    const { runs } = await vectorDB.findSimilarRuns(embedding, { topK: 10 });
    runtimeConsole.info('Coach context retrieval:', { retrieved: runs.length });
    retrievedRuns = runs;
    parts.push(formatRunsSummary(runs, units));
  } catch (err) {
    runtimeConsole.warn('Coach context retrieval failed:', err.message);
    parts.push('No runs in RAG index (or retrieval failed).');
  }

  const pbFacts = userProfile && pbRun ? buildPaceToBeatFacts(pbRun, userProfile, units) : null;
  parts.push(buildPaceToBeatLine(pbFacts, units));

  const retrievedRunFacts = buildRetrievedRunFacts(retrievedRuns, units);

  return {
    context: parts.join('\n\n'),
    contract: buildCoachGuardrailContract(retrievedRunFacts, pbFacts, units),
  };
}
