'use strict';
// To'siq — WallRush/Quoridor uslubidagi onlayn o'yin + AI
const E = require('../public/js/qengine');
const db = require('./db');
const users = require('./users');
const hub = require('./hub');
const { rid, digits } = require('./util');

const CLOCK_MS = 5 * 60e3;
const games = new Map();
const queue = new Map(); // uid -> since
const AI_NAMES = ['Botir', 'Zukko', 'Aqlvoy', 'Sardor', 'Donish', 'Ilmbek', 'Farosat', 'Hushyor'];

// ================= AI =================
function wallsAgainst(st, target) {
  const block = E.buildBlock(st.walls);
  const pr = E.dist(block, st.pawns[target].r, st.pawns[target].c, E.goalRow(target), true);
  const m = new Map();
  const add = (w) => { if (w.r >= 0 && w.r < 8 && w.c >= 0 && w.c < 8) m.set(w.o + w.r + ',' + w.c, w); };
  const path = pr.path.slice(0, 7);
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i], b = path[i + 1];
    if (a.c === b.c) { const r = Math.min(a.r, b.r); add({ o: 'h', r, c: a.c }); add({ o: 'h', r, c: a.c - 1 }); }
    else { const c = Math.min(a.c, b.c); add({ o: 'v', r: a.r, c }); add({ o: 'v', r: a.r - 1, c }); }
  }
  return [...m.values()];
}

function evalPos(st, me) {
  if (st.winner !== null) return st.winner === me ? 100 : -100;
  const [d0, d1] = E.distances(st);
  const dMe = me === 0 ? d0 : d1, dOp = me === 0 ? d1 : d0;
  const tempo = st.turn === me ? 0.5 : -0.5;
  return (dOp - dMe) + tempo + 0.22 * (st.wallsLeft[me] - st.wallsLeft[1 - me]);
}

function movesFor(st, p, wallLimit) {
  const out = E.pawnMoves(st, p).map((m) => ({ t: 'm', r: m.r, c: m.c }));
  if (st.wallsLeft[p] > 0) {
    let ws = wallsAgainst(st, 1 - p).filter((w) => E.canPlaceWall(st, p, w)).map((w) => ({ t: 'w', ...w }));
    if (wallLimit && ws.length > wallLimit) {
      ws = ws.map((w) => ({ w, v: evalPos(E.apply(st, p, w), p) })).sort((a, b) => b.v - a.v).slice(0, wallLimit).map((x) => x.w);
    }
    out.push(...ws);
  }
  return out;
}

// 2 qatlamli qidiruv: har bir yurish uchun raqibning eng yaxshi javobi hisobga olinadi
function scoreMoves(st, me) {
  const mine = movesFor(st, me, 0);
  const scored = [];
  for (const mv of mine) {
    const s1 = E.apply(st, me, mv);
    if (s1.winner === me) { scored.push({ mv, v: 100 }); continue; }
    let worst = Infinity;
    for (const r of movesFor(s1, 1 - me, 10)) {
      const v = evalPos(E.apply(s1, 1 - me, r), me);
      if (v < worst) worst = v;
      if (worst <= -100) break;
    }
    scored.push({ mv, v: worst, imm: evalPos(s1, me) });
  }
  scored.sort((a, b) => b.v - a.v || b.imm - a.imm);
  return scored;
}

function isBackward(st, me, mv) {
  if (mv.t !== 'm') return false;
  const cur = st.pawns[me];
  return me === 0 ? mv.r > cur.r : mv.r < cur.r;
}

