# Slack Reaction-Nudge Bot

Posts a Slack announcement, then nudges (in a thread) the people on a fixed list
who have not reacted with a chosen emoji — repeating until everyone reacts or the
item expires.

## Slack app setup (one-time)

1. Create a Slack app at api.slack.com/apps ("From scratch").
2. Under **OAuth & Permissions**, add bot token scopes:
   `chat:write`, `reactions:read`, `im:write` (for DM-mode reminders), and
   `users:read` + `users:read.email` (only if you list people by email).
3. Install the app to your workspace and copy the **Bot User OAuth Token**
   (`xoxb-...`). If you add scopes later, **reinstall** the app.
4. `cp .env.example .env` and paste the token into `.env`.
5. For channel-mode reminders, invite the bot: `/invite @your-bot-name`.
   (DM-mode reminders need no invite.)
6. Get the channel ID (channel details in Slack, or right-click the channel).

## Configure

`config.json` is an **array of reminders**. `cp config.example.json config.json`
and edit. Each reminder has:

- `id` — unique name; you post a reminder by this id (e.g. `card-withdrawal`).
- `mode` — `"channel"` (post once in a channel, react there, nudge in-thread) or
  `"dm"` (send each person a private DM they react on; nudges go to that DM).
- `channel` — channel ID (starts with `C`). Required for `channel` mode; ignored
  for `dm` mode.
- `emoji` — reaction emoji name, no colons (e.g. `done`).
- `expected` — Slack user IDs (`U...`) and/or emails to resolve.
- `text` — the announcement message.
- `nudgeText` — reminder template. `{mentions}` is replaced with the `<@ID>`
  mentions of whoever has not reacted (omit it for personal DMs). Optional.
- `initialDelayHours` — delay from posting to the first nudge.
- `repeatIntervalHours` — spacing between repeat nudges.
- `schedule` — when the daily cloud job auto-announces this reminder (KST),
  using the Korean working calendar (`src/koreanCalendar.js`). Omit for
  manual-only reminders. Types:
  - `{ "type": "nthWorkingDay", "n": 3 }` — the nth working day of the month
    (weekends + KR public/substitute holidays + Labor Day skipped). Used by
    `expense-claim`.
  - `{ "type": "dayBeforeWorkingDayOnOrAfter", "day": 23 }` — withdrawal lands
    on `day`, rolled forward to the next working day if needed; the message is
    sent the calendar day before that (may be a weekend/holiday, by design).
    Used by `card-withdrawal`.
- `stopAtLocalTime` + `timezone` — daily cutoff after which no more nudges are
  sent, e.g. `"23:00"` in `"Asia/Seoul"`.

## Run

```bash
npm install
npm test                          # run the test suite
npm run announce -- <reminder-id> # post a reminder (e.g. card-withdrawal)
npm run check                     # nudge due non-reactors (run on a schedule)
```

## Schedule the check (local, only while your computer is on)

Add to your crontab (`crontab -e`) to check every 15 minutes:

```
*/15 * * * * cd ~/slack-nudge-bot && /usr/bin/env node --env-file=.env src/check.js >> check.log 2>&1
```

## Run in the cloud with GitHub Actions (works without your computer)

Two workflows in `.github/workflows/` run the bot on GitHub's servers:

- `nudge-check` — runs `check` on a schedule (every 30 min) and on demand.
- `nudge-announce` — runs **daily at 09:00 KST** and announces whichever
  reminders are due today per their `schedule` block (Korean working calendar).
  A manual run with a `reminder_id` announces that reminder immediately,
  bypassing the schedule.

Both read `config.json`, use the `SLACK_BOT_TOKEN` **repository secret**, and
commit the updated `tracked.json` back to the repo so state persists between runs.

Setup:

1. Push this repo to GitHub (**private** — `config.json` contains channel and
   user IDs).
2. Add the secret: repo **Settings → Secrets and variables → Actions → New
   repository secret**, name `SLACK_BOT_TOKEN`, value your `xoxb-...` token.
   (Or: `gh secret set SLACK_BOT_TOKEN`.)
3. Leave it to run: `nudge-announce` fires each reminder on its scheduled day.
   To start one manually, use **Actions → nudge-announce → Run workflow** and
   enter the reminder `id` (e.g. `card-withdrawal`).
4. The scheduled `nudge-check` then nudges non-reactors automatically.

Notes:

- Once you run in the cloud, let the workflows own `tracked.json`. If you also run
  locally, `git pull` first to avoid diverging state.
- GitHub disables scheduled workflows after ~60 days of repo inactivity; an active
  reminder commits state regularly, which keeps it alive.
- The workflows use `config.json` from the repo, so commit config changes to
  update what the cloud posts.

## State

`tracked.json` holds active/done/expired items. It is gitignored and written
atomically. Safe to inspect; deleting it stops all tracking.
