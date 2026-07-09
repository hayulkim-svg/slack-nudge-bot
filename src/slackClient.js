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