// Yutqazishni "maqsad qilgan" AI ham ochiqdan-ochiq yutqazmaydi: u shunchaki kamroq
// oldindan ko'radi — ba'zan devor qo'yish imkonini ko'rmaydi, eng yaxshi emas,
// lekin mantiqli yurishni tanlaydi. G'alaba imkoni bo'lsa doim foydalanadi.
const AI_WEAK = { best: 0.38, wallBlind: 0.3, w: [0.5, 0.3, 0.2] };
function aiChoose(game) {
  const st = game.st, me = game.ai.idx, ai = game.ai;
  const scored = scoreMoves(st, me);
  if (!scored.length) return null;
  if (scored[0].v >= 100) return scored[0].mv;
  if (ai.intendWin) {
    const r = Math.random();
    if (r < (ai.level >= 3 ? 0.92 : 0.8) || scored.length < 2) return scored[0].mv;
    return scored[1].mv;
  }
  const cfg = ai.cfg || AI_WEAK;
  if (Math.random() < cfg.best) return scored[0].mv;
  let pool = scored;
  if (Math.random() < cfg.wallBlind) {
    const pawnOnly = scored.filter((x) => x.mv.t === 'm');
    if (pawnOnly.length) pool = pawnOnly;
  }
  const fwd = pool.filter((x) => !isBackward(st, me, x.mv));
  if (fwd.length) pool = fwd;
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < cfg.w.length && i < pool.length; i++) { acc += cfg.w[i]; if (r < acc) return pool[i].mv; }
  return pool[0].mv;
}

function thinkDelay(game, mv) {
  const forced = E.pawnMoves(game.st, game.ai.idx).length === 1 && game.st.wallsLeft[game.ai.idx] === 0;
  let ms = mv.t === 'w' ? 1300 + Math.random() * 2600 : 550 + Math.random() * 1400;
  if (forced) ms = 350 + Math.random() * 400;
  else if (Math.random() < 0.12) ms += 1500 + Math.random() * 2800; // ba'zan uzoq o'ylaydi
  else if (Math.random() < 0.15) ms = 300 + Math.random() * 350;   // ba'zan juda tez
  const left = game.clocks[game.ai.idx];
  if (left < 40e3) ms = Math.min(ms, 900);
  return Math.round(ms);
}

// ---------- AI hissiyotlari ----------
const R = {
  happy: ['😂', '😏', '😎'],
  angry: ['😡', '😤'],
  worried: ['😰', '😬'],
  confident: ['😎'],
  lost: ['🤝', '😭', '🫡'],
  won: ['🏆', '😎', '🤝'],
  replyLaugh: ['😤', '😏'],
  replyGood: ['🤝', '🫡'],
};
function aiReact(game, kind, force) {
  const now = Date.now();
  if (!force && (now - (game.ai.lastReact || 0) < 15000 || Math.random() > 0.35)) return;
  const arr = R[kind];
  const e = arr[Math.floor(Math.random() * arr.length)];
  game.ai.lastReact = now;
  setTimeout(() => pushReaction(game, game.ai.idx, e, ''), 500 + Math.random() * 1200);
}
function pushReaction(game, idx, e, text) {
  const r = { idx, e, text: text || '', at: Date.now(), id: rid(4) };
  game.reactions.push(r);
  if (game.reactions.length > 10) game.reactions.shift();
  hub.publish('q:' + game.id, 'react', r);
}

function reactAfterMove(game, moverIdx, before, after) {
  if (!game.ai) return;
  const me = game.ai.idx;
  const dMeB = before[me], dOpB = before[1 - me], dMeA = after[me], dOpA = after[1 - me];
  if (moverIdx !== me && dMeA - dMeB >= 3) return aiReact(game, 'angry');
  if (moverIdx === me && dOpA - dOpB >= 3) return aiReact(game, 'happy');
  const race = dOpA - dMeA;
  if (race <= -4 && Math.random() < 0.2) return aiReact(game, 'worried');
}

// ================= O'yin boshqaruvi =================
function playerFromUser(uid) {
  const u = users.getUser(uid);
  return { uid, ai: false, name: u ? u.name : 'O\'yinchi', avatar: users.avatarUrl(u), rating: u && u.st ? Math.round(u.st.qr) : 1000 };
}
function winChance(rating) { return Math.max(0.05, Math.min(0.2, 0.1 + (rating - 1000) / 2000)); }

function makeAi(level, rating, intendWin) {
  return {
    uid: null, ai: true, name: AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)] + ' 🤖',
    avatar: null, rating: Math.round(rating), level,
    ...(intendWin !== undefined ? { intendWin } : {}),
  };
}

