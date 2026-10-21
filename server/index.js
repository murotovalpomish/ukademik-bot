'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cfg = require('./config');
const tg = require('./tg');
const db = require('./db');
const users = require('./users');
const hub = require('./hub');
const bot = require('./bot');
const daily = require('./daily');
const svoyak = require('./svoyak');
const tosiq = require('./tosiq');
const football = require('./football');
const penalty = require('./penalty');
const bank = require('./bank');
bot.setGames(penalty, tosiq);
penalty.setNotifier(bot.notifyTour);

const WEBHOOK_PATH = '/tg/' + crypto.createHash('sha256').update('wh:' + (cfg.BOT_TOKEN || 'dev')).digest('hex').slice(0, 24);
const WEBHOOK_SECRET = crypto.createHash('sha256').update('sec:' + (cfg.BOT_TOKEN || 'dev')).digest('hex').slice(0, 32);

// ---------------- Yordamchi ----------------
function send(res, code, obj, headers = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}
function readBody(req, limit = 4 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('Juda katta so\'rov')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { resolve({}); }
    });
    req.on('error', reject);
  });
}
class HttpError extends Error { constructor(code, msg, extra) { super(msg); this.code = code; this.extra = extra; } }

// ---------------- Statik fayllar ----------------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json', '.webp': 'image/webp' };
function serveStatic(req, res, pathname) {
  let p = pathname === '/' ? '/index.html' : pathname;
  p = path.normalize(p).replace(/^(\.\.[\/\\])+/, '');
  const file = path.join(cfg.PUBLIC_DIR, p);
  if (!file.startsWith(cfg.PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      // SPA: noma'lum yo'llar uchun index.html
      if (!path.extname(p)) return serveStatic(req, res, '/');
      res.writeHead(404); return res.end('Not found');
    }
    const ext = path.extname(file);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300' });
    fs.createReadStream(file).pipe(res);
  });
}

// ---------------- Router ----------------
const routes = [];
function route(method, pattern, handler, opts = {}) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, handler, opts });
}

async function requireUser(ctx) {
  const tgUser = users.authFromReq(ctx.req);
  if (!tgUser) throw new HttpError(401, 'Telegram orqali kiring');
  ctx.tgUser = tgUser; ctx.uid = tgUser.id;
  if (ctx.opts.noUser) return;
  if (!(await users.isSubscribed(tgUser.id))) throw new HttpError(403, 'Kanalga obuna bo\'ling', { gate: 'subscribe' });
  const u = users.getUser(tgUser.id);
  if (!u) throw new HttpError(403, 'Ro\'yxatdan o\'ting', { gate: 'captcha' });
  users.touch(u, tgUser);
  ctx.user = u;
  ctx.sup = await users.isSuper(u.id);
  svoyak.markSuper(u.id, ctx.sup);
  if (ctx.opts.admin && !ctx.sup && !(await users.isAdmin(u.id))) throw new HttpError(403, 'Faqat adminlar uchun');
  if (ctx.opts.super && !ctx.sup) throw new HttpError(403, 'Faqat bosh admin uchun');
}

// ---- Umumiy ----
route('GET', '/api/config', async () => ({ bot: bot.username(), channel: cfg.CHANNEL, channelLink: cfg.CHANNEL_LINK, dev: cfg.DEV }), { public: true });

route('GET', '/api/me', async (ctx) => {
  const t = ctx.tgUser;
  const subscribed = await users.isSubscribed(t.id);
  if (!subscribed) return { gate: 'subscribe', channelLink: cfg.CHANNEL_LINK, channel: cfg.CHANNEL };
  const u = users.getUser(t.id);
  if (!u) return { gate: 'captcha', tgName: [t.first_name, t.last_name].filter(Boolean).join(' ') };
  users.touch(u, t);
  const sup = await users.isSuper(u.id);
  svoyak.markSuper(u.id, sup);
  return { gate: 'ok', user: users.profile(u), isAdmin: sup || await users.isAdmin(u.id), isSuper: sup, canClaim: await users.canClaimSuper(u.id), bot: bot.username(), channelLink: cfg.CHANNEL_LINK };
}, { noUser: true });

route('POST', '/api/recheck', async (ctx) => { users.clearSub(ctx.uid); return { ok: await users.isSubscribed(ctx.uid) }; }, { noUser: true });

