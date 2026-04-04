import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateSupportArtifactForIngest,
  SUPPORT_KB_TOPICS,
  SUPPORT_KB_INTENTS,
} from './supportArtifact.js';

const validBase = {
  artifact_id: 'support-test-strava',
  title: 'Strava connection',
  body_markdown: 'Connect Strava from Settings.',
  version: 1,
  review_status: 'approved',
  topic: 'sync',
  intent: 'howto',
  source_type: 'editorial',
};

test('accepts minimal valid approved artifact', () => {
  const r = validateSupportArtifactForIngest(validBase);
  assert.equal(r.ok, true);
  assert.equal(r.artifact?.artifact_id, 'support-test-strava');
  assert.equal(r.artifact?.product, 'kinetix');
});

test('rejects draft review_status', () => {
  const r = validateSupportArtifactForIngest({ ...validBase, review_status: 'draft' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('approved')));
});

test('rejects missing body_markdown', () => {
  const { body_markdown, ...rest } = validBase;
  const r = validateSupportArtifactForIngest(rest);
  assert.equal(r.ok, false);
});

test('rejects invalid topic', () => {
  const r = validateSupportArtifactForIngest({ ...validBase, topic: 'not-a-topic' });
  assert.equal(r.ok, false);
});

test('rejects invalid artifact_id characters', () => {
  const r = validateSupportArtifactForIngest({ ...validBase, artifact_id: 'bad id spaces' });
  assert.equal(r.ok, false);
});

test('topic and intent enums are stable sets', () => {
  assert.ok(SUPPORT_KB_TOPICS.includes('sync'));
  assert.ok(SUPPORT_KB_INTENTS.includes('troubleshoot'));
});
