import React, { useMemo, useState } from 'react';
import { listSimScenarios } from '../../api/ops/controlplane/sim/scenarios';
import { previewSimulation } from '../../api/ops/controlplane/sim/preview';
import { runSimulation } from '../../api/ops/controlplane/sim/run';
import type { SimulationScenarioName } from '../../ops/sim/types';

export function SimulationPanel() {
  const scenarios = useMemo(() => listSimScenarios(), []);
  const [selected, setSelected] = useState<SimulationScenarioName>('healthy');
  const [preview, setPreview] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handlePreview = () => {
    const res = previewSimulation(selected);
    setPreview(res);
  };

  const handleRun = async () => {
    setLoading(true);
    const res = await runSimulation({ scenario: selected });
    setResult(res);
    setLoading(false);
  };

  return (
    <div className="bg-gray-900 text-white p-4 rounded-lg space-y-3 border border-gray-800">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Simulation / Chaos</h2>
          <p className="text-sm text-gray-400">Preview OpsAI reactions to common failure modes</p>
        </div>
        <span className="px-2 py-1 text-xs rounded-full bg-amber-700">Safety</span>
      </div>
      <div className="flex items-center space-x-2">
        <select
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
          value={selected}
          onChange={(e) => setSelected(e.target.value as SimulationScenarioName)}
        >
          {scenarios.map((scenario) => (
            <option key={scenario.name} value={scenario.name}>
              {scenario.name} — {scenario.description}
            </option>
          ))}
        </select>
        <button type="button" onClick={handlePreview} className="px-2 py-1 bg-blue-600 rounded text-sm">
          Preview
        </button>
        <button
          type="button"
          onClick={handleRun}
          disabled={loading}
          className="px-2 py-1 bg-emerald-600 rounded text-sm"
        >
          {loading ? 'Running…' : 'Run scenario'}
        </button>
      </div>
      {preview && (
        <div className="border border-gray-800 rounded p-2 text-sm">
          <h3 className="font-semibold">Previewed state</h3>
          <p className="text-gray-400">Health: {preview.state.health.status}</p>
          <p className="text-gray-400">Metrics: latency p99 {preview.state.metrics.latencyP99}ms</p>
          <p className="text-gray-400">Incidents: {preview.state.incidents.length}</p>
          <h4 className="font-semibold mt-2">Autonomous responses</h4>
          <ul className="space-y-1">
            {preview.actions.map((action: any) => (
              <li key={action.id} className="text-gray-300">{action.reason}</li>
            ))}
            {preview.actions.length === 0 && <li className="text-gray-500">No actions proposed</li>}
          </ul>
        </div>
      )}
      {result && (
        <div className="border border-gray-800 rounded p-2 text-sm">
          <h3 className="font-semibold">Executed scenario</h3>
          <p className="text-gray-400">Health: {result.state.health.status}</p>
          <p className="text-gray-400">Actions executed: {result.actions?.length ?? 0}</p>
        </div>
      )}
    </div>
  );
}
