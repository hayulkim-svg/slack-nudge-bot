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

export function computeExpiresAt(postTime, expiresAfterHours) {
  return expiresAfterHours == null ? null : addHours(postTime, expiresAfterHours);
}
