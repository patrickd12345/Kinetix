import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ticketMatchesTriageFilter, SupportTicketDerivedLabel } from './supportTicketDerived'

describe('ticketMatchesTriageFilter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2023-10-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return true for "all" filter', () => {
    expect(ticketMatchesTriageFilter({}, 'all', null)).toBe(true)
  })

  describe('urgent filter', () => {
    it('returns true if overdue_first_response', () => {
      expect(ticketMatchesTriageFilter({ derived: { labels: ['overdue_first_response'], nowIso: '', escalation_level: 0 } }, 'urgent', null)).toBe(true)
    })
    it('returns true if overdue_resolution', () => {
      expect(ticketMatchesTriageFilter({ derived: { labels: ['overdue_resolution'], nowIso: '', escalation_level: 0 } }, 'urgent', null)).toBe(true)
    })
    it('returns true if escalation_level > 0', () => {
      expect(ticketMatchesTriageFilter({ derived: { labels: [], nowIso: '', escalation_level: 1 } }, 'urgent', null)).toBe(true)
    })
    it('returns false otherwise', () => {
      expect(ticketMatchesTriageFilter({ derived: { labels: ['unassigned'], nowIso: '', escalation_level: 0 } }, 'urgent', null)).toBe(false)
      expect(ticketMatchesTriageFilter({}, 'urgent', null)).toBe(false)
    })
  })

  describe('escalated filter', () => {
    it('returns true if escalation_level > 0', () => {
      expect(ticketMatchesTriageFilter({ derived: { labels: [], nowIso: '', escalation_level: 1 } }, 'escalated', null)).toBe(true)
      expect(ticketMatchesTriageFilter({ derived: { labels: [], nowIso: '', escalation_level: 2 } }, 'escalated', null)).toBe(true)
    })
    it('returns false otherwise', () => {
      expect(ticketMatchesTriageFilter({ derived: { labels: [], nowIso: '', escalation_level: 0 } }, 'escalated', null)).toBe(false)
      expect(ticketMatchesTriageFilter({}, 'escalated', null)).toBe(false)
    })
  })

  describe('label based filters', () => {
    const testCases: { filter: any; label?: SupportTicketDerivedLabel; expectedLabel?: SupportTicketDerivedLabel[] }[] = [
      { filter: 'unassigned', label: 'unassigned' },
      { filter: 'overdue', expectedLabel: ['overdue_first_response', 'overdue_resolution'] },
      { filter: 'awaiting_retry', label: 'awaiting_retry' },
      { filter: 'ready_for_kb', label: 'ready_for_kb' }
    ]

    for (const { filter, label, expectedLabel } of testCases) {
      it(`returns true for ${filter} if matching label is present`, () => {
        if (label) {
          expect(ticketMatchesTriageFilter({ derived: { labels: [label], nowIso: '', escalation_level: 0 } }, filter, null)).toBe(true)
        } else if (expectedLabel) {
          for (const l of expectedLabel) {
            expect(ticketMatchesTriageFilter({ derived: { labels: [l], nowIso: '', escalation_level: 0 } }, filter, null)).toBe(true)
          }
        }
      })
      it(`returns false for ${filter} if label is not present`, () => {
        expect(ticketMatchesTriageFilter({ derived: { labels: ['assigned'], nowIso: '', escalation_level: 0 } }, filter, null)).toBe(false)
        expect(ticketMatchesTriageFilter({}, filter, null)).toBe(false)
      })
    }
  })

  describe('assigned_to_me filter', () => {
    it('returns true if assigned_to matches operatorUserId', () => {
      expect(ticketMatchesTriageFilter({ assigned_to: 'user-123' }, 'assigned_to_me', 'user-123')).toBe(true)
    })
    it('returns false if assigned_to does not match', () => {
      expect(ticketMatchesTriageFilter({ assigned_to: 'user-456' }, 'assigned_to_me', 'user-123')).toBe(false)
      expect(ticketMatchesTriageFilter({}, 'assigned_to_me', 'user-123')).toBe(false)
    })
    it('returns false if operatorUserId is null', () => {
      expect(ticketMatchesTriageFilter({ assigned_to: 'user-123' }, 'assigned_to_me', null)).toBe(false)
    })
  })

  describe('recent filter', () => {
    it('returns true if updated_at is within 24 hours', () => {
      // System time is 2023-10-15T12:00:00Z
      const recentDate = new Date('2023-10-15T08:00:00Z').toISOString()
      expect(ticketMatchesTriageFilter({ updated_at: recentDate }, 'recent', null)).toBe(true)
    })
    it('returns false if updated_at is older than 24 hours', () => {
      const oldDate = new Date('2023-10-14T11:00:00Z').toISOString()
      expect(ticketMatchesTriageFilter({ updated_at: oldDate }, 'recent', null)).toBe(false)
    })
    it('returns false if updated_at is missing or invalid', () => {
      expect(ticketMatchesTriageFilter({}, 'recent', null)).toBe(false)
      expect(ticketMatchesTriageFilter({ updated_at: 'invalid-date' }, 'recent', null)).toBe(false)
    })
  })

  describe('stale_resolved filter', () => {
    it('returns true if status is resolved, kb not ingested, and older than 7 days', () => {
      const olderThan7Days = new Date('2023-10-08T11:00:00Z').toISOString()
      expect(ticketMatchesTriageFilter({ status: 'resolved', kb_approval_status: 'none', updated_at: olderThan7Days }, 'stale_resolved', null)).toBe(true)
      expect(ticketMatchesTriageFilter({ status: 'resolved', updated_at: olderThan7Days }, 'stale_resolved', null)).toBe(true) // kb defaults to 'none'
    })
    it('returns false if status is not resolved', () => {
      const olderThan7Days = new Date('2023-10-08T11:00:00Z').toISOString()
      expect(ticketMatchesTriageFilter({ status: 'open', updated_at: olderThan7Days }, 'stale_resolved', null)).toBe(false)
    })
    it('returns false if kb_approval_status is ingested', () => {
      const olderThan7Days = new Date('2023-10-08T11:00:00Z').toISOString()
      expect(ticketMatchesTriageFilter({ status: 'resolved', kb_approval_status: 'ingested', updated_at: olderThan7Days }, 'stale_resolved', null)).toBe(false)
    })
    it('returns false if not older than 7 days', () => {
      const newerThan7Days = new Date('2023-10-10T12:00:00Z').toISOString()
      expect(ticketMatchesTriageFilter({ status: 'resolved', kb_approval_status: 'none', updated_at: newerThan7Days }, 'stale_resolved', null)).toBe(false)
    })
    it('returns false if updated_at is missing or invalid', () => {
      expect(ticketMatchesTriageFilter({ status: 'resolved' }, 'stale_resolved', null)).toBe(false)
      expect(ticketMatchesTriageFilter({ status: 'resolved', updated_at: 'invalid-date' }, 'stale_resolved', null)).toBe(false)
    })
  })

  describe('fallback', () => {
    it('returns true for unknown filters', () => {
      expect(ticketMatchesTriageFilter({}, 'unknown_filter' as any, null)).toBe(true)
    })
  })
})
