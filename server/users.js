'use strict';
const crypto = require('crypto');
const cfg = require('./config');
const tg = require('./tg');
const db = require('./db');

// ---------- Telegram initData tekshiruvi ----------
const initCache = new Map();
let secretKey = null;

function validateInitData(initData) {
  if (!initData || !cfg.BOT_TOKEN) return null;
  const cached = initCache.get(initData);
  if (cached) return cached;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const dcs = [...params.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  if (!secretKey) secretKey = crypto.createHmac('sha256', 'WebAppData').update(cfg.BOT_TOKEN).digest();
  const calc = crypto.createHmac('sha256', secretKey).update(dcs).digest('hex');
  if (calc.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash))) return null;
  const authDate = Number(params.get('auth_date')) * 1000;
  if (authDate && Date.now() - authDate > 7 * 24 * 3600e3) return null;
  let user;
  try { user = JSON.parse(params.get('user')); } catch (e) { return null; }
  if (!user || !user.id) return null;
  if (initCache.size > 5000) initCache.clear();
  initCache.set(initData, user);
  return user;
}

function authFromReq(req) {
  if (cfg.DEV) {
    const d = req.headers['x-dev-user'];
    if (d) {
      const [id, ...n] = String(d).split(':');
      const name = decodeURIComponent(n.join(':') || 'Foydalanuvchi ' + id);
      return { id: Number(id), first_name: name, username: 'user' + id };
    }
  }
  return validateInitData(req.headers['x-init-data']);
}

// ---------- Kanal obunasi va adminlar ----------
const subCache = new Map();
let channelError = null;

async function isSubscribed(uid) {
  const c = subCache.get(uid);
  if (c && c.exp > Date.now()) return c.ok;
  let ok = true;
  try {
    const m = await tg.call('getChatMember', { chat_id: cfg.CHANNEL, user_id: uid });
    ok = ['creator', 'administrator', 'member'].includes(m.status) || (m.status === 'restricted' && m.is_member);
    channelError = null;
  } catch (e) {
    // Bot kanalga admin qilinmagan bo'lsa tekshirib bo'lmaydi — foydalanuvchini to'xtatmaymiz
    channelError = e.message;
    ok = true;
  }
  subCache.set(uid, { ok, exp: Date.now() + (ok ? 5 * 60e3 : 15e3) });
  return ok;
}
function clearSub(uid) { subCache.delete(uid); }

let adminCache = { ids: new Set(), order: [], at: 0 };
async function refreshAdmins(force) {
  if (!force && Date.now() - adminCache.at < 10 * 60e3) return adminCache;
  try {
    const list = await tg.call('getChatAdministrators', { chat_id: cfg.CHANNEL });
    const humans = list.filter((m) => !m.user.is_bot);
    humans.sort((a, b) => (a.status === 'creator' ? -1 : b.status === 'creator' ? 1 : 0));
    const creator = humans.find((m) => m.status === 'creator');
    adminCache = { ids: new Set(humans.map((m) => m.user.id)), order: humans.map((m) => m.user.id), at: Date.now(), creator: creator ? creator.user.id : null };
    channelError = null;
  } catch (e) {
    channelError = e.message;
    adminCache.at = Date.now() - 9 * 60e3; // 1 daqiqadan keyin qayta urinish
  }
  for (const id of cfg.ADMIN_IDS) adminCache.ids.add(id);
  return adminCache;
}
async function isAdmin(uid) {
  if (cfg.ADMIN_IDS.includes(uid)) return true;
  const a = await refreshAdmins();
  return a.ids.has(uid);
}
// Bosh admin: kanal egasi, SUPER_ADMIN_IDS yoki o'zini tasdiqlagan birinchi admin
async function isSuper(uid) {
  if (cfg.SUPER_ADMIN_IDS.includes(uid)) return true;
  const list = db.get().meta.superAdmins || [];
  if (list.includes(uid)) return true;
  const a = await refreshAdmins();
  if (cfg.DEV && uid === 1) return true;
  return a.creator === uid;
}
async function canClaimSuper(uid) {
  const list = db.get().meta.superAdmins || [];
  return !list.length && !(await isSuper(uid)) && (await isAdmin(uid));
}
async function claimSuper(uid) {
  if (!(await canClaimSuper(uid))) throw new Error('Ruxsat yo\'q');
  db.get().meta.superAdmins = [uid];
  db.save();
}
db.setAdminCandidates(async () => { const a = await refreshAdmins(); return [...new Set([...a.order, ...cfg.ADMIN_IDS])]; });

