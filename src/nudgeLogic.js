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

export function formatNudge(emoji, missing) {
  const mentions = missing.map((id) => `<@${id}>`).join(' ');
  return `Still waiting on a :${emoji}: from ${mentions} — please react to confirm.`;
}

export function addHours(unixSeconds, hours) {
  return unixSeconds + Math.round(hours * 3600);
}

export function computeExpiresAt(postTime, expiresAfterHours) {
  return expiresAfterHours == null ? null : addHours(postTime, expiresAfterHours);
}
