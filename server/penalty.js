'use strict';
// Penalti: onlayn o'yin (7 soniyada tanlash), AI, do'st bilan, turnirlar (guruh bosqichi / play-off)
const crypto = require('crypto');
const db = require('./db');
const users = require('./users');
const hub = require('./hub');
const { rid, digits } = require('./util');

const PICK_MS = 7000, SHOW_MS = 2900, START_MS = 3000;
const matches = new Map();
const queue = new Map();
let notifier = () => { };
function setNotifier(fn) { notifier = fn; }

const NAMES = ['Jasur', 'Bekzod', 'Sardor', 'Diyorbek', 'Shahzod', 'Javohir', 'Otabek', 'Sanjar', 'Doniyor', 'Ulug\'bek', 'Azizbek', 'Asilbek',
  'Islom', 'Kamron', 'Mirjalol', 'Farrux', 'Akmal', 'Bobur', 'Nodir', 'Rustam', 'Elyor', 'Alisher', 'Sherzod', 'Dilshod', 'Abdulloh',
  'Malika', 'Madina', 'Dilnoza', 'Shahnoza', 'Nilufar', 'Sevara', 'Kamola', 'Zarina', 'Mohira', 'Gulnoza', 'Laylo', 'Sabina', 'Muslima', 'Durdona'];
const SUFFIX = ['', '', '', '_07', ' Karimov', ' Tursunov', '2004', ' 🇺🇿', '_uz', ' Aliyev', '10', ' R.', ' M.', '_99', ' Yusupov'];
const T = () => db.get().penalty;
const hash = (s) => parseInt(crypto.createHash('md5').update(String(s)).digest('hex').slice(0, 8), 16);

function aiPlayer(seed) {
  const h = hash(seed);
  const name = NAMES[h % NAMES.length] + SUFFIX[(h >>> 8) % SUFFIX.length];
  return { id: 'ai:' + seed, uid: null, ai: true, name, avatar: `/api/bot-avatar/${encodeURIComponent(seed)}.svg` };
}
function humanPlayer(uid, fallbackName) {
  const u = users.getUser(uid);
  return { id: uid, uid, ai: false, name: u ? u.name : (fallbackName || 'O\'yinchi'), avatar: users.avatarUrl(u) };
}
function playerById(t, pid) {
  if (typeof pid === 'string' && pid.startsWith('ai:')) return { ...aiPlayer(pid.slice(3)), ...(t && t.ai && t.ai[pid] ? t.ai[pid] : {}) };
  return humanPlayer(pid);
}
const pub = (p, reveal) => (p ? { id: p.id, name: p.name, avatar: p.avatar, ...(reveal && p.ai ? { ai: true } : {}) } : null);

// ================= O'yin =================
function newMatch(mode, pA, pB, extra = {}) {
  const m = { id: rid(10), mode, p: [pA, pB || null], status: pB ? 'starting' : 'waiting', kicks: [], cur: null, score: [0, 0], winner: null, createdAt: Date.now(), ...extra };
  matches.set(m.id, m);
  if (pB) start(m);
  setTimeout(() => { if (m.status === 'waiting') { m.status = 'cancelled'; broadcast(m); } }, 60 * 60e3);
  return m;
}
function start(m) {
  m.status = 'starting'; m.startAt = Date.now() + START_MS;
  broadcast(m);
  setTimeout(() => nextKick(m), START_MS);
}
function view(m, uid) {
  const me = m.p.findIndex((p) => p && p.uid === uid);
  const cur = m.cur ? {
    n: m.cur.n, k: m.cur.k, deadline: m.cur.deadline,
    kickDone: m.cur.kick !== null, saveDone: m.cur.save !== null,
    mine: me < 0 ? null : (me === m.cur.k ? m.cur.kick : m.cur.save),
  } : null;
  return {
    id: m.id, mode: m.mode, code: m.code, status: m.status, me, players: m.p.map((p) => pub(p)), kicks: m.kicks, cur, score: m.score,
    winner: m.winner, serverNow: Date.now(), startAt: m.startAt || null, showUntil: m.showUntil || null, tour: m.tour || null,
  };
}
function broadcast(m) { hub.publishEach('pen:' + m.id, 'state', (uid) => view(m, uid)); }

