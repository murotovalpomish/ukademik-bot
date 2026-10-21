'use strict';
// Shaxsiy o'yin (Svoyak): boshlovchi, tugmalar, jonli jadval, chat, ochiq/yopiq turnirlar
const fs = require('fs');
const path = require('path');
const cfg = require('./config');
const db = require('./db');
const users = require('./users');
const hub = require('./hub');
const { rid, digits } = require('./util');

const VALUES = [10, 20, 30, 40, 50];
const ANSWER_MS = 7000;
const VOICE_DIR = path.join(cfg.DATA_DIR, 'voice');
const G = () => db.get().svoyak.games;

function norm(g) {
  if (!g.viewers) g.viewers = [];
  if (!g.access) g.access = [];
  if (!g.chat) g.chat = [];
  if (!g.guests) g.guests = {};
  return g;
}
function pBrief(g, pid) {
  if (typeof pid === 'string' && pid.startsWith('g:')) {
    const guest = (g.guests || {})[pid];
    return { id: pid, name: guest ? guest.name : 'Mehmon', avatar: null, guest: true };
  }
  return users.briefId(pid) || { id: pid, name: 'ID ' + pid, avatar: null };
}
function totals(g) {
  const t = {};
  for (const p of g.players) t[p] = 0;
  for (const [k, v] of Object.entries(g.cells)) { const pid = k.split('|')[0]; const key = g.players.find((x) => String(x) === pid); if (key !== undefined) t[key] += v; }
  return t;
}
const isHostOf = (g, uid, sup) => sup || uid === g.hostId;
const hasAccess = (g, uid, sup) => !g.closed || isHostOf(g, uid, sup) || g.players.includes(uid) || g.viewers.includes(uid);

function view(g, uid, sup) {
  norm(g);
  if (!hasAccess(g, uid, sup)) return { ...summary(g, uid, sup), locked: true, myAccess: g.access.includes(uid), myRequest: g.requests.includes(uid) };
  const isHost = isHostOf(g, uid, sup);
  const cur = g.cur ? { ...g.cur } : null;
  if (cur) cur.text = (g.themes[cur.t] && g.themes[cur.t].q[cur.vi]) || '';
  return {
    id: g.id, title: g.title, status: g.status, createdAt: g.createdAt, finishedAt: g.finishedAt || null, closed: !!g.closed,
    host: users.briefId(g.hostId), isHost, isOwner: uid === g.hostId, code: isHost ? g.code : undefined, voiceLink: g.voiceLink || '',
    themes: g.themes.map((t) => ({ name: t.name, q: isHost ? t.q : undefined })),
    values: VALUES, maxPlayers: g.maxPlayers,
    players: g.players.map((p) => pBrief(g, p)),
    requests: isHost ? g.requests.map((p) => pBrief(g, p)) : undefined,
    access: isHost ? g.access.map((p) => pBrief(g, p)) : undefined,
    myRequest: g.requests.includes(uid), isPlayer: g.players.includes(uid), canChat: isHost || g.players.includes(uid),
    cells: g.cells, used: g.used, cur, totals: totals(g), serverNow: Date.now(), answerMs: ANSWER_MS,
    pinned: g.pinned && g.chat.find((m) => m.id === g.pinned) ? withUser(g.chat.find((m) => m.id === g.pinned)) : null,
  };
}
function broadcast(g, supIds) {
  db.save();
  hub.publishEach('sv:' + g.id, 'state', (uid) => view(g, uid, supSet.has(uid)));
}
// Bosh adminlar ro'yxati (sinxron tekshirish uchun keshlanadi)
const supSet = new Set();
function markSuper(uid, yes) { if (yes) supSet.add(uid); else supSet.delete(uid); }

