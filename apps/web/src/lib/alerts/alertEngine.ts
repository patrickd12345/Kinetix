import { evaluateAlertRules } from './alertRules'
import type { CoachAlertsInputs, CoachAlertsResult } from './types'

export function computeCoachAlerts(inputs: CoachAlertsInputs): CoachAlertsResult {
  const alerts = evaluateAlertRules(inputs).slice(0, 3)
  return { alerts }
}
