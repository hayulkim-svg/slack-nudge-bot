export function computeMissing(expected, reactors) {
  const reacted = new Set(reactors);
  const seen = new Set();
  const missing = [];
  for (const id of expected) {
    if (reacted.has(id) || seen.has(id)) continue;
    seen.add(id);
    missing.push(id);
  }
  return missing;
}

export function isDue(item, now) {
  return item.status === 'active' && now >= item.nextNudgeAt;
}

export function isExpired(item, now) {
  return item.expiresAt != null && now >= item.expiresAt;
}

export const DEFAULT_NUDGE_TEMPLATE =
  'Still waiting on a reaction from {mentions} — please react to confirm.';

// template may contain {mentions}; it is replaced with the joined <@ID> mentions.
export function formatNudge(template, missing) {
  const mentions = missing.map((id) => `<@${id}>`).join(' ');
  return template.replaceAll('{mentions}', mentions);
}

export function addHours(unixSeconds, hours) {
  return unixSeconds + Math.round(hours * 3600);
}

// Seconds that `timeZone` is offset from UTC at the given instant (east positive).
function zoneOffsetSeconds(unixSeconds, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(unixSeconds * 1000));
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const asUTC = Math.floor(
    Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) / 1000,
  );
  return asUTC - unixSeconds;
}

// Unix seconds of wall-clock `hhmm` (e.g. "23:00") in `timeZone`, on the same
// local calendar day as `now`. Used as the daily cutoff after which no more
// nudges are sent.
export function stopTimeUnix(now, hhmm, timeZone) {
  const [hh, mm] = hhmm.split(':').map(Number);
  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(now * 1000));
  const get = (t) => Number(dateParts.find((p) => p.type === t).value);
  const guess = Math.floor(Date.UTC(get('year'), get('month') - 1, get('day'), hh, mm, 0) / 1000);
  return guess - zoneOffsetSeconds(guess, timeZone);
}
