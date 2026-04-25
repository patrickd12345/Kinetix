import { useEffect, useMemo, useState, memo } from 'react'
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
      badge:
        'border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10',
      value: 'text-rose-950 dark:text-rose-100',
      dot: 'bg-rose-500 dark:bg-rose-400',
      text: 'Breached',
    }
  }
  if (health === 'warning') {
    return {
      badge:
        'border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10',
      value: 'text-amber-950 dark:text-amber-100',
      dot: 'bg-amber-500 dark:bg-amber-400',
      text: 'Warning',
    }
  }
  return {
    badge:
      'border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10',
    value: 'text-emerald-950 dark:text-emerald-100',
    dot: 'bg-emerald-500 dark:bg-emerald-400',
    text: 'Healthy',
  }
}

const SummaryCard = memo(function SummaryCard({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'warning' | 'danger' | 'success' | 'info' }) {
  const surface =
    tone === 'danger'
      ? 'border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10'
        : tone === 'success'
          ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10'
          : tone === 'info'
            ? 'border-cyan-200 bg-cyan-50 dark:border-cyan-500/20 dark:bg-cyan-500/10'
            : 'border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-black/20'

  const valueClass =
    tone === 'danger'
      ? 'text-rose-950 dark:text-white'
      : tone === 'warning'
        ? 'text-amber-950 dark:text-white'
        : tone === 'success'
          ? 'text-emerald-950 dark:text-white'
          : tone === 'info'
            ? 'text-cyan-950 dark:text-white'
            : 'text-slate-900 dark:text-white'

  return (
    <div className={`rounded-xl border p-3 shadow-sm dark:shadow-none ${surface}`}>
      <div className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight ${valueClass}`}>{value}</div>
    </div>
  )
})

const MetricCard = memo(function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm dark:border-white/10 dark:bg-black/20 dark:shadow-none">
      <div className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</div>
      <div className="mt-2 text-lg font-semibold tabular-nums text-slate-900 dark:text-white">{value}</div>
    </div>
  )
})

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
      <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Operator dashboard</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          This dashboard is disabled by feature flag. Use the support queue directly.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-900 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-100">
              <ShieldAlert size={14} />
              Operator dashboard
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">What needs attention now?</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">Additive operational view over the existing support queue.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReloadToken((current) => current + 1)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 dark:border-white/15 dark:bg-transparent dark:text-slate-200 dark:shadow-none dark:hover:bg-white/5"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
            Refresh
          </button>
        </div>

        {error ? (
          <p
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/20 dark:bg-red-500/5 dark:text-red-200"
            role="alert"
          >
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
          <div className={`rounded-xl border p-3 shadow-sm dark:shadow-none ${healthTone.badge}`}>
            <div className="text-xs font-medium text-slate-600 dark:text-slate-300">SLA health</div>
            <div className={`mt-2 flex items-center gap-2 text-lg font-semibold ${healthTone.value}`}>
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${healthTone.dot}`} />
              {healthTone.text}
            </div>
          </div>
          <MetricCard label="SLA warnings" value={warningCount} />
          <MetricCard label="SLA breaches" value={breachCount} />
          <MetricCard label="Avg first response" value={formatDuration(slaMetrics?.avg_first_response_ms ?? null)} />
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1.4fr,0.8fr]">
        <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-600 dark:text-amber-300" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent escalations</h2>
          </div>
          <div className="mt-4 space-y-3">
            {escalations.map((ticket) => {
              const escalationLevel = ticket.derived?.escalation_level ?? 0
              const escalationTone =
                escalationLevel === 2
                  ? 'border-rose-200 bg-rose-50 hover:bg-rose-100/80 dark:border-rose-500/30 dark:bg-rose-500/10 dark:hover:bg-rose-500/15'
                  : escalationLevel === 1
                    ? 'border-amber-200 bg-amber-50 hover:bg-amber-100/80 dark:border-amber-500/30 dark:bg-amber-500/10 dark:hover:bg-amber-500/15'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100/90 dark:border-white/10 dark:bg-black/20 dark:hover:bg-white/5'

              return (
                <Link
                  key={ticket.ticket_id}
                  to={`/support-queue?ticketId=${encodeURIComponent(ticket.ticket_id)}`}
                  className={`block rounded-xl border p-3 transition ${escalationTone}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-white">{ticket.issue_summary}</div>
                      <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        {ticket.ticket_id} | {ticket.status} | Created {formatTimestamp(ticket.created_at)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {computeSLAStatus(ticket) === 'breached' ? (
                        <span className="rounded-full bg-rose-100 px-2 py-1 font-medium text-rose-900 dark:bg-rose-500/15 dark:text-rose-100">
                          SLA Breach
                        </span>
                      ) : null}
                      {computeSLAStatus(ticket) === 'warning' ? (
                        <span className="rounded-full bg-amber-100 px-2 py-1 font-medium text-amber-950 dark:bg-amber-500/15 dark:text-amber-100">
                          SLA Warning
                        </span>
                      ) : null}
                      {escalationLevel > 0 ? (
                        <span
                          className={`rounded-full px-2 py-1 font-medium ${
                            escalationLevel === 2
                              ? 'bg-rose-100 text-rose-950 dark:bg-rose-500/20 dark:text-rose-100'
                              : 'bg-amber-100 text-amber-950 dark:bg-amber-500/20 dark:text-amber-100'
                          }`}
                        >
                          {escalationLevel === 2 ? 'Escalated (critical)' : 'Escalated'}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              )
            })}
            {escalations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center dark:border-white/15 dark:bg-black/10">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">All clear</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">No escalations in view right now.</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
          <div className="flex items-center gap-2">
            <LayoutList size={18} className="text-cyan-600 dark:text-cyan-300" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Quick links</h2>
          </div>
          <div className="mt-4 space-y-3">
            <Link
              to="/support-queue"
              className="flex items-center justify-between rounded-xl border border-cyan-300 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-950 shadow-sm hover:bg-cyan-100/90 dark:border-cyan-500/25 dark:bg-cyan-500/10 dark:text-cyan-100 dark:shadow-none dark:hover:bg-cyan-500/15"
            >
              <span>Go to queue</span>
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/support-queue?urgent=1"
              className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950 hover:bg-amber-100/80 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100 dark:hover:bg-amber-500/15"
            >
              <span>Open urgent queue</span>
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/support-queue?assigned=me"
              className="flex items-center justify-between rounded-xl border border-cyan-200 bg-cyan-50/80 px-4 py-3 text-sm font-medium text-cyan-950 hover:bg-cyan-100/80 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-100 dark:hover:bg-cyan-500/15"
            >
              <span>Open assigned to me</span>
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/support-queue?escalated=1"
              className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-950 hover:bg-rose-100/80 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-100 dark:hover:bg-rose-500/15"
            >
              <span>Open escalated queue</span>
              <ArrowRight size={16} />
            </Link>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-white/10 dark:bg-black/20 dark:text-slate-300">
            <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <Clock3 size={16} />
              SLA context
            </div>
            <div className="mt-2">Warnings: {warningCount}</div>
            <div className="mt-1">Breaches: {breachCount}</div>
            <div className="mt-1">Critical escalations: {summary?.escalatedLevel2 ?? 0}</div>
            <div className="mt-1">Latest escalated ticket: {recentEscalation?.ticket_id ?? 'n/a'}</div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-white/10 dark:bg-black/20 dark:text-slate-300">
            <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <FileWarning size={16} />
              Scope
            </div>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Escalation notifications are best-effort: when enabled and configured, the UI posts to{' '}
              <span className="font-mono text-slate-800 dark:text-slate-300">/api/escalationNotify</span> and the server applies resend
              suppression and rate limiting before forwarding to Slack. No background jobs, browser notifications, or email delivery are
              implemented here.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
