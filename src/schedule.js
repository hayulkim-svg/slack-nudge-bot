import {
  nthWorkingDayOfMonth,
  nextWorkingDayOnOrAfter,
  addDays,
  datesEqual,
} from './koreanCalendar.js';

// Decides, for a reminder's `schedule` block and a civil date { y, m, d } in
// KST, whether that date is the day the reminder should be announced.
//
// Schedule types:
//   { type: 'nthWorkingDay', n }
//       The nth working day of the month (weekends + KR holidays skipped).
//       Used by expense-claim (n: 3 = 3rd working day).
//
//   { type: 'dayBeforeWorkingDayOnOrAfter', day }
//       The withdrawal lands on `day`, rolled forward to the next working day
//       if `day` is not one; the reminder is sent the calendar day before that
//       withdrawal (so "내일은 출금일" stays accurate). Used by card-withdrawal
//       (day: 23). This may fall on a weekend/holiday — intended, since it is a
//       DM sent exactly one day before the money is withdrawn.
export function isSendDate(schedule, date) {
  if (schedule.type === 'nthWorkingDay') {
    const target = nthWorkingDayOfMonth(date.y, date.m, schedule.n);
    return target != null && datesEqual(target, date);
  }
  if (schedule.type === 'dayBeforeWorkingDayOnOrAfter') {
    const withdrawal = nextWorkingDayOnOrAfter({ y: date.y, m: date.m, d: schedule.day });
    const send = addDays(withdrawal, -1);
    return datesEqual(send, date);
  }
  throw new Error(`Unknown schedule type: ${schedule.type}`);
}

// Ids of every reminder due to be announced on `date`. Reminders without a
// `schedule` block are never auto-announced (they are manual-dispatch only).
export function dueReminderIds(reminders, date) {
  return reminders.filter((r) => r.schedule && isSendDate(r.schedule, date)).map((r) => r.id);
}