function nextKick(m) {
  if (m.status === 'over' || m.status === 'cancelled') return;
  m.status = 'playing';
  const n = m.kicks.length;
  m.cur = { n, k: n % 2, deadline: Date.now() + PICK_MS, kick: null, save: null };
  broadcast(m);
  m.p.forEach((pl, idx) => {
    if (pl && pl.ai) setTimeout(() => { try { pick(m, idx, aiZone(idx === m.cur.k)); } catch (e) { } }, 1000 + Math.random() * 4200);
  });
  clearTimeout(m.timer);
  m.timer = setTimeout(() => resolve(m, n), PICK_MS + 300);
}
function aiZone(kicker) {
  // Tepuvchi ko'proq burchaklarga, darvozabon ko'proq yon tomonlarga
  const w = kicker ? [16, 8, 16, 22, 16, 22] : [12, 10, 12, 24, 18, 24];
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 6; i++) { r -= w[i]; if (r < 0) return i; }
  return 4;
}
function pick(m, idx, zone) {
  if (m.status !== 'playing' || !m.cur) throw new Error('Hozir tanlash vaqti emas');
  zone = Number(zone);
  if (!(zone >= 0 && zone <= 5)) throw new Error('Noto\'g\'ri joy');
  const role = idx === m.cur.k ? 'kick' : 'save';
  if (m.cur[role] !== null) return;
  m.cur[role] = zone;
  if (m.cur.kick !== null && m.cur.save !== null) { clearTimeout(m.timer); resolve(m, m.cur.n); }
  else broadcast(m);
}
function shotResult(kick, save) {
  if (kick === null) return 'nopick';
  const post = () => ((kick === 0 || kick === 2) && Math.random() < 0.07 ? 'post' : 'goal');
  if (save === null) return kick === 1 || kick === 4 ? 'save' : post(); // darvozabon joyida qoldi
  if (save === kick) return 'save';
  if (save % 3 === kick % 3 && Math.random() < 0.35) return 'save';
  return post();
}
function resolve(m, n) {
  if (!m.cur || m.cur.n !== n || m.status !== 'playing') return;
  const { kick, save, k } = m.cur;
  const res = shotResult(kick, save);
  m.kicks.push({ k, kick, save, res });
  if (res === 'goal') m.score[k]++;
  m.cur = null; m.status = 'show'; m.showUntil = Date.now() + SHOW_MS;
  broadcast(m);
  setTimeout(() => { if (decided(m)) finish(m); else nextKick(m); }, SHOW_MS);
}
function decided(m) {
  const ka = m.kicks.filter((x) => x.k === 0).length, kb = m.kicks.filter((x) => x.k === 1).length;
  const [a, b] = m.score;
  if (m.kicks.length >= 40) return true;
  if (ka <= 5 && kb <= 5) {
    if (a + (5 - ka) < b || b + (5 - kb) < a) return true;
    return ka === 5 && kb === 5 && a !== b;
  }
  return ka === kb && a !== b;
}
function finish(m) {
  if (m.status === 'over') return;
  let [a, b] = m.score;
  if (a === b) { m.score[Math.random() < 0.5 ? 0 : 1]++; [a, b] = m.score; }
  m.winner = a > b ? 0 : 1;
  m.status = 'over'; m.cur = null;
  const data = db.get();
  if (m.mode !== 'ai') {
    m.p.forEach((pl, i) => {
      if (!pl || pl.ai) return;
      const u = data.users[pl.uid]; if (!u) return;
      if (!u.st) u.st = users.defaultStats();
      u.st.pg++; if (m.winner === i) u.st.pw++; else u.st.pl++;
      u.st.pgoals += m.score[i];
    });
  }
  T().history.unshift({ id: m.id, mode: m.mode, at: Date.now(), score: m.score, p: m.p.map((p) => p && p.name) });
  if (T().history.length > 200) T().history.length = 200;
  db.save();
  broadcast(m);
  if (m.tour) onTourMatchDone(m);
  setTimeout(() => matches.delete(m.id), 40 * 60e3);
}

