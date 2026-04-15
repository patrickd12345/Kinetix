import { test, expect, type Page } from '@playwright/test'

const NOW_ISO = '2026-04-08T12:00:00.000Z'

type MockTicket = {
  ticket_id: string
  issue_summary: string
  status: string
  assigned_to: string | null
  derived: { labels: string[]; nowIso: string; escalation_level: number }
  severity: string
  internal_notes: string
  notification_slack_status: string
  notification_email_status: string
  notification_error_summary: string
  notification_last_attempt_at: string | null
  kb_approval_status: string
  created_at: string
  updated_at: string
  assigned_at: string | null
  first_response_due_at: string
  resolution_due_at: string
  last_operator_action_at: string | null
  metadata: { inferred_topic: string; retrieval_state: string; route: string }
}

function baseTicket(overrides: Partial<MockTicket>): MockTicket {
  return {
    ticket_id: 'ticket-id',
    issue_summary: 'Issue summary',
    status: 'open',
    assigned_to: null,
    derived: { labels: ['unassigned'], nowIso: NOW_ISO, escalation_level: 0 },
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

const ticketById = new Map<string, MockTicket>(mockTickets.map((t) => [t.ticket_id, t]))

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

  test('operator dashboard: summary, SLA, escalation order, quick links', async ({ page }) => {
    await page.goto('/operator')

    await expect(page.getByText('What needs attention now?')).toBeVisible()
    await expect(page.getByText('Open tickets', { exact: true }).locator('..').getByText('5', { exact: true })).toBeVisible()
    await expect(page.getByText('Urgent tickets').locator('..').getByText('3', { exact: true })).toBeVisible()
    await expect(page.getByText('SLA warnings').locator('..').getByText('1', { exact: true })).toBeVisible()
    await expect(page.getByText('SLA breaches').locator('..').getByText('2', { exact: true })).toBeVisible()
    await expect(page.getByText('Avg first response').locator('..').getByText('1h', { exact: true })).toBeVisible()

    const escalationSection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Recent escalations' }) })
    const escalationLinks = escalationSection.getByRole('link')
    await expect(escalationLinks.nth(0)).toContainText('Smoke Critical Escalation')
    await expect(escalationLinks.nth(1)).toContainText('Smoke Unassigned Escalated')

    await page.getByRole('link', { name: 'Go to queue' }).click()
    await expect(page).toHaveURL(/\/support-queue$/)

    await page.goto('/operator')
    await page.getByRole('link', { name: 'Open urgent queue' }).click()
    await expect(page).toHaveURL(/urgent=1/)

    await page.goto('/operator')
    await page.getByRole('link', { name: 'Open assigned to me' }).click()
    await expect(page).toHaveURL(/assigned=me/)

    await page.goto('/operator')
    await page.getByRole('link', { name: 'Open escalated queue' }).click()
    await expect(page).toHaveURL(/escalated=1/)
  })

  test('support queue: escalation badges, SLA badges, critical styling, KB bin', async ({ page }) => {
    await page.goto('/support-queue?escalated=1')

    await expect(page.getByRole('heading', { name: 'KB Approval Bin' })).toBeVisible()
    await expect(page.getByText('Smoke KB Draft')).toBeVisible()

    const queueColumn = page.locator('section').first()
    const ticketList = queueColumn.locator('[class*="max-h-"]')
    await expect(ticketList.getByText('Escalated (critical)', { exact: true })).toHaveCount(1)
    await expect(ticketList.getByText('Escalated', { exact: true })).toHaveCount(1)
    await expect(ticketList.getByText('SLA Warning', { exact: true })).toHaveCount(1)
    await expect(ticketList.getByText('SLA Breach', { exact: true })).toHaveCount(1)

    const detailColumn = page.locator('section').nth(1)

    await page.goto('/support-queue')
    await page.getByRole('button', { name: /Smoke No Escalation/ }).click()
    await expect(detailColumn.getByText('Escalated (critical)', { exact: true })).toHaveCount(0)
    await expect(detailColumn.getByText('Escalated', { exact: true })).toHaveCount(0)
    await expect(detailColumn.getByText('SLA Warning', { exact: true })).toHaveCount(0)
    await expect(detailColumn.getByText('SLA Breach', { exact: true })).toHaveCount(0)

    await page.getByRole('button', { name: /Smoke Critical Escalation/ }).click()
    const criticalBadge = detailColumn.getByText('Escalated (critical)', { exact: true })
    await expect(criticalBadge).toBeVisible()
    await expect(criticalBadge).toHaveClass(/rose-500/)
    await expect(detailColumn.getByText('SLA Breach', { exact: true })).toBeVisible()
  })
})
