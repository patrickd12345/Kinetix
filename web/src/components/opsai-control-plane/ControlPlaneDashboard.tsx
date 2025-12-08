import React from 'react';
import { AutonomyPanel } from './AutonomyPanel';
import { SentryPanel } from './SentryPanel';
import { SimulationPanel } from './SimulationPanel';

export function ControlPlaneDashboard() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <AutonomyPanel />
      <SentryPanel />
      <SimulationPanel />
    </div>
  );
}
