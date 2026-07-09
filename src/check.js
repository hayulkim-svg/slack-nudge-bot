import { join } from 'node:path';
import { computeMissing, isDue, isExpired, formatNudge, addHours } from './nudgeLogic.js';
import { loadTracked, saveTracked } from './store.js';
import { createWebClient, makeSlack } from './slackClient.js';

export async function runCheck(items, slack, now) {
  for (const item of items) {
    if (!isDue(item, now)) continue;
    try {
      if (isExpired(item, now)) {
        item.status = 'expired';
        continue;
      }
      const reactors = await slack.getReactors({ channel: item.channel, ts: item.ts, emoji: item.emoji });
      const missing = computeMissing(item.expected, reactors);
      if (missing.length === 0) {
        item.status = 'done';
        continue;
      }
      await slack.postThreadReply({
        channel: item.channel,
        threadTs: item.ts,
        text: formatNudge(item.emoji, missing),
      });
      item.nextNudgeAt = addHours(now, item.repeatIntervalHours);
    } catch (err) {
      console.error(`check failed for item ts=${item.ts}: ${err.message}`);
    }
  }
  return items;
}

export async function main() {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error('SLACK_BOT_TOKEN is not set (load it with --env-file=.env)');
  const file = join(process.cwd(), 'tracked.json');
  const items = await loadTracked(file);
  const slack = makeSlack(createWebClient(token));
  const now = Math.floor(Date.now() / 1000);
  await runCheck(items, slack, now);
  await saveTracked(file, items);
  console.log(`check complete: ${items.length} tracked item(s)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
