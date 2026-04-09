import type { KinetixRaceSimulationViewModel } from '../hooks/useKinetixRaceSimulation'

interface KinetixRaceSimulationCardProps {
  loading: boolean
  error: string | null
  simulation: KinetixRaceSimulationViewModel
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function KinetixRaceSimulationCard({ loading, error, simulation }: KinetixRaceSimulationCardProps) {
  if (loading) {
    return (
      <section className="glass rounded-2xl p-5 border border-white/10" aria-live="polite">
        <p className="text-sm text-gray-400">Running race simulation…</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="glass rounded-2xl p-5 border border-red-500/30" aria-live="polite">
        <p className="text-sm text-red-300">Unable to run race simulation: {error}</p>
      </section>
    )
  }

  if (simulation.insufficientData) {
    return (
      <section className="glass rounded-2xl p-5 border border-white/10 space-y-2" aria-live="polite">
        <h3 className="text-lg font-black text-white">Race Simulation</h3>
        <p className="text-sm text-gray-400">
          Not enough prediction or intelligence data to simulate race pacing yet.
        </p>
        <p className="text-xs text-gray-500">
          Distance: {simulation.selectedDistanceLabel} ({simulation.isGoalDriven ? 'Goal-driven' : 'Fallback mode'})
        </p>
      </section>
    )
  }

  return (
    <section className="glass rounded-2xl p-5 border border-amber-500/20 space-y-4" aria-label="Kinetix race simulation">
      <header>
        <h3 className="text-lg font-black text-white">Race Simulation</h3>
        <p className="text-xs text-gray-400">
          Distance: {simulation.selectedDistanceLabel} · {simulation.isGoalDriven ? 'Goal-driven' : 'Fallback distance'}
        </p>
      </header>

      {simulation.caution && (
        <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
          Confidence is low. Treat this simulation conservatively.
        </div>
      )}

      <dl className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-gray-400">Projected finish</dt>
          <dd className="font-semibold text-white">{simulation.formattedFinishTime}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-gray-400">Fade risk</dt>
          <dd className="font-semibold text-white">{titleCase(simulation.fadeRisk ?? 'unknown')}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-gray-400">Confidence</dt>
          <dd className="font-semibold text-white">{simulation.confidenceLabel}</dd>
        </div>
      </dl>

      <p className="text-xs text-amber-200">{simulation.pacingRecommendation}</p>

      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">Splits</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-gray-400">
              <tr>
                <th className="py-1 pr-2 font-medium">Segment</th>
                <th className="py-1 pr-2 font-medium">Pace</th>
                <th className="py-1 font-medium">Cumulative</th>
              </tr>
            </thead>
            <tbody>
              {simulation.splits.map((split) => (
                <tr key={split.label} className="border-t border-white/10">
                  <td className="py-1.5 pr-2 text-gray-300">{split.label}</td>
                  <td className="py-1.5 pr-2 text-white">{split.paceFormatted}</td>
                  <td className="py-1.5 text-white">{split.cumulativeFormatted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
