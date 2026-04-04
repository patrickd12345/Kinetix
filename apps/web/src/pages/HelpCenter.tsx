import type { ReactNode } from 'react'
import { useCallback, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { MessageCircle, Settings, Mail, AlertTriangle, BookOpen, Wrench, Search, Loader2 } from 'lucide-react'
import { KINETIX_PERFORMANCE_SCORE } from '../lib/branding'
import {
  DETERMINISTIC_FALLBACK_DISCLAIMER,
  getDeterministicFallbackSections,
  isWeakOrEmptyRetrieval,
} from '../lib/helpCenterFallback'
import {
  buildEscalationMailtoHref,
  buildSupportEscalationPayload,
  ESCALATION_HANDOFF_NOTE,
} from '../lib/helpCenterEscalation'
import { useAuth } from '../components/providers/useAuth'
import { querySupportKB } from '../lib/supportRagClient'
import type { SupportKBQueryOutcome } from '../lib/supportRagClient'

const QUICK_PROMPTS: { label: string; query: string }[] = [
  { label: 'Strava connection', query: 'How do I connect or sync Strava?' },
  { label: 'Import runs', query: 'How do I import Garmin or FIT files?' },
  { label: 'KPS and charts', query: 'What is KPS and where are charts?' },
]

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

export default function HelpCenter() {
  const supportEmail =
    typeof import.meta.env.VITE_SUPPORT_EMAIL === 'string' && import.meta.env.VITE_SUPPORT_EMAIL.trim()
      ? import.meta.env.VITE_SUPPORT_EMAIL.trim()
      : undefined
  const { session } = useAuth()
  const [supportInput, setSupportInput] = useState('')
  const [supportLoading, setSupportLoading] = useState(false)
  const [supportOutcome, setSupportOutcome] = useState<SupportKBQueryOutcome | null>(null)

  const runSupportSearch = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) return
    setSupportLoading(true)
    setSupportOutcome(null)
    try {
      const out = await querySupportKB(trimmed, { topK: 5 })
      setSupportOutcome(out)
    } finally {
      setSupportLoading(false)
    }
  }, [])

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

  const fallbackSections = showDeterministicFallback
    ? getDeterministicFallbackSections(fallbackQueryText(supportOutcome, supportInput))
    : []

  const escalatePayload = useMemo(() => {
    if (!supportOutcome || !showDeterministicFallback) return null
    const uid = session?.user?.id
    return buildSupportEscalationPayload({
      userQuery: fallbackQueryText(supportOutcome, supportInput),
      supportOutcome,
      route: '/help',
      userIdOpaque: typeof uid === 'string' && uid ? uid : null,
      fallbackGuidanceShown: showDeterministicFallback,
    })
  }, [session?.user?.id, showDeterministicFallback, supportInput, supportOutcome])

  const escalationMailtoHref = useMemo(() => {
    if (!supportEmail || !escalatePayload) return null
    return buildEscalationMailtoHref(supportEmail, escalatePayload)
  }, [escalatePayload, supportEmail])

  const genericSupportMailtoHref = supportEmail
    ? `mailto:${supportEmail}?subject=${encodeURIComponent('Kinetix web — support request')}`
    : null

  return (
    <div className="space-y-6 pb-24 lg:pb-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Help Center</h1>
        <p className="text-slate-400 text-sm mt-1">
          Self-service first: AI coach, then troubleshooting, then escalation when something is still wrong.
        </p>
      </div>

      <Section id="ai-help" title="AI Help" icon={MessageCircle}>
        <p>
          The <strong className="text-slate-200">Coach chat</strong> is the AI-first path for questions about runs,{' '}
          {KINETIX_PERFORMANCE_SCORE}, and training context available in this app.
        </p>
        <p className="text-slate-400 text-xs">
          Answers use your run context from the coach RAG. The support search below uses a separate curated knowledge
          base (retrieval only — not a full AI answer).
        </p>
        <Link
          to="/chat"
          className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/20 transition-colors"
        >
          <MessageCircle size={18} />
          Open Coach chat
        </Link>
      </Section>

      <Section id="support-kb" title="Search support articles" icon={Search}>
        <p className="text-slate-400 text-xs">
          Suggested excerpts from the curated support knowledge base (same RAG service as run indexing, separate
          collection). Requires the Kinetix RAG service to be reachable (e.g. local{' '}
          <code className="text-slate-500">pnpm start</code> in <code className="text-slate-500">apps/rag</code> or{' '}
          <code className="text-slate-500">VITE_RAG_SERVICE_URL</code>).
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
          <input
            type="text"
            value={supportInput}
            onChange={(e) => setSupportInput(e.target.value)}
            placeholder="e.g. Withings scale not syncing"
            className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none"
            disabled={supportLoading}
            aria-label="Support search question"
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

        {supportOutcome?.ok === false && supportOutcome.reason === 'unavailable' && (
          <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-amber-200/90 text-xs">
            Curated support search is unavailable (RAG service not reachable). Use the deterministic tips below, Coach
            chat, Settings, or the FAQ.
          </p>
        )}

        {supportOutcome?.ok === false &&
          supportOutcome.reason !== 'unavailable' && (
            <p className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-red-200/90 text-xs">
              Support search failed ({supportOutcome.reason}
              {supportOutcome.reason === 'http_error' ? ` ${supportOutcome.status}` : ''}). Try again later — fixed tips
              below still apply.
            </p>
          )}

        {showWeakRetrievalNote && (
          <p className="text-amber-200/85 text-xs border border-amber-500/15 rounded-lg px-3 py-2 bg-amber-500/5">
            The matches below look weak (low similarity to your question). See deterministic fallback for clearer next
            steps.
          </p>
        )}

        {showRetrievalList && supportOutcome?.ok === true && (
          <ul className="space-y-3 pt-1 border-t border-white/10 mt-2">
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
            {escalationMailtoHref && (
              <div className="pt-2 border-t border-white/10 space-y-2">
                <p className="text-[11px] text-slate-500">{ESCALATION_HANDOFF_NOTE}</p>
                <a
                  href={escalationMailtoHref}
                  data-testid="help-escalation-mailto"
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-500/15 transition-colors"
                >
                  <Mail size={18} />
                  Contact support with this context
                </a>
              </div>
            )}
          </div>
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
            <dt className="font-medium text-slate-200">Where do escalations go?</dt>
            <dd className="text-slate-400 mt-0.5">
              Use the contact path below when self-service and AI do not resolve the issue. Ticket workflows and
              knowledge reinjection are planned; this web app starts with email escalation when configured.
            </dd>
          </div>
        </dl>
      </Section>

      <Section id="contact" title="Ticket / contact" icon={Mail}>
        <p>
          When something remains unresolved after Coach chat and Settings, escalate so the team can help with account or
          platform issues.
        </p>
        {escalatePayload && (
          <p className="text-xs text-slate-500">
            After a support search that still did not resolve the issue, use the button above or the link below — email
            opens with structured context (not a submitted ticket).
          </p>
        )}
        {supportEmail ? (
          <a
            href={escalationMailtoHref ?? genericSupportMailtoHref ?? '#'}
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/20 transition-colors"
            data-testid={escalationMailtoHref ? 'help-contact-mailto-context' : 'help-contact-mailto-generic'}
          >
            <Mail size={18} />
            {escalationMailtoHref ? `Email ${supportEmail} (with search context)` : `Email ${supportEmail}`}
          </a>
        ) : (
          <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-amber-200/90 text-xs">
            Set <code className="text-amber-100/90">VITE_SUPPORT_EMAIL</code> in the deployment environment to enable a
            one-click support mail link. Until then, use the channel your organization uses for Bookiji Inc products.
          </p>
        )}
      </Section>

      <Section id="limitations" title="Known limitations & support boundaries" icon={AlertTriangle}>
        <ul className="list-disc pl-5 space-y-1 text-slate-400">
          <li>
            Support search shows retrieval excerpts only — not generated AI answers. Coach chat remains the AI path for
            run-specific coaching.
          </li>
          <li>Coach chat depends on configured AI providers; behavior may differ by tier or outage (fallback is evolving).</li>
          <li>Watch and phone apps are separate surfaces; this dashboard covers the web experience.</li>
        </ul>
      </Section>
    </div>
  )
}
