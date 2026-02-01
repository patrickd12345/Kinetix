import { memo } from 'react'
import { RunRecord } from '../lib/database'
import { formatTime, formatDistance, formatPace } from '@kinetix/core'
import { Trash2, Calendar, MapPin, Clock, TrendingUp, Sparkles } from 'lucide-react'

interface RunListItemProps {
  run: RunRecord
  unitSystem: 'metric' | 'imperial'
  onAnalyze: (run: RunRecord) => void
  onDelete: (id: number) => void
  isAnalyzing: boolean
}

// Memoized to prevent re-renders when parent state (like AI Coach modal) changes
export const RunListItem = memo(function RunListItem({
  run,
  unitSystem,
  onAnalyze,
  onDelete,
  isAnalyzing,
}: RunListItemProps) {
  return (
    <div className="glass rounded-xl p-4 hover:border-cyan-500/30 transition-all">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={14} className="text-gray-400" />
            <span className="text-sm font-semibold text-white">
              {new Date(run.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-1">
              <MapPin size={12} />
              {formatDistance(run.distance, unitSystem)} {unitSystem === 'metric' ? 'km' : 'mi'}
            </div>
            <div className="flex items-center gap-1">
              <Clock size={12} />
              {formatTime(run.duration)}
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp size={12} />
              {formatPace(run.averagePace, unitSystem)}
            </div>
          </div>
        </div>
        <div className="text-right ml-4">
          <div className="text-2xl font-black text-cyan-400">{Math.round(run.npi)}</div>
          <div className="text-xs text-gray-500 uppercase">NPI</div>
          <div className="flex gap-2 mt-2 justify-end">
            <button
              onClick={() => onAnalyze(run)}
              className="text-cyan-400 hover:text-cyan-300 transition-colors"
              disabled={isAnalyzing}
              title="Analyze with AI Coach"
            >
              <Sparkles size={14} />
            </button>
            <button
              onClick={() => run.id && onDelete(run.id)}
              className="text-red-400 hover:text-red-300 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
      {run.notes && (
        <div className="mt-2 text-xs text-gray-400 italic">{run.notes}</div>
      )}
    </div>
  )
})
