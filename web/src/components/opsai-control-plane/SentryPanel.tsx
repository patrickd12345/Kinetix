import React from 'react';
import { getOpsState } from '../../ops/api/state';

export function SentryPanel() {
  const ops = getOpsState();
  const sentryIncidents = ops.incidents.filter((inc) => inc.source === 'sentry');
  const sentryDeploys = ops.deployments.filter((dep) => dep.source === 'sentry');

  return (
    <div className="bg-gray-900 text-white p-4 rounded-lg space-y-3 border border-gray-800">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Sentry Integration</h2>
          <p className="text-sm text-gray-400">Webhook sourced incidents, deploys, and performance</p>
        </div>
        <span className="px-2 py-1 text-xs rounded-full bg-purple-700">Webhooks</span>
      </div>
      <div>
        <h3 className="font-semibold">Incidents from Sentry</h3>
        <ul className="space-y-2 text-sm">
          {sentryIncidents.map((inc) => (
            <li key={inc.id} className="border border-gray-800 rounded p-2">
              <div className="flex justify-between">
                <span>{inc.title}</span>
                <span className="text-gray-400">{inc.severity}</span>
              </div>
              <p className="text-gray-400 text-xs">{inc.metadata?.project ?? 'external'}</p>
            </li>
          ))}
          {sentryIncidents.length === 0 && <p className="text-gray-500 text-sm">No Sentry incidents yet.</p>}
        </ul>
      </div>
      <div>
        <h3 className="font-semibold">Deployments</h3>
        <ul className="space-y-2 text-sm">
          {sentryDeploys.map((deploy) => (
            <li key={deploy.id} className="border border-gray-800 rounded p-2">
              <div className="flex justify-between">
                <span>{deploy.version}</span>
                <span className="text-gray-400">{deploy.environment}</span>
              </div>
              <p className="text-gray-400 text-xs">Status: {deploy.status}</p>
            </li>
          ))}
          {sentryDeploys.length === 0 && <p className="text-gray-500 text-sm">No Sentry deploys yet.</p>}
        </ul>
      </div>
    </div>
  );
}
