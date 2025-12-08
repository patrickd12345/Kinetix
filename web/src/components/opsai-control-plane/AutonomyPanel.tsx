import React, { useEffect, useState } from 'react';
import { autonomyStatus } from '../../api/ops/controlplane/autonomy/status';
import { autonomyRun } from '../../api/ops/controlplane/autonomy/run';
import type { AutonomousAction, AutonomyContext } from '../../ops/autonomy/types';
import { getOpsState } from '../../ops/api/state';

export function AutonomyPanel() {
  const [actions, setActions] = useState<AutonomousAction[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [level, setLevel] = useState('observing');
  const [loading, setLoading] = useState(false);

  const loadStatus = () => {
    const status = autonomyStatus(getOpsState() as unknown as AutonomyContext);
    setActions(status.lastActions);
    setEnabled(status.enabled);
    setLevel(status.level);
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleEvaluate = async () => {
    setLoading(true);
    const result = await autonomyRun(getOpsState() as unknown as AutonomyContext);
    setActions(result);
    setLoading(false);
  };

  return (
    <div className="bg-gray-900 text-white p-4 rounded-lg space-y-3 border border-gray-800">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Autonomy</h2>
          <p className="text-sm text-gray-400">Policy-gated autonomous actions</p>
        </div>
        <span className={`px-3 py-1 text-sm rounded-full ${enabled ? 'bg-emerald-600' : 'bg-gray-700'}`}>
          {enabled ? `Enabled (${level})` : 'Disabled'}
        </span>
      </div>
      <button
        type="button"
        onClick={handleEvaluate}
        disabled={loading}
        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-sm"
      >
        {loading ? 'Evaluating…' : 'Evaluate now'}
      </button>
      <div>
        <h3 className="font-semibold mb-2">Recent actions</h3>
        <ul className="space-y-2">
          {actions.map((action) => (
            <li key={action.id} className="border border-gray-800 rounded p-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{action.type}</span>
                <span className="text-gray-400">{action.status}</span>
              </div>
              <p className="text-gray-300">{action.reason}</p>
              {action.target && <p className="text-gray-400 text-xs">Target: {action.target}</p>}
            </li>
          ))}
          {actions.length === 0 && <p className="text-gray-500 text-sm">No actions yet.</p>}
        </ul>
      </div>
    </div>
  );
}
