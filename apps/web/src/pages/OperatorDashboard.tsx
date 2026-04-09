import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Clock3, FileWarning, LayoutList, Loader2, RefreshCcw, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../components/providers/useAuth'
import { listSupportQueueTickets, type QueueSummary, type SlaMetrics, type SupportQueueTicket } from '../lib/supportQueueClient'

function formatDuration(ms: number | null) {
  if (ms == null) return 'n/a'
  const totalMinutes = Math.round(ms / (60 * 1000))
  if (totalMinutes < 60) return `${totalMinutes}m`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours < 24) return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`
  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  return remHours === 0 ? `${days}d` : `${days}d ${remHours}h`
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return 'n/a'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function isOverdue(ticket: SupportQueueTicket) {
  const labels = ticket.derived?.labels ?? []
  return labels.includes('overdue_first_response') || labels.includes('overdue_resolution')
}

function isUnassigned(ticket: SupportQueueTicket) {
  return (ticket.derived?.labels ?? []).includes('unassigned')
}

function isAwaitingRetry(ticket: SupportQueueTicket) {
  return (ticket.derived?.labels ?? []).includes('awaiting_retry')
}

function isAssigned(ticket: SupportQueueTicket) {
  return (ticket.derived?.labels ?? []).includes('assigned')
}

function urgentRank(ticket: SupportQueueTicket) {
  if (isOverdue(ticket)) return 0
  if (isUnassigned(ticket)) return 1
  if (isAwaitingRetry(ticket)) return 2
  if (isAssigned(ticket)) return 3
  return 4
}

function byUrgency(a: SupportQueueTicket, b: SupportQueueTicket) {
  const rankDiff = urgentRank(a) - urgentRank(b)
  if (rankDiff !== 0) return rankDiff
  const escalationDiff = (b.derived?.escalation_level ?? 0) - (a.derived?.escalation_level ?? 0)
  if (escalationDiff !== 0) return escalationDiff
  const updatedDiff = Date.parse(b.updated_at) - Date.parse(a.updated_at)
  if (!Number.isNaN(updatedDiff) && updatedDiff !== 0) return updatedDiff
  return a.ticket_id.localeCompare(b.ticket_id)
}

function SummaryCard({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'warning' | 'danger' | 'success' | 'info' }) {
  const toneClass =
    tone === 'danger'
      ? 'text-rose-100 border-rose-500/20 bg-rose-500/10'
      : tone === 'warning'
        ? 'text-amber-100 border-amber-500/20 bg-amber-500/10'
        : tone === 'success'
          ? 'text-emerald-100 border-emerald-500/20 bg-emerald-500/10'
          : tone === 'info'
            ? 'text-cyan-100 border-cyan-500/20 bg-cyan-500/10'
            : 'text-slate-100 border-white/10 bg-black/20'

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  )
}

export default function OperatorDashboard() {
  const { session } = useAuth()
  const operatorUserId = session?.user?.id ?? null
  const [tickets, setTickets] = useState<SupportQueueTicket[]>([])
  const [summary, setSummary] = useState<QueueSummary | null>(null)
  const [slaMetrics, setSlaMetrics] = useState<SlaMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        setError(null)
        const payload = await listSupportQueueTickets(session)
        if (cancelled) return
        setTickets(payload.tickets)
        setSummary(payload.summary)
        setSlaMetrics(payload.slaMetrics)
      } catch (loadError) {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Operator dashboard failed to load')
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [session, reloadToken])

  const urgentTickets = useMemo(() => [...tickets].sort(byUrgency).slice(0, 8), [tickets])
  const firstUrgent = urgentTickets[0] ?? null
  const firstAssignedToMe = useMemo(
    () => tickets.find((ticket) => operatorUserId && ticket.assigned_to === operatorUserId) ?? null,
    [tickets, operatorUserId],
  )

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100">
              <ShieldAlert size={14} />
              Operator dashboard
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-white">What needs attention now?</h1>
              <p className="text-sm text-slate-400">Additive operational view over the existing support queue.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReloadToken((current) => current + 1)}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
            Refresh
          </button>
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-200" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Unassigned" value={summary?.unassigned ?? 0} />
        <SummaryCard label="Overdue" value={summary?.overdue ?? 0} tone="warning" />
        <SummaryCard label="Assigned to me" value={summary?.assignedToMe ?? 0} tone="info" />
        <SummaryCard label="Awaiting retry" value={summary?.awaitingRetry ?? 0} tone="danger" />
        <SummaryCard label="Ready for KB" value={summary?.readyForKb ?? 0} tone="success" />
        <SummaryCard label="Stale resolved" value={summary?.staleResolvedNotKb ?? 0} />
        <SummaryCard label="Escalated" value={summary?.escalated ?? 0} tone="warning" />
        <SummaryCard label="Escalated (critical)" value={summary?.escalatedLevel2 ?? 0} tone="danger" />
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Avg first response" value={formatDuration(slaMetrics?.avg_first_response_ms ?? null)} />
        <MetricCard label="Avg resolution" value={formatDuration(slaMetrics?.avg_resolution_ms ?? null)} />
        <MetricCard label="Overdue" value={slaMetrics?.overdue_count ?? 0} />
        <MetricCard label="Resolved (7d)" value={slaMetrics?.resolved_last_7_days ?? 0} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr,0.8fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-300" />
            <h2 className="text-lg font-semibold text-white">Recent urgent tickets</h2>
          </div>
          <div className="mt-4 space-y-3">
            {urgentTickets.map((ticket) => {
              const escalationLevel = ticket.derived?.escalation_level ?? 0
              const escalationTone =
                escalationLevel === 2
                  ? 'border-rose-500/30 bg-rose-500/10'
                  : escalationLevel === 1
                    ? 'border-amber-500/30 bg-amber-500/10'
                    : 'border-white/10 bg-black/20'

              return (
                <Link
                  key={ticket.ticket_id}
                  to={`/support-queue?ticketId=${encodeURIComponent(ticket.ticket_id)}`}
                  className={`block rounded-xl border p-3 transition hover:bg-white/5 ${escalationTone}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-white">{ticket.issue_summary}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {ticket.ticket_id} | {ticket.status} | Updated {formatTimestamp(ticket.updated_at)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {isOverdue(ticket) ? <span className="rounded-full bg-amber-500/15 px-2 py-1 text-amber-100">Overdue</span> : null}
                      {isUnassigned(ticket) ? <span className="rounded-full bg-slate-500/20 px-2 py-1 text-slate-100">Unassigned</span> : null}
                      {isAwaitingRetry(ticket) ? <span className="rounded-full bg-rose-500/15 px-2 py-1 text-rose-100">Awaiting retry</span> : null}
                      {isAssigned(ticket) ? <span className="rounded-full bg-cyan-500/15 px-2 py-1 text-cyan-100">Assigned</span> : null}
                      {escalationLevel > 0 ? (
                        <span className={`rounded-full px-2 py-1 ${escalationLevel === 2 ? 'bg-rose-500/20 text-rose-100' : 'bg-amber-500/20 text-amber-100'}`}>
                          {escalationLevel === 2 ? 'Escalated (critical)' : 'Escalated'}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              )
            })}
            {urgentTickets.length === 0 ? <p className="text-sm text-slate-500">No urgent tickets right now.</p> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2">
            <LayoutList size={18} className="text-cyan-300" />
            <h2 className="text-lg font-semibold text-white">Quick links</h2>
          </div>
          <div className="mt-4 space-y-3">
            <Link to="/support-queue" className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-100 hover:bg-white/5">
              <span>Go to queue</span>
              <ArrowRight size={16} />
            </Link>
            <Link
              to={firstUrgent ? `/support-queue?ticketId=${encodeURIComponent(firstUrgent.ticket_id)}` : '/support-queue'}
              className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 hover:bg-amber-500/15"
            >
              <span>Open urgent</span>
              <ArrowRight size={16} />
            </Link>
            <Link
              to={firstAssignedToMe ? `/support-queue?ticketId=${encodeURIComponent(firstAssignedToMe.ticket_id)}` : '/support-queue'}
              className="flex items-center justify-between rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100 hover:bg-cyan-500/15"
            >
              <span>Open assigned to me</span>
              <ArrowRight size={16} />
            </Link>
          </div>

          <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
            <div className="flex items-center gap-2 text-white">
              <Clock3 size={16} />
              SLA context
            </div>
            <div className="mt-2">Created (7d): {slaMetrics?.created_last_7_days ?? 0}</div>
            <div className="mt-1">Resolved (7d): {slaMetrics?.resolved_last_7_days ?? 0}</div>
            <div className="mt-1">Critical escalations: {summary?.escalatedLevel2 ?? 0}</div>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
            <div className="flex items-center gap-2 text-white">
              <FileWarning size={16} />
              Scope
            </div>
            <p className="mt-2 text-slate-400">
              Escalation is UI-only in phase 2. No background jobs, browser notifications, email, or Slack escalation are triggered here.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