function createGame(mode, pA, pB, extra = {}) {
  const swap = Math.random() < 0.5;
  const players = swap ? [pB, pA] : [pA, pB];
  const g = {
    id: rid(10), mode, players, st: E.newState(), clocks: [CLOCK_MS, CLOCK_MS], turnStart: Date.now(),
    status: 'playing', winner: null, reason: null, createdAt: Date.now(), reactions: [], lastMove: null, ratingDelta: null,
    disc: {}, ...extra,
  };
  const aiIdx = players.findIndex((p) => p.ai);
  if (aiIdx >= 0) {
    const p = players[aiIdx];
    g.ai = { idx: aiIdx, level: p.level, intendWin: !!p.intendWin, stall: 0, lastReact: 0 };
  }
  games.set(g.id, g);
  scheduleAi(g);
  return g;
}

function view(g, uid) {
  const me = g.players.findIndex((p) => p.uid === uid);
  const now = Date.now();
  const clocks = g.clocks.slice();
  if (g.status === 'playing') clocks[g.st.turn] = Math.max(0, clocks[g.st.turn] - (now - g.turnStart));
  return {
    id: g.id, mode: g.mode, me, code: g.code, status: g.status, winner: g.winner, reason: g.reason,
    players: g.players.map((p) => ({ name: p.name, avatar: p.avatar, rating: p.rating, ai: p.ai, uid: p.uid })),
    st: g.st, clocks, serverNow: now, lastMove: g.lastMove, ratingDelta: g.ratingDelta, aiLevel: g.ai ? g.ai.level : null,
  };
}
function broadcast(g) { hub.publishEach('q:' + g.id, 'state', (uid) => view(g, uid)); }

function finish(g, winner, reason) {
  if (g.status === 'over') return;
  const now = Date.now();
  if (g.status === 'playing') g.clocks[g.st.turn] = Math.max(0, g.clocks[g.st.turn] - (now - g.turnStart));
  g.status = 'over'; g.winner = winner; g.reason = reason;
  if (g.aiTimer) { clearTimeout(g.aiTimer); g.aiTimer = null; }
  // Reyting va statistika
  const data = db.get();
  const rated = g.mode === 'quick';
  const counted = g.mode === 'quick' || g.mode === 'friend';
  if (counted) {
    const [a, b] = g.players;
    const ea = 1 / (1 + Math.pow(10, (b.rating - a.rating) / 400));
    const k = g.ai ? 20 : 32;
    const deltaA = rated ? Math.round(k * ((winner === 0 ? 1 : 0) - ea)) : 0;
    const deltas = [deltaA, rated ? -deltaA : 0];
    g.ratingDelta = deltas;
    g.players.forEach((p, i) => {
      if (p.ai || !p.uid) return;
      const u = data.users[p.uid];
      if (!u) return;
      if (!u.st) u.st = users.defaultStats();
      u.st.qg++;
      if (winner === i) u.st.qw++; else u.st.ql++;
      if (rated) u.st.qr = Math.max(100, Math.round(u.st.qr + deltas[i]));
    });
  }
  data.tosiq.history.unshift({
    id: g.id, mode: g.mode, at: now, winner, reason,
    players: g.players.map((p) => ({ uid: p.uid, name: p.name, ai: p.ai })),
  });
  if (data.tosiq.history.length > 300) data.tosiq.history.length = 300;
  db.save();
  if (g.ai && Math.random() < 0.7) aiReact(g, winner === g.ai.idx ? 'won' : 'lost', true);
  broadcast(g);
  setTimeout(() => games.delete(g.id), 30 * 60e3);
}

