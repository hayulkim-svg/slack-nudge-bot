import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeMissing,
  isDue,
  isExpired,
  formatNudge,
  addHours,
  computeExpiresAt,
} from '../src/nudgeLogic.js';

test('computeMissing returns expected users not in reactors, preserving order', () => {
  assert.deepEqual(computeMissing(['U1', 'U2', 'U3'], ['U2']), ['U1', 'U3']);
});

test('computeMissing returns empty when everyone reacted', () => {
  assert.deepEqual(computeMissing(['U1', 'U2'], ['U2', 'U1', 'U9']), []);
});

test('computeMissing de-duplicates expected', () => {
  assert.deepEqual(computeMissing(['U1', 'U1', 'U2'], ['U2']), ['U1']);
});

test('isDue is true only for active items past nextNudgeAt', () => {
  assert.equal(isDue({ status: 'active', nextNudgeAt: 100 }, 100), true);
  assert.equal(isDue({ status: 'active', nextNudgeAt: 100 }, 99), false);
  assert.equal(isDue({ status: 'done', nextNudgeAt: 100 }, 200), false);
});

test('isExpired respects null expiresAt (never expires)', () => {
  assert.equal(isExpired({ expiresAt: null }, 999999), false);
  assert.equal(isExpired({ expiresAt: 500 }, 500), true);
  assert.equal(isExpired({ expiresAt: 500 }, 499), false);
});

test('formatNudge lists mentions and the emoji, no decorative emoji', () => {
  assert.equal(
    formatNudge('white_check_mark', ['U2', 'U3']),
    'Still waiting on a :white_check_mark: from <@U2> <@U3> — please react to confirm.',
  );
});

test('addHours adds whole seconds', () => {
  assert.equal(addHours(1000, 2), 1000 + 7200);
});

test('computeExpiresAt returns null when hours is null', () => {
  assert.equal(computeExpiresAt(1000, null), null);
  assert.equal(computeExpiresAt(1000, 24), 1000 + 24 * 3600);
});
