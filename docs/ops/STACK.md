## Operational Stack

### Required
- Sentry (error tracking; fail-closed/no-op when DSNs are unset)
- GitHub PR traceability template

### Minimal
- Uptime monitoring via `/api/health` backed by `api/health/index.ts`

### Optional
- Analytics (PostHog scaffold only)
- Slack alerts (future, not required)

## Principles
- Keep system simple
- No overlapping tools
- One responsibility per tool
- No feature bloat
