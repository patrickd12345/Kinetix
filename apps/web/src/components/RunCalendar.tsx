import { useState, useMemo } from 'react'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import { RunRecord } from '../lib/database'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface RunCalendarProps {
  runs: RunRecord[]
  onDateSelect: (date: Date) => void
}

export function RunCalendar({ runs, onDateSelect }: RunCalendarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  // Create a Set of dates that have runs (normalized to date only, no time)
  const runDates = useMemo(() => {
    const dates = new Set<string>()
    runs.forEach(run => {
      const date = new Date(run.date)
      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
      dates.add(dateKey)
    })
    return dates
  }, [runs])

  // Check if a date has runs
  const hasRun = (date: Date): boolean => {
    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    return runDates.has(dateKey)
  }

  // Find the most recent month with runs for initial calendar view
  const defaultMonth = useMemo(() => {
    if (runs.length === 0) {
      // No runs, default to current date
      return new Date()
    }
    
    // Get the most recent run (runs should be sorted newest first from History.tsx)
    // But we'll also verify by finding the actual most recent date to be safe
    let mostRecentRun = runs[0]
    let mostRecentDate = mostRecentRun ? new Date(mostRecentRun.date) : null
    
    // Double-check by finding the actual most recent date (in case sorting is off)
    for (const run of runs) {
      if (run.date) {
        const runDate = new Date(run.date)
        if (!mostRecentDate || runDate > mostRecentDate) {
          mostRecentDate = runDate
          mostRecentRun = run
        }
      }
    }
    
    if (mostRecentDate && mostRecentRun) {
      // Set to first day of that month for cleaner display
      return new Date(mostRecentDate.getFullYear(), mostRecentDate.getMonth(), 1)
    }
    
    // Fallback to current date
    return new Date()
  }, [runs])

  const handleDateChange = (value: any) => {
    if (value instanceof Date) {
      setSelectedDate(value)
      onDateSelect(value)
      setIsOpen(false) // Close calendar after selection
    } else if (Array.isArray(value) && value[0] instanceof Date) {
      // Handle date range selection (use first date)
      setSelectedDate(value[0])
      onDateSelect(value[0])
      setIsOpen(false)
    }
  }

  // Custom tile content to highlight dates with runs
  const tileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month' && hasRun(date)) {
      return (
        <>
          <span className="sr-only">Has run</span>
          <div
            className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full bg-cyan-400"
            aria-hidden
          />
        </>
      )
    }
    return null
  }

  // Custom tile className to style dates with runs
  const tileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month' && hasRun(date)) {
      return 'has-run'
    }
    return ''
  }

  const calendarPanelId = 'run-calendar-panel'

  return (
    <div className="mb-4">
      <button
        type="button"
        id="run-calendar-toggle"
        aria-expanded={isOpen}
        aria-controls={calendarPanelId}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full glass rounded-xl p-3 flex items-center justify-between hover:border-cyan-500/30 transition-all"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-900 dark:text-white">Jump to Date</span>
          {selectedDate && (
            <span className="text-xs text-slate-600 dark:text-gray-400">
              {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
        </div>
        {isOpen ? <ChevronUp size={16} className="text-slate-600 dark:text-gray-400" /> : <ChevronDown size={16} className="text-slate-600 dark:text-gray-400" />}
      </button>

      {isOpen && (
        <div id={calendarPanelId} className="mt-2 glass rounded-xl p-4 border border-cyan-500/20" role="region" aria-label="Choose a date">
          <Calendar
            onChange={handleDateChange}
            value={selectedDate || undefined}
            defaultActiveStartDate={defaultMonth}
            tileContent={tileContent}
            tileClassName={tileClassName}
            className="run-calendar"
          />
          <style>{`
            .run-calendar {
              background: transparent;
              border: none;
              width: 100%;
              font-family: inherit;
            }
            
            .run-calendar .react-calendar__navigation {
              display: flex;
              height: 44px;
              margin-bottom: 1em;
            }
            
            .run-calendar .react-calendar__navigation button {
              min-width: 44px;
              background: transparent;
              color: #e5e7eb;
              font-size: 14px;
              font-weight: 600;
              border: none;
              padding: 0;
            }
            
            .run-calendar .react-calendar__navigation button:hover {
              color: #22d3ee;
            }
            
            .run-calendar .react-calendar__navigation button:disabled {
              color: #6b7280;
            }
            
            .run-calendar .react-calendar__month-view__weekdays {
              text-align: center;
              text-transform: uppercase;
              font-weight: 600;
              font-size: 11px;
              color: #9ca3af;
              margin-bottom: 0.5em;
            }
            
            .run-calendar .react-calendar__month-view__weekdays__weekday {
              padding: 0.5em;
            }
            
            .run-calendar .react-calendar__month-view__days {
              display: grid !important;
              grid-template-columns: repeat(7, 1fr);
              gap: 2px;
            }
            
            .run-calendar .react-calendar__tile {
              max-width: 100%;
              background: rgba(31, 41, 55, 0.5);
              border: 1px solid rgba(75, 85, 99, 0.3);
              border-radius: 6px;
              padding: 8px 4px;
              color: #e5e7eb;
              font-size: 12px;
              position: relative;
              transition: all 0.2s;
            }
            
            .run-calendar .react-calendar__tile:hover {
              background: rgba(34, 211, 238, 0.1);
              border-color: rgba(34, 211, 238, 0.3);
              color: #22d3ee;
            }
            
            .run-calendar .react-calendar__tile:disabled {
              background: rgba(17, 24, 39, 0.3);
              color: #4b5563;
              border-color: rgba(75, 85, 99, 0.1);
            }
            
            .run-calendar .react-calendar__tile--active {
              background: rgba(34, 211, 238, 0.2);
              border-color: #22d3ee;
              color: #22d3ee;
              font-weight: 700;
            }
            
            .run-calendar .react-calendar__tile.has-run {
              border-color: rgba(34, 211, 238, 0.5);
            }
            
            .run-calendar .react-calendar__tile.has-run:hover {
              background: rgba(34, 211, 238, 0.15);
            }
            
            .run-calendar .react-calendar__tile--now {
              background: rgba(139, 92, 246, 0.1);
              border-color: rgba(139, 92, 246, 0.3);
            }
            
            .run-calendar .react-calendar__tile--neighboringMonth {
              color: #6b7280;
            }
          `}</style>
        </div>
      )}
    </div>
  )
}
