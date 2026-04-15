import { formatDistance, formatPace, formatTime } from '@kinetix/core'
import { X } from 'lucide-react'
import type { AIResult } from '../../hooks/useAICoach'
import { Dialog } from '../../components/a11y/Dialog'
import type { BeatTargetOption } from './types'

interface BeatTargetModalProps {
  isOpen: boolean
  title: string
  description: string
  accent: 'amber' | 'violet'
  error: string | null
  options: BeatTargetOption[] | null
  unitSystem: 'metric' | 'imperial'
  onClose: () => void
}

interface AICoachModalProps {
  isAnalyzing: boolean
  aiResult: AIResult | null
  error: string | null
  onClose: () => void
}

const ACCENT_STYLES = {
  amber: {
    border: 'border-amber-500/30',
    title: 'text-amber-400',
    value: 'text-amber-400',
    error: 'text-amber-300',
  },
  violet: {
    border: 'border-violet-500/30',
    title: 'text-violet-400',
    value: 'text-violet-400',
    error: 'text-violet-300',
  },
} as const

export function BeatTargetModal({
  isOpen,
  title,
  description,
  accent,
  error,
  options,
  unitSystem,
  onClose,
}: BeatTargetModalProps) {
  const styles = ACCENT_STYLES[accent]

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      ariaLabelledBy="beat-target-modal-title"
      ariaDescribedBy="beat-target-modal-desc"
    >
      <div className={`glass border ${styles.border} rounded-2xl p-6 w-full max-w-md shadow-2xl`}>
        <div className="flex justify-between items-center mb-3">
          <h3 id="beat-target-modal-title" className={`text-lg font-black ${styles.title}`}>
            {title}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-600 transition-colors hover:text-slate-900 dark:text-gray-400 dark:hover:text-white">
            <X size={20} />
          </button>
        </div>
        <p id="beat-target-modal-desc" className="text-sm text-slate-700 dark:text-gray-300 mb-4">
          {description}
        </p>
        {error ? (
          <p className={`text-sm ${styles.error} mb-4`} role="alert">
            {error}
          </p>
        ) : options ? (
          <ul className="space-y-2 mb-4">
            {options.map((opt) => {
              const paceSecPerKm = opt.distanceKm > 0 ? opt.timeSeconds / opt.distanceKm : 0
              return (
                <li key={opt.label} className="flex justify-between items-center gap-2 border-b border-slate-200/80 py-2 text-sm last:border-0 dark:border-gray-700/50">
                  <span className="text-slate-700 dark:text-gray-300">{opt.label}</span>
                  <span className="text-right">
                    <span className={`font-mono font-bold ${styles.value}`}>
                      {opt.type === 'time'
                        ? `${formatDistance(opt.distanceKm * 1000, unitSystem)} ${unitSystem === 'metric' ? 'km' : 'mi'} in ${opt.label}`
                        : `${formatDistance(opt.distanceKm * 1000, unitSystem)} ${unitSystem === 'metric' ? 'km' : 'mi'} in ${formatTime(opt.timeSeconds)}`}
                    </span>
                    <span className="ml-2 text-slate-600 dark:text-gray-400 font-mono text-xs">
                      {paceSecPerKm > 0 ? formatPace(paceSecPerKm, unitSystem) + (unitSystem === 'metric' ? '/km' : '/mi') : '—'}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-sm text-slate-600 dark:text-gray-400">Loading…</p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl border border-slate-300/80 bg-slate-100 py-2.5 text-sm font-bold text-slate-900 transition-all hover:bg-slate-200 dark:border-gray-700/50 dark:bg-gray-900/50 dark:text-white dark:hover:bg-gray-800"
        >
          Close
        </button>
      </div>
    </Dialog>
  )
}

export function AICoachModal({ isAnalyzing, aiResult, error, onClose }: AICoachModalProps) {
  const isOpen = Boolean(isAnalyzing || aiResult || error)

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      ariaLabelledBy="ai-coach-modal-title"
      closeOnEscape={!isAnalyzing}
      ariaBusy={isAnalyzing}
    >
      <div className="glass border border-cyan-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        {isAnalyzing ? (
          <div className="text-center" aria-live="polite">
            <div id="ai-coach-modal-title" className="animate-pulse text-cyan-400 font-mono text-sm mb-2">
              ANALYZING...
            </div>
            <div className="text-xs text-slate-600 dark:text-gray-400">Using AI to analyze your run</div>
          </div>
        ) : error ? (
          <div>
            <h3 id="ai-coach-modal-title" className="text-lg font-black text-red-400 mb-3">
              Error
            </h3>
            <p className="text-sm text-slate-700 dark:text-gray-300 mb-4" role="alert">
              {error}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl border border-slate-300/80 bg-slate-100 py-2.5 text-sm font-bold text-slate-900 transition-all hover:bg-slate-200 dark:border-gray-700/50 dark:bg-gray-900/50 dark:text-white dark:hover:bg-gray-800"
            >
              Close
            </button>
          </div>
        ) : aiResult ? (
          <div>
            <div className="flex justify-between items-start mb-3">
              <h3 id="ai-coach-modal-title" className="text-lg font-black text-cyan-400">
                {aiResult.title}
              </h3>
              <button type="button" onClick={onClose} aria-label="Close" className="text-slate-600 transition-colors hover:text-slate-900 dark:text-gray-400 dark:hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent my-3" />
            <p className="text-sm text-slate-800 dark:text-gray-200 mb-5 leading-relaxed">{aiResult.insight}</p>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl border border-slate-300/80 bg-slate-100 py-2.5 text-sm font-bold text-slate-900 transition-all hover:bg-slate-200 dark:border-gray-700/50 dark:bg-gray-900/50 dark:text-white dark:hover:bg-gray-800"
            >
              Close
            </button>
          </div>
        ) : null}
      </div>
    </Dialog>
  )
}
