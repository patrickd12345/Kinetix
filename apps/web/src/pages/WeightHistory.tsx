import { useState, useEffect, useCallback } from 'react'
import { getWeightHistoryPage, type WeightEntry } from '../lib/database'
import { useSettingsStore } from '../store/settingsStore'
import { WITHINGS_WEIGHTS_SYNCED_EVENT } from '../lib/withings'
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
  const lastWithingsWeightKg = useSettingsStore((s) => s.lastWithingsWeightKg)
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
  }, [loadPage, currentPage, lastWithingsWeightKg])

  useEffect(() => {
    const onSynced = () => {
      setCurrentPage(1)
      void loadPage(1)
    }
    window.addEventListener(WITHINGS_WEIGHTS_SYNCED_EVENT, onSynced)
    return () => window.removeEventListener(WITHINGS_WEIGHTS_SYNCED_EVENT, onSynced)
  }, [loadPage])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasPrev = currentPage > 1
  const hasNext = currentPage < totalPages

  return (
    <div className="pb-20 lg:pb-4">
      <div className="max-w-md lg:max-w-2xl mx-auto">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <Scale className="text-cyan-600 dark:text-cyan-400" size={28} aria-hidden />
            Weight History
          </h1>
          {total > 0 && (
            <span className="text-sm text-slate-600 dark:text-gray-400">
              {total} entr{total !== 1 ? 'ies' : 'y'}
            </span>
          )}
        </div>

        {loading ? (
          <div className="glass rounded-2xl border border-slate-200/90 p-8 text-center dark:border-white/10">
            <p className="text-slate-600 dark:text-gray-400">Loading...</p>
          </div>
        ) : total === 0 ? (
          <div className="glass rounded-2xl border border-slate-200/90 p-8 text-center dark:border-white/10">
            <p className="text-slate-600 dark:text-gray-400">No weight entries yet.</p>
            <p className="text-sm text-slate-500 dark:text-gray-500 mt-2">
              Import weight history in Settings (Withings) or connect your scale and open the app to sync.
            </p>
          </div>
        ) : (
          <>
            <div className="glass rounded-2xl border border-slate-200/90 overflow-hidden dark:border-white/10">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200/90 dark:border-white/10">
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-gray-400 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-gray-400 uppercase tracking-wider text-right">
                        Weight ({weightUnit})
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((entry) => (
                      <tr
                        key={entry.dateUnix}
                        className="border-b border-slate-200/70 transition-colors hover:bg-slate-100/90 dark:border-white/5 dark:hover:bg-white/5"
                      >
                        <td className="px-4 py-3 text-sm text-slate-800 dark:text-gray-200">
                          {formatWeightDate(entry.date)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-cyan-700 text-right dark:text-cyan-300">
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
                  className="flex items-center gap-1 rounded-xl border border-slate-300/80 bg-white/70 px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <ChevronLeft size={18} />
                  Previous
                </button>
                <span className="text-sm text-slate-600 dark:text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={!hasNext}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="flex items-center gap-1 rounded-xl border border-slate-300/80 bg-white/70 px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
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
