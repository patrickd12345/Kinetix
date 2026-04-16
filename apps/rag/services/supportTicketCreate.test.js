import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendSupportTicketRecord,
  buildSupportTicketRow,
  generateKinetixTicketId,
  validateSupportTicketBody,
} from './supportTicketCreate.js';

test('generateKinetixTicketId matches kinetix-YYYYMMDD-hex pattern', () => {
  const id = generateKinetixTicketId();
  assert.match(id, /^kinetix-\d{8}-[0-9a-f]{6}$/);
});

test('validateSupportTicketBody accepts minimal valid payload', () => {
  const v = validateSupportTicketBody({
    product: 'kinetix',
    timestamp: new Date().toISOString(),
    issueSummary: 'Strava will not connect',
    environment: 'web',
    severity: 'unknown',
    userId: 'user-1',
    conversationExcerpt: 'q: sync',
    attemptedSolutions: 'tried settings',
    metadata: { route: '/help', inferred_topic: 'sync' },
  });
  assert.equal(v.ok, true);
  if (v.ok) {
    assert.equal(v.value.product, 'kinetix');
    assert.deepEqual(v.value.metadata, { route: '/help', inferred_topic: 'sync' });
  }
});

test('validateSupportTicketBody rejects wrong product', () => {
  const v = validateSupportTicketBody({
    product: 'other',
    timestamp: '2026-01-01T00:00:00.000Z',
    issueSummary: 'x',
    environment: 'web',
  });
  assert.equal(v.ok, false);
});

test('validateSupportTicketBody defaults severity to unknown when missing', () => {
  const v = validateSupportTicketBody({
    product: 'kinetix',
    timestamp: '2026-01-01T00:00:00.000Z',
    issueSummary: 'x',
    environment: 'web',
  });
  assert.equal(v.ok, true);
  if (v.ok) assert.equal(v.value.severity, 'unknown');
});

test('buildSupportTicketRow normalizes invalid severity to unknown', () => {
  const v = validateSupportTicketBody({
    product: 'kinetix',
    timestamp: '2026-01-01T00:00:00.000Z',
    issueSummary: 'x',
    environment: 'web',
    severity: 'not-a-real-level',
    userId: null,
    conversationExcerpt: 'a',
    attemptedSolutions: 'b',
  });
  assert.equal(v.ok, true);
  if (!v.ok) return;
  const row = buildSupportTicketRow(v.value, 'kinetix-20260101-abcdef', '2026-01-01T12:00:00.000Z');
  assert.equal(row.severity, 'unknown');
  assert.equal(row.ticket_id, 'kinetix-20260101-abcdef');
  assert.equal(row.product_key, 'kinetix');
  assert.ok(Array.isArray(row.conversation_excerpt));
});

test('appendSupportTicketRecord returns storage_unavailable when supabase override is null', async () => {
  const body = {
    product: 'kinetix',
    timestamp: new Date().toISOString(),
    issueSummary: 'test',
    environment: 'web',
    severity: 'unknown',
    userId: null,
    conversationExcerpt: 'x',
    attemptedSolutions: 'y',
  };
  const out = await appendSupportTicketRecord(body, { supabase: null });
  assert.equal(out.ok, false);
  assert.equal(out.error, 'storage_unavailable');
});

test('appendSupportTicketRecord succeeds when Supabase insert returns no error', async () => {
  let insertedRow = null;
  const mockSupabase = {
    schema: () => ({
      from: () => ({
        insert: async (row) => {
          insertedRow = row;
          return { error: null };
        },
        update: () => ({
          eq: async () => ({ error: null }),
        }),
      }),
    }),
  };
  const body = {
    product: 'kinetix',
    timestamp: new Date().toISOString(),
    issueSummary: 'test',
    environment: 'web',
    severity: 'low',
    userId: 'u1',
    conversationExcerpt: 'ex',
    attemptedSolutions: 'at',
    metadata: { route: '/help', retrieval_state: 'service_unavailable' },
  };
  const out = await appendSupportTicketRecord(body, { supabase: mockSupabase });
  assert.equal(out.ok, true);
  if (out.ok) {
    assert.match(out.ticketId, /^kinetix-\d{8}-[0-9a-f]{6}$/);
    assert.ok(typeof out.receivedAt === 'string');
  }
  assert.equal(insertedRow.metadata.route, '/help');
  assert.equal(insertedRow.metadata.retrieval_state, 'service_unavailable');
});

test('appendSupportTicketRecord returns storage_unavailable on Supabase error', async () => {
  const mockSupabase = {
    schema: () => ({
      from: () => ({
        insert: async () => ({ error: { code: '23505', message: 'hidden' } }),
      }),
    }),
  };
  const body = {
    product: 'kinetix',
    timestamp: new Date().toISOString(),
    issueSummary: 'test',
    environment: 'web',
    userId: null,
    conversationExcerpt: 'x',
    attemptedSolutions: 'y',
  };
  const out = await appendSupportTicketRecord(body, { supabase: mockSupabase });
  assert.equal(out.ok, false);
  assert.equal(out.error, 'storage_unavailable');
});

test('appendSupportTicketRecord keeps success when notification status update fails', async () => {
  const mockSupabase = {
    schema: () => ({
      from: () => ({
        insert: async () => ({ error: null }),
        update: () => ({
          eq: async () => ({ error: { message: 'update failed' } }),
        }),
      }),
    }),
  };
  const body = {
    product: 'kinetix',
    timestamp: new Date().toISOString(),
    issueSummary: 'ticket survives notification failure',
    environment: 'web',
    userId: null,
    conversationExcerpt: 'x',
    attemptedSolutions: 'y',
  };
  const out = await appendSupportTicketRecord(body, { supabase: mockSupabase });
  assert.equal(out.ok, true);
});
