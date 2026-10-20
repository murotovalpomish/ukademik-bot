'use strict';
// Kunlik Zakovat savoli
const crypto = require('crypto');
const cfg = require('./config');
const db = require('./db');
const tg = require('./tg');
const users = require('./users');
const hub = require('./hub');
const { tzNow, tzToTs, addDays, esc, isCorrect } = require('./util');

const POINTS = [10, 8, 6, 4, 4, 4, 4, 4, 4, 4];
const WRITE_SEC = 10;
const SIGN = crypto.createHash('sha256').update('img:' + (cfg.BOT_TOKEN || 'dev')).digest('hex').slice(0, 16);
let botUsername = 'bot';
function setBotUsername(u) { botUsername = u; }

const D = () => db.get().daily;
const byId = (id) => D().questions.find((q) => q.id === Number(id));
const isOk = (r) => (r.acc === true || r.acc === false ? r.acc : !!r.ok);

function imgKey(qid) { return crypto.createHmac('sha256', SIGN).update(String(qid)).digest('hex').slice(0, 20); }
function imgUrl(q) { return q.image ? `/api/qimg/${q.id}?k=${imgKey(q.id)}` : null; }

function computePoints(q) {
  const list = Object.entries(q.resp || {}).filter(([, r]) => r.a && isOk(r)).sort((a, b) => a[1].a - b[1].a);
  for (const r of Object.values(q.resp || {})) r.p = 0;
  list.forEach(([, r], i) => { r.p = i < POINTS.length ? POINTS[i] : 2; });
}

function recomputeStats() {
  const data = db.get();
  for (const u of Object.values(data.users)) { if (!u.st) u.st = users.defaultStats(); u.st.dp = 0; u.st.dc = 0; u.st.dq = 0; }
  for (const q of D().questions) {
    if (q.status !== 'closed') continue;
    for (const [uid, r] of Object.entries(q.resp || {})) {
      const u = data.users[uid];
      if (!u || !r.a) continue;
      u.st.dq++;
      if (isOk(r)) { u.st.dc++; u.st.dp += r.p || 0; }
    }
  }
  db.save();
}

function top(q, n = 10) {
  return Object.entries(q.resp || {}).filter(([, r]) => r.a && isOk(r)).sort((a, b) => a[1].a - b[1].a).slice(0, n)
    .map(([uid, r]) => ({ user: users.briefId(Number(uid)), p: r.p, sec: Math.round((r.a - r.s) / 100) / 10 }));
}

