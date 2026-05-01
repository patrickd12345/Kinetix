import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors } from '../_lib/cors.js';
import { GarminAdapter } from '../integrations/garmin/adapter.js';
import { evaluateRecoveryCoaching } from '../_lib/coaching/recoveryLogic.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cors = applyCors(req, res, {
    methods: ['GET', 'OPTIONS'],
    headers: ['Content-Type', 'Authorization'],
  });

  if (!cors.allowed) {
    return res.status(403).json({ code: 'origin_not_allowed', message: 'Origin not allowed' });
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ code: 'method_not_allowed', message: 'Method not allowed' });
  }

  // In a real implementation, we would extract the profileId from the session/token
  const profileId = req.query.profileId as string || 'default-user';

  try {
    const recoveryData = await GarminAdapter.fetchLatestRecovery(profileId);

    if (!recoveryData) {
      return res.status(200).json({
        recovery: null,
        decision: evaluateRecoveryCoaching({}),
      });
    }

    const decision = evaluateRecoveryCoaching({
      sleepScore: recoveryData.sleepScore,
      bodyBattery: recoveryData.bodyBattery,
    });

    return res.status(200).json({
      recovery: recoveryData,
      decision: decision,
    });
  } catch (error) {
    console.error('Failed to fetch recovery status:', error);
    return res.status(500).json({
      code: 'recovery_fetch_failed',
      message: 'Failed to fetch recovery status.',
    });
  }
}
