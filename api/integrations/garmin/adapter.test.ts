import { describe, it, expect } from 'vitest';
import { GarminAdapter } from './adapter';

describe('GarminAdapter', () => {
  it('fetches mock recovery data', async () => {
    const data = await GarminAdapter.fetchLatestRecovery('test-user');
    expect(data).not.toBeNull();
    expect(data?.sleepScore).toBe(75);
    expect(data?.bodyBattery).toBe(65);
  });

  it('maps Garmin data to HumanStateSnapshot correctly', () => {
    const data = {
      sleepScore: 70,
      bodyBattery: 50,
      stressLevel: 25,
      hrv: 50.0,
      restingHeartRate: 55,
      vo2Max: 45,
      timestamp: new Date().toISOString(),
    };

    const snapshot = GarminAdapter.mapToSnapshot(data, 'test-profile');
    expect(snapshot.profile_id).toBe('test-profile');
    expect(snapshot.sleep_score).toBe(70);
    expect(snapshot.body_battery).toBe(50);
    expect(snapshot.source).toBe('garmin');
  });
});
