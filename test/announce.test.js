import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAnnounce } from '../src/announce.js';

function fakeSlack(posted) {
  return {
    async postAnnouncement(args) {
      posted.push(args);
      return '1720000000.000200';
    },
    async lookupUserIdByEmail(email) {
      return email === 'a@b.com' ? 'U_A' : 'U_OTHER';
    },
  };
}

const config = {
  channel: 'C1',
  emoji: 'white_check_mark',
  expected: ['U1', 'a@b.com'],
  text: 'React to confirm you read this.',
  initialDelayHours: 24,
  repeatIntervalHours: 24,
  expiresAfterHours: 168,
};

test('runAnnounce posts text and builds a tracked item', async () => {
  const posted = [];
  const item = await runAnnounce({ config, slack: fakeSlack(posted), now: 1000 });
  assert.deepEqual(posted, [{ channel: 'C1', text: 'React to confirm you read this.' }]);
  assert.deepEqual(item, {
    channel: 'C1',
    ts: '1720000000.000200',
    emoji: 'white_check_mark',
    expected: ['U1', 'U_A'],
    repeatIntervalHours: 24,
    nextNudgeAt: 1000 + 24 * 3600,
    expiresAt: 1000 + 168 * 3600,
    status: 'active',
  });
});

test('runAnnounce supports never-expire (null)', async () => {
  const item = await runAnnounce({
    config: { ...config, expiresAfterHours: null },
    slack: fakeSlack([]),
    now: 1000,
  });
  assert.equal(item.expiresAt, null);
});
