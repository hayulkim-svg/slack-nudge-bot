import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeMissing,
  isDue,
  isExpired,
  formatNudge,
  addHours,
  stopTimeUnix,
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

test('stopTimeUnix resolves 23:00 KST on the local day of now', () => {
  // now = 2026-07-10 00:00 UTC = 2026-07-10 09:00 KST
  const now = Math.floor(Date.UTC(2026, 6, 10, 0, 0, 0) / 1000);
  // 23:00 KST 2026-07-10 = 14:00 UTC 2026-07-10
  assert.equal(stopTimeUnix(now, '23:00', 'Asia/Seoul'), Math.floor(Date.UTC(2026, 6, 10, 14, 0, 0) / 1000));
});

test('stopTimeUnix uses the local calendar day, not the UTC day', () => {
  // now = 2026-07-10 22:00 UTC = 2026-07-11 07:00 KST -> local day is the 11th
  const now = Math.floor(Date.UTC(2026, 6, 10, 22, 0, 0) / 1000);
  assert.equal(stopTimeUnix(now, '23:00', 'Asia/Seoul'), Math.floor(Date.UTC(2026, 6, 11, 14, 0, 0) / 1000));
});

test('stopTimeUnix works for UTC', () => {
  const now = Math.floor(Date.UTC(2026, 6, 10, 0, 0, 0) / 1000);
  assert.equal(stopTimeUnix(now, '23:00', 'UTC'), Math.floor(Date.UTC(2026, 6, 10, 23, 0, 0) / 1000));
});
