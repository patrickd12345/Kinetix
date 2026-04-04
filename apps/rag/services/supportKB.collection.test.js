import assert from 'node:assert/strict';
import test from 'node:test';
import { SUPPORT_KB_COLLECTION_NAME } from './supportVectorDB.js';

test('support KB collection name is distinct from run collection', () => {
  assert.notEqual(SUPPORT_KB_COLLECTION_NAME, 'kinetix_runs');
  assert.equal(SUPPORT_KB_COLLECTION_NAME, 'kinetix_support_kb');
});