// ---------- Foydalanuvchi uchun ----------
function userView(uid) {
  const s = D().settings;
  const qs = D().questions;
  const open = qs.filter((q) => q.status === 'open').sort((a, b) => b.openedAt - a.openedAt).map((q) => {
    const r = q.resp[uid];
    let status = 'none';
    if (r && r.a) status = 'answered';
    else if (r && r.s) status = Date.now() - r.s > (q.timeLimit + WRITE_SEC) * 1000 + 3000 ? 'expired' : 'started';
    return {
      id: q.id, num: q.num, date: q.date, timeLimit: q.timeLimit, closesAt: q.closesAt, hasImage: !!q.image,
      count: Object.values(q.resp).filter((x) => x.a).length,
      my: { status, answer: r && r.t, startedAt: r && r.s },
    };
  });
  const recent = qs.filter((q) => q.status === 'closed').sort((a, b) => b.closedAt - a.closedAt).slice(0, 15).map((q) => {
    const r = q.resp[uid];
    return {
      id: q.id, num: q.num, date: q.date, text: q.text, image: imgUrl(q), answer: q.answers[0], comment: q.comment, author: q.author,
      count: Object.values(q.resp).filter((x) => x.a).length,
      correct: Object.values(q.resp).filter((x) => x.a && isOk(x)).length,
      my: r && r.a ? { answer: r.t, ok: isOk(r), p: r.p || 0, late: !!r.late, appeal: r.ap || null } : (r && r.s ? { answer: null, ok: false, p: 0, expired: true } : null),
      top: top(q, 10),
    };
  });
  const today = tzNow().date;
  const next = qs.filter((q) => q.status === 'scheduled' && q.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  return { open, recent, next: next ? { date: next.date, time: s.openTime } : null, settings: s, serverNow: Date.now() };
}

function start(uid, qid) {
  const q = byId(qid);
  if (!q || q.status !== 'open') throw new Error('Savol hozir ochiq emas');
  let r = q.resp[uid];
  if (r && r.a) throw new Error('Siz bu savolga javob bergansiz');
  if (!r) { r = q.resp[uid] = { s: Date.now() }; db.save(); }
  const left = (q.timeLimit + WRITE_SEC) * 1000 - (Date.now() - r.s);
  if (left < -3000) throw new Error('Vaqt tugagan');
  return { id: q.id, num: q.num, text: q.text, image: imgUrl(q), timeLimit: q.timeLimit, writeSec: WRITE_SEC, startedAt: r.s, serverNow: Date.now() };
}

function answer(uid, qid, text) {
  const q = byId(qid);
  if (!q || q.status !== 'open') throw new Error('Savol yopilgan');
  const r = q.resp[uid];
  if (!r || !r.s) throw new Error('Avval savolni oching');
  if (r.a) throw new Error('Javob allaqachon yuborilgan');
  text = String(text || '').trim().slice(0, 200);
  if (!text) throw new Error('Javob bo\'sh');
  r.a = Date.now();
  r.t = text;
  r.late = r.a - r.s > (q.timeLimit + WRITE_SEC) * 1000 + 5000;
  r.ok = !r.late && isCorrect(text, q.answers);
  db.save();
  const order = Object.values(q.resp).filter((x) => x.a).length;
  hub.publish('daily', 'count', { id: q.id, count: order });
  return { order, late: r.late, sec: Math.round((r.a - r.s) / 100) / 10 };
}

function appeal(uid, qid, text) {
  const q = byId(qid);
  if (!q || q.status !== 'closed') throw new Error('Apellyatsiya faqat natijalar e\'lon qilingandan keyin');
  const r = q.resp[uid];
  if (!r || !r.a) throw new Error('Siz javob bermagansiz');
  if (isOk(r)) throw new Error('Javobingiz qabul qilingan');
  if (r.ap) throw new Error('Apellyatsiya allaqachon yuborilgan');
  if (Date.now() - q.closedAt > 3 * 86400e3) throw new Error('Apellyatsiya muddati o\'tgan (3 kun)');
  r.ap = { text: String(text || '').trim().slice(0, 600), st: 'pending', at: Date.now() };
  db.save();
  return true;
}

// ---------- Kanal xabarlari ----------
function startLink(p) { return `https://t.me/${botUsername}?start=${p}`; }

async function postOpen(q) {
  const s = D().settings;
  const text = `🧠 <b>Kunlik Zakovat savoli №${q.num}</b>\n\n` +
    `Bugungi savol tayyor! Kim birinchi bo'lib to'g'ri javob beradi? 🤔\n\n` +
    `⏱ Savolni ochgach <b>${q.timeLimit} soniya</b> o'ylash + ${WRITE_SEC} soniya yozish uchun\n` +
    `🎯 Faqat <b>1 urinish</b>\n\n` +
    `🏆 Ballar: 🥇10 · 🥈8 · 🥉6 · 4–10-o'rin: 4 · qolgan to'g'ri javoblar: 2\n\n` +
    `📣 To'g'ri javob soat <b>${esc(new Date(q.closesAt + cfg.TZ_OFFSET_MIN * 60e3).toISOString().slice(11, 16))}</b> da e'lon qilinadi`;
  try {
    const m = await tg.call('sendMessage', {
      chat_id: cfg.CHANNEL, text, parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '🧠 Javob berish', url: startLink('daily') }]] },
    });
    q.postId = m.message_id;
    db.save();
  } catch (e) { console.error('[daily] kanalga yuborilmadi:', e.message); q.postError = e.message; }
}

async function postResults(q) {
  const t = top(q, 10);
  const count = Object.values(q.resp).filter((x) => x.a).length;
  const correct = Object.values(q.resp).filter((x) => x.a && isOk(x)).length;
  const medals = ['🥇', '🥈', '🥉'];
  let text = `✅ <b>Kunlik savol №${q.num} — natijalar</b>\n\n`;
  if (q.text) text += `❓ ${esc(q.text.length > 900 ? q.text.slice(0, 900) + '…' : q.text)}\n\n`;
  text += `💡 <b>Javob:</b> ${esc(q.answers[0])}\n`;
  if (q.comment) text += `💬 ${esc(q.comment.slice(0, 600))}\n`;
  if (q.author) text += `✍️ Muallif: ${esc(q.author)}\n`;
  text += `\n👥 Javob berdi: <b>${count}</b> · To'g'ri: <b>${correct}</b>\n`;
  if (t.length) {
    text += `\n🏆 <b>Eng tezkorlar:</b>\n`;
    t.forEach((x, i) => { text += `${medals[i] || (i + 1) + '.'} ${esc(x.user ? x.user.name : '—')} — <b>+${x.p}</b> (${x.sec} s)\n`; });
  } else text += `\nBu safar hech kim to'g'ri javob bermadi 🤯`;
  try {
    await tg.call('sendMessage', {
      chat_id: cfg.CHANNEL, text, parse_mode: 'HTML',
      reply_parameters: q.postId ? { message_id: q.postId, allow_sending_without_reply: true } : undefined,
      reply_markup: { inline_keyboard: [[{ text: '🏆 Reyting', url: startLink('rating') }, { text: '⚖️ Apellyatsiya', url: startLink('daily') }]] },
    });
    if (q.postId) {
      tg.call('editMessageReplyMarkup', { chat_id: cfg.CHANNEL, message_id: q.postId, reply_markup: { inline_keyboard: [[{ text: '✅ Javob e\'lon qilindi', url: startLink('daily') }]] } }).catch(() => { });
    }
  } catch (e) { console.error('[daily] natija yuborilmadi:', e.message); }
}

