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
    conversations: {
      open: async (args) => {
        calls.push(['conversations.open', args]);
        return { channel: { id: 'D999' } };
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

test('openDm opens a DM and returns the DM channel id', async () => {
  const calls = [];
  const slack = makeSlack(fakeWeb(calls));
  assert.equal(await slack.openDm('U123'), 'D999');
  assert.deepEqual(calls[0], ['conversations.open', { users: 'U123' }]);
});
