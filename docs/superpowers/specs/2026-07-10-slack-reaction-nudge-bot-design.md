# Slack Reaction-Nudge Bot — Design

Date: 2026-07-10

## Purpose

Post an announcement in a Slack channel asking a fixed list of people to react
with a specific emoji (a "read receipt" / confirmation). After an initial delay,
the bot checks who has not reacted and posts a **thread reply** @mentioning the
stragglers. It **repeats** the reminder on a fixed interval until everyone on the
list has reacted (or the item expires).

## Non-goals

- No real-time event handling (no Events API / Socket Mode). Reactions are polled
  when a nudge is due, not listened for.
- No web server or public URL.
- No interactive components (buttons, modals). Can be added later.
- No database — a local JSON file is the state store.

## Runtime model

Cron-style, two command entry points. No always-on process.

- `announce` — posts the announcement message and records a tracked item.
- `check` — the scheduled job (run every N minutes by cron). Finds due tracked
  items, diffs reactions, posts nudges, reschedules or completes items.

```
announce  ── chat.postMessage ──▶ Slack
          ── append ───────────▶ tracked.json

check (cron) ── read ─────────▶ tracked.json
             ── reactions.get ▶ Slack
             ── diff (expected − reactors)
             ── chat.postMessage (thread reply) ▶ Slack   (if stragglers remain)
             ── update ────────▶ tracked.json
```

## Components

Each unit has one purpose, a small interface, and is testable in isolation.

### `config`
- `.env`: `SLACK_BOT_TOKEN` (xoxb-…).
- Config object (file or env), per announcement definition:
  - `channel` — channel ID (e.g. `C0123ABCD`).
  - `emoji` — emoji name without colons (e.g. `white_check_mark`).
  - `expected` — list of people expected to react. Stored/resolved to Slack user
    IDs (`U…`). May be authored as emails and resolved via `users.lookupByEmail`.
  - `text` — announcement message body.
  - `initialDelayHours` — delay from post time to first nudge.
  - `repeatIntervalHours` — spacing between repeat nudges.
  - `expiresAfterHours` — stop nudging after this long even if some never react
    (default 168h = 7 days; may be set to `null` for "never expire").

### `state store` (`tracked.json`)
A JSON array of tracked items:
```json
{
  "channel": "C0123ABCD",
  "ts": "1720598400.000100",
  "emoji": "white_check_mark",
  "expected": ["U1", "U2", "U3"],
  "nextNudgeAt": 1720684800,
  "expiresAt": 1721203200,
  "status": "active"
}
```
- `status`: `active` | `done` | `expired`.
- `nextNudgeAt`: unix seconds. On post: `postTime + initialDelayHours`.
  On each nudge: `now + repeatIntervalHours`.

### `slack client` (thin wrapper over `@slack/web-api` `WebClient`)
- `postAnnouncement({channel, text})` → returns `ts`.
- `getReactors({channel, ts, emoji})` → returns `[userId]` (the `users` array for
  that emoji from `reactions.get`; empty if the emoji is absent).
- `postThreadReply({channel, threadTs, text})`.
- `lookupUserIdByEmail(email)` → `userId` (helper for authoring by email).

### entry points
- `announce` — reads a config, calls `postAnnouncement`, computes `nextNudgeAt`
  and `expiresAt`, appends a tracked item to `tracked.json`.
- `check` — for each `active` item: if `now >= expiresAt`, mark `expired`; else if
  `now >= nextNudgeAt`, fetch reactors, compute `missing = expected − reactors`.
  If `missing` empty → mark `done`. Else → post thread reply mentioning `missing`,
  set `nextNudgeAt = now + repeatIntervalHours`.

## Nudge logic (the core, pure and unit-tested)

Two pure functions with no Slack dependency:

- `isDue(item, now)` → whether the item needs processing this run.
- `computeMissing(expected, reactors)` → the straggler list.

`check` composes these with the Slack client. Purity keeps the decision logic
fully testable with a mocked clock and a fake client.

Nudge message (thread reply):
`":wave: still waiting on a :white_check_mark: from <@U2> <@U3>"`

## Identifying people

- Expected list resolves to Slack user IDs (`U…`); mentions render as `<@U…>`.
- Authoring convenience: emails resolved once via `users.lookupByEmail` and
  cached into the tracked item's `expected` as IDs.

## Slack app setup (one-time, in Slack UI)

1. Create a Slack app (from scratch).
2. Bot token scopes: `chat:write`, `reactions:read`, `users:read`
   (+ `users:read.email` if resolving expected people by email).
3. Install to workspace; copy the `xoxb-` token into `.env`.
4. Invite the bot to the target channel (`/invite @yourbot`).

## Error handling

- Missing `SLACK_BOT_TOKEN`, bot not in channel, or bad channel ID → fail with a
  clear, actionable message (name the missing scope / channel).
- `check` is idempotent per run: an item is only nudged when `now >= nextNudgeAt`,
  and `nextNudgeAt` advances after each nudge, so a double cron run won't
  double-nudge.
- A single item failing (e.g. transient API error) is logged and does not abort
  the rest of the run; its state is left unchanged so it retries next run.
- `tracked.json` writes are atomic (write temp file, rename) to avoid corruption.

## Testing

- Unit: `computeMissing` (subset/overlap/empty cases), `isDue` (before delay, due,
  after expiry) with a mocked clock.
- Unit: `check` orchestration against a fake Slack client (no live API) verifying
  the right thread replies and state transitions.
- Manual smoke: real `announce` + `check` against a test channel with a short
  `initialDelayHours` (e.g. a few minutes).

## Scheduling

- `check` runs on cron, e.g. every 15 minutes:
  `*/15 * * * * cd ~/slack-nudge-bot && node src/check.js >> check.log 2>&1`
- `announce` run manually (or its own cron) when you want to start a confirmation.

## Project layout

```
~/slack-nudge-bot/
  .env                  # SLACK_BOT_TOKEN (gitignored)
  .env.example
  config.json           # announcement definition(s)
  tracked.json          # state (gitignored)
  src/
    slackClient.js      # WebClient wrapper
    nudgeLogic.js       # isDue, computeMissing (pure)
    store.js            # load/save tracked.json (atomic)
    announce.js         # entry point
    check.js            # entry point
  test/
    nudgeLogic.test.js
    check.test.js
  docs/superpowers/specs/2026-07-10-slack-reaction-nudge-bot-design.md
```