// ---------- Ommaviy amallar ----------
function get(id) { const m = matches.get(id); if (!m) throw new Error('O\'yin topilmadi yoki tugagan'); return m; }
function userPick(uid, id, zone) {
  const m = get(id);
  const idx = m.p.findIndex((p) => p && p.uid === uid);
  if (idx < 0) throw new Error('Siz bu o\'yinda emassiz');
  pick(m, idx, zone);
  return view(m, uid);
}
function vsAi(uid) { return newMatch('ai', humanPlayer(uid), { ...aiPlayer('bot' + rid(4)), name: 'AI 🤖', avatar: null }); }
function friendCreate(uid, fallbackName) {
  return newMatch('friend', humanPlayer(uid, fallbackName), null, { code: uniqueCode(), ready: new Set([uid]) });
}
function uniqueCode() {
  const used = new Set([...matches.values()].filter((m) => m.status === 'waiting').map((m) => m.code));
  let c; do { c = digits(4); } while (used.has(c)); return c;
}
function friendJoin(uid, code) {
  const m = [...matches.values()].find((x) => x.status === 'waiting' && x.code === String(code).trim() && !x.tour);
  if (!m) throw new Error('Bunday kodli o\'yin topilmadi');
  m.ready = m.ready || new Set();
  m.ready.add(uid);
  if (m.p[0].uid !== uid && !m.p[1]) m.p[1] = humanPlayer(uid);
  if (m.p[1] && m.ready.has(m.p[0].uid) && m.ready.has(m.p[1].uid)) start(m);
  else broadcast(m);
  return m;
}
// Telegram guruhidan /penalti — chaqiruvchi ham havolani bosib kirgach o'yin boshlanadi
function groupInvite(fromUser) {
  const name = [fromUser.first_name, fromUser.last_name].filter(Boolean).join(' ');
  return newMatch('friend', humanPlayer(fromUser.id, name), null, { code: uniqueCode(), ready: new Set() });
}
function cancel(uid, id) {
  const m = get(id);
  const idx = m.p.findIndex((p) => p && p.uid === uid);
  if (idx < 0) return;
  if (m.status === 'waiting') { m.status = 'cancelled'; broadcast(m); return; }
  if (m.status !== 'over' && !m.tour) { clearTimeout(m.timer); m.score = idx === 0 ? [0, 3] : [3, 0]; finish(m); }
}
function activeOf(uid) {
  for (const m of matches.values()) if (['starting', 'playing', 'show'].includes(m.status) && m.p.some((p) => p && p.uid === uid)) return m;
  return null;
}
function quick(uid) {
  const a = activeOf(uid); if (a) return { id: a.id };
  queue.set(uid, { since: Date.now(), wait: 7000 + Math.random() * 4000 });
  return { queued: true };
}
function quickCancel(uid) { queue.delete(uid); }
setInterval(() => {
  const w = [...queue.entries()].sort((a, b) => a[1].since - b[1].since);
  while (w.length >= 2) {
    const [a] = w.shift(), [b] = w.shift();
    queue.delete(a); queue.delete(b);
    const m = newMatch('quick', humanPlayer(a), humanPlayer(b));
    hub.toUser(a, 'pen:matched', { id: m.id }); hub.toUser(b, 'pen:matched', { id: m.id });
  }
  for (const [uid, q] of w) {
    if (Date.now() - q.since >= q.wait) {
      queue.delete(uid);
      const m = newMatch('quick', humanPlayer(uid), aiPlayer('q' + rid(5)));
      hub.toUser(uid, 'pen:matched', { id: m.id });
    }
  }
}, 700).unref();

// ================= Turnirlar =================
const SIZES = { groups: [8, 16], playoff: [4, 8, 16, 32, 64] };
const ROUND_NAMES = { 32: '1/32 final', 16: '1/16 final', 8: '1/8 final', 4: 'Chorak final', 2: 'Yarim final', 1: 'Final' };
const tget = (id) => { const t = T().tournaments[id]; if (!t) throw new Error('Turnir topilmadi'); return t; };
const canManage = (t, uid, sup) => sup || t.creator === uid;
const hasAccess = (t, uid, sup) => !t.closed || sup || t.creator === uid || t.players.includes(uid) || t.viewers.includes(uid);

