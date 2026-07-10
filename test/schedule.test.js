import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSendDate, dueReminderIds } from '../src/schedule.js';

const NTH = { type: 'nthWorkingDay', n: 3 };
const DAY_BEFORE = { type: 'dayBeforeWorkingDayOnOrAfter', day: 23 };

test('nthWorkingDay send date is true only on the 3rd working day', () => {
  assert.equal(isSendDate(NTH, { y: 2026, m: 1, d: 6 }), true);
  assert.equal(isSendDate(NTH, { y: 2026, m: 1, d: 5 }), false);
  assert.equal(isSendDate(NTH, { y: 2026, m: 1, d: 7 }), false);
});

test('dayBeforeWorkingDayOnOrAfter matches the 2026 card-withdrawal send dates', () => {
  const sendDates = {
    1: '2026-01-22',
    2: '2026-02-22', // Sun (day before Mon 23)
    3: '2026-03-22', // Sun
    4: '2026-04-22',
    5: '2026-05-25', // 대체공휴일 (day before Tue 26, after Sat/Sun/대체)
    6: '2026-06-22',
    7: '2026-07-22',
    8: '2026-08-23', // Sun (day before Mon 24)
    9: '2026-09-22',
    10: '2026-10-22',
    11: '2026-11-22', // Sun
    12: '2026-12-22',
  };
  for (const [m, iso] of Object.entries(sendDates)) {
    const [y, mm, dd] = iso.split('-').map(Number);
    assert.equal(isSendDate(DAY_BEFORE, { y, m: Number(m), d: dd }), true, `send ${iso}`);
    // The day after the send date is not itself a send date.
    assert.equal(isSendDate(DAY_BEFORE, { y, m: mm, d: dd + 1 }), false, `not ${iso}+1`);
  }
});

test('dueReminderIds returns only reminders whose schedule fires today', () => {
  const reminders = [
    { id: 'expense-claim', schedule: NTH },
    { id: 'card-withdrawal', schedule: DAY_BEFORE },
    { id: 'manual-only' }, // no schedule -> never auto-fires
  ];
  assert.deepEqual(dueReminderIds(reminders, { y: 2026, m: 3, d: 5 }), ['expense-claim']);
  assert.deepEqual(dueReminderIds(reminders, { y: 2026, m: 3, d: 22 }), ['card-withdrawal']);
  assert.deepEqual(dueReminderIds(reminders, { y: 2026, m: 3, d: 10 }), []);
});

test('unknown schedule type throws', () => {
  assert.throws(() => isSendDate({ type: 'nope' }, { y: 2026, m: 1, d: 1 }), /Unknown schedule type/);
});
