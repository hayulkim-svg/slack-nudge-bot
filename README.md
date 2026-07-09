# Slack Reaction-Nudge Bot

Posts a Slack announcement, then nudges (in a thread) the people on a fixed list
who have not reacted with a chosen emoji — repeating until everyone reacts or the
item expires.

## Slack app setup (one-time)

1. Create a Slack app at api.slack.com/apps ("From scratch").
2. Under **OAuth & Permissions**, add bot token scopes:
   `chat:write`, `reactions:read`, `users:read`, and `users:read.email`
   (the last only needed if you list people by email).
3. Install the app to your workspace and copy the **Bot User OAuth Token**
   (`xoxb-...`).
4. `cp .env.example .env` and paste the token into `.env`.
5. Invite the bot to the target channel: `/invite @your-bot-name`.
6. Get the channel ID (channel details in Slack, or right-click the channel).

## Configure

`cp config.example.json config.json` and edit:

- `channel` — channel ID (starts with `C`).
- `emoji` — reaction emoji name, no colons (e.g. `white_check_mark`).
- `expected` — list of Slack user IDs (`U...`) and/or emails to resolve.
- `text` — the announcement message.
- `nudgeText` — the reminder message template. `{mentions}` is replaced with the
  `<@ID>` mentions of everyone who has not reacted. Supports Slack markup and
  newlines. Optional; a plain English default is used if omitted.
- `initialDelayHours` — wait this long after posting before the first nudge.
- `repeatIntervalHours` — spacing between repeat nudges.
- `expiresAfterHours` — stop nudging after this long (`null` = never expire).

## Run

```bash
npm install
npm test            # run the test suite
npm run announce    # post the announcement (reads config.json)
npm run check       # nudge non-reactors that are due (run this on a schedule)
```

## Schedule the check (local, only while your computer is on)

Add to your crontab (`crontab -e`) to check every 15 minutes:

```
*/15 * * * * cd ~/slack-nudge-bot && /usr/bin/env node --env-file=.env src/check.js >> check.log 2>&1
```

## Run in the cloud with GitHub Actions (works without your computer)

Two workflows in `.github/workflows/` run the bot on GitHub's servers:

- `nudge-check` — runs `check` on a schedule (every 30 min) and on demand.
- `nudge-announce` — runs `announce` when you trigger it manually.

Both read `config.json`, use the `SLACK_BOT_TOKEN` **repository secret**, and
commit the updated `tracked.json` back to the repo so state persists between runs.

Setup:

1. Push this repo to GitHub (**private** — `config.json` contains channel and
   user IDs).
2. Add the secret: repo **Settings → Secrets and variables → Actions → New
   repository secret**, name `SLACK_BOT_TOKEN`, value your `xoxb-...` token.
   (Or: `gh secret set SLACK_BOT_TOKEN`.)
3. To start a reminder: **Actions → nudge-announce → Run workflow**.
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
