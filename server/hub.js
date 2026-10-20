'use strict';
// Real vaqt rejimi: Server-Sent Events (SSE) orqali kanallarga xabar tarqatish
const crypto = require('crypto');

const channels = new Map();   // kanal -> Set(client)
const tokens = new Map();     // stream token -> { uid, exp }
const leaveHooks = [];        // (channel, uid) => void
const joinHooks = [];

function issueToken(uid) {
  const t = crypto.randomBytes(18).toString('base64url');
  tokens.set(t, { uid, exp: Date.now() + 24 * 3600e3 });
  return t;
}
function tokenUid(t) {
  const r = tokens.get(t);
  if (!r || r.exp < Date.now()) return null;
  return r.uid;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of tokens) if (v.exp < now) tokens.delete(k); }, 3600e3).unref();

function attach(req, res, uid, chs) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 2000\n\n');
  const client = { res, uid, chs };
  for (const ch of chs) {
    if (!channels.has(ch)) channels.set(ch, new Set());
    channels.get(ch).add(client);
    for (const h of joinHooks) { try { h(ch, uid); } catch (e) { console.error(e); } }
  }
  req.on('close', () => {
    for (const ch of chs) {
      const set = channels.get(ch);
      if (set) { set.delete(client); if (!set.size) channels.delete(ch); }
      for (const h of leaveHooks) { try { h(ch, uid); } catch (e) { console.error(e); } }
    }
  });
}

function publish(ch, event, data) {
  const set = channels.get(ch);
  if (!set) return;
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of set) { try { c.res.write(msg); } catch (e) { } }
}

// Kanaldagi har bir mijozga alohida (masalan, foydalanuvchiga moslangan) ma'lumot
function publishEach(ch, event, fn) {
  const set = channels.get(ch);
  if (!set) return;
  for (const c of set) {
    try { c.res.write(`event: ${event}\ndata: ${JSON.stringify(fn(c.uid))}\n\n`); } catch (e) { }
  }
}

function present(ch, uid) {
  const set = channels.get(ch);
  if (!set) return false;
  for (const c of set) if (c.uid === uid) return true;
  return false;
}
function count(ch) { const s = channels.get(ch); return s ? s.size : 0; }

setInterval(() => {
  for (const set of channels.values()) for (const c of set) { try { c.res.write(': ping\n\n'); } catch (e) { } }
}, 20000).unref();

module.exports = {
  issueToken, tokenUid, attach, publish, publishEach, present, count,
  onLeave: (fn) => leaveHooks.push(fn), onJoin: (fn) => joinHooks.push(fn),
  toUser: (uid, event, data) => publish('u:' + uid, event, data),
};
