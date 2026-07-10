// Korean working-calendar helpers. A "civil date" is { y, m, d } in KST
// (Korea has no DST, so KST is a fixed UTC+9). Non-working days are weekends
// plus the holidays below.
//
// HOLIDAYS lists official public holidays, substitute holidays (대체공휴일),
// the local-election day, and 근로자의날 (Labor Day) — every day workers are
// granted leave. Add future years by appending their 'YYYY-MM-DD' entries.
export const HOLIDAYS = new Set([
  // ---- 2026 ----
  '2026-01-01', // 신정
  '2026-02-16', // 설날 연휴
  '2026-02-17', // 설날
  '2026-02-18', // 설날 연휴
  '2026-03-01', // 삼일절
  '2026-03-02', // 삼일절 대체공휴일
  '2026-05-01', // 근로자의날 (Labor Day)
  '2026-05-05', // 어린이날
  '2026-05-24', // 부처님오신날
  '2026-05-25', // 부처님오신날 대체공휴일
  '2026-06-03', // 제9회 전국동시지방선거
  '2026-06-06', // 현충일
  '2026-07-17', // 제헌절 (2026년 공휴일 재지정)
  '2026-08-15', // 광복절
  '2026-08-17', // 광복절 대체공휴일
  '2026-09-24', // 추석 연휴
  '2026-09-25', // 추석
  '2026-09-26', // 추석 연휴
  '2026-10-03', // 개천절
  '2026-10-05', // 개천절 대체공휴일
  '2026-10-09', // 한글날
  '2026-12-25', // 성탄절
]);

const pad = (n) => String(n).padStart(2, '0');

export function ymdString({ y, m, d }) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

// 0 = Sunday … 6 = Saturday. Computed via a UTC Date so it is timezone-neutral.
export function weekday({ y, m, d }) {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isWorkingDay(date) {
  const wd = weekday(date);
  if (wd === 0 || wd === 6) return false; // Sun / Sat
  return !HOLIDAYS.has(ymdString(date));
}

// Add n calendar days (n may be negative), rolling across month/year borders.
export function addDays(date, n) {
  const dt = new Date(Date.UTC(date.y, date.m - 1, date.d + n));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

export function datesEqual(a, b) {
  return a.y === b.y && a.m === b.m && a.d === b.d;
}

// The nth working day of a given month (n is 1-based). Null if the month has
// fewer than n working days (never happens for small n).
export function nthWorkingDayOfMonth(y, m, n) {
  let count = 0;
  let date = { y, m, d: 1 };
  while (date.m === m && date.y === y) {
    if (isWorkingDay(date)) {
      count += 1;
      if (count === n) return date;
    }
    date = addDays(date, 1);
  }
  return null;
}

// The first working day on or after `date`.
export function nextWorkingDayOnOrAfter(date) {
  let d = date;
  while (!isWorkingDay(d)) d = addDays(d, 1);
  return d;
}

// Today's civil date in KST. `now` is a Date (defaults to real time).
export function todayKstYmd(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  return { y: kst.getUTCFullYear(), m: kst.getUTCMonth() + 1, d: kst.getUTCDate() };
}