route('GET', '/api/captcha', async (ctx) => users.newCaptcha(ctx.uid), { noUser: true });
route('POST', '/api/captcha', async (ctx) => {
  if (!(await users.isSubscribed(ctx.uid))) throw new HttpError(403, 'Avval kanalga obuna bo\'ling', { gate: 'subscribe' });
  if (!users.checkCaptcha(ctx.uid, ctx.body.id, ctx.body.picks)) return { ok: false };
  let u = users.getUser(ctx.uid);
  if (!u) u = await users.createUser(ctx.tgUser);
  return { ok: true, user: users.profile(u) };
}, { noUser: true });

route('POST', '/api/stream-token', async (ctx) => ({ t: hub.issueToken(ctx.uid) }), { noUser: true });

route('POST', '/api/profile', async (ctx) => {
  const u = ctx.user, b = ctx.body;
  if (b.name !== undefined) {
    const name = String(b.name).replace(/\s+/g, ' ').trim().slice(0, 40);
    if (name.length < 2) throw new Error('Ism kamida 2 ta harf bo\'lsin');
    u.name = name;
  }
  if (b.avatarData) {
    const b64 = String(b.avatarData).replace(/^data:image\/\w+;base64,/, '');
    if (b64.length > 400000) throw new Error('Rasm juda katta');
    u.avatar = { t: 'custom', data: b64 }; u.avatarV = (u.avatarV || 0) + 1;
  }
  if (b.resetAvatar) {
    const tgUser = ctx.tgUser;
    const fileId = await (async () => { try { const r = await tg.call('getUserProfilePhotos', { user_id: tgUser.id, limit: 1 }); const s = r.photos && r.photos[0]; return s ? (s.find((x) => x.width >= 160) || s[s.length - 1]).file_id : null; } catch (e) { return null; } })();
    u.avatar = fileId ? { t: 'tg', id: fileId } : null; u.avatarV = (u.avatarV || 0) + 1;
    if (b.resetName) u.name = (u.tgName || u.name).slice(0, 40);
  }
  db.save();
  return { user: users.profile(u) };
});

route('GET', '/api/home', async (ctx) => {
  const dv = daily.userView(ctx.uid);
  const live = svoyak.list('live', ctx.uid, ctx.sup).filter((g) => g.status === 'live').length;
  const bk = bank.list(ctx.uid);
  return { daily: { open: dv.open, next: dv.next, last: dv.recent[0] || null }, svoyakLive: live, tosiq: tosiq.stats(), activeGame: (tosiq.activeGameOf(ctx.uid) || {}).id || null, bank: { total: bk.total, solved: bk.solved }, penActive: (penalty.activeOf(ctx.uid) || {}).id || null };
});

route('GET', '/api/rating', async (ctx) => {
  const type = ctx.query.get('type') || 'daily';
  const all = Object.values(db.get().users);
  let rows;
  if (type === 'football') {
    const lb = football.leaderboard();
    rows = Object.entries(lb).map(([uid, x]) => ({ u: users.getUser(Number(uid)), v: x.p, sub: `${x.n} prognoz · ${x.exact} aniq` }));
  } else if (type === 'tosiq') {
    rows = all.filter((u) => u.st && u.st.qg > 0).map((u) => ({ u, v: Math.round(u.st.qr), sub: `${u.st.qw} g'alaba · ${u.st.ql} mag'lubiyat` }));
  } else if (type === 'penalty') {
    rows = all.filter((u) => u.st && u.st.pg > 0).map((u) => ({ u, v: u.st.pw, sub: `${u.st.pg} o'yin · ${u.st.pgoals} gol` }));
  } else {
    rows = all.filter((u) => u.st && u.st.dq > 0).map((u) => ({ u, v: u.st.dp, sub: `${u.st.dc} to'g'ri / ${u.st.dq} javob` }));
  }
  rows = rows.filter((r) => r.u).sort((a, b) => b.v - a.v);
  const myIdx = rows.findIndex((r) => r.u.id === ctx.uid);
  const map = (r, i) => ({ rank: i + 1, user: users.brief(r.u), v: r.v, sub: r.sub });
  return { rows: rows.slice(0, 100).map(map), me: myIdx >= 0 ? map(rows[myIdx], myIdx) : null };
});

