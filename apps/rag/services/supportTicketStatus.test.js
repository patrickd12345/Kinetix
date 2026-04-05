import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SUPPORT_TICKET_STATUSES,
  updateSupportTicketStatus,
  validateExternalTicketId,
  validateStatusUpdateBody,
} from './supportTicketStatus.js';

test('validateExternalTicketId accepts kinetix ticket id', () => {
  const v = validateExternalTicketId('kinetix-20260101-abcdef');
  assert.equal(v.ok, true);
  if (v.ok) assert.equal(v.ticketId, 'kinetix-20260101-abcdef');
});

test('validateExternalTicketId rejects bad shape', () => {
  const v = validateExternalTicketId('not-a-ticket');
  assert.equal(v.ok, false);
});

test('validateStatusUpdateBody accepts status and optional metadataPatch', () => {
  const v = validateStatusUpdateBody({ status: 'triaged', metadataPatch: { note: 'x' } });
  assert.equal(v.ok, true);
  if (v.ok) {
    assert.equal(v.value.status, 'triaged');
    assert.deepEqual(v.value.metadataPatch, { note: 'x' });
  }
});

test('validateStatusUpdateBody rejects invalid status', () => {
  const v = validateStatusUpdateBody({ status: 'bogus' });
  assert.equal(v.ok, false);
});

test('validateStatusUpdateBody rejects metadataPatch array', () => {
  const v = validateStatusUpdateBody({ status: 'open', metadataPatch: [] });
  assert.equal(v.ok, false);
});

test('SUPPORT_TICKET_STATUSES lists five statuses', () => {
  assert.equal(SUPPORT_TICKET_STATUSES.length, 5);
});

test('updateSupportTicketStatus returns storage_unavailable without client', async () => {
  const out = await updateSupportTicketStatus('kinetix-20260101-abcdef', 'triaged', { supabase: null });
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.kind, 'storage_unavailable');
});

function mockSupabaseForUpdate({ data, error, fetchData, fetchError }) {
  return {
    schema: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: fetchData, error: fetchError }),
          }),
        }),
        update: () => ({
          eq: () => ({
            select: () => ({
              maybeSingle: async () => ({ data, error }),
            }),
          }),
        }),
      }),
    }),
  };
}

test('updateSupportTicketStatus succeeds without metadata patch', async () => {
  const row = {
    ticket_id: 'kinetix-20260101-abcdef',
    status: 'triaged',
    updated_at: '2026-01-02T12:00:00.000Z',
  };
  const mock = mockSupabaseForUpdate({ data: row, error: null });
  const out = await updateSupportTicketStatus('kinetix-20260101-abcdef', 'triaged', { supabase: mock });
  assert.equal(out.ok, true);
  if (out.ok) {
    assert.equal(out.ticketId, 'kinetix-20260101-abcdef');
    assert.equal(out.status, 'triaged');
    assert.equal(out.updatedAt, new Date(row.updated_at).toISOString());
  }
});

test('updateSupportTicketStatus returns not_found when no row', async () => {
  const mock = mockSupabaseForUpdate({ data: null, error: null });
  const out = await updateSupportTicketStatus('kinetix-20260101-abcdef', 'triaged', { supabase: mock });
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.kind, 'not_found');
});

test('updateSupportTicketStatus returns storage_error on Supabase error', async () => {
  const mock = mockSupabaseForUpdate({ data: null, error: { code: 'xx' } });
  const out = await updateSupportTicketStatus('kinetix-20260101-abcdef', 'triaged', { supabase: mock });
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.kind, 'storage_error');
});

test('updateSupportTicketStatus merges metadata when metadataPatch set', async () => {
  const fetchData = { metadata: { a: 1 } };
  const updatedRow = {
    ticket_id: 'kinetix-20260101-abcdef',
    status: 'in_progress',
    updated_at: '2026-01-03T00:00:00.000Z',
  };
  let updatePayload;
  const mock = {
    schema: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: fetchData, error: null }),
          }),
        }),
        update: (payload) => {
          updatePayload = payload;
          return {
            eq: () => ({
              select: () => ({
                maybeSingle: async () => ({ data: updatedRow, error: null }),
              }),
            }),
          };
        },
      }),
    }),
  };
  const out = await updateSupportTicketStatus('kinetix-20260101-abcdef', 'in_progress', {
    supabase: mock,
    metadataPatch: { b: 2 },
  });
  assert.equal(out.ok, true);
  assert.ok(updatePayload);
  assert.equal(updatePayload.status, 'in_progress');
  assert.deepEqual(updatePayload.metadata, { a: 1, b: 2 });
});
