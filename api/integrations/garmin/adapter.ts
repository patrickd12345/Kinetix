/**
 * Garmin Adapter Boundary (Proof-of-Concept)
 * KX-FEAT-006: Recovery-Aware Coaching Foundation
 */

export interface GarminRecoveryData {
  sleepScore?: number;
  bodyBattery?: number;
  stressLevel?: number;
  hrv?: number;
  restingHeartRate?: number;
  vo2Max?: number;
  timestamp: string;
}

/**
 * Proof-of-concept Garmin adapter.
 * The iPhone app must NOT talk directly to the MCP.
 * This adapter lives on the backend and represents the ingestion boundary.
 */
export class GarminAdapter {
  /**
   * Fetches the latest recovery data from the Garmin service.
   * Currently a mock implementation for V1.
   */
  static async fetchLatestRecovery(profileId: string): Promise<GarminRecoveryData | null> {
    // In a future phase, this will call the @nicolasvegam/garmin-connect-mcp service
    // or use a direct Garmin Connect integration.

    // Returning mock data for POC validation
    return {
      sleepScore: 75,
      bodyBattery: 65,
      stressLevel: 20,
      hrv: 55.5,
      restingHeartRate: 52,
      vo2Max: 48,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Maps Garmin data to our internal HumanStateSnapshot model.
   */
  static mapToSnapshot(data: GarminRecoveryData, profileId: string) {
    return {
      profile_id: profileId,
      source: 'garmin',
      captured_at: data.timestamp,
      sleep_score: data.sleepScore,
      body_battery: data.bodyBattery,
      stress_level: data.stressLevel,
      hrv: data.hrv,
      resting_hr: data.restingHeartRate,
      vo2max: data.vo2Max,
      raw_payload: data,
    };
  }
}
