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

test('rejects non-object inputs', () => {
  assert.equal(validateSupportArtifactForIngest(null).ok, false);
  assert.equal(validateSupportArtifactForIngest(undefined).ok, false);
  assert.equal(validateSupportArtifactForIngest('string').ok, false);
  assert.equal(validateSupportArtifactForIngest(123).ok, false);
});

test('rejects empty or missing required string fields', () => {
  const cases = [
    { artifact_id: '' },
    { artifact_id: '   ' },
    { title: '' },
    { title: '   ' },
    { body_markdown: '' },
    { body_markdown: '   ' },
  ];
  for (const c of cases) {
    const r = validateSupportArtifactForIngest({ ...validBase, ...c });
    assert.equal(r.ok, false, `Should reject ${JSON.stringify(c)}`);
  }
});

test('rejects oversized body_markdown', () => {
  const longBody = 'a'.repeat(50001);
  const r = validateSupportArtifactForIngest({ ...validBase, body_markdown: longBody });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('exceeds 50000')));
});

test('validates excerpt optionality and size', () => {
  // ok when missing
  assert.equal(validateSupportArtifactForIngest(validBase).ok, true);

  // rejects non-string
  assert.equal(validateSupportArtifactForIngest({ ...validBase, excerpt: 123 }).ok, false);

  // rejects too long
  const longExcerpt = 'a'.repeat(2001);
  assert.equal(validateSupportArtifactForIngest({ ...validBase, excerpt: longExcerpt }).ok, false);
});

test('validates version formats and values', () => {
  assert.equal(validateSupportArtifactForIngest({ ...validBase, version: undefined }).ok, false);
  assert.equal(validateSupportArtifactForIngest({ ...validBase, version: null }).ok, false);
  assert.equal(validateSupportArtifactForIngest({ ...validBase, version: '' }).ok, false);
  assert.equal(validateSupportArtifactForIngest({ ...validBase, version: 'abc' }).ok, false);
  assert.equal(validateSupportArtifactForIngest({ ...validBase, version: 0.5 }).ok, false);
  assert.equal(validateSupportArtifactForIngest({ ...validBase, version: -1 }).ok, false);

  // acceptable versions
  assert.equal(validateSupportArtifactForIngest({ ...validBase, version: 2 }).ok, true);
  assert.equal(validateSupportArtifactForIngest({ ...validBase, version: '2' }).ok, true);
  assert.equal(validateSupportArtifactForIngest({ ...validBase, version: ' 3.0 ' }).ok, true);
});

test('rejects non-kinetix product', () => {
  const r = validateSupportArtifactForIngest({ ...validBase, product: 'bookiji' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('must be "kinetix"')));
});

test('rejects invalid intent and source_type', () => {
  assert.equal(validateSupportArtifactForIngest({ ...validBase, intent: 'unknown' }).ok, false);
  assert.equal(validateSupportArtifactForIngest({ ...validBase, source_type: 'unknown' }).ok, false);
});

test('normalizes and defaults fields', () => {
  const input = {
    ...validBase,
    artifact_id: '  id-123  ',
    title: '  My Title  ',
    locale: '  fr  ',
    surface: '  mobile  ',
    excerpt: '  Some excerpt  '
  };
  const r = validateSupportArtifactForIngest(input);
  assert.equal(r.ok, true);
  assert.equal(r.artifact.artifact_id, 'id-123');
  assert.equal(r.artifact.title, 'My Title');
  assert.equal(r.artifact.locale, 'fr');
  assert.equal(r.artifact.surface, 'mobile');
  assert.equal(r.artifact.excerpt, 'Some excerpt');

  // check defaults
  const r2 = validateSupportArtifactForIngest(validBase);
  assert.equal(r2.artifact.locale, 'en');
  assert.equal(r2.artifact.surface, 'web');
});

test('accumulates multiple errors', () => {
  const r = validateSupportArtifactForIngest({
    ...validBase,
    artifact_id: '',
    title: ''
  });
  assert.equal(r.ok, false);
  assert.equal(r.errors.length, 2);
});
