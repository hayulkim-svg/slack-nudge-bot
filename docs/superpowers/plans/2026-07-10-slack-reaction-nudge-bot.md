# Slack Reaction-Nudge Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Node.js bot that posts a Slack announcement, then repeatedly nudges (via thread reply) the people on a fixed list who have not reacted with a specific emoji, until everyone reacts or the item expires.

**Architecture:** Cron-style, two entry points (`announce`, `check`). No always-on server. `announce` posts a message and appends a tracked item to a local JSON file. `check` (run by cron) finds due items, diffs expected people against actual reactors via `reactions.get`, posts thread-reply nudges, and reschedules or completes each item. Decision logic is pure and unit-tested; Slack access is injected so orchestration is testable with a fake client.

**Tech Stack:** Node.js (ESM), `@slack/web-api` (only runtime dependency), Node built-in test runner (`node --test`) and `node:assert`, native `--env-file` for the token.

## Global Constraints

- Node.js >= 26 required (built-in test runner, native `--env-file`). Copy verbatim into `package.json` `engines`.
- Only runtime dependency allowed: `@slack/web-api`. No dotenv, no test framework, no scheduler library.
- ESM modules (`package.json` has `"type": "module"`; use `import`/`export`).
- All time values in state are **unix seconds** (integers). "now" is `Math.floor(Date.now() / 1000)`.
- No literal emoji characters in code, comments, or output. Slack emoji **shortcodes** (e.g. `:white_check_mark:`) are functional domain content and are allowed where the feature requires referencing the reaction emoji.
- `SLACK_BOT_TOKEN` is read from the environment (loaded via `--env-file=.env`). Never hardcode or commit it. `.env` and `tracked.json` are already gitignored.

---

### Task 1: Scaffold + pure nudge logic

**Files:**
- Create: `package.json`
- Create: `.env.example`
- Create: `src/nudgeLogic.js`
- Test: `test/nudgeLogic.test.js`

**Interfaces:**
- Consumes: nothing (first task).
- Produces (all pure, no I/O):
  - `computeMissing(expected: string[], reactors: string[]) => string[]` — user IDs in `expected` (in order, de-duplicated) that are not in `reactors`.
  - `isDue(item, now: number) => boolean` — `item.status === 'active' && now >= item.nextNudgeAt`.
  - `isExpired(item, now: number) => boolean` — `item.expiresAt != null && now >= item.expiresAt`.
  - `formatNudge(emoji: string, missing: string[]) => string` — the thread-reply text.
  - `addHours(unixSeconds: number, hours: number) => number` — `unixSeconds + Math.round(hours * 3600)`.
  - `computeExpiresAt(postTime: number, expiresAfterHours: number | null) => number | null` — `null` when `expiresAfterHours == null`, else `addHours(postTime, expiresAfterHours)`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "slack-nudge-bot",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "engines": { "node": ">=26" },
  "scripts": {
    "test": "node --test",
    "announce": "node --env-file=.env src/announce.js",
    "check": "node --env-file=.env src/check.js"
  },
  "dependencies": {
    "@slack/web-api": "^7.0.0"
  }
}
```

- [ ] **Step 2: Create `.env.example`**

```
# Copy to .env and fill in. .env is gitignored.
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
```

- [ ] **Step 3: Write the failing test** — `test/nudgeLogic.test.js`

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeMissing,
  isDue,
  isExpired,
  formatNudge,
  addHours,
  computeExpiresAt,
} from '../src/nudgeLogic.js';

test('computeMissing returns expected users not in reactors, preserving order', () => {
  assert.deepEqual(computeMissing(['U1', 'U2', 'U3'], ['U2']), ['U1', 'U3']);
});

test('computeMissing returns empty when everyone reacted', () => {
  assert.deepEqual(computeMissing(['U1', 'U2'], ['U2', 'U1', 'U9']), []);
});

test('computeMissing de-duplicates expected', () => {
  assert.deepEqual(computeMissing(['U1', 'U1', 'U2'], ['U2']), ['U1']);
});

test('isDue is true only for active items past nextNudgeAt', () => {
  assert.equal(isDue({ status: 'active', nextNudgeAt: 100 }, 100), true);
  assert.equal(isDue({ status: 'active', nextNudgeAt: 100 }, 99), false);
  assert.equal(isDue({ status: 'done', nextNudgeAt: 100 }, 200), false);
});

test('isExpired respects null expiresAt (never expires)', () => {
  assert.equal(isExpired({ expiresAt: null }, 999999), false);
  assert.equal(isExpired({ expiresAt: 500 }, 500), true);
  assert.equal(isExpired({ expiresAt: 500 }, 499), false);
});

test('formatNudge lists mentions and the emoji, no decorative emoji', () => {
  assert.equal(
    formatNudge('white_check_mark', ['U2', 'U3']),
    'Still waiting on a :white_check_mark: from <@U2> <@U3> — please react to confirm.',
  );
});

test('addHours adds whole seconds', () => {
  assert.equal(addHours(1000, 2), 1000 + 7200);
});

test('computeExpiresAt returns null when hours is null', () => {
  assert.equal(computeExpiresAt(1000, null), null);
  assert.equal(computeExpiresAt(1000, 24), 1000 + 24 * 3600);
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd ~/slack-nudge-bot && node --test test/nudgeLogic.test.js`
Expected: FAIL — cannot find module `../src/nudgeLogic.js`.

