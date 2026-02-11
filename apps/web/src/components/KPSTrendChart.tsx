import { useMemo } from 'react'
import { KINETIX_PERFORMANCE_SCORE, KPS_SHORT } from '../lib/branding'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Dot } from 'recharts'
import { formatTime, formatDistance } from '@kinetix/core'
import { RunRecord } from '../lib/database'

interface KPSTrendData {
  date: string
  dateFormatted: string
  kps: number
  isPB: boolean
  distance: number
  duration: number
}

interface KPSTrendChartProps {
  runs: RunRecord[]
  relativeKPSMap: Map<number, number>
  unitSystem: 'metric' | 'imperial'
}

export function KPSTrendChart({ runs, relativeKPSMap, unitSystem }: KPSTrendChartProps) {
  const chartData = useMemo<KPSTrendData[]>(() => {
    if (runs.length === 0) return []

    const sortedRuns = [...runs].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    let maxKPS = -Infinity
    const data: KPSTrendData[] = sortedRuns.map((run) => {
      const relativeKPS = run.id ? (relativeKPSMap.get(run.id) ?? run.kps) : run.kps
      if (relativeKPS > maxKPS) {
        maxKPS = relativeKPS
      }
      return {
        date: run.date,
        dateFormatted: new Date(run.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        }),
        kps: relativeKPS,
        isPB: false,
        distance: run.distance,
        duration: run.duration,
      }
    })

    data.forEach((point, index) => {
      const isNewPB = index === 0 || point.kps > Math.max(...data.slice(0, index).map(d => d.kps))
      point.isPB = isNewPB && point.kps === maxKPS
    })

    return data
  }, [runs, relativeKPSMap])

  if (chartData.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <p className="text-gray-400">No data to display</p>
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
          <p className="text-xs text-gray-400 mb-1">{data.dateFormatted}</p>
          <p className="text-lg font-black text-cyan-400 mb-1">
            {KPS_SHORT}: {Math.round(data.kps)}
            {data.isPB && <span className="ml-2 text-green-400">PB</span>}
          </p>
          <p className="text-xs text-gray-300">
            {formatDistance(data.distance, unitSystem)} {unitSystem === 'metric' ? 'km' : 'mi'} • {formatTime(data.duration)}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="glass rounded-2xl p-6 border border-cyan-500/20">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-black text-white mb-1">{KINETIX_PERFORMANCE_SCORE} Trend</h3>
          <p className="text-xs text-gray-400">Your performance over time</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
            <span className="text-gray-400">{KPS_SHORT}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-400"></div>
            <span className="text-gray-400">PB</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
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
            domain={['dataMin - 5', 'dataMax + 5']}
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
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
