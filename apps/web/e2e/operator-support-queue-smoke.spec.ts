import { test, expect, type Page } from '@playwright/test'

const NOW_ISO = '2026-04-08T12:00:00.000Z'

function baseTicket(overrides: Record<string, unknown>) {
  return {
    severity: 'unknown',
    internal_notes: '',
    notification_slack_status: 'pending',
    notification_email_status: 'pending',
    notification_error_summary: '',
    notification_last_attempt_at: null,
    kb_approval_status: 'none',
    created_at: '2026-04-08T08:00:00.000Z',
    updated_at: '2026-04-08T11:30:00.000Z',
    assigned_at: null,
    first_response_due_at: '2026-04-08T14:00:00.000Z',
    resolution_due_at: '2026-04-11T10:00:00.000Z',
    last_operator_action_at: null,
    metadata: { inferred_topic: 'general', retrieval_state: 'unknown', route: '/help' },
    ...overrides,
  }
}

const mockTickets = [
  baseTicket({
    ticket_id: 'kinetix-smoke-overdue',
    issue_summary: 'Smoke Overdue First',
    status: 'open',
    assigned_to: null,
    derived: { labels: ['overdue_first_response'], nowIso: NOW_ISO, escalation_level: 0 },
  }),
  baseTicket({
    ticket_id: 'kinetix-smoke-unassigned',
    issue_summary: 'Smoke Unassigned Escalated',
    status: 'open',
    assigned_to: null,
    derived: { labels: ['unassigned'], nowIso: NOW_ISO, escalation_level: 1 },
  }),
  baseTicket({
    ticket_id: 'kinetix-smoke-assigned-me',
    issue_summary: 'Smoke Assigned To Me',
    status: 'open',
    assigned_to: 'bypass-dev',
    assigned_at: '2026-04-08T10:00:00.000Z',
    derived: { labels: ['assigned'], nowIso: NOW_ISO, escalation_level: 0 },
  }),
  baseTicket({
    ticket_id: 'kinetix-smoke-critical',
    issue_summary: 'Smoke Critical Escalation',
    status: 'open',
    assigned_to: null,
    derived: { labels: ['unassigned'], nowIso: NOW_ISO, escalation_level: 2 },
  }),
  baseTicket({
    ticket_id: 'kinetix-smoke-no-badge',
    issue_summary: 'Smoke No Escalation',
    status: 'open',
    assigned_to: 'other-operator',
    assigned_at: '2026-04-08T09:00:00.000Z',
    derived: { labels: ['assigned'], nowIso: NOW_ISO, escalation_level: 0 },
  }),
]

const mockListPayload = {
  tickets: mockTickets,
  summary: {
    unassigned: 2,
    overdue: 1,
    awaitingRetry: 0,
    readyForKb: 0,
    assignedToMe: 1,
    staleResolvedNotKb: 0,
    recentlyUpdated: 5,
    escalated: 2,
    escalatedLevel2: 1,
  },
  slaMetrics: {
    avg_first_response_ms: 3_600_000,
    avg_resolution_ms: 10_800_000,
    overdue_count: 1,
    resolved_last_7_days: 3,
    created_last_7_days: 5,
  },
}

const mockDrafts = [
  {
    id: 'draft-smoke-1',
    source_ticket_id: 'kinetix-smoke-overdue',
    artifact_id: 'art-smoke-1',
    title: 'Smoke KB Draft',
    excerpt: 'Smoke excerpt',
    body_markdown: '# Smoke body',
    review_status: 'draft',
    topic: 'general',
    intent: 'howto',
    updated_at: '2026-04-08T11:00:00.000Z',
  },
]

const ticketById = new Map(mockTickets.map((t) => [t.ticket_id as string, t]))

async function installSupportQueueMocks(page: Page) {
  await page.route('**/api/support-queue/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname
    const method = req.method()

    if (method === 'GET' && path === '/api/support-queue/tickets') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockListPayload),
      })
      return
    }

    if (method === 'GET' && path.startsWith('/api/support-queue/tickets/')) {
      const rest = path.slice('/api/support-queue/tickets/'.length)
      if (!rest.includes('/')) {
        const id = decodeURIComponent(rest)
        const ticket = ticketById.get(id)
        if (ticket) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ticket }),
          })
          return
        }
      }
    }

    if (method === 'GET' && path === '/api/support-queue/kb-approval') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ drafts: mockDrafts }),
      })
      return
    }

    if (method === 'GET' && path.startsWith('/api/support-queue/kb-approval/')) {
      const id = decodeURIComponent(path.slice('/api/support-queue/kb-approval/'.length))
      const draft = mockDrafts.find((d) => d.id === id)
      if (draft) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ draft }),
        })
        return
      }
    }

    await route.continue()
  })
}

test.describe('Operator + support queue smoke', () => {
  test.beforeEach(async ({ page }) => {
    await installSupportQueueMocks(page)
  })

  test('operator dashboard: summary, SLA, urgent order, quick links', async ({ page }) => {
    await page.goto('/operator')

    await expect(page.getByText('What needs attention now?')).toBeVisible()
    await expect(page.getByText('Unassigned', { exact: true }).locator('..').getByText('2', { exact: true })).toBeVisible()
    await expect(page.getByText('Avg first response').locator('..').getByText('1h', { exact: true })).toBeVisible()
    await expect(page.getByText('Avg resolution').locator('..').getByText('3h', { exact: true })).toBeVisible()
    const slaSection = page.locator('section').nth(2)
    await expect(slaSection.getByText('Overdue', { exact: true }).locator('..').getByText('1', { exact: true })).toBeVisible()
    await expect(page.getByText('Resolved (7d)').locator('..').getByText('3', { exact: true })).toBeVisible()

    const urgentSection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Recent urgent tickets' }) })
    const firstUrgentLink = urgentSection.getByRole('link').first()
    await expect(firstUrgentLink).toContainText('Smoke Overdue First')

    await page.getByRole('link', { name: 'Go to queue' }).click()
    await expect(page).toHaveURL(/\/support-queue$/)

    await page.goto('/operator')
    await page.getByRole('link', { name: 'Open urgent' }).click()
    await expect(page).toHaveURL(/ticketId=kinetix-smoke-overdue/)

    await page.goto('/operator')
    await page.getByRole('link', { name: 'Open assigned to me' }).click()
    await expect(page).toHaveURL(/ticketId=kinetix-smoke-assigned-me/)
  })

  test('support queue: escalation badges, critical styling, KB bin', async ({ page }) => {
    await page.goto('/support-queue')

    await expect(page.getByRole('heading', { name: 'KB Approval Bin' })).toBeVisible()
    await expect(page.getByText('Smoke KB Draft')).toBeVisible()

    const queueColumn = page.locator('section').first()
    const ticketList = queueColumn.locator('[class*="max-h-"]')
    await expect(ticketList.getByText('Escalated (critical)', { exact: true })).toHaveCount(1)
    await expect(ticketList.getByText('Escalated', { exact: true })).toHaveCount(1)

    const detailColumn = page.locator('section').nth(1)
    await page.getByRole('button', { name: /Smoke No Escalation/ }).click()
    await expect(detailColumn.getByText('Escalated (critical)', { exact: true })).toHaveCount(0)
    await expect(detailColumn.getByText('Escalated', { exact: true })).toHaveCount(0)

    await page.getByRole('button', { name: /Smoke Critical Escalation/ }).click()
    const criticalBadge = detailColumn.getByText('Escalated (critical)', { exact: true })
    await expect(criticalBadge).toBeVisible()
    await expect(criticalBadge).toHaveClass(/rose-500/)
  })
})