route('GET', '/api/avatar/:id', async (ctx) => {
  const buf = await users.avatarBuffer(Number(ctx.params.id));
  if (!buf) { ctx.res.writeHead(404); ctx.res.end(); return null; }
  const isPng = buf[0] === 0x89;
  ctx.res.writeHead(200, { 'Content-Type': isPng ? 'image/png' : 'image/jpeg', 'Cache-Control': 'public, max-age=86400' });
  ctx.res.end(buf);
  return null;
}, { public: true });

route('GET', '/api/stream', async (ctx) => {
  const uid = hub.tokenUid(ctx.query.get('t'));
  if (!uid) throw new HttpError(401, 'token');
  const chs = String(ctx.query.get('ch') || '').split(',').filter(Boolean).slice(0, 5)
    .filter((c) => /^(sv|q|daily|u|pen|pt)(:[\w-]+)?$/.test(c) && (!c.startsWith('u:') || c === 'u:' + uid));
  hub.attach(ctx.req, ctx.res, uid, chs);
  return null;
}, { public: true });

// ---- Kunlik savol ----
route('GET', '/api/daily', async (ctx) => daily.userView(ctx.uid));
route('POST', '/api/daily/:id/start', async (ctx) => daily.start(ctx.uid, ctx.params.id));
route('POST', '/api/daily/:id/answer', async (ctx) => daily.answer(ctx.uid, ctx.params.id, ctx.body.text));
route('POST', '/api/daily/:id/appeal', async (ctx) => ({ ok: daily.appeal(ctx.uid, ctx.params.id, ctx.body.text) }));
route('GET', '/api/qimg/:id', async (ctx) => {
  const buf = await daily.imageBuffer(Number(ctx.params.id), ctx.query.get('k'));
  if (!buf) { ctx.res.writeHead(404); ctx.res.end(); return null; }
  ctx.res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=3600' });
  ctx.res.end(buf);
  return null;
}, { public: true });

// ---- Shaxsiy o'yin (Svoyak) ----
route('GET', '/api/sv', async (ctx) => ({ games: svoyak.list(ctx.query.get('f') || 'live', ctx.uid, ctx.sup, ctx.query.get('q')) }));
route('POST', '/api/sv', async (ctx) => { const g = svoyak.create(ctx.uid, ctx.body); return { id: g.id, code: g.code }; });
route('POST', '/api/sv/join', async (ctx) => { const g = svoyak.joinByCode(ctx.uid, ctx.body.code); return { id: g.id }; });
route('GET', '/api/sv/:id', async (ctx) => svoyak.view(svoyak.get(ctx.params.id), ctx.uid, ctx.sup));
route('GET', '/api/sv/:id/chat', async (ctx) => ({ chat: svoyak.chatList(ctx.uid, ctx.params.id, ctx.sup) }));
route('POST', '/api/sv/:id/voice', async (ctx) => svoyak.saveVoice(ctx.uid, ctx.params.id, ctx.sup, ctx.body));
route('POST', '/api/sv/:id/act', async (ctx) => svoyak.action(ctx.uid, ctx.params.id, ctx.body || {}, ctx.sup));
route('POST', '/api/sv/:id/join', async (ctx) => {
  const g = svoyak.get(ctx.params.id);
  if (String(ctx.body.code || '').trim() !== g.code) throw new Error('Kod noto\'g\'ri');
  svoyak.joinByCode(ctx.uid, g.code); return { ok: true };
});
route('DELETE', '/api/sv/:id', async (ctx) => { svoyak.remove(ctx.uid, ctx.params.id, ctx.sup); return { ok: true }; });
route('GET', '/api/voice/:gid/:vid', async (ctx) => {
  const f = svoyak.voiceFile(ctx.params.vid, ctx.params.gid);
  if (!f) { ctx.res.writeHead(404); ctx.res.end(); return null; }
  ctx.res.writeHead(200, { 'Content-Type': f.mime, 'Cache-Control': 'private, max-age=86400', 'Accept-Ranges': 'none' });
  ctx.res.end(f.buf);
  return null;
}, { public: true });