function tCreate(uid, b) {
  const title = String(b.title || '').trim().slice(0, 60);
  if (!title) throw new Error('Turnir nomini kiriting');
  const format = b.format === 'groups' ? 'groups' : 'playoff';
  const size = Number(b.size);
  if (!SIZES[format].includes(size)) throw new Error('Ishtirokchilar sonini tanlang');
  const t = {
    id: rid(8), code: digits(6), title, format, size, closed: !!b.closed, creator: uid, createdAt: Date.now(), status: 'lobby',
    players: [], requests: [], viewers: [], ai: {}, groups: null, gm: [], rounds: [], stage: null, champion: null, joinSelf: !!b.joinSelf,
  };
  if (b.joinSelf) t.players.push(uid);
  T().tournaments[t.id] = t;
  db.save();
  return t;
}
function tSummary(t, uid, sup) {
  const locked = !hasAccess(t, uid, sup);
  return {
    id: t.id, title: t.title, format: t.format, size: t.size, closed: t.closed, status: t.status, createdAt: t.createdAt,
    creator: users.briefId(t.creator), count: t.players.length, locked, mine: t.creator === uid || t.players.includes(uid),
    champion: t.champion ? pub(playerById(t, t.champion)) : null,
  };
}
function tList(uid, sup, f, q) {
  let arr = Object.values(T().tournaments);
  if (f === 'mine') arr = arr.filter((t) => t.creator === uid || t.players.includes(uid));
  else if (f === 'finished') arr = arr.filter((t) => t.status === 'finished');
  else if (f === 'open') arr = arr.filter((t) => !t.closed && t.status !== 'finished');
  else if (f === 'closed') arr = arr.filter((t) => t.closed && t.status !== 'finished');
  else arr = arr.filter((t) => t.status !== 'finished');
  q = String(q || '').toLowerCase().trim();
  if (q) arr = arr.filter((t) => t.title.toLowerCase().includes(q) || ((users.getUser(t.creator) || {}).name || '').toLowerCase().includes(q));
  return arr.sort((a, b) => b.createdAt - a.createdAt).slice(0, 80).map((t) => tSummary(t, uid, sup));
}
function standings(t, gi) {
  const rows = t.groups[gi].map((pid) => ({ pid, p: 0, w: 0, l: 0, gf: 0, ga: 0, pts: 0 }));
  const by = (pid) => rows.find((r) => r.pid === pid);
  for (const m of t.gm.filter((x) => x.g === gi && x.res)) {
    const a = by(m.a), b = by(m.b);
    a.p++; b.p++; a.gf += m.res.sa; a.ga += m.res.sb; b.gf += m.res.sb; b.ga += m.res.sa;
    if (m.res.w === m.a) { a.w++; a.pts += 3; b.l++; } else { b.w++; b.pts += 3; a.l++; }
  }
  return rows.sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf);
}
function tView(t, uid, sup) {
  if (!hasAccess(t, uid, sup)) return { ...tSummary(t, uid, sup), locked: true, myRequest: t.requests.includes(uid) };
  const manage = canManage(t, uid, sup);
  const P = (pid) => pub(playerById(t, pid), manage);
  const mm = (m) => ({ id: m.id, a: P(m.a), b: P(m.b), res: m.res, live: m.live && matches.has(m.live) && matches.get(m.live).status !== 'over' ? m.live : null, g: m.g });
  return {
    ...tSummary(t, uid, sup), manage, code: manage ? t.code : undefined,
    players: t.players.map(P), requests: manage ? t.requests.map((x) => pub(humanPlayer(x))) : undefined,
    myRequest: t.requests.includes(uid), isPlayer: t.players.includes(uid), hasAi: t.players.some((p) => String(p).startsWith('ai:')),
    groups: t.groups ? t.groups.map((g, gi) => ({ name: String.fromCharCode(65 + gi), table: standings(t, gi).map((r) => ({ ...r, player: P(r.pid) })), matches: t.gm.filter((m) => m.g === gi).map(mm) })) : null,
    rounds: t.rounds.map((r) => ({ name: ROUND_NAMES[r.length] || '', matches: r.map(mm) })),
    stage: t.stage, champion: t.champion ? P(t.champion) : null,
    myMatch: (() => { const m = findMyMatch(t, uid); return m ? mm(m) : null; })(),
  };
}
function allTm(t) { return [...t.gm, ...t.rounds.flat()]; }
function findMyMatch(t, uid) { return allTm(t).find((m) => !m.res && (m.a === uid || m.b === uid) && m.a !== null && m.b !== null); }

