import { RunRecord } from '../lib/database'
import { KPS_SHORT } from '../lib/branding'
import { formatTime, formatDistance, formatPace } from '@kinetix/core'
import { useSettingsStore } from '../store/settingsStore'
import { MapPin, TrendingUp, Heart, Activity, Zap, Scale, Trophy } from 'lucide-react'

const KG_TO_LBS = 2.20462

interface RunDetailsProps {
  run: RunRecord
  relativeKPS: number
  unitSystem: 'metric' | 'imperial'
  /** Weight-at-date from history (Withings) when available; else falls back to `run.weightKg` */
  displayWeightKg?: number | null
  /** This run is the current all-time best / PB anchor (shows as relative 100). */
  isReferenceRun?: boolean
}

export function RunDetails({
  run,
  relativeKPS,
  unitSystem,
  displayWeightKg,
  isReferenceRun,
}: RunDetailsProps) {
  const weightUnit = useSettingsStore((s) => s.weightUnit)
  const hasSplits = run.splits && run.splits.length > 0
  const hasLocations = run.locations && run.locations.length > 0
  const hasHeartRate = run.heartRate !== undefined

  // Calculate heart rate zones (simplified)
  const getHRZone = (hr: number) => {
    // Assuming max HR = 220 - age (simplified, would use user's actual max HR)
    const maxHR = 190 // placeholder
    const percentage = (hr / maxHR) * 100
    if (percentage < 60) return { zone: 'Recovery', color: 'text-blue-400' }
    if (percentage < 70) return { zone: 'Aerobic', color: 'text-green-400' }
    if (percentage < 80) return { zone: 'Tempo', color: 'text-yellow-400' }
    if (percentage < 90) return { zone: 'Threshold', color: 'text-orange-400' }
    return { zone: 'VO2 Max', color: 'text-red-400' }
  }

  const hrZone = hasHeartRate && run.heartRate ? getHRZone(run.heartRate) : null
  const weightKgForDisplay = displayWeightKg ?? run.weightKg

  // Calculate elevation if we have location data
  const elevationGain = hasLocations ? 0 : undefined // Placeholder - would calculate from lat/lon

  return (
    <div className="mt-4 pt-4 border-t border-gray-700 space-y-4">

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-lg p-3">
          <div className="flex items-center gap-1 mb-1">
            <Zap size={12} className="text-purple-400" />
            <span className="text-xs text-gray-400 uppercase">Relative {KPS_SHORT}</span>
          </div>
          <div className="text-xl font-black text-purple-400">
            {Math.round(relativeKPS)}
          </div>
        </div>

        {weightKgForDisplay != null && weightKgForDisplay > 0 && (
          <div className="glass rounded-lg p-3">
            <div className="flex items-center gap-1 mb-1">
              <Scale size={12} className="text-cyan-400" />
              <span className="text-xs text-gray-400 uppercase">Weight used</span>
            </div>
            <div className="text-xl font-black text-cyan-400">
              {weightUnit === 'lbs'
                ? (weightKgForDisplay * KG_TO_LBS).toFixed(1)
                : weightKgForDisplay.toFixed(1)}{' '}
              {weightUnit}
            </div>
          </div>
        )}
        
        {hasHeartRate && (
          <div className="glass rounded-lg p-3">
            <div className="flex items-center gap-1 mb-1">
              <Heart size={12} className="text-red-400" />
              <span className="text-xs text-gray-400 uppercase">Avg HR</span>
            </div>
            <div className={`text-xl font-black ${hrZone?.color || 'text-white'}`}>
              {Math.round(run.heartRate!)}
            </div>
            {hrZone && (
              <div className={`text-xs ${hrZone.color} mt-1`}>
                {hrZone.zone}
              </div>
            )}
          </div>
        )}

        {elevationGain !== undefined && (
          <div className="glass rounded-lg p-3">
            <div className="flex items-center gap-1 mb-1">
              <Activity size={12} className="text-orange-400" />
              <span className="text-xs text-gray-400 uppercase">Elevation</span>
            </div>
            <div className="text-xl font-black text-orange-400">
              +{Math.round(elevationGain)}m
            </div>
          </div>
        )}
      </div>

      {isReferenceRun && run.id && (
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-400">
            <Trophy size={16} className="flex-shrink-0" aria-hidden />
            This activity is your all-time best ({KPS_SHORT} 100). Other runs are scored relative to it.
          </p>
        </div>
      )}

      {/* Splits Table */}
      {hasSplits && (
        <div>
          <h4 className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1">
            <TrendingUp size={12} />
            Splits
          </h4>
          <div className="glass rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left p-2 text-gray-400 font-semibold">#</th>
                    <th className="text-right p-2 text-gray-400 font-semibold">Distance</th>
                    <th className="text-right p-2 text-gray-400 font-semibold">Time</th>
                    <th className="text-right p-2 text-gray-400 font-semibold">Pace</th>
                  </tr>
                </thead>
                <tbody>
                  {run.splits.map((split, index) => (
                    <tr key={index} className="border-b border-gray-800/50 hover:bg-gray-900/30">
                      <td className="p-2 text-gray-300">{index + 1}</td>
                      <td className="p-2 text-right text-gray-300">
                        {formatDistance(split.distance, unitSystem)} {unitSystem === 'metric' ? 'km' : 'mi'}
                      </td>
                      <td className="p-2 text-right text-gray-300">{formatTime(split.time)}</td>
                      <td className="p-2 text-right text-cyan-400 font-mono">
                        {formatPace(split.pace, unitSystem)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Location Info */}
      {hasLocations && (
        <div>
          <h4 className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1">
            <MapPin size={12} />
            Route Data
          </h4>
          <div className="glass rounded-lg p-3">
            <p className="text-xs text-gray-300">
              {run.locations.length} GPS points recorded
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Map visualization coming soon
            </p>
          </div>
        </div>
      )}

      {/* Notes */}
      {run.notes && (
        <div>
          <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Notes</h4>
          <div className="glass rounded-lg p-3">
            <p className="text-xs text-gray-300 italic">{run.notes}</p>
          </div>
        </div>
      )}
    </div>
  )
}