async function openQuestion(q, manual = false) {
  const now = Date.now();
  const s = D().settings;
  q.status = 'open';
  q.openedAt = now;
  if (!manual) q.date = tzNow().date;
  let closesAt = tzToTs(tzNow().date, s.closeTime);
  if (closesAt < now + 60 * 60e3) closesAt = now + 12 * 3600e3;
  q.closesAt = closesAt;
  db.save();
  hub.publish('daily', 'changed', {});
  await postOpen(q);
}

async function closeQuestion(q) {
  q.status = 'closed';
  q.closedAt = Date.now();
  computePoints(q);
  recomputeStats();
  hub.publish('daily', 'changed', {});
  await postResults(q);
}

let ticking = false;
async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    const s = D().settings;
    const now = tzNow();
    const [oh, om] = s.openTime.split(':').map(Number);
    const [ch, cm] = s.closeTime.split(':').map(Number);
    const openMin = oh * 60 + om, closeMin = ch * 60 + cm;
    for (const q of D().questions) {
      if (q.status === 'open' && q.closesAt && Date.now() >= q.closesAt) await closeQuestion(q);
    }
    const inWindow = closeMin > openMin ? (now.minutes >= openMin && now.minutes < closeMin) : (now.minutes >= openMin);
    if (inWindow) {
      const due = D().questions.filter((q) => q.status === 'scheduled' && q.date === now.date).sort((a, b) => a.id - b.id)[0];
      if (due) await openQuestion(due);
    }
  } catch (e) { console.error('[daily] tick:', e); }
  ticking = false;
}

// ---------- Admin ----------
function adminList() {
  return D().questions.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id)).map((q) => ({
    id: q.id, num: q.num, date: q.date, status: q.status, text: q.text, answers: q.answers, comment: q.comment, author: q.author,
    timeLimit: q.timeLimit, image: imgUrl(q), postError: q.postError || null,
    count: Object.values(q.resp).filter((x) => x.a).length,
    appeals: Object.values(q.resp).filter((x) => x.ap && x.ap.st === 'pending').length,
  }));
}

function nextFreeDate() {
  const used = new Set(D().questions.filter((q) => q.status === 'scheduled').map((q) => q.date));
  const now = tzNow();
  const [oh, om] = D().settings.openTime.split(':').map(Number);
  let d = now.minutes < oh * 60 + om && !D().questions.some((q) => q.date === now.date) ? now.date : addDays(now.date, 1);
  while (used.has(d)) d = addDays(d, 1);
  return d;
}

