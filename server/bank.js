'use strict';
// Zakovat savollari bazasi: oldingi kunlik savollar + admin qo'shgan mashq savollari
const crypto = require('crypto');
const cfg = require('./config');
const db = require('./db');
const tg = require('./tg');
const { isCorrect } = require('./util');

const B = () => db.get().bank;
const SIGN = crypto.createHash('sha256').update('bank:' + (cfg.BOT_TOKEN || 'dev')).digest('hex').slice(0, 16);
const imgKey = (key) => crypto.createHmac('sha256', SIGN).update(key).digest('hex').slice(0, 20);

// Barcha savollar: b<ID> — baza, d<ID> — yopilgan kunlik savol
function all() {
  const items = B().items.map((q) => ({ key: 'b' + q.id, num: q.id, pack: q.pack || 'Umumiy', text: q.text, image: q.image, answers: q.answers, comment: q.comment, author: q.author, at: q.createdAt }));
  const daily = db.get().daily.questions.filter((q) => q.status === 'closed').map((q) => ({
    key: 'd' + q.id, num: q.num, pack: 'Kunlik savollar', text: q.text, image: q.image, answers: q.answers, comment: q.comment, author: q.author, at: q.closedAt,
  }));
  return [...items, ...daily].sort((a, b) => b.at - a.at);
}
const imgUrl = (q) => (q.image ? `/api/bimg/${q.key}?k=${imgKey(q.key)}` : null);
function prog(uid) { const p = B().progress; if (!p[uid]) p[uid] = {}; return p[uid]; }

function list(uid, pack, q) {
  const my = prog(uid);
  let arr = all();
  const packs = {};
  for (const x of arr) packs[x.pack] = (packs[x.pack] || 0) + 1;
  if (pack) arr = arr.filter((x) => x.pack === pack);
  q = String(q || '').toLowerCase().trim();
  if (q) arr = arr.filter((x) => (x.text || '').toLowerCase().includes(q));
  const solved = Object.values(my).filter((v) => v === 1).length;
  return {
    packs: Object.entries(packs).map(([name, n]) => ({ name, n })),
    total: all().length, solved,
    items: arr.slice(0, 200).map((x) => ({ key: x.key, num: x.num, pack: x.pack, text: (x.text || '').slice(0, 160), hasImage: !!x.image, st: my[x.key] === 1 ? 'ok' : my[x.key] === 0 ? 'bad' : my[x.key] === 2 ? 'seen' : null })),
  };
}
function find(key) { const x = all().find((q) => q.key === key); if (!x) throw new Error('Savol topilmadi'); return x; }
function open(uid, key) {
  const x = find(key);
  const st = prog(uid)[key];
  const done = st !== undefined;
  return { key, num: x.num, pack: x.pack, text: x.text, image: imgUrl(x), done, st, ...(done ? { answers: x.answers, comment: x.comment, author: x.author } : {}) };
}
function check(uid, key, text) {
  const x = find(key);
  const my = prog(uid);
  const ok = isCorrect(text, x.answers);
  if (my[key] === undefined) my[key] = ok ? 1 : 0;
  db.save();
  return { ok, answers: x.answers, comment: x.comment, author: x.author };
}
function reveal(uid, key) {
  const x = find(key);
  const my = prog(uid);
  if (my[key] === undefined) my[key] = 2;
  db.save();
  return { answers: x.answers, comment: x.comment, author: x.author };
}
async function image(key, k) {
  if (k !== imgKey(key)) return null;
  const x = all().find((q) => q.key === key);
  if (!x || !x.image) return null;
  if (x.image.t === 'b64') return Buffer.from(x.image.data, 'base64');
  return tg.downloadFile(x.image.id);
}

// ---------- Admin ----------
function adminList() { return B().items.slice().reverse().map((q) => ({ ...q, image: q.image ? imgUrl({ key: 'b' + q.id, image: q.image }) : null })); }
async function adminSave(b) {
  const bank = B();
  let q = b.id ? bank.items.find((x) => x.id === Number(b.id)) : null;
  const answers = String(b.answers || '').split(/\n|\//).map((s) => s.trim()).filter(Boolean);
  if (!String(b.text || '').trim() && !b.imageData && !(q && q.image)) throw new Error('Savol matnini kiriting');
  if (!answers.length) throw new Error('Javobni kiriting');
  if (!q) { bank.seq++; q = { id: bank.seq, createdAt: Date.now() }; bank.items.push(q); }
  q.text = String(b.text || '').trim().slice(0, 3000);
  q.answers = answers.slice(0, 20);
  q.comment = String(b.comment || '').trim().slice(0, 1500);
  q.author = String(b.author || '').trim().slice(0, 80);
  q.pack = String(b.pack || '').trim().slice(0, 40) || 'Umumiy';
  if (b.removeImage) q.image = null;
  if (b.imageData) {
    const b64 = String(b.imageData).replace(/^data:image\/\w+;base64,/, '');
    const buf = Buffer.from(b64, 'base64');
    let fileId = null;
    try { fileId = await db.storePhoto(buf); } catch (e) { }
    q.image = fileId ? { t: 'tg', id: fileId } : { t: 'b64', data: b64 };
  }
  db.save();
  return q.id;
}
function adminDelete(id) { const bank = B(); bank.items = bank.items.filter((x) => x.id !== Number(id)); db.save(); }

module.exports = { list, open, check, reveal, image, adminList, adminSave, adminDelete };
