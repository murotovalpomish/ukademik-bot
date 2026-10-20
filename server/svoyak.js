'use strict';
// Svoyak (Своя игра): boshlovchi, tugmalar, jonli jadval
const db = require('./db');
const users = require('./users');
const hub = require('./hub');
const { rid, digits } = require('./util');

const VALUES = [10, 20, 30, 40, 50];
const ANSWER_MS = 7000;
const G = () => db.get().svoyak.games;

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

function view(g, uid) {
  const isHost = uid === g.hostId;
  const cur = g.cur ? { ...g.cur } : null;
  if (cur) {
    const q = g.themes[cur.t] && g.themes[cur.t].q[cur.vi];
    cur.text = q || '';
  }
  return {
    id: g.id, title: g.title, status: g.status, createdAt: g.createdAt, finishedAt: g.finishedAt || null,
    host: users.briefId(g.hostId), isHost, code: isHost ? g.code : undefined,
    themes: g.themes.map((t) => ({ name: t.name, q: isHost ? t.q : undefined })),
    values: VALUES, maxPlayers: g.maxPlayers,
    players: g.players.map((p) => pBrief(g, p)),
    requests: isHost ? g.requests.map((p) => pBrief(g, p)) : undefined,
    myRequest: g.requests.includes(uid), isPlayer: g.players.includes(uid),
    cells: g.cells, used: g.used, cur, totals: totals(g), serverNow: Date.now(), answerMs: ANSWER_MS,
  };
}

function broadcast(g) {
  db.save();
  hub.publishEach('sv:' + g.id, 'state', (uid) => view(g, uid));
}

function summary(g) {
  const t = totals(g);
  const ranked = g.players.map((p) => ({ ...pBrief(g, p), total: t[p] })).sort((a, b) => b.total - a.total);
  return {
    id: g.id, title: g.title, status: g.status, createdAt: g.createdAt, host: users.briefId(g.hostId),
    players: g.players.length, themes: g.themes.length, leader: ranked[0] || null, watching: hub.count('sv:' + g.id),
  };
}

function list(filter, uid) {
  let arr = Object.values(G());
  if (filter === 'live') arr = arr.filter((g) => g.status !== 'finished');
  else if (filter === 'finished') arr = arr.filter((g) => g.status === 'finished');
  else if (filter === 'mine') arr = arr.filter((g) => g.hostId === uid || g.players.includes(uid));
  return arr.sort((a, b) => b.createdAt - a.createdAt).slice(0, 60).map(summary);
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
  const g = {
    id: rid(8), code, title, hostId: uid, createdAt: Date.now(), status: 'lobby', themes, maxPlayers,
    players: [], requests: [], guests: {}, cells: {}, used: {}, cur: null,
  };
  G()[g.id] = g;
  db.save();
  return g;
}

function get(id) { const g = G()[id]; if (!g) throw new Error('O\'yin topilmadi'); return g; }

function joinByCode(uid, code) {
  const g = Object.values(G()).find((x) => x.code === String(code).trim() && x.status !== 'finished');
  if (!g) throw new Error('Bunday kodli faol turnir topilmadi');
  if (g.hostId === uid) return g;
  if (g.players.includes(uid)) return g;
  if (!g.requests.includes(uid)) g.requests.push(uid);
  broadcast(g);
  const u = users.getUser(uid);
  hub.toUser(g.hostId, 'toast', { text: `🙋 ${u ? u.name : 'Kimdir'} «${g.title}» turniriga qo'shilmoqchi` });
  return g;
}

function action(uid, id, a) {
  const g = get(id);
  const isHost = uid === g.hostId;
  const need = () => { if (!isHost) throw new Error('Faqat boshlovchi uchun'); };
  const pid = (x) => (typeof x === 'string' && x.startsWith('g:') ? x : Number(x));
  switch (a.type) {
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
      g.guests = g.guests || {}; g.guests[gid] = { name };
      g.players.push(gid);
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
    case 'start': need(); if (!g.players.length) throw new Error('Kamida bitta ishtirokchini qabul qiling'); g.status = 'live'; break;
    case 'open': {
      need(); if (g.status !== 'live') throw new Error('O\'yin boshlanmagan');
      const t = Number(a.t), vi = Number(a.vi);
      if (!g.themes[t] || !(vi >= 0 && vi < 5)) throw new Error('Noto\'g\'ri katak');
      g.cur = { t, vi, phase: 'reading', answering: null, deadline: null, tried: [], openedAt: Date.now() };
      break;
    }
    case 'unlock': need(); if (!g.cur || g.cur.phase === 'closed') throw new Error('Savol tanlanmagan'); g.cur.phase = 'open'; g.cur.answering = null; break;
    case 'assign': { // boshlovchi qo'lda javob beruvchini tanlaydi (oflayn o'yin uchun)
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
    case 'reopen': need(); delete g.used[`${Number(a.t)}|${Number(a.vi)}`]; break;
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
    default: throw new Error('Noma\'lum amal');
  }
  broadcast(g);
  return view(g, uid);
}

function remove(uid, id, isAdmin) {
  const g = get(id);
  if (g.hostId !== uid && !isAdmin) throw new Error('Ruxsat yo\'q');
  delete G()[id];
  db.save();
  hub.publish('sv:' + id, 'deleted', {});
}

module.exports = { list, create, get, view, joinByCode, action, remove };
