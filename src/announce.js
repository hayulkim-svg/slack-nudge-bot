import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { addHours, stopTimeUnix, DEFAULT_NUDGE_TEMPLATE } from './nudgeLogic.js';
import { loadTracked, saveTracked } from './store.js';
import { createWebClient, makeSlack } from './slackClient.js';

async function resolveExpected(expected, slack) {
  const ids = [];
  for (const entry of expected) {
    ids.push(entry.includes('@') ? await slack.lookupUserIdByEmail(entry) : entry);
  }
  return ids;
}

// Returns an array of tracked items. In "channel" mode that is a single item
// (one post, many expected reactors). In "dm" mode it is one item per person
// (each gets their own DM message they react on), so the check logic — which
// diffs expected vs reactors per item — works unchanged for both.
export async function runAnnounce({ config, slack, now }) {
  const expected = await resolveExpected(config.expected, slack);
  const base = {
    emoji: config.emoji,
    nudgeText: config.nudgeText ?? DEFAULT_NUDGE_TEMPLATE,
    repeatIntervalHours: config.repeatIntervalHours,
    nextNudgeAt: addHours(now, config.initialDelayHours),
    expiresAt: stopTimeUnix(now, config.stopAtLocalTime, config.timezone),
    status: 'active',
  };

  if (config.mode === 'dm') {
    const items = [];
    for (const userId of expected) {
      const channel = await slack.openDm(userId);
      const ts = await slack.postAnnouncement({ channel, text: config.text });
      items.push({ channel, ts, expected: [userId], ...base });
    }
    return items;
  }

  const ts = await slack.postAnnouncement({ channel: config.channel, text: config.text });
  return [{ channel: config.channel, ts, expected, ...base }];
}

// config.json is an array of reminder definitions, each with a unique `id`.
export function selectReminder(reminders, reminderId) {
  const list = Array.isArray(reminders) ? reminders : [reminders];
  const ids = list.map((r) => r.id).join(', ');
  if (!reminderId) throw new Error(`Specify a reminder id. Available: ${ids}`);
  const config = list.find((r) => r.id === reminderId);
  if (!config) throw new Error(`Reminder '${reminderId}' not found. Available: ${ids}`);
  return config;
}

export async function main() {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error('SLACK_BOT_TOKEN is not set (load it with --env-file=.env)');
  const reminderId = process.argv[2] || process.env.REMINDER_ID;
  const reminders = JSON.parse(await readFile(join(process.cwd(), 'config.json'), 'utf8'));
  const config = selectReminder(reminders, reminderId);
  const file = join(process.cwd(), 'tracked.json');
  const items = await loadTracked(file);
  const slack = makeSlack(createWebClient(token));
  const now = Math.floor(Date.now() / 1000);
  const newItems = await runAnnounce({ config, slack, now });
  items.push(...newItems);
  await saveTracked(file, items);
  const stopsAt = new Date(newItems[0].expiresAt * 1000).toISOString();
  console.log(
    `announced '${config.id}' (${config.mode ?? 'channel'} mode): ${newItems.length} message(s), stops at ${stopsAt}`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
