import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { todayKstYmd, ymdString } from './koreanCalendar.js';
import { dueReminderIds } from './schedule.js';
import { runAnnounce, selectReminder } from './announce.js';
import { loadTracked, saveTracked } from './store.js';
import { createWebClient, makeSlack } from './slackClient.js';

// Runs once a day. Announces every reminder whose Korean-working-calendar
// schedule makes it due today (KST); does nothing on non-send days.
export async function main() {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error('SLACK_BOT_TOKEN is not set (load it with --env-file=.env)');
  const reminders = JSON.parse(await readFile(join(process.cwd(), 'config.json'), 'utf8'));
  const list = Array.isArray(reminders) ? reminders : [reminders];
  const today = todayKstYmd();
  const dueIds = dueReminderIds(list, today);
  if (dueIds.length === 0) {
    console.log(`no reminders due on ${ymdString(today)} (KST)`);
    return;
  }
  const file = join(process.cwd(), 'tracked.json');
  const items = await loadTracked(file);
  const slack = makeSlack(createWebClient(token));
  const now = Math.floor(Date.now() / 1000);
  for (const id of dueIds) {
    const config = selectReminder(list, id);
    const newItems = await runAnnounce({ config, slack, now });
    items.push(...newItems);
    console.log(`announced '${id}' (${config.mode ?? 'channel'} mode): ${newItems.length} message(s)`);
  }
  await saveTracked(file, items);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
