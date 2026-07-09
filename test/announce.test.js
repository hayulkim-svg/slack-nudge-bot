import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAnnounce, selectReminder } from '../src/announce.js';
import { stopTimeUnix } from '../src/nudgeLogic.js';

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
  id: 'demo',
  channel: 'C1',
  emoji: 'white_check_mark',
  expected: ['U1', 'a@b.com'],
  text: 'React to confirm you read this.',
  nudgeText: 'Reminder for {mentions}',
  initialDelayHours: 2,
  repeatIntervalHours: 2,
  stopAtLocalTime: '23:00',
  timezone: 'Asia/Seoul',
};

test('runAnnounce (channel mode) posts once and builds one item with a stop-time expiry', async () => {
  const posted = [];
  const now = 1000;
  const items = await runAnnounce({ config, slack: fakeSlack(posted), now });
  assert.deepEqual(posted, [{ channel: 'C1', text: 'React to confirm you read this.' }]);
  assert.equal(items.length, 1);
  assert.deepEqual(items[0], {
    channel: 'C1',
    ts: '1720000000.000200',
    expected: ['U1', 'U_A'],
    emoji: 'white_check_mark',
    nudgeText: 'Reminder for {mentions}',
    repeatIntervalHours: 2,
    nextNudgeAt: now + 2 * 3600,
    expiresAt: stopTimeUnix(now, '23:00', 'Asia/Seoul'),
    status: 'active',
  });
});

test('runAnnounce (dm mode) opens a DM per person and tracks each separately', async () => {
  const opened = [];
  const posted = [];
  const slack = {
    async openDm(userId) {
      opened.push(userId);
      return `D_${userId}`;
    },
    async postAnnouncement(args) {
      posted.push(args);
      return `ts_${args.channel}`;
    },
    async lookupUserIdByEmail() {
      throw new Error('should not be called; expected are already IDs');
    },
  };
  const dmConfig = { ...config, mode: 'dm', expected: ['U1', 'U2'] };
  const items = await runAnnounce({ config: dmConfig, slack, now: 1000 });
  assert.deepEqual(opened, ['U1', 'U2']);
  assert.equal(items.length, 2);
  assert.deepEqual(items[0].expected, ['U1']);
  assert.equal(items[0].channel, 'D_U1');
  assert.equal(items[0].ts, 'ts_D_U1');
  assert.deepEqual(items[1].expected, ['U2']);
  assert.equal(items[1].channel, 'D_U2');
});

test('runAnnounce falls back to the default nudge template when config omits it', async () => {
  const { nudgeText, ...withoutNudge } = config;
  const [item] = await runAnnounce({ config: withoutNudge, slack: fakeSlack([]), now: 1000 });
  assert.equal(item.nudgeText, 'Still waiting on a reaction from {mentions} — please react to confirm.');
});

test('selectReminder finds the reminder by id', () => {
  const reminders = [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }];
  assert.equal(selectReminder(reminders, 'b').text, 'B');
});

test('selectReminder throws with available ids when id is missing or unknown', () => {
  const reminders = [{ id: 'a' }, { id: 'b' }];
  assert.throws(() => selectReminder(reminders, undefined), /Available: a, b/);
  assert.throws(() => selectReminder(reminders, 'nope'), /not found.*Available: a, b/);
});
