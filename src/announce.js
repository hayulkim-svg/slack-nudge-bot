import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { addHours, computeExpiresAt } from './nudgeLogic.js';
import { loadTracked, saveTracked } from './store.js';
import { createWebClient, makeSlack } from './slackClient.js';

async function resolveExpected(expected, slack) {
  const ids = [];
  for (const entry of expected) {
    ids.push(entry.includes('@') ? await slack.lookupUserIdByEmail(entry) : entry);
  }
  return ids;
}

export async function runAnnounce({ config, slack, now }) {
  const expected = await resolveExpected(config.expected, slack);
  const ts = await slack.postAnnouncement({ channel: config.channel, text: config.text });
  return {
    channel: config.channel,
    ts,
    emoji: config.emoji,
    expected,
    repeatIntervalHours: config.repeatIntervalHours,
    nextNudgeAt: addHours(now, config.initialDelayHours),
    expiresAt: computeExpiresAt(now, config.expiresAfterHours),
    status: 'active',
  };
}

export async function main() {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error('SLACK_BOT_TOKEN is not set (load it with --env-file=.env)');
  const config = JSON.parse(await readFile(join(process.cwd(), 'config.json'), 'utf8'));
  const file = join(process.cwd(), 'tracked.json');
  const items = await loadTracked(file);
  const slack = makeSlack(createWebClient(token));
  const now = Math.floor(Date.now() / 1000);
  const item = await runAnnounce({ config, slack, now });
  items.push(item);
  await saveTracked(file, items);
  console.log(`announced in ${item.channel}, ts=${item.ts}, tracking ${item.expected.length} people`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