async function adminSave(body) {
  const d = D();
  let q = body.id ? byId(body.id) : null;
  const answers = (Array.isArray(body.answers) ? body.answers : String(body.answers || '').split(/\n|\//))
    .map((s) => String(s).trim()).filter(Boolean);
  if (!String(body.text || '').trim() && !body.imageData && !(q && q.image)) throw new Error('Savol matnini kiriting');
  if (!answers.length) throw new Error('Kamida bitta to\'g\'ri javob kiriting');
  if (!q) {
    d.seq++;
    const maxNum = d.questions.reduce((m, x) => Math.max(m, x.num || 0), 0);
    q = { id: d.seq, num: maxNum + 1, status: 'scheduled', resp: {}, createdAt: Date.now() };
    d.questions.push(q);
  }
  q.text = String(body.text || '').trim().slice(0, 3000);
  q.answers = answers.slice(0, 20);
  q.comment = String(body.comment || '').trim().slice(0, 1500);
  q.author = String(body.author || '').trim().slice(0, 80);
  q.timeLimit = Math.max(20, Math.min(180, Number(body.timeLimit) || 60));
  if (q.status === 'scheduled') q.date = /^\d{4}-\d{2}-\d{2}$/.test(body.date || '') ? body.date : (q.date || nextFreeDate());
  if (body.removeImage) q.image = null;
  if (body.imageData) {
    const b64 = String(body.imageData).replace(/^data:image\/\w+;base64,/, '');
    const buf = Buffer.from(b64, 'base64');
    if (buf.length > 3 * 1024 * 1024) throw new Error('Rasm juda katta');
    let fileId = null;
    try { fileId = await db.storePhoto(buf); } catch (e) { console.error('[daily] rasm saqlanmadi:', e.message); }
    q.image = fileId ? { t: 'tg', id: fileId } : { t: 'b64', data: b64 };
  }
  if (q.status === 'closed') { computePoints(q); recomputeStats(); }
  db.save();
  return q.id;
}

function adminDelete(id) {
  const d = D();
  const i = d.questions.findIndex((q) => q.id === Number(id));
  if (i < 0) throw new Error('Topilmadi');
  const wasClosed = d.questions[i].status === 'closed';
  d.questions.splice(i, 1);
  if (wasClosed) recomputeStats();
  db.save();
}

function adminDetail(id) {
  const q = byId(id);
  if (!q) throw new Error('Topilmadi');
  const resp = Object.entries(q.resp).filter(([, r]) => r.a || r.s).sort((a, b) => (a[1].a || 9e15) - (b[1].a || 9e15)).map(([uid, r]) => ({
    user: users.briefId(Number(uid)) || { id: Number(uid), name: 'ID ' + uid }, answer: r.t || null, ok: !!r.ok, acc: r.acc === undefined ? null : r.acc,
    final: r.a ? isOk(r) : false, late: !!r.late, sec: r.a ? Math.round((r.a - r.s) / 100) / 10 : null, p: r.p || 0, ap: r.ap || null,
  }));
  return { ...adminList().find((x) => x.id === q.id), openedAt: q.openedAt, closesAt: q.closesAt, resp };
}

function adminOverride(id, uid, acc) {
  const q = byId(id);
  if (!q) throw new Error('Topilmadi');
  const r = q.resp[uid];
  if (!r || !r.a) throw new Error('Javob topilmadi');
  r.acc = acc === true || acc === false ? acc : null;
  if (r.ap && r.ap.st === 'pending') r.ap.st = isOk(r) ? 'accepted' : 'rejected';
  computePoints(q);
  if (q.status === 'closed') recomputeStats();
  db.save();
  if (r.ap) hub.toUser(uid, 'toast', { text: isOk(r) ? '✅ Apellyatsiyangiz qabul qilindi!' : '❌ Apellyatsiyangiz rad etildi' });
}

function adminAppeal(id, uid, accept) {
  const q = byId(id);
  const r = q && q.resp[uid];
  if (!r || !r.ap) throw new Error('Apellyatsiya topilmadi');
  if (accept) adminOverride(id, uid, true);
  else { r.ap.st = 'rejected'; db.save(); hub.toUser(uid, 'toast', { text: '❌ Apellyatsiyangiz rad etildi' }); }
}

async function adminPublishNow(id) {
  const q = byId(id);
  if (!q || q.status !== 'scheduled') throw new Error('Faqat rejalashtirilgan savolni e\'lon qilish mumkin');
  q.date = tzNow().date;
  await openQuestion(q, true);
}
async function adminCloseNow(id) {
  const q = byId(id);
  if (!q || q.status !== 'open') throw new Error('Savol ochiq emas');
  await closeQuestion(q);
}
function adminSettings(body) {
  const s = D().settings;
  if (/^\d{2}:\d{2}$/.test(body.openTime || '')) s.openTime = body.openTime;
  if (/^\d{2}:\d{2}$/.test(body.closeTime || '')) s.closeTime = body.closeTime;
  db.save();
  return s;
}

async function imageBuffer(qid, k) {
  const q = byId(qid);
  if (!q || !q.image || k !== imgKey(q.id)) return null;
  if (q.image.t === 'b64') return Buffer.from(q.image.data, 'base64');
  return tg.downloadFile(q.image.id);
}

module.exports = {
  setBotUsername, userView, start, answer, appeal, tick, adminList, adminSave, adminDelete, adminDetail,
  adminOverride, adminAppeal, adminPublishNow, adminCloseNow, adminSettings, imageBuffer, nextFreeDate, recomputeStats,
};