// ---------- Foydalanuvchilar ----------
function getUser(uid) { return db.get().users[uid] || null; }

function avatarUrl(u) {
  if (!u || !u.avatar) return null;
  return `/api/avatar/${u.id}?v=${u.avatarV || 0}`;
}
function brief(u) {
  if (!u) return null;
  return { id: u.id, name: u.name, avatar: avatarUrl(u) };
}
function briefId(uid) {
  if (typeof uid === 'string' && uid.startsWith('g:')) return null;
  return brief(getUser(uid));
}

function defaultStats() {
  return { dp: 0, dc: 0, dq: 0, qr: 1000, qw: 0, ql: 0, qg: 0, pw: 0, pl: 0, pg: 0, pgoals: 0 };
}

async function fetchTgPhoto(uid) {
  try {
    const r = await tg.call('getUserProfilePhotos', { user_id: uid, limit: 1 });
    if (r.total_count && r.photos[0]) {
      const sizes = r.photos[0];
      const pick = sizes.find((s) => s.width >= 160) || sizes[sizes.length - 1];
      return pick.file_id;
    }
  } catch (e) { }
  return null;
}

async function createUser(tgUser) {
  const data = db.get();
  const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ').trim() || tgUser.username || ('Foydalanuvchi ' + tgUser.id);
  const fileId = await fetchTgPhoto(tgUser.id);
  const u = {
    id: tgUser.id,
    name: name.slice(0, 40),
    tgName: name,
    username: tgUser.username || null,
    avatar: fileId ? { t: 'tg', id: fileId } : null,
    avatarV: 1,
    createdAt: Date.now(),
    lastSeen: Date.now(),
    st: defaultStats(),
  };
  data.users[u.id] = u;
  db.save();
  return u;
}

function touch(u, tgUser) {
  u.lastSeen = Date.now();
  if (tgUser && tgUser.username && u.username !== tgUser.username) u.username = tgUser.username;
  if (!u.st) u.st = defaultStats();
}

function profile(u) {
  return { ...brief(u), username: u.username, createdAt: u.createdAt, st: u.st, hasCustomAvatar: !!(u.avatar && u.avatar.t === 'custom') };
}

// ---------- Avatar ----------
const avatarCache = new Map();
async function avatarBuffer(uid) {
  const u = getUser(uid);
  if (!u || !u.avatar) return null;
  const key = uid + ':' + (u.avatarV || 0);
  if (avatarCache.has(key)) return avatarCache.get(key);
  let buf = null;
  if (u.avatar.t === 'custom') buf = Buffer.from(u.avatar.data, 'base64');
  else if (u.avatar.t === 'tg') { try { buf = await tg.downloadFile(u.avatar.id); } catch (e) { buf = null; } }
  if (buf) {
    if (avatarCache.size > 600) avatarCache.delete(avatarCache.keys().next().value);
    avatarCache.set(key, buf);
  }
  return buf;
}

// ---------- Captcha: "bot emasman" ----------
const captchas = new Map();
const BALLS = ['🏀', '🏐', '🎾', '🏈', '⚾', '🎱', '🏉', '🥎', '🏓'];
function newCaptcha(uid) {
  const n = 2 + Math.floor(Math.random() * 3); // 2..4 ta to'p
  const cells = [];
  const idx = new Set();
  while (idx.size < n) idx.add(Math.floor(Math.random() * 9));
  for (let i = 0; i < 9; i++) cells.push(idx.has(i) ? '⚽' : BALLS[Math.floor(Math.random() * BALLS.length)]);
  const id = crypto.randomBytes(8).toString('hex');
  captchas.set(id, { uid, answer: [...idx].sort().join(','), at: Date.now(), tries: 0 });
  if (captchas.size > 2000) captchas.delete(captchas.keys().next().value);
  return { id, cells };
}
function checkCaptcha(uid, id, picks) {
  const c = captchas.get(id);
  if (!c || c.uid !== uid) return false;
  c.tries++;
  if (c.tries > 3) { captchas.delete(id); return false; }
  if (Date.now() - c.at < 1200) return false;
  const ans = [...new Set((picks || []).map(Number))].sort().join(',');
  if (ans === c.answer) { captchas.delete(id); return true; }
  return false;
}

module.exports = {
  isSuper, canClaimSuper, claimSuper,
  authFromReq, isSubscribed, clearSub, isAdmin, refreshAdmins, getUser, brief, briefId, avatarUrl,
  createUser, touch, profile, avatarBuffer, newCaptcha, checkCaptcha, defaultStats,
  channelError: () => channelError,
};
