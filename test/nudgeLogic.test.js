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

test('formatNudge substitutes {mentions} in the template', () => {
  assert.equal(
    formatNudge('Waiting on {mentions} to react :E:', ['U2', 'U3']),
    'Waiting on <@U2> <@U3> to react :E:',
  );
});

test('formatNudge replaces every {mentions} occurrence', () => {
  assert.equal(formatNudge('{mentions} — {mentions}', ['U1']), '<@U1> — <@U1>');
});

test('addHours adds whole seconds', () => {
  assert.equal(addHours(1000, 2), 1000 + 7200);
});

test('computeExpiresAt returns null when hours is null', () => {
  assert.equal(computeExpiresAt(1000, null), null);
  assert.equal(computeExpiresAt(1000, 24), 1000 + 24 * 3600);
});