function doMove(g, idx, mv) {
  if (g.status !== 'playing') throw new Error('O\'yin tugagan');
  if (g.st.turn !== idx) throw new Error('Hozir sizning navbatingiz emas');
  const m = mv.t === 'm' ? { t: 'm', r: Number(mv.r), c: Number(mv.c) } : { t: 'w', r: Number(mv.r), c: Number(mv.c), o: mv.o === 'v' ? 'v' : 'h' };
  if (!E.isLegal(g.st, idx, m)) throw new Error('Bu yurish mumkin emas');
  const now = Date.now();
  g.clocks[idx] = Math.max(0, g.clocks[idx] - (now - g.turnStart));
  if (g.clocks[idx] <= 0) { finish(g, 1 - idx, 'time'); return; }
  const before = E.distances(g.st);
  g.st = E.apply(g.st, idx, m);
  g.turnStart = now;
  g.lastMove = { idx, ...m, at: now };
  const after = E.distances(g.st);
  if (g.st.winner !== null) { finish(g, g.st.winner, 'goal'); return; }
  reactAfterMove(g, idx, before, after);
  broadcast(g);
  scheduleAi(g);
}

function scheduleAi(g) {
  if (!g.ai || g.status !== 'playing' || g.st.turn !== g.ai.idx || g.aiTimer) return;
  let mv;
  try { mv = aiChoose(g); } catch (e) { console.error('[tosiq] AI xatosi', e); }
  if (!mv) return;
  g.aiTimer = setTimeout(() => {
    g.aiTimer = null;
    if (g.status !== 'playing' || g.st.turn !== g.ai.idx) return;
    try { doMove(g, g.ai.idx, mv); } catch (e) {
      // holat o'zgargan bo'lsa qayta hisoblaymiz
      const again = aiChoose(g); if (again) { try { doMove(g, g.ai.idx, again); } catch (e2) { console.error(e2); } }
    }
  }, thinkDelay(g, mv));
}

// Vaqt nazorati
setInterval(() => {
  const now = Date.now();
  for (const g of games.values()) {
    if (g.status !== 'playing') continue;
    if (g.clocks[g.st.turn] - (now - g.turnStart) <= 0) finish(g, 1 - g.st.turn, 'time');
  }
}, 500).unref();

// Uzilib qolganlar
hub.onLeave((ch, uid) => {
  if (!ch.startsWith('q:')) return;
  const g = games.get(ch.slice(2));
  if (!g || g.status !== 'playing') return;
  const idx = g.players.findIndex((p) => p.uid === uid);
  if (idx < 0) return;
  setTimeout(() => {
    if (g.status === 'playing' && !hub.present(ch, uid)) {
      g.disc[idx] = (g.disc[idx] || 0) + 1;
      setTimeout(() => { if (g.status === 'playing' && !hub.present(ch, uid)) finish(g, 1 - idx, 'left'); }, 40000);
    }
  }, 1500);
});

// ---------- Tezkor o'yin: navbat ----------
const AI_WAIT_MIN = 6000, AI_WAIT_MAX = 10000;
setInterval(() => {
  const now = Date.now();
  const waiting = [...queue.entries()].sort((a, b) => a[1].since - b[1].since);
  while (waiting.length >= 2) {
    const [a] = waiting.shift(); const [b] = waiting.shift();
    queue.delete(a); queue.delete(b);
    const g = createGame('quick', playerFromUser(a), playerFromUser(b));
    hub.toUser(a, 'q:matched', { id: g.id }); hub.toUser(b, 'q:matched', { id: g.id });
  }
  for (const [uid, q] of waiting) {
    if (now - q.since >= q.wait) {
      queue.delete(uid);
      const me = playerFromUser(uid);
      const intendWin = Math.random() < winChance(me.rating);
      const level = me.rating < 950 ? 1 : me.rating < 1150 ? 2 : 3;
      const ai = makeAi(level, me.rating + Math.round((Math.random() - 0.5) * 120), intendWin);
      const g = createGame('quick', me, ai);
      hub.toUser(uid, 'q:matched', { id: g.id });
    }
  }
}, 700).unref();

function activeGameOf(uid) {
  for (const g of games.values()) if (g.status !== 'over' && g.players.some((p) => p.uid === uid)) return g;
  return null;
}

function quick(uid) {
  const act = activeGameOf(uid);
  if (act && act.status === 'playing') return { id: act.id };
  queue.set(uid, { since: Date.now(), wait: AI_WAIT_MIN + Math.random() * (AI_WAIT_MAX - AI_WAIT_MIN) });
  return { queued: true, online: queue.size };
}
function cancel(uid) { queue.delete(uid); }

