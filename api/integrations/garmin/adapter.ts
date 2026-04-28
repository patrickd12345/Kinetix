export interface GarminFitRecord {
  timestamp: string;
  heartRate?: number;
  cadence?: number;
  pace?: number;
  distance?: number;
}

export interface GarminHealthSnapshot {
  sleepScore?: number;
  bodyBattery?: number;
  stress?: number;
  hrv?: number;
  vo2Max?: number;
}

/**
 * Maps incoming Garmin Webhook / FIT parsed data to Kinetix's canonical
 * snapshot state format.
 */
export function mapGarminTelemetry(snapshot: GarminHealthSnapshot) {
  // Canonical mapping logic for the Recovery Gate
  return {
    sleepScore: snapshot.sleepScore ?? null,
    bodyBattery: snapshot.bodyBattery ?? null,
    stressLevel: snapshot.stress ?? null,
    hrv: snapshot.hrv ?? null,
    vo2Max: snapshot.vo2Max ?? null,
    source: 'garmin',
  };
}
