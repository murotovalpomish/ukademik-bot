'use strict';
// Telegram Bot API bilan ishlash (kutubxonasiz, Node 18+ fetch orqali)
const cfg = require('./config');

const API = 'https://api.telegram.org';
let devMsgId = 1000;

function devMock(method, p) {
  switch (method) {
    case 'getMe': return { id: 1, is_bot: true, first_name: 'Ukademik', username: 'ukademik_dev_bot' };
    case 'getChatMember': return { status: 'member', user: { id: p.user_id } };
    case 'getChatAdministrators': return [{ status: 'creator', user: { id: 1, first_name: 'Admin' } }];
    case 'getUserProfilePhotos': return { total_count: 0, photos: [] };
    case 'getChat': return { id: p.chat_id, type: 'private' };
    case 'sendMessage': case 'sendPhoto': case 'sendDocument': case 'editMessageMedia':
      if (method !== 'editMessageMedia') console.log('[DEV tg]', method, JSON.stringify(p).slice(0, 300));
      return { message_id: ++devMsgId, photo: [{ file_id: 'dev_photo_' + devMsgId, width: 800 }], document: { file_id: 'dev_doc' } };
    default: return true;
  }
}

async function call(method, params = {}) {
  if (cfg.DEV || !cfg.BOT_TOKEN) return devMock(method, params);
  const res = await fetch(`${API}/bot${cfg.BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params),
  });
  let j;
  try { j = await res.json(); } catch (e) { throw new Error(`${method}: HTTP ${res.status}`); }
  if (!j.ok) {
    const err = new Error(`${method}: ${j.description}`);
    err.code = j.error_code; err.parameters = j.parameters;
    throw err;
  }
  return j.result;
}

// Fayl yuborish (multipart)
async function callFile(method, fields, fileField, buffer, filename, mime) {
  if (cfg.DEV || !cfg.BOT_TOKEN) return devMock(method, fields);
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    fd.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  fd.append(fileField, new Blob([buffer], { type: mime }), filename);
  const res = await fetch(`${API}/bot${cfg.BOT_TOKEN}/${method}`, { method: 'POST', body: fd });
  const j = await res.json();
  if (!j.ok) { const err = new Error(`${method}: ${j.description}`); err.code = j.error_code; throw err; }
  return j.result;
}

async function downloadFile(fileId) {
  if (cfg.DEV || !cfg.BOT_TOKEN) return null;
  const f = await call('getFile', { file_id: fileId });
  if (!f.file_path) return null;
  const res = await fetch(`${API}/file/bot${cfg.BOT_TOKEN}/${f.file_path}`);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

module.exports = { call, callFile, downloadFile };
