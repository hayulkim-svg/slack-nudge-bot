import { WebClient } from '@slack/web-api';

// Schedules (or immediately posts) the card-withdrawal notice as bot DMs to a
// roster of employees given by Korean name (or raw Slack user id). Reports
// matching results and outcomes via DM to REPORT_USER instead of logs
// (public repo — no PII in logs).
const token = process.env.SLACK_BOT_TOKEN;
if (!token) throw new Error('SLACK_BOT_TOKEN is not set');
const names = (process.env.ROSTER || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!names.length) throw new Error('ROSTER is empty');
const postAt1 = process.env.POST_AT_1 || ''; // 'now' | epoch seconds | '' (skip)
const postAt2 = process.env.POST_AT_2 || ''; // epoch seconds | '' (skip)
const dryRun = process.env.DRY_RUN === '1';
const REPORT_USER = 'U067F2L82RJ';

const TEXT_NIGHT = ':bell: *대금 인출 확인 안내*\n내일은 법인카드 대금 출금일입니다:money_with_wings: 법인카드 출금 계좌에 잔액이 충분히 들어있는지 꼭 확인해 주세요. 잔액이 부족하면 연체가 발생할 수 있습니다.\n연체가 발생 할 시 회사 신용도에 문제가 생길 수 있으니, 연체가 발생하지 않도록 꼭 확인해주시기를 바랍니다:pray:\n\n확인을 완료하셨다면 *이 DM 메시지에 :done: 이모지*를 달아 응답해 주세요!';
const TEXT_MORNING = ':bell: *대금 인출 확인 안내*\n오늘은 법인카드 대금 출금일입니다:money_with_wings: 법인카드 출금 계좌에 잔액이 충분히 들어있는지 꼭 확인해 주세요. 잔액이 부족하면 연체가 발생할 수 있습니다.\n연체가 발생 할 시 회사 신용도에 문제가 생길 수 있으니, 연체가 발생하지 않도록 꼭 확인해주시기를 바랍니다:pray:\n\n확인을 완료하셨다면 *이 DM 메시지에 :done: 이모지*를 달아 응답해 주세요!';

const web = new WebClient(token);

const byKorean = new Map();
let cursor;
do {
  const res = await web.users.list({ limit: 200, cursor });
  for (const u of res.members) {
    if (u.deleted || u.is_bot || u.id === 'USLACKBOT') continue;
    const fields = [u.real_name, u.profile && u.profile.real_name, u.profile && u.profile.display_name]
      .filter(Boolean).join(' ');
    const koreans = fields.match(/[가-힣]{2,}/g) || [];
    for (const k of new Set(koreans)) {
      if (!byKorean.has(k)) byKorean.set(k, new Set());
      byKorean.get(k).add(u.id);
    }
  }
  cursor = res.response_metadata && res.response_metadata.next_cursor;
} while (cursor);

const matched = [];
const unmatched = [];
const ambiguous = [];
for (const name of names) {
  if (/^U[A-Z0-9]{6,}$/.test(name)) { matched.push({ name, id: name }); continue; }
  const set = byKorean.get(name);
  if (!set || set.size === 0) unmatched.push(name);
  else if (set.size > 1) ambiguous.push(name);
  else matched.push({ name, id: [...set][0] });
}
console.log('matched=' + matched.length + ' unmatched=' + unmatched.length + ' ambiguous=' + ambiguous.length);

async function report(text) {
  const dm = await web.conversations.open({ users: REPORT_USER });
  await web.chat.postMessage({ channel: dm.channel.id, text });
}

if (dryRun) {
  await report(
    ':clipboard: *전사 발송 매칭 결과 (드라이런)*\n대상 ' + names.length + '명 중 매칭 ' + matched.length + '명\n미매칭(' + unmatched.length + '): ' + (unmatched.join(', ') || '없음') + '\n동명이인(' + ambiguous.length + '): ' + (ambiguous.join(', ') || '없음'),
  );
  console.log('dry run — nothing scheduled');
  process.exit(0);
}

let sent1 = 0, sched2 = 0;
const failures = [];
for (const m of matched) {
  try {
    const dm = await web.conversations.open({ users: m.id });
    const ch = dm.channel.id;
    if (postAt1 === 'now') {
      await web.chat.postMessage({ channel: ch, text: TEXT_NIGHT });
      sent1++;
    } else if (postAt1) {
      await web.chat.scheduleMessage({ channel: ch, post_at: Number(postAt1), text: TEXT_NIGHT });
      sent1++;
    }
    if (postAt2) {
      await web.chat.scheduleMessage({ channel: ch, post_at: Number(postAt2), text: TEXT_MORNING });
      sched2++;
    }
  } catch (err) {
    failures.push(m.name + ': ' + err.message);
  }
}
console.log('night=' + sent1 + ' morning=' + sched2 + ' failures=' + failures.length);
await report(
  ':white_check_mark: *전사 대금 인출 안내 발송 처리 완료*\n밤 안내: ' + sent1 + '명 / 아침(08:00) 예약: ' + sched2 + '명\n미매칭: ' + (unmatched.join(', ') || '없음') + '\n동명이인 제외: ' + (ambiguous.join(', ') || '없음') + '\n실패: ' + (failures.join(' | ') || '없음'),
);
