import { useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCcw, Send, CheckCircle2, FileText } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../components/providers/useAuth'
import {
  approveAndIngestKbApprovalDraft,
  getKbApprovalDraft,
  getSupportQueueTicket,
  listKbApprovalDrafts,
  listSupportQueueTickets,
  moveTicketToKbApprovalBin,
  retrySupportQueueNotifications,
  type SupportKbApprovalDraft,
  type SupportQueueTicket,
  updateKbApprovalDraft,
  updateSupportQueueTicket,
} from '../lib/supportQueueClient'

const TICKET_STATUSES = ['open', 'triaged', 'in_progress', 'resolved', 'closed'] as const
const KB_TOPIC_OPTIONS = ['account', 'billing', 'sync', 'import', 'kps', 'charts', 'privacy', 'general'] as const
const KB_INTENT_OPTIONS = ['howto', 'troubleshoot', 'policy', 'limitation'] as const
const KB_REVIEW_STATUS_OPTIONS = ['draft', 'approved', 'ingested', 'rejected'] as const

function formatTimestamp(value: string | null | undefined) {
  if (!value) return 'n/a'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function metadataSummary(ticket: SupportQueueTicket | null) {
  const metadata = ticket?.metadata && typeof ticket.metadata === 'object' ? ticket.metadata : {}
  return {
    topic: typeof metadata.inferred_topic === 'string' ? metadata.inferred_topic : 'general',
    retrieval: typeof metadata.retrieval_state === 'string' ? metadata.retrieval_state : 'unknown',
    route: typeof metadata.route === 'string' ? metadata.route : '/help',
  }
}

export default function SupportQueue() {
  const location = useLocation()
  const { session } = useAuth()
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const requestedTicketId = searchParams.get('ticketId')
  const requestedDraftId = searchParams.get('draftId')
  const [reloadToken, setReloadToken] = useState(0)
  const [tickets, setTickets] = useState<SupportQueueTicket[]>([])
  const [drafts, setDrafts] = useState<SupportKbApprovalDraft[]>([])
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(requestedTicketId)
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(requestedDraftId)
  const [selectedTicket, setSelectedTicket] = useState<SupportQueueTicket | null>(null)
  const [selectedDraft, setSelectedDraft] = useState<SupportKbApprovalDraft | null>(null)
  const [notesDraft, setNotesDraft] = useState('')
  const [statusDraft, setStatusDraft] = useState('open')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)

  const selectionSummary = useMemo(() => metadataSummary(selectedTicket), [selectedTicket])

  useEffect(() => {
    if (requestedTicketId) setSelectedTicketId(requestedTicketId)
  }, [requestedTicketId])

  useEffect(() => {
    if (requestedDraftId) setSelectedDraftId(requestedDraftId)
  }, [requestedDraftId])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoadError(null)
        const [ticketRows, draftRows] = await Promise.all([
          listSupportQueueTickets(session),
          listKbApprovalDrafts(session),
        ])
        if (cancelled) return
        setTickets(ticketRows)
        setDrafts(draftRows)

        const preferredTicketId = requestedTicketId ?? selectedTicketId ?? ticketRows[0]?.ticket_id ?? null
        const preferredDraftId = requestedDraftId ?? selectedDraftId ?? draftRows[0]?.id ?? null

        const [preferredTicket, preferredDraft] = await Promise.all([
          preferredTicketId ? getSupportQueueTicket(session, preferredTicketId).catch(() => null) : Promise.resolve(null),
          preferredDraftId ? getKbApprovalDraft(session, preferredDraftId).catch(() => null) : Promise.resolve(null),
        ])
        if (cancelled) return

        const fallbackTicket = selectedTicketId
          ? ticketRows.find((item) => item.ticket_id === selectedTicketId) ?? null
          : ticketRows[0] ?? null
        const fallbackDraft = selectedDraftId
          ? draftRows.find((item) => item.id === selectedDraftId) ?? null
          : draftRows[0] ?? null

        const ticket = preferredTicket ?? fallbackTicket
        const draft = preferredDraft ?? fallbackDraft

        setTickets(
          ticket && !ticketRows.some((item) => item.ticket_id === ticket.ticket_id) ? [ticket, ...ticketRows] : ticketRows,
        )
        setDrafts(draft && !draftRows.some((item) => item.id === draft.id) ? [draft, ...draftRows] : draftRows)
        setSelectedTicketId(ticket?.ticket_id ?? null)
        setSelectedDraftId(draft?.id ?? null)
        setSelectedTicket(ticket)
        setNotesDraft(ticket?.internal_notes ?? '')
        setStatusDraft(ticket?.status ?? 'open')
        setSelectedDraft(draft)
      } catch (error) {
        if (cancelled) return
        setLoadError(error instanceof Error ? error.message : 'Support queue failed to load')
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [session, selectedTicketId, selectedDraftId, reloadToken, requestedTicketId, requestedDraftId])

  async function refreshAll() {
    setReloadToken((current) => current + 1)
  }

  async function saveTicket() {
    if (!selectedTicketId) return
    setBusyAction('ticket-save')
    try {
      const ticket = await updateSupportQueueTicket(session, selectedTicketId, {
        status: statusDraft,
        internalNotes: notesDraft,
      })
      setSelectedTicket(ticket)
      setTickets((current) => current.map((item) => (item.ticket_id === ticket.ticket_id ? ticket : item)))
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not update ticket')
    } finally {
      setBusyAction(null)
    }
  }

  async function retryNotifications() {
    if (!selectedTicketId) return
    setBusyAction('notifications')
    try {
      const ticket = await retrySupportQueueNotifications(session, selectedTicketId)
      setSelectedTicket(ticket)
      setTickets((current) => current.map((item) => (item.ticket_id === ticket.ticket_id ? ticket : item)))
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not retry notifications')
    } finally {
      setBusyAction(null)
    }
  }

  async function moveToKbBin() {
    if (!selectedTicketId) return
    setBusyAction('kb-bin')
    try {
      const draft = await moveTicketToKbApprovalBin(session, selectedTicketId)
      setSelectedDraftId(draft.id)
      setSelectedDraft(draft)
      setDrafts((current) => {
        const next = current.filter((item) => item.id !== draft.id)
        return [draft, ...next]
      })
      const ticket = await getSupportQueueTicket(session, selectedTicketId)
      setSelectedTicket(ticket)
      setTickets((current) => current.map((item) => (item.ticket_id === ticket.ticket_id ? ticket : item)))
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not move ticket to KB bin')
    } finally {
      setBusyAction(null)
    }
  }

  async function saveDraft() {
    if (!selectedDraft) return
    setBusyAction('draft-save')
    try {
      const draft = await updateKbApprovalDraft(session, selectedDraft.id, {
        title: selectedDraft.title,
        body_markdown: selectedDraft.body_markdown,
        topic: selectedDraft.topic,
        intent: selectedDraft.intent,
        review_status: selectedDraft.review_status,
      })
      setSelectedDraft(draft)
      setDrafts((current) => current.map((item) => (item.id === draft.id ? draft : item)))
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not update draft')
    } finally {
      setBusyAction(null)
    }
  }

  async function approveDraft() {
    if (!selectedDraft) return
    setBusyAction('draft-approve')
    try {
      const draft = await approveAndIngestKbApprovalDraft(session, selectedDraft.id)
      setSelectedDraft(draft)
      setDrafts((current) => current.map((item) => (item.id === draft.id ? draft : item)))
      if (draft.source_ticket_id) {
        const ticket = await getSupportQueueTicket(session, draft.source_ticket_id)
        setSelectedTicket(ticket)
        setTickets((current) => current.map((item) => (item.ticket_id === ticket.ticket_id ? ticket : item)))
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not ingest draft')
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px,1fr,1fr]">
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-white">Support Queue</h1>
            <p className="text-xs text-slate-400">Operator-only queue inside Kinetix web.</p>
          </div>
          <button
            type="button"
            onClick={() => void refreshAll()}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-200 hover:bg-white/5"
          >
            <RefreshCcw size={14} />
            Refresh
          </button>
        </div>
        {loadError && (
          <p className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-200" role="alert">
            {loadError}
          </p>
        )}
        <div className="space-y-2">
          {tickets.map((ticket) => (
            <button
              key={ticket.ticket_id}
              type="button"
              aria-pressed={selectedTicketId === ticket.ticket_id}
              onClick={() => setSelectedTicketId(ticket.ticket_id)}
              className={`w-full rounded-lg border px-3 py-3 text-left text-sm ${
                selectedTicketId === ticket.ticket_id
                  ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-100'
                  : 'border-white/10 bg-black/20 text-slate-300 hover:bg-white/5'
              }`}
            >
              <div className="font-medium">{ticket.issue_summary}</div>
              <div className="mt-1 text-xs text-slate-400">
                {ticket.ticket_id} · {ticket.status} · {formatTimestamp(ticket.created_at)}
              </div>
            </button>
          ))}
          {tickets.length === 0 && <p className="text-sm text-slate-500">No tickets yet.</p>}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Ticket Detail</h2>
          <p className="text-xs text-slate-400">Persistence is authoritative. Notification failures stay visible here.</p>
        </div>
        {selectedTicket ? (
          <>
            <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-slate-300 space-y-2">
              <div className="font-medium text-slate-100">{selectedTicket.issue_summary}</div>
              <div>Ticket: <span className="font-mono text-xs">{selectedTicket.ticket_id}</span></div>
              <div>Topic: {selectionSummary.topic}</div>
              <div>Retrieval: {selectionSummary.retrieval}</div>
              <div>Route: {selectionSummary.route}</div>
              <div>Slack: {selectedTicket.notification_slack_status}</div>
              <div>Email: {selectedTicket.notification_email_status}</div>
              <div>Last notification attempt: {formatTimestamp(selectedTicket.notification_last_attempt_at)}</div>
              {selectedTicket.notification_error_summary && (
                <div className="text-red-200">Notification errors: {selectedTicket.notification_error_summary}</div>
              )}
            </div>

            <label className="space-y-2 block">
              <span className="text-sm text-slate-200">Status</span>
              <select
                value={statusDraft}
                onChange={(event) => setStatusDraft(event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              >
                {TICKET_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 block">
              <span className="text-sm text-slate-200">Internal notes</span>
              <textarea
                value={notesDraft}
                onChange={(event) => setNotesDraft(event.target.value)}
                rows={8}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void saveTicket()}
                disabled={busyAction !== null}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100 disabled:opacity-50"
              >
                {busyAction === 'ticket-save' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Save ticket
              </button>
              <button
                type="button"
                onClick={() => void retryNotifications()}
                disabled={busyAction !== null}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200 disabled:opacity-50"
              >
                {busyAction === 'notifications' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Retry notifications
              </button>
              <button
                type="button"
                onClick={() => void moveToKbBin()}
                disabled={busyAction !== null || statusDraft !== 'resolved'}
                className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-100 disabled:opacity-50"
              >
                {busyAction === 'kb-bin' ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                Move to KB approval bin
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500">Select a ticket to inspect and update it.</p>
        )}
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">KB Approval Bin</h2>
          <p className="text-xs text-slate-400">Resolved tickets become curated drafts here. Nothing auto-ingests.</p>
        </div>

        <div className="space-y-2 max-h-48 overflow-auto">
          {drafts.map((draft) => (
            <button
              key={draft.id}
              type="button"
              aria-pressed={selectedDraftId === draft.id}
              onClick={() => setSelectedDraftId(draft.id)}
              className={`w-full rounded-lg border px-3 py-3 text-left text-sm ${
                selectedDraftId === draft.id
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                  : 'border-white/10 bg-black/20 text-slate-300 hover:bg-white/5'
              }`}
            >
              <div className="font-medium">{draft.title}</div>
              <div className="mt-1 text-xs text-slate-400">
                {draft.review_status} · {draft.topic} · {formatTimestamp(draft.updated_at)}
              </div>
            </button>
          ))}
          {drafts.length === 0 && <p className="text-sm text-slate-500">No KB drafts yet.</p>}
        </div>

        {selectedDraft ? (
          <>
            <label className="space-y-2 block">
              <span className="text-sm text-slate-200">Title</span>
              <input
                value={selectedDraft.title}
                onChange={(event) => setSelectedDraft((current) => (current ? { ...current, title: event.target.value } : current))}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="space-y-2 block">
              <span className="text-sm text-slate-200">Body markdown</span>
              <textarea
                value={selectedDraft.body_markdown}
                onChange={(event) =>
                  setSelectedDraft((current) => (current ? { ...current, body_markdown: event.target.value } : current))
                }
                rows={10}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-2 block">
                <span className="text-sm text-slate-200">Topic</span>
                <select
                  value={selectedDraft.topic}
                  onChange={(event) => setSelectedDraft((current) => (current ? { ...current, topic: event.target.value } : current))}
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                >
                  {KB_TOPIC_OPTIONS.map((topic) => (
                    <option key={topic} value={topic}>
                      {topic}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 block">
                <span className="text-sm text-slate-200">Intent</span>
                <select
                  value={selectedDraft.intent}
                  onChange={(event) => setSelectedDraft((current) => (current ? { ...current, intent: event.target.value } : current))}
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                >
                  {KB_INTENT_OPTIONS.map((intent) => (
                    <option key={intent} value={intent}>
                      {intent}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 block">
                <span className="text-sm text-slate-200">Review status</span>
                <select
                  value={selectedDraft.review_status}
                  onChange={(event) =>
                    setSelectedDraft((current) => (current ? { ...current, review_status: event.target.value } : current))
                  }
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                >
                  {KB_REVIEW_STATUS_OPTIONS.map((reviewStatus) => (
                    <option key={reviewStatus} value={reviewStatus}>
                      {reviewStatus}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void saveDraft()}
                disabled={busyAction !== null}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100 disabled:opacity-50"
              >
                {busyAction === 'draft-save' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Save draft
              </button>
              <button
                type="button"
                onClick={() => void approveDraft()}
                disabled={busyAction !== null}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100 disabled:opacity-50"
              >
                {busyAction === 'draft-approve' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Approve and ingest
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500">Select a KB draft to edit and ingest it.</p>
        )}
      </section>
    </div>
  )
}
