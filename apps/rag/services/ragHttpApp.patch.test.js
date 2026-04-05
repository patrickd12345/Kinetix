import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { createRagApp } from '../ragHttpApp.js';

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = createServer(app);
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ server, port });
    });
    server.on('error', reject);
  });
}

async function patchJson(app, port, path, body, headers = {}) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

async function postJson(app, port, path, body) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

const validTicketId = 'kinetix-20260101-abcdef';

test('PATCH status returns 401 without ops secret', async () => {
  const app = createRagApp({
    getRuntime: () => ({ kinetixSupportOpsSecret: 'secret' }),
    updateSupportTicketStatus: async () => ({ ok: true, ticketId: validTicketId, status: 'triaged', updatedAt: '2026-01-01T00:00:00.000Z' }),
  });
  const { server, port } = await listen(app);
  try {
    const { status, json } = await patchJson(app, port, `/support/ticket/${validTicketId}/status`, { status: 'triaged' });
    assert.equal(status, 401);
    assert.equal(json.ok, false);
    assert.equal(json.error, 'unauthorized');
  } finally {
    server.close();
  }
});

test('PATCH status returns 503 when ops secret not configured', async () => {
  const app = createRagApp({
    getRuntime: () => ({ kinetixSupportOpsSecret: '' }),
    updateSupportTicketStatus: async () => ({ ok: true, ticketId: validTicketId, status: 'triaged', updatedAt: '2026-01-01T00:00:00.000Z' }),
  });
  const { server, port } = await listen(app);
  try {
    const { status, json } = await patchJson(
      app,
      port,
      `/support/ticket/${validTicketId}/status`,
      { status: 'triaged' },
      { 'x-kinetix-support-ops-secret': 'x' },
    );
    assert.equal(status, 503);
    assert.equal(json.error, 'ops_unconfigured');
  } finally {
    server.close();
  }
});

test('PATCH status 400 for invalid status', async () => {
  const app = createRagApp({
    getRuntime: () => ({ kinetixSupportOpsSecret: 's' }),
    updateSupportTicketStatus: async () => ({ ok: true, ticketId: validTicketId, status: 'triaged', updatedAt: '2026-01-01T00:00:00.000Z' }),
  });
  const { server, port } = await listen(app);
  try {
    const { status } = await patchJson(
      app,
      port,
      `/support/ticket/${validTicketId}/status`,
      { status: 'not_valid' },
      { 'x-kinetix-support-ops-secret': 's' },
    );
    assert.equal(status, 400);
  } finally {
    server.close();
  }
});

test('PATCH status 404 when ticket not found', async () => {
  const app = createRagApp({
    getRuntime: () => ({ kinetixSupportOpsSecret: 's' }),
    updateSupportTicketStatus: async () => ({ ok: false, kind: 'not_found' }),
  });
  const { server, port } = await listen(app);
  try {
    const { status, json } = await patchJson(
      app,
      port,
      `/support/ticket/${validTicketId}/status`,
      { status: 'triaged' },
      { 'x-kinetix-support-ops-secret': 's' },
    );
    assert.equal(status, 404);
    assert.equal(json.error, 'not_found');
  } finally {
    server.close();
  }
});

test('PATCH status 503 on storage failure', async () => {
  const app = createRagApp({
    getRuntime: () => ({ kinetixSupportOpsSecret: 's' }),
    updateSupportTicketStatus: async () => ({ ok: false, kind: 'storage_error' }),
  });
  const { server, port } = await listen(app);
  try {
    const { status, json } = await patchJson(
      app,
      port,
      `/support/ticket/${validTicketId}/status`,
      { status: 'resolved' },
      { 'x-kinetix-support-ops-secret': 's' },
    );
    assert.equal(status, 503);
    assert.equal(json.error, 'storage_unavailable');
  } finally {
    server.close();
  }
});

test('PATCH status success with correct secret', async () => {
  const app = createRagApp({
    getRuntime: () => ({ kinetixSupportOpsSecret: 's' }),
    updateSupportTicketStatus: async () => ({
      ok: true,
      ticketId: validTicketId,
      status: 'triaged',
      updatedAt: '2026-01-02T00:00:00.000Z',
    }),
  });
  const { server, port } = await listen(app);
  try {
    const { status, json } = await patchJson(
      app,
      port,
      `/support/ticket/${validTicketId}/status`,
      { status: 'triaged' },
      { 'x-kinetix-support-ops-secret': 's' },
    );
    assert.equal(status, 200);
    assert.equal(json.ok, true);
    assert.equal(json.ticketId, validTicketId);
    assert.equal(json.status, 'triaged');
    assert.equal(json.updatedAt, '2026-01-02T00:00:00.000Z');
  } finally {
    server.close();
  }
});

test('POST /support/ticket/create still returns 201 when mock inject succeeds', async () => {
  const app = createRagApp({
    appendSupportTicketRecord: async () => ({
      ok: true,
      ticketId: 'kinetix-20990101-000000',
      receivedAt: '2026-01-01T00:00:00.000Z',
    }),
  });
  const { server, port } = await listen(app);
  try {
    const { status, json } = await postJson(app, port, '/support/ticket/create', {
      product: 'kinetix',
      timestamp: new Date().toISOString(),
      issueSummary: 'test',
      environment: 'web',
      userId: null,
      conversationExcerpt: 'x',
      attemptedSolutions: 'y',
    });
    assert.equal(status, 201);
    assert.equal(json.ok, true);
  } finally {
    server.close();
  }
});
