import { useMemo, useState, useCallback } from 'react'
import { KINETIX_PERFORMANCE_SCORE, KPS_SHORT } from '../lib/branding'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Dot, Brush } from 'recharts'
import { formatTime, formatDistance } from '@kinetix/core'
import { RunRecord } from '../lib/database'
import { useSettingsStore } from '../store/settingsStore'
import { capDisplayRelativeKps, MAX_DISPLAY_RELATIVE_KPS } from '../lib/kpsDisplayPolicy'

const KG_TO_LBS = 2.20462
/** KPS is 0–100 scale (PB = 100). */
const KPS_DOMAIN: [number, number] = [0, MAX_DISPLAY_RELATIVE_KPS]

interface KPSTrendData {
  runId?: number
  date: string
  dateFormatted: string
  kps: number
  isPB: boolean
  distance: number
  duration: number
  /** Weight (kg) used for this run's KPS calculation. */
  weightKg?: number
}

interface KPSTrendChartProps {
  runs: RunRecord[]
  relativeKPSMap: Map<number, number>
  unitSystem: 'metric' | 'imperial'
  /** Overall PB run id; only this run gets the green dot (KPS = 100). */
  pbRunId?: number | null
  /** Reference (PB) run date YYYY-MM-DD; when set, legend shows "Reference: <date>" even if PB is outside chart range. */
  referenceRunDateKey?: string | null
  /** Formatted reference run date for legend (e.g. "Jan 15, 2024"). */
  referenceRunDateFormatted?: string | null
  /** When set, wheel zoom changes history range (zoom out = more history) instead of brush. */
  onWheelZoomIn?: () => void
  onWheelZoomOut?: () => void
  /** Called when user clicks the reference run date in the legend; dateKey is YYYY-MM-DD. */
  onScrollToReferenceRun?: (dateKey: string) => void
}