// ---- Zakovat savollari (baza) ----
route('GET', '/api/bank', async (ctx) => bank.list(ctx.uid, ctx.query.get('pack'), ctx.query.get('q')));
route('GET', '/api/bank/:key', async (ctx) => bank.open(ctx.uid, ctx.params.key));
route('POST', '/api/bank/:key/check', async (ctx) => bank.check(ctx.uid, ctx.params.key, ctx.body.text));
route('POST', '/api/bank/:key/reveal', async (ctx) => bank.reveal(ctx.uid, ctx.params.key));
route('GET', '/api/bimg/:key', async (ctx) => {
  const buf = await bank.image(ctx.params.key, ctx.query.get('k'));
  if (!buf) { ctx.res.writeHead(404); ctx.res.end(); return null; }
  ctx.res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=3600' }); ctx.res.end(buf); return null;
}, { public: true });

// ---- Penalti ----
route('POST', '/api/pen/quick', async (ctx) => penalty.quick(ctx.uid));
route('POST', '/api/pen/quick-cancel', async (ctx) => { penalty.quickCancel(ctx.uid); return { ok: true }; });
route('POST', '/api/pen/ai', async (ctx) => ({ id: penalty.vsAi(ctx.uid).id }));
route('POST', '/api/pen/friend', async (ctx) => { const m = penalty.friendCreate(ctx.uid); return { id: m.id, code: m.code }; });
route('POST', '/api/pen/join', async (ctx) => ({ id: penalty.friendJoin(ctx.uid, ctx.body.code).id }));
route('GET', '/api/pen/active', async (ctx) => ({ id: (penalty.activeOf(ctx.uid) || {}).id || null }));
route('GET', '/api/pen/:id', async (ctx) => penalty.view(penalty.get(ctx.params.id), ctx.uid));
route('POST', '/api/pen/:id/pick', async (ctx) => penalty.userPick(ctx.uid, ctx.params.id, ctx.body.zone));
route('POST', '/api/pen/:id/leave', async (ctx) => { penalty.cancel(ctx.uid, ctx.params.id); return { ok: true }; });
route('GET', '/api/pt', async (ctx) => ({ list: penalty.tList(ctx.uid, ctx.sup, ctx.query.get('f'), ctx.query.get('q')) }));
route('POST', '/api/pt', async (ctx) => ({ id: penalty.tCreate(ctx.uid, ctx.body).id }));
route('GET', '/api/pt/:id', async (ctx) => penalty.tGet(ctx.uid, ctx.sup, ctx.params.id));
route('POST', '/api/pt/:id/act', async (ctx) => penalty.tAction(ctx.uid, ctx.sup, ctx.params.id, ctx.body || {}));
route('POST', '/api/pt/:id/play', async (ctx) => penalty.tPlay(ctx.uid, ctx.sup, ctx.params.id));
route('GET', '/api/bot-avatar/:seed', async (ctx) => {
  ctx.res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=604800' });
  ctx.res.end(penalty.avatarSvg(String(ctx.params.seed).replace(/\.svg$/, '')));
  return null;
}, { public: true });

// ---- To'siq ----
route('POST', '/api/q/quick', async (ctx) => tosiq.quick(ctx.uid));
route('POST', '/api/q/cancel', async (ctx) => { tosiq.cancel(ctx.uid); return { ok: true }; });
route('POST', '/api/q/practice', async (ctx) => ({ id: tosiq.practice(ctx.uid, ctx.body.level).id }));
route('POST', '/api/q/friend', async (ctx) => { const g = tosiq.friendCreate(ctx.uid); return { id: g.id, code: g.code }; });
route('POST', '/api/q/join', async (ctx) => ({ id: tosiq.friendJoin(ctx.uid, ctx.body.code).id }));
route('GET', '/api/q/active', async (ctx) => ({ id: (tosiq.activeGameOf(ctx.uid) || {}).id || null }));
route('GET', '/api/q/:id', async (ctx) => tosiq.view(tosiq.getGame(ctx.params.id), ctx.uid));
route('POST', '/api/q/:id/move', async (ctx) => tosiq.move(ctx.uid, ctx.params.id, ctx.body.mv));
route('POST', '/api/q/:id/react', async (ctx) => { tosiq.react(ctx.uid, ctx.params.id, ctx.body.e); return { ok: true }; });
route('POST', '/api/q/:id/resign', async (ctx) => { tosiq.resign(ctx.uid, ctx.params.id); return { ok: true }; });

// ---- Futbol ----
route('GET', '/api/fb', async (ctx) => football.list(ctx.uid));
route('POST', '/api/fb/:id/predict', async (ctx) => football.predict(ctx.uid, ctx.params.id, ctx.body.h, ctx.body.a));
route('POST', '/api/penalty', async (ctx) => ({ st: football.penaltyResult(ctx.uid, ctx.body) }));

