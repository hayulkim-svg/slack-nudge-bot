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

## Schedule the check

Add to your crontab (`crontab -e`) to check every 15 minutes:

```
*/15 * * * * cd ~/slack-nudge-bot && /usr/bin/env node --env-file=.env src/check.js >> check.log 2>&1
```

## State

`tracked.json` holds active/done/expired items. It is gitignored and written
atomically. Safe to inspect; deleting it stops all tracking.