export function KPSTrendChart({
  runs,
  relativeKPSMap,
  unitSystem,
  pbRunId = null,
  referenceRunDateKey: referenceRunDateKeyProp = null,
  referenceRunDateFormatted: referenceRunDateFormattedProp = null,
  onWheelZoomIn,
  onWheelZoomOut,
  onScrollToReferenceRun,
}: KPSTrendChartProps) {
  const weightUnit = useSettingsStore((s) => s.weightUnit)
  const chartData = useMemo<KPSTrendData[]>(() => {
    if (runs.length === 0) return []

    const sortedRuns = [...runs].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    return sortedRuns.map((run) => {
      const raw = run.id ? (relativeKPSMap.get(run.id) ?? 0) : 0
      const kps = Number.isFinite(raw) && typeof raw === 'number' ? capDisplayRelativeKps(raw) : 0
      return {
        runId: run.id,
        date: run.date,
        dateFormatted: new Date(run.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        }),
        kps,
        isPB: run.id != null && run.id === pbRunId,
        distance: run.distance,
        duration: run.duration,
        weightKg: run.weightKg,
      }
    })
  }, [runs, relativeKPSMap, pbRunId])

  const [range, setRange] = useState<{ startIndex: number; endIndex: number } | null>(null)
  const onBrushChange = useCallback((next: { startIndex?: number; endIndex?: number }) => {
    if (next.startIndex != null && next.endIndex != null) {
      setRange({ startIndex: next.startIndex, endIndex: next.endIndex })
    }
  }, [])

  const brushStartIndex = range?.startIndex ?? 0
  const brushEndIndex = range?.endIndex ?? Math.max(0, chartData.length - 1)

  const pbVisibleInRange = useMemo(() => {
    return chartData.some(
      (d, i) => i >= brushStartIndex && i <= brushEndIndex && d.isPB
    )
  }, [chartData, brushStartIndex, brushEndIndex])

  const referenceRunEntry = useMemo(
    () => chartData.find((d) => d.isPB),
    [chartData]
  )
  const referenceRunDateKey = referenceRunEntry?.date?.split('T')[0] ?? referenceRunDateKeyProp
  const referenceRunDateFormatted = referenceRunEntry?.dateFormatted ?? referenceRunDateFormattedProp

  const handleWheelZoom = useCallback(
    (e: React.WheelEvent) => {
      if (onWheelZoomIn && onWheelZoomOut) {
        if (e.deltaY > 0) onWheelZoomOut()
        else onWheelZoomIn()
        e.preventDefault()
        return
      }
      const span = brushEndIndex - brushStartIndex + 1
      const minSpan = 2
      const maxSpan = chartData.length
      if (maxSpan <= minSpan) return
      const center = (brushStartIndex + brushEndIndex) / 2
      const zoomFactor = e.deltaY > 0 ? 1.15 : 1 / 1.15
      let newSpan = Math.round(span * zoomFactor)
      newSpan = Math.max(minSpan, Math.min(maxSpan, newSpan))
      const half = (newSpan - 1) / 2
      let newStart = Math.round(center - half)
      let newEnd = Math.round(center + half)
      if (newStart < 0) {
        newEnd -= newStart
        newStart = 0
      }
      if (newEnd >= chartData.length) {
        newStart -= newEnd - (chartData.length - 1)
        newEnd = chartData.length - 1
      }
      newStart = Math.max(0, newStart)
      newEnd = Math.min(chartData.length - 1, newEnd)
      if (newEnd - newStart + 1 < minSpan) return
      setRange({ startIndex: newStart, endIndex: newEnd })
      e.preventDefault()
    },
    [chartData.length, brushStartIndex, brushEndIndex, onWheelZoomIn, onWheelZoomOut]
  )

  if (chartData.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <p className="text-slate-600 dark:text-gray-400">No data to display</p>
      </div>
    )
  }

  const CustomDot = ({ cx, cy, payload }: { cx?: number; cy?: number; payload?: KPSTrendData }) => {
    if (payload?.isPB) {
      return (
        <g>
          <circle cx={cx} cy={cy} r={6} fill="#10b981" stroke="#fff" strokeWidth={2} />
          <circle cx={cx} cy={cy} r={10} fill="#10b981" opacity={0.3} />
        </g>
      )
    }
    return <Dot cx={cx} cy={cy} r={3} fill="#22d3ee" />
  }

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: KPSTrendData }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="glass border border-cyan-500/30 rounded-lg p-3 shadow-xl">
          <p className="text-xs text-slate-600 dark:text-gray-400 mb-1">{data.dateFormatted}</p>
          <p className="text-lg font-black text-cyan-400 mb-1">
            {KPS_SHORT}: {Math.round(data.kps)}
            {data.isPB && <span className="ml-2 text-green-400">PB</span>}
          </p>
          <p className="text-xs text-slate-700 dark:text-gray-300">
            {formatDistance(data.distance, unitSystem)} {unitSystem === 'metric' ? 'km' : 'mi'} • {formatTime(data.duration)}
          </p>
          {data.weightKg != null && data.weightKg > 0 && (
            <p className="text-xs text-slate-600 dark:text-gray-400 mt-1">
              Weight used: {weightUnit === 'lbs' ? (data.weightKg * KG_TO_LBS).toFixed(1) : data.weightKg.toFixed(1)} {weightUnit}
            </p>
          )}
        </div>
      )
    }
    return null
  }

  return (
    <div className="glass rounded-2xl p-6 border border-cyan-500/20">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="mb-1 text-lg font-black text-slate-900 dark:text-white">{KINETIX_PERFORMANCE_SCORE} Trend</h3>
          <p className="text-xs text-slate-600 dark:text-gray-400">Your performance over time</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
            <span className="text-slate-600 dark:text-gray-400">{KPS_SHORT}</span>
          </div>
          {pbVisibleInRange && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-400"></div>
              <span className="text-slate-600 dark:text-gray-400">PB</span>
            </div>
          )}
          {referenceRunDateKey && referenceRunDateFormatted && onScrollToReferenceRun && (
            <span className="text-slate-600 dark:text-gray-400">
              Reference:{' '}
              <button
                type="button"
                onClick={() => onScrollToReferenceRun(referenceRunDateKey)}
                className="text-cyan-400 hover:text-cyan-300 underline underline-offset-1 transition-colors"
              >
                {referenceRunDateFormatted}
              </button>
            </span>
          )}
          <span className="text-slate-500 dark:text-gray-500">{onWheelZoomOut ? 'Scroll to zoom history' : 'Scroll to zoom'}</span>
        </div>
      </div>

      <div
        className="min-h-[340px]"
        onWheel={handleWheelZoom}
        role="application"
        aria-label="Chart: scroll to zoom"
      >
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="kpsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" opacity={0.3} />
          <XAxis
            dataKey="dateFormatted"
            stroke="#6b7280"
            fontSize={10}
            tick={{ fill: '#9ca3af' }}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke="#6b7280"
            fontSize={10}
            tick={{ fill: '#9ca3af' }}
            domain={KPS_DOMAIN}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={100} stroke="#10b981" strokeDasharray="2 2" opacity={0.5} />
          <Line
            type="monotone"
            dataKey="kps"
            stroke="#22d3ee"
            strokeWidth={2}
            dot={<CustomDot />}
            activeDot={{ r: 6, fill: '#22d3ee', stroke: '#fff', strokeWidth: 2 }}
            animationDuration={1000}
          />
          <Brush
            dataKey="dateFormatted"
            height={36}
            stroke="#22d3ee"
            fill="#1f2937"
            startIndex={brushStartIndex}
            endIndex={brushEndIndex}
            onChange={onBrushChange}
          />
        </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
