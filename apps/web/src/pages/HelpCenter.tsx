import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { MessageCircle, Settings, Mail, AlertTriangle, BookOpen, Wrench, Search, Loader2 } from 'lucide-react'
import { KINETIX_PERFORMANCE_SCORE } from '../lib/branding'
import {
  DETERMINISTIC_FALLBACK_DISCLAIMER,
  getBestSupportSimilarity,
  getDeterministicFallbackSections,
  isHelpSupportSearchCycleUnresolved,
  isWeakOrEmptyRetrieval,
  shouldProposeHelpEscalation,
} from '../lib/helpCenterFallback'
import { postHelpCenterSupportAnswer } from '../lib/helpCenterSupportAi'
import type { HelpSupportAiOutcome } from '../lib/helpCenterSupportAi'
import { buildSupportEscalationPayload, buildTicketPayloadMailtoHref } from '../lib/helpCenterEscalation'
import { useAuth } from '../components/providers/useAuth'
import { Dialog } from '../components/a11y/Dialog'
import { createSupportTicket, querySupportKB } from '../lib/supportRagClient'
import type { SupportKBQueryOutcome } from '../lib/supportRagClient'

const QUICK_PROMPTS: { label: string; query: string }[] = [
  { label: 'Strava connection', query: 'How do I connect or sync Strava?' },
  { label: 'Import runs', query: 'How do I import Garmin or FIT files?' },
  { label: 'KPS and charts', query: 'What is KPS and where are charts?' },
]

type EscalationPhase = 'none' | 'proposing' | 'escalated' | 'capped'

/**
 * Manual test matrix (Help Center escalation):
 *
 * - First unresolved search or first "still not resolved" click → no escalation yet (hybrid gate)
 * - Second unresolved search OR second "still not resolved" click → escalation proposed
 * - User clicks Yes → ticket created (no ticket before confirm)
 * - User clicks No → continue troubleshooting; no immediate re-prompt until gate re-satisfied
 * - Ticket API failure → mailto fallback when VITE_SUPPORT_EMAIL set
 * - Mailto unavailable → fallback error message
 */

const maxEscalationAttempts = 2

function makeEscalationProposeKey(
  outcome: SupportKBQueryOutcome,
  stillNotResolvedClicks: number,
  unresolvedCompletedSearchCount: number,
  bestSimilarity: number | null,
  aiFingerprint: string,
): string {
  if (outcome.ok === false) {
    return `${stillNotResolvedClicks}|${unresolvedCompletedSearchCount}|fail:${outcome.reason}|${aiFingerprint}`
  }
  return `${stillNotResolvedClicks}|${unresolvedCompletedSearchCount}|${outcome.data.query}|${bestSimilarity ?? 'null'}|${outcome.data.results.length}|${aiFingerprint}`
}

function Section({
  id,
  title,
  icon: Icon,
  children,
}: {
  id: string
  title: string
  icon: LucideIcon
  children: ReactNode
}) {
  return (
    <section id={id} className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
        <Icon size={20} className="text-cyan-400 shrink-0" />
        {title}
      </h2>
      <div className="text-sm text-slate-300 space-y-2 leading-relaxed">{children}</div>
    </section>
  )
}

