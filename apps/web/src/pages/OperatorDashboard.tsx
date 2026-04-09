import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Clock3, FileWarning, LayoutList, Loader2, RefreshCcw, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../components/providers/useAuth'
import { listSupportQueueTickets, type QueueSummary, type SlaMetrics, type SupportQueueTicket } from '../lib/supportQueueClient'
import { featureFlags } from '../lib/featureFlags'
import { checkEscalations, notifyEscalation } from '../lib/helpcenter/escalation'
import { computeSLAHealth, computeSLAStatus } from '../lib/helpcenter/sla'

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

function isOpenTicket(ticket: SupportQueueTicket) {
  return ticket.status !== 'resolved' && ticket.status !== 'closed'
}

function healthToneClasses(health: ReturnType<typeof computeSLAHealth>) {
  if (health === 'breached') {
    return {
      badge: 'border-rose-500/20 bg-rose-500/10 text-rose-100',
      dot: 'bg-rose-400',
      text: 'Breached',
    }
  }
  if (health === 'warning') {
    return {
      badge: 'border-amber-500/20 bg-amber-500/10 text-amber-100',
      dot: 'bg-amber-400',
      text: 'Warning',
    }
  }
  return {
    badge: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100',
    dot: 'bg-emerald-400',
    text: 'Healthy',
  }
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
        setTickets(payload.tickets ?? [])
        setSummary(payload.summary ?? null)
        setSlaMetrics(payload.slaMetrics ?? null)
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

  const openTickets = useMemo(() => (tickets ?? []).filter(isOpenTicket), [tickets])
  const escalations = useMemo(() => (featureFlags.ENABLE_ESCALATION ? checkEscalations(openTickets).slice(0, 5) : []), [openTickets])
  const slaHealth = useMemo(() => computeSLAHealth(openTickets), [openTickets])
  const warningCount = useMemo(() => openTickets.filter((ticket) => computeSLAStatus(ticket) === 'warning').length, [openTickets])
  const breachCount = useMemo(() => openTickets.filter((ticket) => computeSLAStatus(ticket) === 'breached').length, [openTickets])
  const healthTone = healthToneClasses(slaHealth)

  useEffect(() => {
    if (!featureFlags.ENABLE_ESCALATION) return
    for (const ticket of escalations) {
      notifyEscalation(ticket)
    }
  }, [escalations])

  const recentEscalation = escalations[0] ?? null
  const urgentCount = useMemo(
    () => openTickets.filter((ticket) => isOverdue(ticket) || (ticket.derived?.escalation_level ?? 0) > 0).length,
    [openTickets],
  )

  if (!featureFlags.ENABLE_OPERATOR_DASHBOARD) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h1 className="text-2xl font-semibold text-white">Operator dashboard</h1>
        <p className="mt-2 text-sm text-slate-400">This dashboard is disabled by feature flag. Use the support queue directly.</p>
      </div>
    )
  }

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
        <SummaryCard label="Open tickets" value={openTickets.length} />
        <SummaryCard label="Urgent tickets" value={urgentCount} tone="warning" />
        <SummaryCard label="Escalated tickets" value={summary?.escalated ?? 0} tone="danger" />
        <SummaryCard label="Assigned to me" value={summary?.assignedToMe ?? 0} tone="info" />
      </section>

      {featureFlags.ENABLE_SLA_METRICS ? (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className={`rounded-xl border p-3 ${healthTone.badge}`}>
            <div className="text-xs">SLA health</div>
            <div className="mt-2 flex items-center gap-2 text-lg font-semibold text-white">
              <span className={`h-2.5 w-2.5 rounded-full ${healthTone.dot}`} />
              {healthTone.text}
            </div>
          </div>
          <MetricCard label="SLA warnings" value={warningCount} />
          <MetricCard label="SLA breaches" value={breachCount} />
          <MetricCard label="Avg first response" value={formatDuration(slaMetrics?.avg_first_response_ms ?? null)} />
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1.4fr,0.8fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-300" />
            <h2 className="text-lg font-semibold text-white">Recent escalations</h2>
          </div>
          <div className="mt-4 space-y-3">
            {escalations.map((ticket) => {
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
                        {ticket.ticket_id} | {ticket.status} | Created {formatTimestamp(ticket.created_at)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {computeSLAStatus(ticket) === 'breached' ? <span className="rounded-full bg-rose-500/15 px-2 py-1 text-rose-100">SLA Breach</span> : null}
                      {computeSLAStatus(ticket) === 'warning' ? <span className="rounded-full bg-amber-500/15 px-2 py-1 text-amber-100">SLA Warning</span> : null}
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
            {escalations.length === 0 ? <p className="text-sm text-slate-500">No escalations right now.</p> : null}
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
              to="/support-queue?urgent=1"
              className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 hover:bg-amber-500/15"
            >
              <span>Open urgent queue</span>
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/support-queue?assigned=me"
              className="flex items-center justify-between rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100 hover:bg-cyan-500/15"
            >
              <span>Open assigned to me</span>
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/support-queue?escalated=1"
              className="flex items-center justify-between rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 hover:bg-rose-500/15"
            >
              <span>Open escalated queue</span>
              <ArrowRight size={16} />
            </Link>
          </div>

          <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
            <div className="flex items-center gap-2 text-white">
              <Clock3 size={16} />
              SLA context
            </div>
            <div className="mt-2">Warnings: {warningCount}</div>
            <div className="mt-1">Breaches: {breachCount}</div>
            <div className="mt-1">Critical escalations: {summary?.escalatedLevel2 ?? 0}</div>
            <div className="mt-1">Latest escalated ticket: {recentEscalation?.ticket_id ?? 'n/a'}</div>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
            <div className="flex items-center gap-2 text-white">
              <FileWarning size={16} />
              Scope
            </div>
            <p className="mt-2 text-slate-400">
              Escalation notifications are best-effort: when enabled and configured, the UI posts to <span className="font-mono">/api/escalationNotify</span> and the server applies resend suppression and rate limiting before forwarding to Slack. No background jobs, browser notifications, or email delivery are implemented here.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
