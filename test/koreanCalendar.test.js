import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isWorkingDay,
  nthWorkingDayOfMonth,
  nextWorkingDayOnOrAfter,
  addDays,
  todayKstYmd,
  ymdString,
} from '../src/koreanCalendar.js';

test('isWorkingDay: weekends are off', () => {
  assert.equal(isWorkingDay({ y: 2026, m: 1, d: 3 }), false); // Sat
  assert.equal(isWorkingDay({ y: 2026, m: 1, d: 4 }), false); // Sun
  assert.equal(isWorkingDay({ y: 2026, m: 1, d: 5 }), true); // Mon
});

test('isWorkingDay: public holidays, substitutes, election and Labor Day are off', () => {
  assert.equal(isWorkingDay({ y: 2026, m: 1, d: 1 }), false); // 신정
  assert.equal(isWorkingDay({ y: 2026, m: 3, d: 2 }), false); // 삼일절 대체
  assert.equal(isWorkingDay({ y: 2026, m: 5, d: 1 }), false); // 근로자의날
  assert.equal(isWorkingDay({ y: 2026, m: 6, d: 3 }), false); // 지방선거
  assert.equal(isWorkingDay({ y: 2026, m: 7, d: 17 }), false); // 제헌절
  assert.equal(isWorkingDay({ y: 2026, m: 8, d: 17 }), false); // 광복절 대체
  assert.equal(isWorkingDay({ y: 2026, m: 5, d: 25 }), false); // 부처님 대체
  assert.equal(isWorkingDay({ y: 2026, m: 12, d: 25 }), false); // 성탄절
});

test('nthWorkingDayOfMonth: 3rd working day matches the 2026 expense-claim table', () => {
  const expected = {
    1: '2026-01-06',
    2: '2026-02-04',
    3: '2026-03-05',
    4: '2026-04-03',
    5: '2026-05-07',
    6: '2026-06-04',
    7: '2026-07-03',
    8: '2026-08-05',
    9: '2026-09-03',
    10: '2026-10-06',
    11: '2026-11-04',
    12: '2026-12-03',
  };
  for (const [m, want] of Object.entries(expected)) {
    assert.equal(ymdString(nthWorkingDayOfMonth(2026, Number(m), 3)), want, `month ${m}`);
  }
});

test('nextWorkingDayOnOrAfter: rolls past weekends and holiday runs', () => {
  assert.equal(ymdString(nextWorkingDayOnOrAfter({ y: 2026, m: 2, d: 23 })), '2026-02-23'); // Mon, working
  assert.equal(ymdString(nextWorkingDayOnOrAfter({ y: 2026, m: 5, d: 23 })), '2026-05-26'); // Sat+Sun+대체 -> Tue
  assert.equal(ymdString(nextWorkingDayOnOrAfter({ y: 2026, m: 8, d: 23 })), '2026-08-24'); // Sun -> Mon
});

test('addDays crosses month and year boundaries', () => {
  assert.equal(ymdString(addDays({ y: 2026, m: 1, d: 31 }, 1)), '2026-02-01');
  assert.equal(ymdString(addDays({ y: 2026, m: 3, d: 1 }, -1)), '2026-02-28');
  assert.equal(ymdString(addDays({ y: 2026, m: 12, d: 31 }, 1)), '2027-01-01');
});

test('todayKstYmd converts a UTC instant to the KST calendar day', () => {
  // 2026-01-01 20:00 UTC is 2026-01-02 05:00 KST.
  assert.deepEqual(todayKstYmd(new Date('2026-01-01T20:00:00Z')), { y: 2026, m: 1, d: 2 });
  // 2026-01-01 00:00 UTC is 2026-01-01 09:00 KST (the daily run time).
  assert.deepEqual(todayKstYmd(new Date('2026-01-01T00:00:00Z')), { y: 2026, m: 1, d: 1 });
});