function notifyCreator(t, text) { hub.toUser(t.creator, 'toast', { text }); }
function tAction(uid, sup, id, a) {
  const t = tget(id);
  const manage = canManage(t, uid, sup);
  const need = () => { if (!manage) throw new Error('Faqat turnir yaratuvchisi uchun'); };
  switch (a.type) {
    case 'code': // yopiq turnirga kod bilan kirish
      if (String(a.code || '').trim() !== t.code) throw new Error('Kod noto\'g\'ri');
      if (!t.viewers.includes(uid)) t.viewers.push(uid);
      break;
    case 'request':
      if (!hasAccess(t, uid, sup) && t.closed) throw new Error('Avval turnir kodini kiriting');
      if (t.status !== 'lobby') throw new Error('Turnir boshlangan');
      if (t.players.includes(uid)) break;
      if (!t.requests.includes(uid)) t.requests.push(uid);
      notifyCreator(t, `🙋 ${(users.getUser(uid) || {}).name || 'Kimdir'} «${t.title}» turniriga qo'shilmoqchi`);
      break;
    case 'approve': {
      need(); const p = Number(a.uid);
      t.requests = t.requests.filter((x) => x !== p);
      if (t.players.length >= t.size) throw new Error('Joylar to\'lgan');
      if (!t.players.includes(p)) t.players.push(p);
      hub.toUser(p, 'toast', { text: `✅ «${t.title}» turniriga qabul qilindingiz!` });
      break;
    }
    case 'reject': need(); t.requests = t.requests.filter((x) => x !== Number(a.uid)); break;
    case 'kick': need(); if (t.status !== 'lobby') throw new Error('Turnir boshlangan'); t.players = t.players.filter((x) => String(x) !== String(a.uid)); break;
    case 'joinSelf': need(); if (!t.players.includes(uid) && t.players.length < t.size) t.players.push(uid); break;
    case 'fillAi': {
      need(); if (t.status !== 'lobby') throw new Error('Turnir boshlangan');
      while (t.players.length < t.size) { const pid = 'ai:' + t.id + rid(4); t.ai[pid] = aiPlayer(pid.slice(3)); t.players.push(pid); }
      break;
    }
    case 'start': {
      need();
      if (t.players.length < t.size) throw new Error(`Ishtirokchilar ${t.size} ta bo'lishi kerak (AI bilan to'ldirishingiz mumkin)`);
      tStart(t);
      break;
    }
    case 'result': { // texnik natija
      need();
      const m = allTm(t).find((x) => x.id === a.mid);
      if (!m || m.res) throw new Error('O\'yin topilmadi');
      const w = a.w === 'b' ? m.b : m.a;
      m.res = { sa: w === m.a ? 3 : 0, sb: w === m.b ? 3 : 0, w, tech: true };
      advance(t);
      break;
    }
    case 'delete': need(); delete T().tournaments[t.id]; db.save(); hub.publish('pt:' + t.id, 'deleted', {}); return { deleted: true };
    default: throw new Error('Noma\'lum amal');
  }
  db.save();
  tBroadcast(t);
  return tView(t, uid, sup);
}
function tBroadcast(t) { hub.publish('pt:' + t.id, 'changed', {}); }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const tm = (a, b, g) => ({ id: rid(6), a, b, res: null, live: null, ...(g !== undefined ? { g } : {}) });
function tStart(t) {
  const ps = shuffle(t.players.slice());
  t.status = 'running';
  if (t.format === 'groups') {
    t.groups = [];
    for (let i = 0; i < ps.length; i += 4) t.groups.push(ps.slice(i, i + 4));
    t.gm = [];
    t.groups.forEach((g, gi) => [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]].forEach(([x, y]) => t.gm.push(tm(g[x], g[y], gi))));
    t.stage = 'groups';
  } else {
    const r = []; for (let i = 0; i < ps.length; i += 2) r.push(tm(ps[i], ps[i + 1]));
    t.rounds = [r]; t.stage = 'playoff';
  }
  autoAi(t);
  announce(t);
}
function simScore() {
  let a = 0, b = 0;
  for (let i = 0; i < 5; i++) { if (Math.random() < 0.72) a++; if (Math.random() < 0.72) b++; }
  while (a === b) { const x = Math.random() < 0.72, y = Math.random() < 0.72; if (x) a++; if (y) b++; }
  return [a, b];
}
function autoAi(t) {
  for (const m of allTm(t)) {
    if (!m.res && m.a && m.b && String(m.a).startsWith('ai:') && String(m.b).startsWith('ai:')) {
      const [sa, sb] = simScore(); m.res = { sa, sb, w: sa > sb ? m.a : m.b };
    }
  }
  advance(t, true);
}
function advance(t, inner) {
  if (t.stage === 'groups' && t.gm.every((m) => m.res)) {
    const q = t.groups.map((g, gi) => standings(t, gi).slice(0, 2).map((r) => r.pid));
    let r = [];
    if (q.length === 2) r = [tm(q[0][0], q[1][1]), tm(q[1][0], q[0][1])];
    else r = [tm(q[0][0], q[1][1]), tm(q[2][0], q[3][1]), tm(q[1][0], q[0][1]), tm(q[3][0], q[2][1])];
    t.rounds = [r]; t.stage = 'playoff';
    autoAi(t); announce(t);
  } else if (t.stage === 'playoff') {
    const last = t.rounds[t.rounds.length - 1];
    if (last.every((m) => m.res)) {
      if (last.length === 1) { t.champion = last[0].res.w; t.status = 'finished'; t.stage = 'done'; t.finishedAt = Date.now(); }
      else {
        const nr = []; for (let i = 0; i < last.length; i += 2) nr.push(tm(last[i].res.w, last[i + 1].res.w));
        t.rounds.push(nr); autoAi(t); announce(t);
      }
    }
  }
  db.save();
  if (!inner) tBroadcast(t);
}
function announce(t) {
  // Har bir odam o'yinchiga faqat navbatdagi (birinchi o'ynalmagan) o'yini haqida xabar
  for (const pid of t.players) {
    if (typeof pid !== 'number') continue;
    const m = findMyMatch(t, pid);
    if (!m) continue;
    m.ann = m.ann || [];
    if (m.ann.includes(pid)) continue;
    m.ann.push(pid);
    const opName = playerById(t, m.a === pid ? m.b : m.a).name;
    hub.toUser(pid, 'toast', { text: `⚽ «${t.title}»: navbatdagi o'yiningiz — ${opName}` });
    notifier(pid, t, opName);
  }
  tBroadcast(t);
}
function tPlay(uid, sup, id) {
  const t = tget(id);
  const m = findMyMatch(t, uid);
  if (!m) throw new Error('Sizda hozir o\'yin yo\'q');
  let live = m.live && matches.get(m.live);
  if (!live || live.status === 'over' || live.status === 'cancelled') {
    const meIdx = m.a === uid ? 0 : 1;
    const opPid = meIdx === 0 ? m.b : m.a;
    const op = playerById(t, opPid);
    const pa = playerById(t, m.a), pb = playerById(t, m.b);
    live = newMatch('tour', pa, null, { tour: { tid: t.id, mid: m.id, title: t.title }, ready: new Set([uid]) });
    live.p = [pa, pb];
    m.live = live.id;
    if (op.ai) start(live); else { live.status = 'waiting'; hub.toUser(opPid, 'toast', { text: `⚽ ${(users.getUser(uid) || {}).name || 'Raqib'} sizni kutmoqda — «${t.title}»` }); }
  } else {
    live.ready = live.ready || new Set();
    live.ready.add(uid);
    if (live.status === 'waiting' && live.p.every((p) => p.ai || live.ready.has(p.uid))) start(live);
  }
  tBroadcast(t);
  return { id: live.id };
}
function onTourMatchDone(mt) {
  const t = T().tournaments[mt.tour.tid];
  if (!t) return;
  const m = allTm(t).find((x) => x.id === mt.tour.mid);
  if (!m || m.res) return;
  const [sa, sb] = mt.score;
  m.res = { sa, sb, w: mt.winner === 0 ? m.a : m.b };
  advance(t);
  announce(t);
}
function tGet(uid, sup, id) { return tView(tget(id), uid, sup); }

