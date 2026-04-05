import assert from 'node:assert/strict';
import test from 'node:test';
import { verifySupportOpsSecret } from './supportTicketOpsAuth.js';

test('verifySupportOpsSecret rejects when secret not configured', () => {
  const r = verifySupportOpsSecret({}, '');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, 'unconfigured');
});

test('verifySupportOpsSecret rejects wrong header', () => {
  const r = verifySupportOpsSecret({ 'x-kinetix-support-ops-secret': 'wrong' }, 'expected');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, 'unauthorized');
});

test('verifySupportOpsSecret accepts matching header', () => {
  const r = verifySupportOpsSecret({ 'x-kinetix-support-ops-secret': 'expected' }, 'expected');
  assert.equal(r.ok, true);
});

test('verifySupportOpsSecret accepts Bearer token', () => {
  const r = verifySupportOpsSecret({ authorization: 'Bearer expected' }, 'expected');
  assert.equal(r.ok, true);
});