// ---- Admin ----
const A = { admin: true };
route('GET', '/api/admin/status', async () => {
  await users.refreshAdmins(true);
  const d = db.get();
  return {
    channel: cfg.CHANNEL, channelError: users.channelError(), backup: db.status(), users: Object.keys(d.users).length,
    publicUrl: cfg.PUBLIC_URL, settings: d.daily.settings, nextFreeDate: daily.nextFreeDate(),
  };
}, A);
route('POST', '/api/admin/claim-super', async (ctx) => { await users.claimSuper(ctx.uid); return { ok: true }; });
const SUP = { admin: true, super: true };
route('GET', '/api/admin/users', async (ctx) => {
  const q = String(ctx.query.get('q') || '').toLowerCase().trim();
  let arr = Object.values(db.get().users);
  const total = arr.length;
  if (q) arr = arr.filter((u) => (u.name || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q) || String(u.id) === q);
  arr.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
  const day = Date.now() - 86400e3, week = Date.now() - 7 * 86400e3;
  const all = Object.values(db.get().users);
  return {
    total, today: all.filter((u) => u.createdAt > day).length, active: all.filter((u) => (u.lastSeen || 0) > week).length,
    users: arr.slice(0, 300).map((u) => ({ ...users.brief(u), username: u.username, tgName: u.tgName, createdAt: u.createdAt, lastSeen: u.lastSeen, st: u.st })),
  };
}, SUP);
route('GET', '/api/admin/groups', async () => ({ groups: Object.values(db.get().groups).sort((a, b) => b.at - a.at) }), SUP);
route('GET', '/api/admin/bank', async () => ({ items: bank.adminList() }), A);
route('POST', '/api/admin/bank', async (ctx) => ({ id: await bank.adminSave(ctx.body) }), A);
route('DELETE', '/api/admin/bank/:id', async (ctx) => { bank.adminDelete(ctx.params.id); return { ok: true }; }, A);
route('GET', '/api/admin/daily', async () => ({ questions: daily.adminList(), settings: db.get().daily.settings, nextFreeDate: daily.nextFreeDate() }), A);
route('GET', '/api/admin/daily/:id', async (ctx) => daily.adminDetail(ctx.params.id), A);
route('POST', '/api/admin/daily', async (ctx) => ({ id: await daily.adminSave(ctx.body) }), A);
route('DELETE', '/api/admin/daily/:id', async (ctx) => { daily.adminDelete(ctx.params.id); return { ok: true }; }, A);
route('POST', '/api/admin/daily/:id/publish', async (ctx) => { await daily.adminPublishNow(ctx.params.id); return { ok: true }; }, A);
route('POST', '/api/admin/daily/:id/close', async (ctx) => { await daily.adminCloseNow(ctx.params.id); return { ok: true }; }, A);
route('POST', '/api/admin/daily/:id/override', async (ctx) => { daily.adminOverride(ctx.params.id, ctx.body.uid, ctx.body.acc); return daily.adminDetail(ctx.params.id); }, A);
route('POST', '/api/admin/daily/:id/appeal', async (ctx) => { daily.adminAppeal(ctx.params.id, ctx.body.uid, !!ctx.body.accept); return daily.adminDetail(ctx.params.id); }, A);
route('POST', '/api/admin/settings', async (ctx) => ({ settings: daily.adminSettings(ctx.body) }), A);
route('POST', '/api/admin/fb', async (ctx) => ({ id: football.adminSave(ctx.body) }), A);
route('POST', '/api/admin/fb/:id/result', async (ctx) => { football.adminResult(ctx.params.id, ctx.body.h, ctx.body.a); return { ok: true }; }, A);
route('DELETE', '/api/admin/fb/:id', async (ctx) => { football.adminDelete(ctx.params.id); return { ok: true }; }, A);

