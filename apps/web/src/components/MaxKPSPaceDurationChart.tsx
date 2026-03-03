import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Dot,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import type { RunRecord } from '../lib/database'
import { KPS_SHORT } from '../lib/branding'
import {
  buildMaxKPSPaceDurationPoints,
  type MaxKPSPaceDurationPoint,
} from '../lib/maxKpsPaceChart'

interface MaxKPSPaceDurationChartProps {
  runs: RunRecord[]
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
  runs,
  unitSystem,
}: MaxKPSPaceDurationChartProps) {
  const points = useMemo(
    () => buildMaxKPSPaceDurationPoints(runs, unitSystem),
    [runs, unitSystem]
  )

  const [selectedPoint, setSelectedPoint] = useState<MaxKPSPaceDurationPoint | null>(null)
  const [selectedTooltipPosition, setSelectedTooltipPosition] = useState<{
    x: number
    y: number
  } | null>(null)

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

  if (points.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 border border-white/10 text-center">
        <p className="text-gray-300 mb-1">No performance data yet for this chart.</p>
        <p className="text-xs text-gray-500">
          Finish a few runs and this view will display max {KPS_SHORT} by duration bucket.
        </p>
      </div>
    )
  }

  const chartMinPace = Math.min(...points.map((point) => point.paceSeconds))
  const chartMaxPace = Math.max(...points.map((point) => point.paceSeconds))
  const pacePadding = Math.max(20, (chartMaxPace - chartMinPace) * 0.2)
  const yDomain: [number, number] = [chartMinPace - pacePadding, chartMaxPace + pacePadding]

  const ClickableDot = ({
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
  }

  return (
    <div className="glass rounded-2xl p-6 border border-violet-500/20">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-black text-white">Max {KPS_SHORT} on Pace vs Duration</h3>
          <p className="text-xs text-gray-400">
            Each point is the highest-{KPS_SHORT} run inside a 5-minute duration bucket.
          </p>
        </div>
        <span className="text-xs text-gray-500">Click a point to open its tooltip</span>
      </div>

      <div
        role="application"
        aria-label={`Chart: max ${KPS_SHORT} pace over duration`}
        className="relative h-[340px]"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
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
              animationDuration={600}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>

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