- [ ] **Step 5: Write minimal implementation** — `src/nudgeLogic.js`

```javascript
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
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd ~/slack-nudge-bot && node --test test/nudgeLogic.test.js`
Expected: PASS — 8 tests.

- [ ] **Step 7: Commit**

```bash
cd ~/slack-nudge-bot
git add package.json .env.example src/nudgeLogic.js test/nudgeLogic.test.js
git commit -m "feat: pure nudge logic and project scaffold"
```

---

### Task 2: State store (atomic JSON)

**Files:**
- Create: `src/store.js`
- Test: `test/store.test.js`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces:
  - `loadTracked(filePath: string) => Promise<object[]>` — parses the JSON array; returns `[]` if the file does not exist.
  - `saveTracked(filePath: string, items: object[]) => Promise<void>` — writes atomically (temp file + rename).

- [ ] **Step 1: Write the failing test** — `test/store.test.js`

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadTracked, saveTracked } from '../src/store.js';

test('loadTracked returns [] when file is missing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'store-'));
  try {
    assert.deepEqual(await loadTracked(join(dir, 'nope.json')), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('saveTracked then loadTracked round-trips items', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'store-'));
  const file = join(dir, 'tracked.json');
  try {
    const items = [{ ts: '1.2', status: 'active', expected: ['U1'] }];
    await saveTracked(file, items);
    assert.deepEqual(await loadTracked(file), items);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/slack-nudge-bot && node --test test/store.test.js`
Expected: FAIL — cannot find module `../src/store.js`.

- [ ] **Step 3: Write minimal implementation** — `src/store.js`

```javascript
import { readFile, writeFile, rename } from 'node:fs/promises';

export async function loadTracked(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

export async function saveTracked(filePath, items) {
  const tmp = `${filePath}.tmp`;
  await writeFile(tmp, JSON.stringify(items, null, 2));
  await rename(tmp, filePath);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/slack-nudge-bot && node --test test/store.test.js`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
cd ~/slack-nudge-bot
git add src/store.js test/store.test.js
git commit -m "feat: atomic JSON state store"
```

---

### Task 3: Slack client wrapper

**Files:**
- Create: `src/slackClient.js`
- Test: `test/slackClient.test.js`

**Interfaces:**
- Consumes: nothing from other tasks (wraps `@slack/web-api`).
- Produces:
  - `makeSlack(web) => slack` where `web` is a `WebClient`-shaped object. `slack` has:
    - `postAnnouncement({ channel, text }) => Promise<string>` — returns the new message `ts`.
    - `getReactors({ channel, ts, emoji }) => Promise<string[]>` — the `users` array for `emoji` from `reactions.get`; `[]` if the emoji is absent.
    - `postThreadReply({ channel, threadTs, text }) => Promise<void>`.
    - `lookupUserIdByEmail(email) => Promise<string>`.
  - `createWebClient(token) => WebClient` — real client factory (imported by entry points; not unit-tested).

- [ ] **Step 1: Write the failing test** — `test/slackClient.test.js`

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeSlack } from '../src/slackClient.js';

function fakeWeb(calls, responses = {}) {
  return {
    chat: {
      postMessage: async (args) => {
        calls.push(['postMessage', args]);
        return { ts: '1720000000.000100' };
      },
    },
    reactions: {
      get: async (args) => {
        calls.push(['reactions.get', args]);
        return responses.reactionsGet ?? { message: { reactions: [] } };
      },
    },
    users: {
      lookupByEmail: async (args) => {
        calls.push(['lookupByEmail', args]);
        return { user: { id: 'U777' } };
      },
    },
  };
}

test('postAnnouncement posts text and returns ts', async () => {
  const calls = [];
  const slack = makeSlack(fakeWeb(calls));
  const ts = await slack.postAnnouncement({ channel: 'C1', text: 'hi' });
  assert.equal(ts, '1720000000.000100');
  assert.deepEqual(calls[0], ['postMessage', { channel: 'C1', text: 'hi' }]);
});

test('getReactors returns users for the matching emoji', async () => {
  const calls = [];
  const responses = {
    reactionsGet: {
      message: {
        reactions: [
          { name: 'eyes', users: ['U9'], count: 1 },
          { name: 'white_check_mark', users: ['U1', 'U2'], count: 2 },
        ],
      },
    },
  };
  const slack = makeSlack(fakeWeb(calls, responses));
  const reactors = await slack.getReactors({ channel: 'C1', ts: '1.2', emoji: 'white_check_mark' });
  assert.deepEqual(reactors, ['U1', 'U2']);
  assert.deepEqual(calls[0], ['reactions.get', { channel: 'C1', timestamp: '1.2', full: true }]);
});

test('getReactors returns [] when emoji absent', async () => {
  const slack = makeSlack(fakeWeb([]));
  assert.deepEqual(await slack.getReactors({ channel: 'C1', ts: '1.2', emoji: 'tada' }), []);
});

test('postThreadReply sets thread_ts', async () => {
  const calls = [];
  const slack = makeSlack(fakeWeb(calls));
  await slack.postThreadReply({ channel: 'C1', threadTs: '1.2', text: 'poke' });
  assert.deepEqual(calls[0], ['postMessage', { channel: 'C1', text: 'poke', thread_ts: '1.2' }]);
});

test('lookupUserIdByEmail returns the user id', async () => {
  const slack = makeSlack(fakeWeb([]));
  assert.equal(await slack.lookupUserIdByEmail('a@b.com'), 'U777');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/slack-nudge-bot && node --test test/slackClient.test.js`
Expected: FAIL — cannot find module `../src/slackClient.js`.

- [ ] **Step 3: Write minimal implementation** — `src/slackClient.js`

```javascript
import { WebClient } from '@slack/web-api';

export function createWebClient(token) {
  return new WebClient(token);
}

export function makeSlack(web) {
  return {
    async postAnnouncement({ channel, text }) {
      const res = await web.chat.postMessage({ channel, text });
      return res.ts;
    },
    async getReactors({ channel, ts, emoji }) {
      const res = await web.reactions.get({ channel, timestamp: ts, full: true });
      const reactions = res.message?.reactions ?? [];
      const match = reactions.find((r) => r.name === emoji);
      return match?.users ?? [];
    },
    async postThreadReply({ channel, threadTs, text }) {
      await web.chat.postMessage({ channel, text, thread_ts: threadTs });
    },
    async lookupUserIdByEmail(email) {
      const res = await web.users.lookupByEmail({ email });
      return res.user.id;
    },
  };
}
```

- [ ] **Step 4: Install the dependency and run the test**

Run: `cd ~/slack-nudge-bot && npm install && node --test test/slackClient.test.js`
Expected: `npm install` adds `@slack/web-api`; test PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
cd ~/slack-nudge-bot
git add package.json package-lock.json src/slackClient.js test/slackClient.test.js
git commit -m "feat: Slack web-api client wrapper"
```

---

### Task 4: Check orchestration + entry point

**Files:**
- Create: `src/check.js`
- Test: `test/check.test.js`

**Interfaces:**
- Consumes:
  - `computeMissing`, `isDue`, `isExpired`, `formatNudge`, `addHours` from `src/nudgeLogic.js`.
  - `loadTracked`, `saveTracked` from `src/store.js`.
  - `createWebClient`, `makeSlack` from `src/slackClient.js`.
  - Tracked item shape: `{ channel, ts, emoji, expected: string[], repeatIntervalHours, nextNudgeAt, expiresAt, status }`.
- Produces:
  - `runCheck(items: object[], slack, now: number) => Promise<object[]>` — mutates and returns `items`. For each item where `isDue`: if `isExpired`, set `status='expired'`; else fetch reactors, compute `missing`; if empty set `status='done'`, else post a thread-reply nudge and set `nextNudgeAt = addHours(now, item.repeatIntervalHours)`. Items where `isDue` is false are left untouched. A per-item error is caught, logged, and leaves that item unchanged.
  - `main()` — loads `tracked.json` from `process.cwd()`, builds the real Slack client, runs `runCheck`, saves.

- [ ] **Step 1: Write the failing test** — `test/check.test.js`

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCheck } from '../src/check.js';

function fakeSlack(reactorsByTs, posted) {
  return {
    async getReactors({ ts }) {
      return reactorsByTs[ts] ?? [];
    },
    async postThreadReply(args) {
      posted.push(args);
    },
  };
}

function item(overrides = {}) {
  return {
    channel: 'C1',
    ts: '1.1',
    emoji: 'white_check_mark',
    expected: ['U1', 'U2'],
    repeatIntervalHours: 24,
    nextNudgeAt: 100,
    expiresAt: null,
    status: 'active',
    ...overrides,
  };
}

test('nudges stragglers in a thread reply and reschedules', async () => {
  const posted = [];
  const slack = fakeSlack({ '1.1': ['U1'] }, posted);
  const [result] = await runCheck([item()], slack, 200);
  assert.equal(result.status, 'active');
  assert.equal(result.nextNudgeAt, 200 + 24 * 3600);
  assert.deepEqual(posted, [
    { channel: 'C1', threadTs: '1.1', text: 'Still waiting on a :white_check_mark: from <@U2> — please react to confirm.' },
  ]);
});

test('marks done when everyone reacted, no post', async () => {
  const posted = [];
  const slack = fakeSlack({ '1.1': ['U1', 'U2'] }, posted);
  const [result] = await runCheck([item()], slack, 200);
  assert.equal(result.status, 'done');
  assert.equal(posted.length, 0);
});

test('marks expired when due and past expiry, no post', async () => {
  const posted = [];
  const slack = fakeSlack({ '1.1': [] }, posted);
  const [result] = await runCheck([item({ expiresAt: 150 })], slack, 200);
  assert.equal(result.status, 'expired');
  assert.equal(posted.length, 0);
});

test('leaves not-yet-due items untouched', async () => {
  const posted = [];
  const slack = fakeSlack({ '1.1': [] }, posted);
  const [result] = await runCheck([item({ nextNudgeAt: 500 })], slack, 200);
  assert.equal(result.status, 'active');
  assert.equal(result.nextNudgeAt, 500);
  assert.equal(posted.length, 0);
});

test('a failing item does not abort the run', async () => {
  const posted = [];
  const slack = {
    async getReactors({ ts }) {
      if (ts === '1.1') throw new Error('boom');
      return ['U1', 'U2'];
    },
    async postThreadReply(args) {
      posted.push(args);
    },
  };
  const items = [item({ ts: '1.1' }), item({ ts: '2.2' })];
  const result = await runCheck(items, slack, 200);
  assert.equal(result[0].status, 'active'); // unchanged after error
  assert.equal(result[1].status, 'done');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/slack-nudge-bot && node --test test/check.test.js`
Expected: FAIL — cannot find module `../src/check.js`.

- [ ] **Step 3: Write minimal implementation** — `src/check.js`

```javascript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/slack-nudge-bot && node --test test/check.test.js`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
cd ~/slack-nudge-bot
git add src/check.js test/check.test.js
git commit -m "feat: check orchestration and entry point"
```

---

### Task 5: Announce entry point + config + docs

**Files:**
- Create: `src/announce.js`
- Create: `config.example.json`
- Create: `README.md`
- Test: `test/announce.test.js`

**Interfaces:**
- Consumes:
  - `addHours`, `computeExpiresAt` from `src/nudgeLogic.js`.
  - `loadTracked`, `saveTracked` from `src/store.js`.
  - `createWebClient`, `makeSlack` from `src/slackClient.js`.
  - Config shape: `{ channel, emoji, expected: string[], text, initialDelayHours, repeatIntervalHours, expiresAfterHours }`. An `expected` entry containing `@` is treated as an email and resolved to a user ID.
- Produces:
  - `runAnnounce({ config, slack, now }) => Promise<object>` — resolves emails to IDs, posts the announcement, returns a tracked item `{ channel, ts, emoji, expected, repeatIntervalHours, nextNudgeAt, expiresAt, status: 'active' }`.
  - `main()` — reads `config.json` and `tracked.json` from `process.cwd()`, runs `runAnnounce`, appends the item, saves.

- [ ] **Step 1: Write the failing test** — `test/announce.test.js`

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAnnounce } from '../src/announce.js';

function fakeSlack(posted) {
  return {
    async postAnnouncement(args) {
      posted.push(args);
      return '1720000000.000200';
    },
    async lookupUserIdByEmail(email) {
      return email === 'a@b.com' ? 'U_A' : 'U_OTHER';
    },
  };
}

const config = {
  channel: 'C1',
  emoji: 'white_check_mark',
  expected: ['U1', 'a@b.com'],
  text: 'React to confirm you read this.',
  initialDelayHours: 24,
  repeatIntervalHours: 24,
  expiresAfterHours: 168,
};

test('runAnnounce posts text and builds a tracked item', async () => {
  const posted = [];
  const item = await runAnnounce({ config, slack: fakeSlack(posted), now: 1000 });
  assert.deepEqual(posted, [{ channel: 'C1', text: 'React to confirm you read this.' }]);
  assert.deepEqual(item, {
    channel: 'C1',
    ts: '1720000000.000200',
    emoji: 'white_check_mark',
    expected: ['U1', 'U_A'],
    repeatIntervalHours: 24,
    nextNudgeAt: 1000 + 24 * 3600,
    expiresAt: 1000 + 168 * 3600,
    status: 'active',
  });
});

test('runAnnounce supports never-expire (null)', async () => {
  const item = await runAnnounce({
    config: { ...config, expiresAfterHours: null },
    slack: fakeSlack([]),
    now: 1000,
  });
  assert.equal(item.expiresAt, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/slack-nudge-bot && node --test test/announce.test.js`
Expected: FAIL — cannot find module `../src/announce.js`.

- [ ] **Step 3: Write minimal implementation** — `src/announce.js`

```javascript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/slack-nudge-bot && node --test test/announce.test.js`
Expected: PASS — 2 tests.

- [ ] **Step 5: Create `config.example.json`**

```json
{
  "channel": "C0123ABCD",
  "emoji": "white_check_mark",
  "expected": ["U0AAA1111", "teammate@example.com"],
  "text": "Please react with :white_check_mark: to confirm you have read this.",
  "initialDelayHours": 24,
  "repeatIntervalHours": 24,
  "expiresAfterHours": 168
}
```

- [ ] **Step 6: Create `README.md`**

````markdown
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
````

- [ ] **Step 7: Commit**

```bash
cd ~/slack-nudge-bot
git add src/announce.js test/announce.test.js config.example.json README.md
git commit -m "feat: announce entry point, config, and docs"
```

---

## Final verification

- [ ] Run the full suite: `cd ~/slack-nudge-bot && node --test` — expect all tests across 5 files passing.
- [ ] Manual smoke (optional, needs a real workspace): set `initialDelayHours` to a small fraction (e.g. `0.05` ≈ 3 min) in `config.json`, `npm run announce`, react (or don't) in Slack, wait, `npm run check`, confirm a thread reply appears only for non-reactors.