// ---------------- Server ----------------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const pathname = url.pathname;
  try {
    if (pathname === '/health') return send(res, 200, { ok: true, t: Date.now() });
    if (pathname === WEBHOOK_PATH && req.method === 'POST') {
      if (req.headers['x-telegram-bot-api-secret-token'] !== WEBHOOK_SECRET) { res.writeHead(403); return res.end(); }
      const upd = await readBody(req);
      res.writeHead(200); res.end('ok');
      bot.handleUpdate(upd);
      return;
    }
    if (!pathname.startsWith('/api/')) return serveStatic(req, res, pathname);
    if (!cfg.BOT_TOKEN && !cfg.DEV) return send(res, 503, { error: 'BOT_TOKEN o\'rnatilmagan' });
    const r = routes.find((x) => x.method === req.method && x.re.test(pathname));
    if (!r) return send(res, 404, { error: 'Topilmadi' });
    const m = pathname.match(r.re);
    const params = {}; r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
    const ctx = { req, res, params, query: url.searchParams, opts: r.opts, body: {} };
    if (req.method === 'POST' || req.method === 'PUT') ctx.body = await readBody(req);
    if (!r.opts.public) await requireUser(ctx);
    const out = await r.handler(ctx);
    if (out !== null && !res.headersSent) send(res, 200, out);
  } catch (e) {
    if (res.headersSent) return;
    if (e instanceof HttpError) return send(res, e.code, { error: e.message, ...(e.extra || {}) });
    if (!(e && e.message)) console.error(e);
    send(res, 400, { error: (e && e.message) || 'Xatolik' });
  }
});

// ---------------- Telegram: webhook yoki polling ----------------
let polling = false;
async function startPolling() {
  polling = true;
  try { await tg.call('deleteWebhook', {}); } catch (e) { }
  let offset = 0;
  while (polling) {
    try {
      const ups = await tg.call('getUpdates', { offset, timeout: 50, allowed_updates: ['message', 'my_chat_member', 'inline_query'] });
      for (const u of ups) { offset = u.update_id + 1; bot.handleUpdate(u); }
    } catch (e) { console.error('[poll]', e.message); await new Promise((r) => setTimeout(r, 3000)); }
  }
}

async function main() {
  if (!cfg.BOT_TOKEN && !cfg.DEV) console.error('\n⚠️  BOT_TOKEN o\'rnatilmagan! Render → Environment bo\'limida BOT_TOKEN qo\'shing.\n');
  if (!db.loadLocal()) await db.restoreFromTelegram();
  try {
    const me = await bot.setup();
    daily.setBotUsername(me.username);
    console.log('[bot] @' + me.username);
  } catch (e) { console.error('[bot] getMe xatosi (token to\'g\'rimi?):', e.message); }

  server.listen(cfg.PORT, () => console.log(`[server] ${cfg.PORT}-portda ishga tushdi. URL: ${cfg.PUBLIC_URL || '(aniqlanmadi)'}${cfg.DEV ? ' [DEV]' : ''}`));

  if (cfg.BOT_TOKEN && !cfg.DEV) {
    if (cfg.PUBLIC_URL) {
      try {
        await tg.call('setWebhook', { url: cfg.PUBLIC_URL + WEBHOOK_PATH, secret_token: WEBHOOK_SECRET, allowed_updates: ['message', 'my_chat_member', 'inline_query'], drop_pending_updates: false });
        console.log('[bot] webhook o\'rnatildi');
      } catch (e) { console.error('[bot] webhook xatosi, polling ishlatiladi:', e.message); startPolling(); }
    } else {
      console.warn('[bot] PUBLIC_URL topilmadi — polling rejimi (Mini App tugmasi uchun PUBLIC_URL kerak)');
      startPolling();
    }
  }

  setInterval(() => daily.tick(), 30e3);
  setTimeout(() => daily.tick(), 5000);
  setInterval(() => db.backupToTelegram(), 3 * 60e3);
  setTimeout(() => db.backupToTelegram(true), 60e3);

  // Bepul Render serveri "uxlab" qolmasligi uchun o'ziga murojaat qilib turadi
  if (cfg.PUBLIC_URL && cfg.IS_RENDER) {
    setInterval(() => { fetch(cfg.PUBLIC_URL + '/health').catch(() => { }); }, 9 * 60e3);
  }
}

async function shutdown() {
  console.log('[server] to\'xtatilmoqda, ma\'lumotlar saqlanmoqda...');
  db.flush();
  try { await Promise.race([db.backupToTelegram(true), new Promise((r) => setTimeout(r, 8000))]); } catch (e) { }
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('unhandledRejection', (e) => console.error('[unhandled]', e));

main();