function summary(g, uid, sup) {
  norm(g);
  const t = totals(g);
  const ranked = g.players.map((p) => ({ ...pBrief(g, p), total: t[p] })).sort((a, b) => b.total - a.total);
  return {
    id: g.id, title: g.title, status: g.status, createdAt: g.createdAt, host: users.briefId(g.hostId), closed: !!g.closed,
    locked: !hasAccess(g, uid, sup), mine: g.hostId === uid || g.players.includes(uid),
    players: g.players.length, themes: g.themes.length, leader: ranked[0] || null, watching: hub.count('sv:' + g.id),
  };
}
function list(filter, uid, sup, q) {
  let arr = Object.values(G()).map(norm);
  if (filter === 'live') arr = arr.filter((g) => g.status !== 'finished');
  else if (filter === 'finished') arr = arr.filter((g) => g.status === 'finished');
  else if (filter === 'mine') arr = arr.filter((g) => g.hostId === uid || g.players.includes(uid));
  else if (filter === 'closed') arr = arr.filter((g) => g.closed);
  q = String(q || '').toLowerCase().trim();
  if (q) arr = arr.filter((g) => g.title.toLowerCase().includes(q) || ((users.getUser(g.hostId) || {}).name || '').toLowerCase().includes(q) || g.code === q);
  return arr.sort((a, b) => b.createdAt - a.createdAt).slice(0, 100).map((g) => summary(g, uid, sup));
}

