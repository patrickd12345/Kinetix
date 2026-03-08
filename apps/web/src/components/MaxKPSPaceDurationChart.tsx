import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CartesianGrid,
  Dot,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts'
import { KPS_SHORT } from '../lib/branding'
import type { MaxKPSPaceDurationPoint } from '../lib/maxKpsPaceChart'

interface MaxKPSPaceDurationChartProps {
  points: MaxKPSPaceDurationPoint[]
  unitSystem: 'metric' | 'imperial'
}

function formatDurationTick(durationMinutes: number): string {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return '0m'
  const totalMinutes = Math.round(durationMinutes)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function formatPaceTick(paceSeconds: number): string {
  if (!Number.isFinite(paceSeconds) || paceSeconds <= 0) return '0:00'
  const minutes = Math.floor(paceSeconds / 60)
  const seconds = Math.round(paceSeconds % 60)
  if (seconds === 60) return `${minutes + 1}:00`
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export default function MaxKPSPaceDurationChart({
  points,
  unitSystem,
}: MaxKPSPaceDurationChartProps) {

  const [selectedPoint, setSelectedPoint] = useState<MaxKPSPaceDurationPoint | null>(null)
  const [selectedTooltipPosition, setSelectedTooltipPosition] = useState<{
    x: number
    y: number
  } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 500, height: 340 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const MIN_DELTA = 5
    const update = () => {
      const rect = el.getBoundingClientRect()
      const w = rect.width > 0 ? Math.round(rect.width) : el.offsetWidth || 500
      const h = rect.height > 0 ? Math.round(rect.height) : 340
      if (w > 0 && h > 0) {
        setDimensions((prev) => {
          if (Math.abs(prev.width - w) < MIN_DELTA && Math.abs(prev.height - h) < MIN_DELTA) return prev
          return { width: w, height: h }
        })
      }
    }
    const ro = new ResizeObserver(update)
    ro.observe(el)
    update()
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (points.length === 0) {
      setSelectedPoint(null)
      setSelectedTooltipPosition(null)
      return
    }

    setSelectedPoint((current) => {
      if (!current) return points[0]
      return (
        points.find((point) => point.bucketStartSeconds === current.bucketStartSeconds) ??
        points[0]
      )
    })
  }, [points])

  const paceUnitLabel = unitSystem === 'metric' ? 'min/km' : 'min/mi'

  // Reasonable pace bounds (2:00–15:00 min/km or 3:13–24:08 min/mi) to avoid absurd Y-axis labels from bad data
  const PACE_MIN = unitSystem === 'metric' ? 120 : 193
  const PACE_MAX = unitSystem === 'metric' ? 900 : 1450

  const validPaces = points
    .map((p) => p.paceSeconds)
    .filter((v) => Number.isFinite(v) && v > 0)
  const rawMin = validPaces.length > 0 ? Math.min(...validPaces) : PACE_MIN
  const rawMax = validPaces.length > 0 ? Math.max(...validPaces) : PACE_MAX
  const chartMinPace = Math.max(PACE_MIN, Math.min(rawMin, PACE_MAX))
  const chartMaxPace = Math.min(PACE_MAX, Math.max(rawMax, PACE_MIN))
  const pacePadding = Math.max(20, Math.max(60, chartMaxPace - chartMinPace) * 0.2)
  const yDomain: [number, number] = [
    Math.max(PACE_MIN, chartMinPace - pacePadding),
    Math.min(PACE_MAX, chartMaxPace + pacePadding),
  ]

  const ClickableDot = useCallback(({
    cx,
    cy,
    payload,
  }: {
    cx?: number
    cy?: number
    payload?: MaxKPSPaceDurationPoint
  }) => {
    if (cx == null || cy == null || !payload) return null
    const isSelected = selectedPoint?.bucketStartSeconds === payload.bucketStartSeconds

    return (
      <g
        onClick={(event) => {
          event.stopPropagation()
          setSelectedPoint(payload)
          setSelectedTooltipPosition({ x: cx, y: cy })
        }}
        style={{ cursor: 'pointer' }}
      >
        <Dot
          cx={cx}
          cy={cy}
          r={isSelected ? 6 : 4}
          fill={isSelected ? '#22d3ee' : '#a78bfa'}
          stroke="#ffffff"
          strokeWidth={isSelected ? 2 : 1}
        />
        {isSelected && <circle cx={cx} cy={cy} r={11} fill="#22d3ee" opacity={0.2} />}
      </g>
    )
  }, [selectedPoint])

  if (points.length === 0) {
    return (
      <div
        data-testid="charts-empty-state"
        className="glass rounded-2xl p-8 border border-violet-500/20 text-center"
      >
        <p className="text-lg font-semibold text-slate-200 mb-2">No performance data yet for this chart.</p>
        <p className="text-sm text-slate-400">
          Finish a few runs and this view will display max {KPS_SHORT} by duration bucket.
        </p>
      </div>
    )
  }

  return (
    <div data-testid="charts-max-kps-pace" className="glass rounded-2xl p-6 border border-violet-500/20">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-black text-white">Your best {KPS_SHORT} by duration bucket</h3>
          <p className="text-xs text-gray-400">
            Each point is your highest-{KPS_SHORT} run in a 5-minute duration bucket. Tooltip shows when each was attained.
          </p>
        </div>
        <span className="text-xs text-gray-500">Click a point to open its tooltip</span>
      </div>

      <div
        ref={containerRef}
        role="application"
        aria-label={`Chart: max ${KPS_SHORT} pace over duration`}
        className="relative w-full"
        style={{ minWidth: 320, width: '100%', height: 340 }}
      >
        {dimensions.width > 0 && (
          <LineChart
            width={dimensions.width}
            height={dimensions.height}
            data={points}
            margin={{ top: 10, right: 16, left: 0, bottom: 12 }}
            onClick={() => {
              setSelectedPoint(null)
              setSelectedTooltipPosition(null)
            }}
          >
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" opacity={0.35} />
              <XAxis
                type="number"
                dataKey="durationMinutes"
                stroke="#6b7280"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                domain={['dataMin - 2', 'dataMax + 2']}
                tickFormatter={formatDurationTick}
                label={{
                  value: 'Duration',
                  position: 'insideBottom',
                  offset: -6,
                  fill: '#9ca3af',
                  fontSize: 12,
                }}
              />
              <YAxis
                type="number"
                dataKey="paceSeconds"
                stroke="#6b7280"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickFormatter={formatPaceTick}
                domain={yDomain}
                reversed
                label={{
                  value: `Pace (${paceUnitLabel})`,
                  angle: -90,
                  position: 'insideLeft',
                  fill: '#9ca3af',
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="paceSeconds"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={<ClickableDot />}
                activeDot={false}
                isAnimationActive={false}
                connectNulls
              />
          </LineChart>
        )}

        {selectedPoint && selectedTooltipPosition && (
          <div
            className="pointer-events-none absolute z-20 min-w-[180px] max-w-[230px] rounded-lg border border-cyan-500/40 bg-gray-950/95 px-3 py-2 shadow-xl"
            style={
              selectedTooltipPosition.y < 84
                ? {
                    left: selectedTooltipPosition.x,
                    top: selectedTooltipPosition.y + 12,
                    transform: 'translateX(-50%)',
                  }
                : {
                    left: selectedTooltipPosition.x,
                    top: selectedTooltipPosition.y - 12,
                    transform: 'translate(-50%, -100%)',
                  }
            }
          >
            <p className="text-[11px] text-gray-400">{selectedPoint.dateFormatted}</p>
            <p className="text-sm font-bold text-cyan-300">
              {KPS_SHORT}: {Math.round(selectedPoint.kps)}
            </p>
            <p className="text-[11px] text-gray-200">{selectedPoint.paceLabel}</p>
            <p className="text-[11px] text-gray-400">
              {selectedPoint.durationLabel} • {selectedPoint.distanceDisplay.toFixed(2)}{' '}
              {selectedPoint.distanceUnitLabel}
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-violet-500/20 bg-black/30 p-4">
        {selectedPoint ? (
          <div>
            <p className="text-xs text-gray-400 mb-1">
              {selectedPoint.dateFormatted} • Duration bucket {selectedPoint.bucketLabel}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500 uppercase">{KPS_SHORT}</p>
                <p className="text-xl font-black text-violet-300">
                  {Math.round(selectedPoint.kps)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Pace</p>
                <p className="text-xl font-black text-cyan-300">{selectedPoint.paceLabel}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Duration</p>
                <p className="text-sm font-semibold text-gray-200">
                  {selectedPoint.durationLabel}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Distance</p>
                <p className="text-sm font-semibold text-gray-200">
                  {selectedPoint.distanceDisplay.toFixed(2)} {selectedPoint.distanceUnitLabel}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">
            Click a chart point to inspect its run details.
          </p>
        )}
      </div>
    </div>
  )
}