// ---------- AI avatar (SVG multfilm yuz) ----------
function avatarSvg(seed) {
  const h = hash(seed);
  const skins = ['#f1c27d', '#e0ac69', '#c68642', '#ffdbac', '#f5cfa0'];
  const hairs = ['#2c1b10', '#4a2c17', '#1a1a1a', '#6b4423', '#8d5524', '#3b2a1a'];
  const bgs = ['#5b7cfa', '#20c997', '#f06595', '#fd7e14', '#845ef7', '#22b8cf', '#fab005', '#40c057', '#e64980', '#4c6ef5'];
  const shirts = ['#1c7ed6', '#e03131', '#2f9e44', '#f08c00', '#7048e8', '#212529', '#0ca678'];
  const skin = skins[h % 5], hair = hairs[(h >>> 3) % 6], bg = bgs[(h >>> 6) % 10], shirt = shirts[(h >>> 10) % 7];
  const style = (h >>> 13) % 4, female = NAMES.indexOf(aiPlayer(seed).name.split(/[ _0-9]/)[0]) >= 25;
  const mouth = (h >>> 16) % 3;
  let hairSvg = style === 0 ? `<path d="M30 46c0-16 9-24 20-24s20 8 20 24c-4-8-10-11-20-11s-16 3-20 11z" fill="${hair}"/>`
    : style === 1 ? `<path d="M29 48c-1-18 8-27 21-27s22 9 21 27c-3-6-5-12-9-14-6 4-17 5-27 3-3 3-5 7-6 11z" fill="${hair}"/>`
      : style === 2 ? `<path d="M31 44c1-14 9-21 19-21s18 7 19 21c-5-5-12-7-19-7s-14 2-19 7z" fill="${hair}"/>`
        : `<path d="M30 44c0-15 9-22 20-22s20 7 20 22l-2-2c-2-5-8-9-18-9s-16 4-18 9z" fill="${hair}"/>`;
  if (female) hairSvg = `<path d="M27 70c-4-30 6-48 23-48s27 18 23 48c-2-12-5-22-8-28-6 4-21 5-30 0-3 6-6 16-8 28z" fill="${hair}"/>`;
  const m = mouth === 0 ? '<path d="M44 60q6 5 12 0" stroke="#7a3e2b" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
    : mouth === 1 ? '<path d="M45 60h10" stroke="#7a3e2b" stroke-width="2.4" stroke-linecap="round"/>' : '<path d="M44 59q6 7 12 0z" fill="#7a3e2b"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/>` +
    `<path d="M18 100c2-17 15-26 32-26s30 9 32 26z" fill="${shirt}"/><rect x="43" y="64" width="14" height="12" rx="5" fill="${skin}"/>` +
    `<ellipse cx="50" cy="48" rx="19" ry="22" fill="${skin}"/>${hairSvg}` +
    `<circle cx="43" cy="49" r="2.6" fill="#1b1b1b"/><circle cx="57" cy="49" r="2.6" fill="#1b1b1b"/>${m}</svg>`;
}

module.exports = {
  setNotifier, get, view, userPick, vsAi, friendCreate, friendJoin, groupInvite, cancel, activeOf, quick, quickCancel,
  tCreate, tList, tGet, tAction, tPlay, avatarSvg, SIZES,
};
