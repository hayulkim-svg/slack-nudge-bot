import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCheck } from '../src/check.js';

function fakeSlack(reactorsByTs, posted) {
  return {
    async getReactors({ ts }) {
      return reactorsByTs[ts] ?? [];
    },
    async postThreadReply(args) {
      posted.push(args);
    },
  };
}

function item(overrides = {}) {
  return {
    channel: 'C1',
    ts: '1.1',
    emoji: 'white_check_mark',
    expected: ['U1', 'U2'],
    repeatIntervalHours: 24,
    nextNudgeAt: 100,
    expiresAt: null,
    status: 'active',
    ...overrides,
  };
}

test('nudges stragglers in a thread reply and reschedules', async () => {
  const posted = [];
  const slack = fakeSlack({ '1.1': ['U1'] }, posted);
  const [result] = await runCheck([item()], slack, 200);
  assert.equal(result.status, 'active');
  assert.equal(result.nextNudgeAt, 200 + 24 * 3600);
  assert.deepEqual(posted, [
    { channel: 'C1', threadTs: '1.1', text: 'Still waiting on a :white_check_mark: from <@U2> — please react to confirm.' },
  ]);
});

test('marks done when everyone reacted, no post', async () => {
  const posted = [];
  const slack = fakeSlack({ '1.1': ['U1', 'U2'] }, posted);
  const [result] = await runCheck([item()], slack, 200);
  assert.equal(result.status, 'done');
  assert.equal(posted.length, 0);
});

test('marks expired when due and past expiry, no post', async () => {
  const posted = [];
  const slack = fakeSlack({ '1.1': [] }, posted);
  const [result] = await runCheck([item({ expiresAt: 150 })], slack, 200);
  assert.equal(result.status, 'expired');
  assert.equal(posted.length, 0);
});

test('leaves not-yet-due items untouched', async () => {
  const posted = [];
  const slack = fakeSlack({ '1.1': [] }, posted);
  const [result] = await runCheck([item({ nextNudgeAt: 500 })], slack, 200);
  assert.equal(result.status, 'active');
  assert.equal(result.nextNudgeAt, 500);
  assert.equal(posted.length, 0);
});

test('a failing item does not abort the run', async () => {
  const posted = [];
  const slack = {
    async getReactors({ ts }) {
      if (ts === '1.1') throw new Error('boom');
      return ['U1', 'U2'];
    },
    async postThreadReply(args) {
      posted.push(args);
    },
  };
  const items = [item({ ts: '1.1' }), item({ ts: '2.2' })];
  const result = await runCheck(items, slack, 200);
  assert.equal(result[0].status, 'active'); // unchanged after error
  assert.equal(result[1].status, 'done');
});