function practice(uid, level) {
  level = Math.max(0, Math.min(3, Number(level) || 0));
  const me = playerFromUser(uid);
  const intendWin = level === 0 ? false : level === 1 ? Math.random() < 0.4 : true;
  const ai = makeAi(level, [800, 1000, 1250, 1500][level], intendWin);
  ai.name = ['Oson', 'O\'rtacha', 'Qiyin', 'Hardkor'][level] + ' 🤖';
  return createGame('ai', me, ai);
}

function friendCreate(uid, fallbackName) {
  const p = playerFromUser(uid);
  if (!users.getUser(uid) && fallbackName) p.name = fallbackName;
  const g = {
    id: rid(10), mode: 'friend', code: digits(4), players: [p], st: E.newState(), clocks: [CLOCK_MS, CLOCK_MS],
    turnStart: Date.now(), status: 'waiting', winner: null, reason: null, createdAt: Date.now(), reactions: [], disc: {},
    ready: new Set(fallbackName ? [] : [uid]),
  };
  games.set(g.id, g);
  setTimeout(() => { if (g.status === 'waiting') games.delete(g.id); }, 60 * 60e3);
  return g;
}
function friendJoin(uid, code) {
  const g = [...games.values()].find((x) => x.mode === 'friend' && x.status === 'waiting' && x.code === String(code).trim());
  if (!g) throw new Error('Bunday kodli xona topilmadi');
  g.ready = g.ready || new Set();
  g.ready.add(uid);
  if (g.players[0].uid === uid) { g.players[0] = playerFromUser(uid); broadcast(g); return g; }
  if (!g.players[1] && !g.players.some((p) => p.uid === uid)) g.players.push(playerFromUser(uid));
  if (g.players.length === 2 && g.players.every((p) => g.ready.has(p.uid))) {
    if (Math.random() < 0.5) g.players.reverse();
    g.status = 'playing'; g.turnStart = Date.now();
  }
  broadcast(g);
  return g;
}

function getGame(id) { const g = games.get(id); if (!g) throw new Error('O\'yin topilmadi yoki tugagan'); return g; }

function move(uid, id, mv) {
  const g = getGame(id);
  const idx = g.players.findIndex((p) => p.uid === uid);
  if (idx < 0) throw new Error('Siz bu o\'yinda emassiz');
  doMove(g, idx, mv || {});
  return view(g, uid);
}
function react(uid, id, e) {
  const g = getGame(id);
  const idx = g.players.findIndex((p) => p.uid === uid);
  const allowed = ['😂', '🫡', '🤝', '😡', '🏆', '😎', '🔥'];
  if (idx < 0 || !allowed.includes(e)) return;
  const last = g.reactions.filter((r) => r.idx === idx).pop();
  if (last && Date.now() - last.at < 1500) return;
  pushReaction(g, idx, e, '');
  if (g.ai && g.status === 'playing') {
    const [d0, d1] = E.distances(g.st);
    const aiAhead = (g.ai.idx === 0 ? d1 - d0 : d0 - d1) > 0;
    if (Math.random() < 0.45) {
      if (e === '😂' || e === '😎' || e === '🔥') aiReact(g, aiAhead ? 'confident' : 'replyLaugh', true);
      else if (e === '😡') aiReact(g, aiAhead ? 'happy' : 'worried', true);
      else aiReact(g, 'replyGood', true);
    }
  }
}
function resign(uid, id) {
  const g = getGame(id);
  const idx = g.players.findIndex((p) => p.uid === uid);
  if (idx < 0) throw new Error('Siz bu o\'yinda emassiz');
  if (g.status === 'waiting') { games.delete(g.id); return; }
  finish(g, 1 - idx, 'resign');
}

function stats() { return { online: queue.size, playing: [...games.values()].filter((g) => g.status === 'playing').length }; }

module.exports = {
  AI_WEAK,
  quick, cancel, practice, friendCreate, friendJoin, getGame, view, move, react, resign, activeGameOf, stats,
  _ai: { aiChoose, scoreMoves, createGame, makeAi, games, doMove },
};