function truncateDoc(text: string, max = 480): string {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

function fallbackQueryText(outcome: SupportKBQueryOutcome | null, input: string): string {
  if (outcome?.ok === true) return outcome.data.query
  return input.trim()
}

function aiOutcomeFingerprint(ai: HelpSupportAiOutcome | null): string {
  if (!ai) return 'none'
  if (ai.ok === false) return `err:${ai.reason}`
  return `ok:${ai.text.length}`
}

function buildConversationExcerpt(
  outcome: SupportKBQueryOutcome | null,
  query: string,
  aiOutcome: HelpSupportAiOutcome | null,
): string {
  const q = query.trim() || '—'
  const aiLine =
    aiOutcome === null
      ? 'Support AI: (not run)'
      : aiOutcome.ok === true
        ? `Support AI: answered (${aiOutcome.text.length} chars)`
        : `Support AI: failed (${aiOutcome.reason}${aiOutcome.message ? ` — ${aiOutcome.message}` : ''})`
  if (!outcome) return `Support search query: ${q}\n${aiLine}`
  if (outcome.ok === false) {
    return `Support search query: ${q}\nOutcome: ${outcome.reason}${outcome.reason === 'http_error' ? ` (${outcome.status})` : ''}\n${aiLine}`
  }
  const ids = outcome.data.results.slice(0, 3).map((r) => r.chunkId).join(', ')
  return `Support search query: ${q}\nTop chunk ids: ${ids || 'none'}\n${aiLine}`
}

function buildAttemptedSolutionsSummary(
  showDeterministicFallback: boolean,
  fallbackSections: ReturnType<typeof getDeterministicFallbackSections>,
  aiOutcome: HelpSupportAiOutcome | null,
): string {
  const aiPart =
    aiOutcome === null
      ? 'Support AI: not available for summary.'
      : aiOutcome.ok === true
        ? 'Support AI: generated a KB-grounded answer.'
        : `Support AI: failed (${aiOutcome.reason}).`
  if (!showDeterministicFallback) {
    return `${aiPart} Curated KB matches looked strong enough to list as sources.`
  }
  const titles = fallbackSections.map((s) => s.title)
  return `${aiPart} Deterministic fallback sections shown: ${titles.join('; ') || 'general tips'}.`
}

function buildStructuredTicketMetadata(
  supportOutcome: SupportKBQueryOutcome | null,
  supportInput: string,
  sessionUserId: string | null | undefined,
  showDeterministicFallback: boolean,
  supportAiOutcome: HelpSupportAiOutcome | null,
  stillNotResolvedClicks: number,
  unresolvedCompletedSearchCount: number,
) {
  if (!supportOutcome) return undefined
  const escalationPayload = buildSupportEscalationPayload({
    userQuery: fallbackQueryText(supportOutcome, supportInput),
    supportOutcome,
    route: '/help',
    userIdOpaque: sessionUserId ?? null,
    fallbackGuidanceShown: showDeterministicFallback,
    helpSupportAiOk: supportAiOutcome?.ok === true,
    helpSupportAiAnswerText: supportAiOutcome?.ok === true ? supportAiOutcome.text : null,
    helpStillNotResolvedClicks: stillNotResolvedClicks,
    helpUnresolvedCompletedSearchCount: unresolvedCompletedSearchCount,
  })

  return {
    route: escalationPayload.route,
    timestamp_utc: escalationPayload.timestampUtc,
    user_id_opaque: escalationPayload.userIdOpaque,
    app_version: escalationPayload.appVersion,
    user_query: escalationPayload.userQuery,
    inferred_topic: escalationPayload.inferredTopic,
    retrieval_state: escalationPayload.retrievalState,
    fallback_guidance_shown: escalationPayload.fallbackGuidanceShown,
    surfaced_articles: escalationPayload.surfacedArticles,
    help_support_ai_ok: escalationPayload.helpSupportAiOk,
    help_support_ai_answer_hash: escalationPayload.helpSupportAiAnswerHash,
    help_still_not_resolved_clicks: escalationPayload.helpStillNotResolvedClicks,
    help_unresolved_completed_search_count: escalationPayload.helpUnresolvedCompletedSearchCount,
  }
}

export default function HelpCenter() {
  const supportEmail =
    typeof import.meta.env.VITE_SUPPORT_EMAIL === 'string' && import.meta.env.VITE_SUPPORT_EMAIL.trim()
      ? import.meta.env.VITE_SUPPORT_EMAIL.trim()
      : undefined
  const { session } = useAuth()
  const [supportInput, setSupportInput] = useState('')
  const [supportLoading, setSupportLoading] = useState(false)
  const [supportOutcome, setSupportOutcome] = useState<SupportKBQueryOutcome | null>(null)
  const [supportAiOutcome, setSupportAiOutcome] = useState<HelpSupportAiOutcome | null>(null)
  const [stillNotResolvedClicks, setStillNotResolvedClicks] = useState(0)
  const [unresolvedCompletedSearchCount, setUnresolvedCompletedSearchCount] = useState(0)
  const [proposalDismissed, setProposalDismissed] = useState(false)
  const [escalationPhase, setEscalationPhase] = useState<EscalationPhase>('none')
  const [ticketId, setTicketId] = useState<string | null>(null)
  const [ticketActionError, setTicketActionError] = useState<string | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  const lastCompletedQueryRef = useRef('')
  const lastProposeKeyRef = useRef<string | null>(null)
  const escalationPromptsShownRef = useRef(0)
  /** True after user clicks "No, keep troubleshooting" so the next proposal counts toward the cap. */
  const userDismissedProposalRef = useRef(false)

  const runSupportSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim()
      if (!trimmed) return
      setSupportLoading(true)
      setTicketActionError(null)
      setSupportOutcome(null)
      setSupportAiOutcome(null)
      setEscalationPhase((prev) => (prev === 'escalated' ? prev : 'none'))
      try {
        const out = await querySupportKB(trimmed, { topK: 5 })
        const bestSim = out.ok === true ? getBestSupportSimilarity(out.data.results) : null
        const aiOut = await postHelpCenterSupportAnswer(trimmed, out, {
          accessToken: session?.access_token ?? null,
        })

        const queryChanged = lastCompletedQueryRef.current !== trimmed
        lastCompletedQueryRef.current = trimmed

        const cycleUnresolved = isHelpSupportSearchCycleUnresolved(out, bestSim, aiOut)

        if (queryChanged) {
          escalationPromptsShownRef.current = 0
          userDismissedProposalRef.current = false
          lastProposeKeyRef.current = null
        }
        if (queryChanged || cycleUnresolved) {
          setProposalDismissed(false)
          lastProposeKeyRef.current = null
        }

        setSupportOutcome(out)
        setSupportAiOutcome(aiOut)
        if (cycleUnresolved) {
          setUnresolvedCompletedSearchCount((c) => c + 1)
        }
      } finally {
        setSupportLoading(false)
      }
    },
    [session?.access_token],
  )

  const showDeterministicFallback =
    supportOutcome !== null &&
    (supportOutcome.ok === false ||
      (supportOutcome.ok === true && isWeakOrEmptyRetrieval(supportOutcome.data.results)))

  const showWeakRetrievalNote =
    supportOutcome?.ok === true &&
    supportOutcome.data.results.length > 0 &&
    isWeakOrEmptyRetrieval(supportOutcome.data.results)

  const showRetrievalList =
    supportOutcome?.ok === true && supportOutcome.data.results.length > 0

  const fallbackSections = useMemo(
    () =>
      showDeterministicFallback
        ? getDeterministicFallbackSections(fallbackQueryText(supportOutcome, supportInput))
        : [],
    [showDeterministicFallback, supportOutcome, supportInput],
  )

  const bestSimilarity = useMemo(() => {
    if (!supportOutcome || supportOutcome.ok !== true) return null
    return getBestSupportSimilarity(supportOutcome.data.results)
  }, [supportOutcome])

  useEffect(() => {
    if (escalationPhase === 'escalated' || escalationPhase === 'capped') return
    if (proposalDismissed) return
    if (!supportOutcome) return
    const propose = shouldProposeHelpEscalation({
      supportOutcome,
      stillNotResolvedClicks,
      unresolvedCompletedSearchCount,
    })
    if (!propose) return

    const proposeKey = makeEscalationProposeKey(
      supportOutcome,
      stillNotResolvedClicks,
      unresolvedCompletedSearchCount,
      bestSimilarity,
      aiOutcomeFingerprint(supportAiOutcome),
    )
    if (proposeKey === lastProposeKeyRef.current) return

    const shouldCountNewPrompt =
      escalationPromptsShownRef.current === 0 || userDismissedProposalRef.current

    if (shouldCountNewPrompt && escalationPromptsShownRef.current >= maxEscalationAttempts) {
      lastProposeKeyRef.current = proposeKey
      setEscalationPhase('capped')
      return
    }

    if (shouldCountNewPrompt) {
      escalationPromptsShownRef.current += 1
      userDismissedProposalRef.current = false
    }

    lastProposeKeyRef.current = proposeKey
    setEscalationPhase('proposing')
  }, [
    supportOutcome,
    supportAiOutcome,
    stillNotResolvedClicks,
    unresolvedCompletedSearchCount,
    proposalDismissed,
    bestSimilarity,
    escalationPhase,
  ])

  const escalationPayloadForMail = useMemo(() => {
    if (!supportOutcome) return null
    return buildSupportEscalationPayload({
      userQuery: fallbackQueryText(supportOutcome, supportInput),
      supportOutcome,
      route: '/help',
      userIdOpaque: session?.user?.id ?? null,
      fallbackGuidanceShown: showDeterministicFallback,
      helpSupportAiOk: supportAiOutcome?.ok === true,
      helpSupportAiAnswerText: supportAiOutcome?.ok === true ? supportAiOutcome.text : null,
      helpStillNotResolvedClicks: stillNotResolvedClicks,
      helpUnresolvedCompletedSearchCount: unresolvedCompletedSearchCount,
    })
  }, [
    session?.user?.id,
    showDeterministicFallback,
    supportInput,
    supportOutcome,
    supportAiOutcome,
    stillNotResolvedClicks,
    unresolvedCompletedSearchCount,
  ])

  const buildTicketPayload = useCallback(() => {
    const uid = session?.user?.id
    const issueSummary = fallbackQueryText(supportOutcome, supportInput) || 'Support request from Help Center'
    const metadata = buildStructuredTicketMetadata(
      supportOutcome,
      supportInput,
      uid,
      showDeterministicFallback,
      supportAiOutcome,
      stillNotResolvedClicks,
      unresolvedCompletedSearchCount,
    )
    return {
      product: 'kinetix' as const,
      userId: typeof uid === 'string' && uid ? uid : null,
      timestamp: new Date().toISOString(),
      issueSummary,
      conversationExcerpt: buildConversationExcerpt(supportOutcome, supportInput, supportAiOutcome),
      attemptedSolutions: buildAttemptedSolutionsSummary(
        showDeterministicFallback,
        fallbackSections,
        supportAiOutcome,
      ),
      environment: 'web' as const,
      severity: 'unknown' as const,
      metadata,
    }
  }, [
    session?.user?.id,
    showDeterministicFallback,
    fallbackSections,
    supportInput,
    supportOutcome,
    supportAiOutcome,
    stillNotResolvedClicks,
    unresolvedCompletedSearchCount,
  ])

  const confirmEscalation = useCallback(async () => {
    setConfirmLoading(true)
    setTicketActionError(null)
    const payload = buildTicketPayload()
    const result = await createSupportTicket(payload)
    if (result.ok) {
      setTicketId(result.ticketId)
      setEscalationPhase('escalated')
      setConfirmLoading(false)
      return
    }
    setConfirmLoading(false)
    if (supportEmail) {
      const mail = buildTicketPayloadMailtoHref(supportEmail, { ...payload, ticketApiError: result.reason })
      window.location.href = mail
      return
    }
    setTicketActionError(
      result.reason === 'unavailable'
        ? 'Could not reach the support service. Try again later.'
        : `Could not create the ticket (HTTP ${result.status ?? 'error'}).`,
    )
  }, [buildTicketPayload, supportEmail])

  const dismissProposal = useCallback(() => {
    userDismissedProposalRef.current = true
    setProposalDismissed(true)
    setEscalationPhase('none')
  }, [])

  const markStillUnresolved = useCallback(() => {
    setStillNotResolvedClicks((c) => c + 1)
    setProposalDismissed(false)
    lastProposeKeyRef.current = null
  }, [])

  const showSupportResults = supportOutcome !== null && !supportLoading
  const showUniversalUnresolved = showSupportResults

  return (
    <div className="space-y-6 pb-24 lg:pb-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Help Center</h1>
        <p className="text-slate-400 text-sm mt-1">
          Support search is AI-first: answers are generated from curated KB excerpts when available, with escalation
          only after two unsuccessful attempts (two unresolved searches or two &quot;still not resolved&quot; signals).
          Coach chat stays the best place for run-specific coaching. Tickets are never created without confirmation.
        </p>
      </div>

      <Section id="ai-help" title="AI Help" icon={MessageCircle}>
        <p>
          The <strong className="text-slate-200">Coach chat</strong> is the dedicated path for questions about runs,{' '}
          {KINETIX_PERFORMANCE_SCORE}, and training context from the app.
        </p>
        <p className="text-slate-400 text-xs">
          The support search below also uses AI, grounded in the curated support knowledge base (not run-coach RAG).
        </p>
        <Link
          to="/chat"
          className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/20 transition-colors"
        >
          <MessageCircle size={18} />
          Open Coach chat
        </Link>
      </Section>

      <Section id="support-kb" title="Support search (AI + KB)" icon={Search}>
        <p className="text-slate-400 text-xs">
          Runs curated KB retrieval first, then calls the app&apos;s AI support assistant with those excerpts. Requires
          the RAG service (e.g. local <code className="text-slate-500">pnpm start</code> in{' '}
          <code className="text-slate-500">apps/rag</code> or <code className="text-slate-500">VITE_RAG_SERVICE_URL</code>
          ) and a reachable <code className="text-slate-500">/api/ai-chat</code> (local dev via{' '}
          <code className="text-slate-500">pnpm dev</code>).
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p.label}
              type="button"
              disabled={supportLoading}
              onClick={() => {
                setSupportInput(p.query)
                void runSupportSearch(p.query)
              }}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10 disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label htmlFor="help-support-search" className="sr-only">
            Support search question
          </label>
          <input
            id="help-support-search"
            type="text"
            value={supportInput}
            onChange={(e) => setSupportInput(e.target.value)}
            placeholder="e.g. Withings scale not syncing"
            className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none"
            disabled={supportLoading}
            autoComplete="off"
          />
          <button
            type="button"
            disabled={supportLoading || !supportInput.trim()}
            onClick={() => void runSupportSearch(supportInput)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-50"
          >
            {supportLoading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
            Search
          </button>
        </div>

        {supportLoading && (
          <p
            className="text-slate-400 text-xs flex items-center gap-2 pt-2"
            data-testid="help-support-loading"
            role="status"
            aria-live="polite"
          >
            <Loader2 size={14} className="animate-spin shrink-0" aria-hidden />
            Retrieving support articles and generating an answer…
          </p>
        )}

        {supportOutcome?.ok === false && supportOutcome.reason === 'unavailable' && (
          <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-amber-200/90 text-xs">
            Curated support search is unavailable (RAG service not reachable). The AI answer may still run with no
            excerpts; use deterministic tips below, Coach chat, or Settings.
          </p>
        )}

        {supportOutcome?.ok === false && supportOutcome.reason !== 'unavailable' && (
          <p className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-red-200/90 text-xs">
            Support search failed ({supportOutcome.reason}
            {supportOutcome.reason === 'http_error' ? ` ${supportOutcome.status}` : ''}). The AI step may still run with
            error context — fixed tips below still apply.
          </p>
        )}

        {showSupportResults && supportAiOutcome?.ok === true && (
          <div
            className="mt-3 space-y-2 rounded-lg border border-cyan-500/25 bg-cyan-500/5 p-4"
            data-testid="help-support-ai-answer"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-200/80">Support assistant</p>
            <p className="text-sm text-slate-200 whitespace-pre-wrap">{supportAiOutcome.text}</p>
            <p className="text-[10px] text-slate-500">
              Generated from curated KB excerpts when available; verify critical steps in Settings or official docs.
            </p>
          </div>
        )}

        {showSupportResults && supportAiOutcome && supportAiOutcome.ok === false && (
          <p
            className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-amber-200/90 text-xs"
            data-testid="help-support-ai-error"
          >
            Could not generate a support answer ({supportAiOutcome.reason}
            {supportAiOutcome.message ? `: ${supportAiOutcome.message}` : ''}). Sources and deterministic tips below may
            still help.
          </p>
        )}

        {showWeakRetrievalNote && (
          <p className="text-amber-200/85 text-xs border border-amber-500/15 rounded-lg px-3 py-2 bg-amber-500/5 mt-2">
            Source matches look weak (low similarity). Prefer the assistant answer and deterministic tips if the excerpts
            look off-topic.
          </p>
        )}

        {showRetrievalList && supportOutcome?.ok === true && (
          <div className="pt-3 mt-2 border-t border-white/10 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sources (curated KB)</p>
            <ul className="space-y-3">
              {supportOutcome.data.results.map((r) => {
                const title =
                  typeof r.metadata.title === 'string' && r.metadata.title
                    ? r.metadata.title
                    : r.chunkId || 'Article'
                const topic = typeof r.metadata.topic === 'string' ? r.metadata.topic : null
                return (
                  <li
                    key={r.chunkId}
                    className="rounded-lg border border-white/10 bg-black/20 p-3 text-slate-300 text-xs space-y-1"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-200">{title}</span>
                      {topic && (
                        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase text-slate-400">
                          {topic}
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap text-slate-400">{truncateDoc(r.document)}</p>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {showDeterministicFallback && (
          <div
            className="mt-3 space-y-3 rounded-lg border border-slate-600/40 bg-slate-950/50 p-4"
            data-testid="deterministic-fallback"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Deterministic fallback</p>
            <p className="text-xs text-slate-400">{DETERMINISTIC_FALLBACK_DISCLAIMER}</p>
            {fallbackSections.map((section) => (
              <div key={section.id} className="space-y-1.5">
                <h3 className="text-sm font-medium text-slate-200">{section.title}</h3>
                <ul className="list-disc space-y-1 pl-5 text-xs text-slate-400">
                  {section.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {showUniversalUnresolved && (
          <div className="pt-3 border-t border-white/10 mt-2">
            <button
              type="button"
              onClick={markStillUnresolved}
              className="text-xs text-amber-200/90 underline-offset-2 hover:underline"
              data-testid="help-mark-unresolved"
            >
              Still not resolved — this did not fix the issue
            </button>
          </div>
        )}

        {escalationPhase === 'capped' && (
          <p
            className="mt-4 rounded-lg border border-slate-500/30 bg-slate-800/40 px-3 py-2 text-slate-200 text-sm"
            data-testid="help-escalation-capped"
          >
            Support request recorded. The team will review.
          </p>
        )}

        {escalationPhase === 'proposing' ? (
          <Dialog
            open
            onClose={dismissProposal}
            ariaLabelledBy="help-escalation-title"
            ariaDescribedBy="help-escalation-desc"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          >
            <div
              className="max-w-md w-full rounded-lg border border-cyan-500/30 bg-slate-950/95 p-4 space-y-3 shadow-xl"
              data-testid="help-escalation-proposal"
            >
              <h2 id="help-escalation-title" className="text-base font-semibold text-cyan-100">
                Escalate to the team
              </h2>
              <p id="help-escalation-desc" className="text-sm text-slate-200">
                I couldn&apos;t resolve this. Would you like me to escalate this to the team?
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={confirmLoading}
                  onClick={() => void confirmEscalation()}
                  className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/50 bg-cyan-500/15 px-4 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-500/25 disabled:opacity-50"
                  data-testid="help-escalation-confirm-yes"
                >
                  {confirmLoading ? <Loader2 size={18} className="animate-spin" /> : null}
                  Yes, escalate to the team
                </button>
                <button
                  type="button"
                  disabled={confirmLoading}
                  onClick={dismissProposal}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
                  data-testid="help-escalation-confirm-no"
                >
                  No, keep troubleshooting
                </button>
              </div>
              {ticketActionError && (
                <p className="text-xs text-red-300/90" data-testid="help-escalation-error" role="alert">
                  {ticketActionError}
                </p>
              )}
              {supportEmail && (
                <p className="text-[11px] text-slate-500">
                  If ticket creation fails, the app opens a mailto with the same structured payload when{' '}
                  <code className="text-slate-400">VITE_SUPPORT_EMAIL</code> is set.
                </p>
              )}
            </div>
          </Dialog>
        ) : null}

        {escalationPhase === 'escalated' && ticketId && (
          <p
            className="mt-4 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-emerald-100/95 text-sm"
            data-testid="help-escalation-success"
          >
            Escalation recorded. Reference: <span className="font-mono text-xs">{ticketId}</span>
          </p>
        )}
      </Section>

      <Section id="troubleshooting" title="Troubleshooting" icon={Wrench}>
        <ul className="list-disc pl-5 space-y-1 text-slate-300">
          <li>Strava or Withings not connecting: check OAuth and redirect URLs in Settings.</li>
          <li>Runs missing after import: confirm sync completed; try manual import from Settings.</li>
          <li>Charts or history look off: verify weight source and target {KINETIX_PERFORMANCE_SCORE} in Settings.</li>
        </ul>
        <Link
          to="/settings"
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200 hover:bg-white/5 transition-colors"
        >
          <Settings size={18} />
          Open Settings
        </Link>
      </Section>

      <Section id="faq" title="FAQ" icon={BookOpen}>
        <dl className="space-y-3">
          <div>
            <dt className="font-medium text-slate-200">What data stays on this device?</dt>
            <dd className="text-slate-400 mt-0.5">
              Run history and related app data are stored locally in the browser unless a feature explicitly syncs to a
              connected service you configured.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-200">Is Coach chat medical advice?</dt>
            <dd className="text-slate-400 mt-0.5">
              No. It is coaching and analytics assistance. For health concerns, consult a qualified professional.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-200">How does escalation work?</dt>
            <dd className="text-slate-400 mt-0.5">
              There is no self-serve &quot;open ticket&quot; control. After two unsuccessful support attempts (two
              unresolved searches or two &quot;still not resolved&quot; clicks), the flow may propose escalation; a
              ticket is created only if you confirm. Coach chat remains the first place for run-specific help.
            </dd>
          </div>
        </dl>
      </Section>

      <Section id="contact" title="Team escalation" icon={Mail}>
        <p>
          Account or platform issues are escalated from this page only after the hybrid attempt rule and your
          confirmation — not via a direct ticket button. Use{' '}
          <Link to="/chat" className="text-cyan-300/90 underline-offset-2 hover:underline">
            Coach chat
          </Link>{' '}
          for training and run questions.
        </p>
        {escalationPayloadForMail && supportEmail && (
          <p className="text-xs text-slate-500">
            Diagnostic context from the last support search is included if you use email fallback after a failed ticket
            API (mailto uses the same structured fields when configured).
          </p>
        )}
        {!supportEmail && (
          <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-amber-200/90 text-xs">
            Optional: set <code className="text-amber-100/90">VITE_SUPPORT_EMAIL</code> so a failed ticket API can open
            mail with the structured payload. Otherwise rely on the in-app ticket queue when the RAG service is
            reachable.
          </p>
        )}
      </Section>

      <Section id="limitations" title="Known limitations & support boundaries" icon={AlertTriangle}>
        <ul className="list-disc pl-5 space-y-1 text-slate-400">
          <li>
            Support search answers are AI-generated from KB excerpts; they can be wrong when retrieval is weak or the
            model misreads context — use Sources and Settings to verify.
          </li>
          <li>Coach chat and support search use different context; pick the path that matches the question.</li>
          <li>Watch and phone apps are separate surfaces; this dashboard covers the web experience.</li>
        </ul>
      </Section>
    </div>
  )
}
