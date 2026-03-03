import { useState, useEffect, useCallback } from 'react'
import { getWeightHistoryPage, type WeightEntry } from '../lib/database'
import { useSettingsStore } from '../store/settingsStore'
import { ChevronLeft, ChevronRight, Scale } from 'lucide-react'

const PAGE_SIZE = 50
const KG_TO_LBS = 2.20462

function formatWeightDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatWeight(kg: number, unit: 'kg' | 'lbs'): string {
  if (unit === 'lbs') return (kg * KG_TO_LBS).toFixed(2)
  return kg.toFixed(2)
}

export default function WeightHistory() {
  const weightUnit = useSettingsStore((s) => s.weightUnit)
  const [items, setItems] = useState<WeightEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)

  const loadPage = useCallback(async (page: number) => {
    if (typeof indexedDB === 'undefined') return
    setLoading(true)
    try {
      const { items: nextItems, total: nextTotal } = await getWeightHistoryPage(page, PAGE_SIZE)
      setItems(nextItems)
      setTotal(nextTotal)
      setCurrentPage(page)
    } catch (err) {
      console.error('Weight history load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPage(currentPage)
  }, [loadPage, currentPage])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasPrev = currentPage > 1
  const hasNext = currentPage < totalPages

  return (
    <div className="pb-20 lg:pb-4">
      <div className="max-w-md lg:max-w-2xl mx-auto">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="text-cyan-400" size={28} />
            Weight History
          </h1>
          {total > 0 && (
            <span className="text-sm text-gray-400">
              {total} entr{total !== 1 ? 'ies' : 'y'}
            </span>
          )}
        </div>

        {loading ? (
          <div className="glass rounded-2xl border border-white/10 p-8 text-center">
            <p className="text-gray-400">Loading...</p>
          </div>
        ) : total === 0 ? (
          <div className="glass rounded-2xl border border-white/10 p-8 text-center">
            <p className="text-gray-400">No weight entries yet.</p>
            <p className="text-sm text-gray-500 mt-2">
              Import weight history in Settings (Withings) or connect your scale and open the app to sync.
            </p>
          </div>
        ) : (
          <>
            <div className="glass rounded-2xl border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">
                        Weight ({weightUnit})
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((entry) => (
                      <tr
                        key={entry.dateUnix}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm text-gray-200">
                          {formatWeightDate(entry.date)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-cyan-300 text-right">
                          {formatWeight(entry.kg, weightUnit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-4 mt-4">
                <button
                  type="button"
                  disabled={!hasPrev}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={18} />
                  Previous
                </button>
                <span className="text-sm text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={!hasNext}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
