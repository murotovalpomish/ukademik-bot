'use strict';
// Futbol: hisobni taxmin qilish (prognoz) + penalti statistikasi
const db = require('./db');
const users = require('./users');

const F = () => db.get().football;
const byId = (id) => F().matches.find((m) => m.id === Number(id));

function points(pred, score) {
  if (!pred || !score) return 0;
  const [ph, pa] = pred, [sh, sa] = score;
  if (ph === sh && pa === sa) return 5;
  if (ph - pa === sh - sa) return 3;
  if (Math.sign(ph - pa) === Math.sign(sh - sa)) return 2;
  return 0;
}

function view(m, uid) {
  const my = m.pred[uid] || null;
  const preds = Object.values(m.pred);
  return {
    id: m.id, home: m.home, away: m.away, hf: m.hf, af: m.af, league: m.league, kickoff: m.kickoff,
    status: m.score ? 'finished' : Date.now() >= m.kickoff ? 'live' : 'upcoming', score: m.score || null,
    my: my ? { h: my[0], a: my[1], p: m.score ? points(my, m.score) : null } : null,
    total: preds.length,
    dist: { home: preds.filter((p) => p[0] > p[1]).length, draw: preds.filter((p) => p[0] === p[1]).length, away: preds.filter((p) => p[0] < p[1]).length },
  };
}

function list(uid) {
  const now = Date.now();
  const all = F().matches.slice();
  const upcoming = all.filter((m) => !m.score).sort((a, b) => a.kickoff - b.kickoff).map((m) => view(m, uid));
  const finished = all.filter((m) => m.score).sort((a, b) => b.kickoff - a.kickoff).slice(0, 30).map((m) => view(m, uid));
  return { upcoming, finished, now };
}

function predict(uid, id, h, a) {
  const m = byId(id);
  if (!m) throw new Error('O\'yin topilmadi');
  if (m.score || Date.now() >= m.kickoff) throw new Error('Prognoz qabul qilish yopilgan — o\'yin boshlangan');
  h = Math.max(0, Math.min(20, parseInt(h, 10))); a = Math.max(0, Math.min(20, parseInt(a, 10)));
  if (Number.isNaN(h) || Number.isNaN(a)) throw new Error('Hisobni kiriting');
  m.pred[uid] = [h, a, Date.now()];
  db.save();
  return view(m, uid);
}

function leaderboard() {
  const tot = {};
  for (const m of F().matches) {
    if (!m.score) continue;
    for (const [uid, p] of Object.entries(m.pred)) {
      if (!tot[uid]) tot[uid] = { p: 0, exact: 0, n: 0 };
      const pts = points(p, m.score);
      tot[uid].p += pts; tot[uid].n++; if (pts === 5) tot[uid].exact++;
    }
  }
  return tot;
}

function adminSave(body) {
  const f = F();
  let m = body.id ? byId(body.id) : null;
  const home = String(body.home || '').trim().slice(0, 40), away = String(body.away || '').trim().slice(0, 40);
  if (!home || !away) throw new Error('Jamoalar nomini kiriting');
  const kickoff = Number(body.kickoff);
  if (!kickoff) throw new Error('Boshlanish vaqtini kiriting');
  if (!m) { f.seq++; m = { id: f.seq, pred: {}, createdAt: Date.now() }; f.matches.push(m); }
  Object.assign(m, { home, away, hf: String(body.hf || '').slice(0, 8), af: String(body.af || '').slice(0, 8), league: String(body.league || '').slice(0, 40), kickoff });
  db.save();
  return m.id;
}
function adminResult(id, h, a) {
  const m = byId(id);
  if (!m) throw new Error('Topilmadi');
  if (h === null || h === '' || h === undefined) m.score = null;
  else m.score = [Math.max(0, parseInt(h, 10) || 0), Math.max(0, parseInt(a, 10) || 0)];
  db.save();
}
function adminDelete(id) {
  const f = F();
  f.matches = f.matches.filter((m) => m.id !== Number(id));
  db.save();
}

function penaltyResult(uid, body) {
  const u = users.getUser(uid);
  if (!u) return;
  const gf = Math.max(0, Math.min(30, Number(body.gf) || 0)), ga = Math.max(0, Math.min(30, Number(body.ga) || 0));
  u.st.pg++;
  if (gf > ga) u.st.pw++; else u.st.pl++;
  u.st.pgoals += gf;
  db.save();
  return u.st;
}

module.exports = { list, predict, leaderboard, adminSave, adminResult, adminDelete, penaltyResult };