function create(uid, body) {
  const title = String(body.title || '').trim().slice(0, 60);
  if (!title) throw new Error('Turnir nomini kiriting');
  const themeCount = Math.max(1, Math.min(12, Number(body.themeCount) || 5));
  const maxPlayers = Math.max(2, Math.min(16, Number(body.maxPlayers) || 6));
  const active = new Set(Object.values(G()).filter((g) => g.status !== 'finished').map((g) => g.code));
  let code; do { code = digits(6); } while (active.has(code));
  const themes = [];
  for (let i = 0; i < themeCount; i++) {
    const src = (body.themes || [])[i] || {};
    themes.push({ name: String(src.name || `${i + 1}-mavzu`).slice(0, 50), q: [0, 1, 2, 3, 4].map((j) => String((src.q || [])[j] || '').slice(0, 600)) });
  }
  const g = norm({
    id: rid(8), code, title, hostId: uid, createdAt: Date.now(), status: 'lobby', themes, maxPlayers, closed: !!body.closed,
    voiceLink: cleanLink(body.voiceLink), players: [], requests: [], guests: {}, cells: {}, used: {}, cur: null,
  });
  G()[g.id] = g;
  db.save();
  return g;
}
function cleanLink(u) {
  u = String(u || '').trim();
  if (!u) return '';
  if (/^@\w+/.test(u)) u = 'https://t.me/' + u.slice(1);
  if (!/^https:\/\/(t\.me|telegram\.me)\//.test(u)) throw new Error('Ovozli chat havolasi t.me/... ko\'rinishida bo\'lsin');
  return u.slice(0, 200);
}
function get(id) { const g = G()[id]; if (!g) throw new Error('O\'yin topilmadi'); return norm(g); }

function joinByCode(uid, code) {
  const g = Object.values(G()).map(norm).find((x) => x.code === String(code).trim() && x.status !== 'finished');
  if (!g) throw new Error('Bunday kodli faol turnir topilmadi');
  if (g.hostId === uid || g.players.includes(uid)) return g;
  if (!g.viewers.includes(uid)) g.viewers.push(uid);
  g.access = g.access.filter((x) => x !== uid);
  if (!g.requests.includes(uid)) g.requests.push(uid);
  broadcast(g);
  const u = users.getUser(uid);
  hub.toUser(g.hostId, 'toast', { text: `🙋 ${u ? u.name : 'Kimdir'} «${g.title}» turniriga qo'shilmoqchi` });
  return g;
}

const withUser = (m) => ({ ...m, u: users.briefId(m.uid) });
function chatPush(g, msg) {
  g.chat.push(msg);
  if (g.chat.length > 300) {
    const old = g.chat.shift();
    if (old.t === 'voice') fs.unlink(path.join(VOICE_DIR, old.vid), () => { });
  }
  hub.publish('sv:' + g.id, 'chat', { op: 'add', msg: withUser(msg) });
  db.save();
}

function action(uid, id, a, sup) {
  const g = get(id);
  const isHost = isHostOf(g, uid, sup);
  const need = () => { if (!isHost) throw new Error('Faqat boshlovchi uchun'); };
  const pid = (x) => (typeof x === 'string' && x.startsWith('g:') ? x : Number(x));
  const u = users.getUser(uid);
  switch (a.type) {
    // ---- Kirish / qatnashish ----
    case 'access': // yopiq turnirni ko'rish uchun ruxsat so'rash
      if (hasAccess(g, uid, sup)) break;
      if (!g.access.includes(uid)) g.access.push(uid);
      hub.toUser(g.hostId, 'toast', { text: `🔐 ${u ? u.name : 'Kimdir'} «${g.title}» turnirini ko'rishga ruxsat so'radi` });
      break;
    case 'access-ok': need(); { const p = Number(a.uid); g.access = g.access.filter((x) => x !== p); if (!g.viewers.includes(p)) g.viewers.push(p); hub.toUser(p, 'toast', { text: `✅ «${g.title}» turnirini ko'rishga ruxsat berildi` }); } break;
    case 'access-no': need(); g.access = g.access.filter((x) => x !== Number(a.uid)); break;
    case 'request':
      if (!hasAccess(g, uid, sup)) throw new Error('Avval kirish uchun ruxsat oling');
      if (g.status === 'finished') throw new Error('O\'yin tugagan');
      if (g.players.includes(uid) || uid === g.hostId) break;
      if (!g.requests.includes(uid)) g.requests.push(uid);
      hub.toUser(g.hostId, 'toast', { text: `🙋 ${u ? u.name : 'Kimdir'} «${g.title}» turniriga qo'shilmoqchi` });
      break;
    case 'approve': {
      need(); const p = pid(a.uid);
      g.requests = g.requests.filter((x) => x !== p);
      if (!g.players.includes(p)) {
        if (g.players.length >= g.maxPlayers) throw new Error(`Ishtirokchilar soni to'lgan (${g.maxPlayers})`);
        g.players.push(p);
        hub.toUser(p, 'toast', { text: `✅ Siz «${g.title}» turniriga qabul qilindingiz!` });
      }
      break;
    }
    case 'reject': need(); g.requests = g.requests.filter((x) => x !== pid(a.uid)); break;
    case 'kick': need(); g.players = g.players.filter((x) => x !== pid(a.uid)); break;
    case 'guest': {
      need();
      const name = String(a.name || '').trim().slice(0, 30);
      if (!name) throw new Error('Ismni kiriting');
      if (g.players.length >= g.maxPlayers) throw new Error('Ishtirokchilar soni to\'lgan');
      const gid = 'g:' + rid(5);
      g.guests[gid] = { name };
      g.players.push(gid);
      break;
    }
    case 'settings': {
      need();
      if (a.closed !== undefined) g.closed = !!a.closed;
      if (a.voiceLink !== undefined) g.voiceLink = cleanLink(a.voiceLink);
      if (a.title) g.title = String(a.title).trim().slice(0, 60) || g.title;
      if (a.maxPlayers) g.maxPlayers = Math.max(g.players.length, Math.min(16, Number(a.maxPlayers) || g.maxPlayers));
      break;
    }
    case 'themes': {
      need();
      (a.themes || []).forEach((t, i) => {
        if (!g.themes[i]) return;
        if (t.name !== undefined) g.themes[i].name = String(t.name).slice(0, 50) || `${i + 1}-mavzu`;
        if (Array.isArray(t.q)) g.themes[i].q = [0, 1, 2, 3, 4].map((j) => String(t.q[j] || '').slice(0, 600));
      });
      break;
    }
    // ---- O'yin ----
    case 'start': need(); if (!g.players.length) throw new Error('Kamida bitta ishtirokchini qabul qiling'); g.status = 'live'; break;
    case 'open': {
      need(); if (g.status !== 'live') throw new Error('O\'yin boshlanmagan');
      const t = Number(a.t), vi = Number(a.vi);
      if (!g.themes[t] || !(vi >= 0 && vi < 5)) throw new Error('Noto\'g\'ri katak');
      delete g.used[`${t}|${vi}`];
      g.cur = { t, vi, phase: a.unlock ? 'open' : 'reading', answering: null, deadline: null, tried: [], openedAt: Date.now() };
      break;
    }
    case 'unlock': need(); if (!g.cur || g.cur.phase === 'closed') throw new Error('Savol tanlanmagan'); g.cur.phase = 'open'; g.cur.answering = null; break;
    case 'assign': {
      need(); const p = pid(a.uid);
      if (!g.cur || g.cur.phase === 'closed') throw new Error('Savol ochiq emas');
      if (!g.players.includes(p)) throw new Error('Ishtirokchi emas');
      g.cur.phase = 'answering'; g.cur.answering = p; g.cur.deadline = Date.now() + ANSWER_MS;
      break;
    }
    case 'buzz': {
      if (!g.cur || g.cur.phase !== 'open') throw new Error('Tugma hozir yopiq');
      if (!g.players.includes(uid)) throw new Error('Siz ishtirokchi emassiz');
      if (g.cur.tried.includes(uid)) throw new Error('Siz bu savolga javob berib bo\'ldingiz');
      g.cur.phase = 'answering'; g.cur.answering = uid; g.cur.deadline = Date.now() + ANSWER_MS; g.cur.buzzAt = Date.now();
      break;
    }
    case 'judge': {
      need();
      if (!g.cur || g.cur.phase !== 'answering') throw new Error('Hozir hech kim javob bermayapti');
      const p = g.cur.answering, v = VALUES[g.cur.vi];
      const key = `${p}|${g.cur.t}|${g.cur.vi}`;
      if (a.ok) {
        g.cells[key] = v;
        g.used[`${g.cur.t}|${g.cur.vi}`] = true;
        g.cur.phase = 'closed'; g.cur.answering = null; g.cur.result = { uid: p, ok: true };
      } else {
        g.cells[key] = -v;
        g.cur.tried.push(p);
        g.cur.answering = null; g.cur.result = { uid: p, ok: false };
        if (g.cur.tried.length >= g.players.length) { g.cur.phase = 'closed'; g.used[`${g.cur.t}|${g.cur.vi}`] = true; }
        else g.cur.phase = 'open';
      }
      break;
    }
    case 'close': need(); if (g.cur) { g.used[`${g.cur.t}|${g.cur.vi}`] = true; g.cur.phase = 'closed'; g.cur.answering = null; } break;
    case 'cancel': need(); g.cur = null; break;
    case 'edit': {
      need();
      const p = pid(a.uid), t = Number(a.t), vi = Number(a.vi);
      if (!g.players.includes(p) || !g.themes[t] || !(vi >= 0 && vi < 5)) throw new Error('Noto\'g\'ri katak');
      const key = `${p}|${t}|${vi}`;
      if (a.val === null || a.val === '' || a.val === undefined || Number(a.val) === 0) delete g.cells[key];
      else g.cells[key] = Math.max(-999, Math.min(999, Math.round(Number(a.val)) || 0));
      break;
    }
    case 'finish': need(); g.status = 'finished'; g.finishedAt = Date.now(); g.cur = null; break;
    case 'resume': need(); g.status = 'live'; g.finishedAt = null; break;
    // ---- Chat ----
    case 'chat': {
      if (!(isHost || g.players.includes(uid))) throw new Error('Yozish faqat ishtirokchilar va boshlovchi uchun');
      const text = String(a.text || '').trim().slice(0, 1000);
      if (!text) throw new Error('Xabar bo\'sh');
      chatPush(g, { id: rid(8), uid, t: 'text', text, at: Date.now() });
      return { ok: true };
    }
    case 'chat-edit': {
      const m = g.chat.find((x) => x.id === a.mid);
      if (!m || m.uid !== uid || m.t !== 'text') throw new Error('Faqat o\'z xabaringizni tahrirlay olasiz');
      m.text = String(a.text || '').trim().slice(0, 1000) || m.text; m.ed = Date.now();
      hub.publish('sv:' + g.id, 'chat', { op: 'edit', msg: withUser(m) });
      db.save();
      return { ok: true };
    }
    case 'chat-del': {
      const i = g.chat.findIndex((x) => x.id === a.mid);
      if (i < 0) throw new Error('Xabar topilmadi');
      if (g.chat[i].uid !== uid && !isHost) throw new Error('Ruxsat yo\'q');
      const [m] = g.chat.splice(i, 1);
      if (m.t === 'voice') fs.unlink(path.join(VOICE_DIR, m.vid), () => { });
      if (g.pinned === m.id) { g.pinned = null; broadcast(g); }
      hub.publish('sv:' + g.id, 'chat', { op: 'del', msg: { id: m.id } });
      db.save();
      return { ok: true };
    }
    case 'chat-pin': {
      need();
      g.pinned = g.pinned === a.mid ? null : (g.chat.some((x) => x.id === a.mid) ? a.mid : null);
      break;
    }
    default: throw new Error('Noma\'lum amal');
  }
  broadcast(g);
  return view(g, uid, sup);
}

function chatList(uid, id, sup) {
  const g = get(id);
  if (!hasAccess(g, uid, sup)) throw new Error('Ruxsat yo\'q');
  return g.chat.slice(-150).map(withUser);
}
function saveVoice(uid, id, sup, b) {
  const g = get(id);
  if (!(isHostOf(g, uid, sup) || g.players.includes(uid))) throw new Error('Ovozli xabar faqat ishtirokchilar va boshlovchi uchun');
  const data = String(b.data || '');
  const m = data.match(/^data:(audio\/[\w.+-]+)(;[^,]*)?;base64,(.*)$/);
  if (!m) throw new Error('Audio formati noto\'g\'ri');
  const buf = Buffer.from(m[3], 'base64');
  if (buf.length > 2.5 * 1024 * 1024) throw new Error('Ovozli xabar juda uzun (maks. 2 daqiqa)');
  fs.mkdirSync(VOICE_DIR, { recursive: true });
  const vid = rid(12);
  fs.writeFileSync(path.join(VOICE_DIR, vid), buf);
  const msg = { id: rid(8), uid, t: 'voice', vid, mime: m[1], dur: Math.max(1, Math.min(180, Math.round(Number(b.dur) || 1))), at: Date.now(), host: uid === g.hostId };
  chatPush(g, msg);
  return { ok: true };
}
function voiceFile(vid, gid) {
  const g = G()[gid];
  const msg = g && (g.chat || []).find((x) => x.vid === vid);
  if (!msg) return null;
  const f = path.join(VOICE_DIR, vid.replace(/[^\w]/g, ''));
  if (!fs.existsSync(f)) return null;
  return { buf: fs.readFileSync(f), mime: msg.mime };
}

function remove(uid, id, sup) {
  const g = get(id);
  if (g.hostId !== uid && !sup) throw new Error('Ruxsat yo\'q');
  for (const m of g.chat || []) if (m.t === 'voice') fs.unlink(path.join(VOICE_DIR, m.vid), () => { });
  delete G()[id];
  db.save();
  hub.publish('sv:' + id, 'deleted', {});
}

module.exports = { list, create, get, view, joinByCode, action, remove, chatList, saveVoice, voiceFile, markSuper };
