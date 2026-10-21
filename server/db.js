'use strict';
// Oddiy JSON ma'lumotlar bazasi + Telegram'ga avtomatik zaxira nusxa
// (bepul serverlarda disk o'chib ketsa ham ma'lumotlar yo'qolmaydi)
const fs = require('fs');
const path = require('path');
const cfg = require('./config');
const tg = require('./tg');

const FILE = path.join(cfg.DATA_DIR, 'db.json');
const BACKUP_NAME = 'ukademik-backup.json';

function defaults() {
  return {
    v: 1,
    users: {},
    daily: { seq: 0, questions: [], settings: { openTime: '10:00', closeTime: '22:00' } },
    svoyak: { games: {} },
    tosiq: { history: [] },
    football: { seq: 0, matches: [] },
    bank: { seq: 0, items: [], progress: {} },
    penalty: { tournaments: {}, history: [] },
    groups: {},
    meta: { createdAt: Date.now(), backup: null, superAdmins: [] },
  };
}

let data = defaults();
let saveTimer = null;
let backupDirty = false;
let lastBackupAt = 0;

function merge(target, src) {
  for (const k of Object.keys(src)) {
    if (target[k] === undefined) target[k] = src[k];
    else if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && typeof target[k] === 'object') merge(target[k], src[k]);
  }
  return target;
}

function loadLocal() {
  try {
    if (fs.existsSync(FILE)) {
      data = merge(JSON.parse(fs.readFileSync(FILE, 'utf8')), defaults());
      console.log('[db] lokal fayldan yuklandi');
      return true;
    }
  } catch (e) { console.error('[db] lokal faylni o\'qib bo\'lmadi:', e.message); }
  return false;
}

function writeLocal() {
  try {
    fs.mkdirSync(cfg.DATA_DIR, { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, FILE);
  } catch (e) { console.error('[db] saqlashda xato:', e.message); }
}

function save() {
  backupDirty = true;
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; writeLocal(); }, 1500);
}

function flush() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  writeLocal();
}

// ---------- Telegram zaxira ----------
// Zaxira kanal adminining bot bilan shaxsiy chatida "pin" qilingan fayl sifatida saqlanadi.
let adminCandidates = async () => [];
function setAdminCandidates(fn) { adminCandidates = fn; }

async function findBackupChat() {
  const ids = await adminCandidates();
  for (const id of ids) {
    try {
      const chat = await tg.call('getChat', { chat_id: id });
      return { chatId: id, pinned: chat.pinned_message };
    } catch (e) { /* foydalanuvchi botni hali ishga tushirmagan */ }
  }
  return null;
}

async function restoreFromTelegram() {
  if (cfg.DEV || !cfg.BOT_TOKEN) return false;
  try {
    const ids = await adminCandidates();
    for (const id of ids) {
      let chat;
      try { chat = await tg.call('getChat', { chat_id: id }); } catch (e) { continue; }
      const doc = chat.pinned_message && chat.pinned_message.document;
      if (doc && doc.file_name === BACKUP_NAME) {
        const buf = await tg.downloadFile(doc.file_id);
        if (!buf) continue;
        data = merge(JSON.parse(buf.toString('utf8')), defaults());
        data.meta.backup = { chatId: id, msgId: chat.pinned_message.message_id };
        writeLocal();
        console.log('[db] Telegram zaxirasidan tiklandi (chat ' + id + ')');
        return true;
      }
    }
  } catch (e) { console.error('[db] zaxiradan tiklashda xato:', e.message); }
  return false;
}

async function backupToTelegram(force = false) {
  if (cfg.DEV || !cfg.BOT_TOKEN) return;
  if (!backupDirty && !force) return;
  try {
    const json = Buffer.from(JSON.stringify(data));
    const caption = '📦 Ukademik bot ma\'lumotlari zaxirasi.\nBu xabarni o\'chirmang va pindan olmang — bot o\'zi yangilab turadi.\n🕒 ' + new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
    let b = data.meta.backup;
    if (b && b.msgId) {
      try {
        await tg.callFile('editMessageMedia', {
          chat_id: b.chatId, message_id: b.msgId,
          media: { type: 'document', media: 'attach://file', caption },
        }, 'file', json, BACKUP_NAME, 'application/json');
        backupDirty = false; lastBackupAt = Date.now();
        return;
      } catch (e) {
        if (!/not modified/i.test(e.message)) { console.warn('[db] zaxirani tahrirlab bo\'lmadi, yangisi yuboriladi:', e.message); b = null; }
        else { backupDirty = false; return; }
      }
    }
    const target = await findBackupChat();
    if (!target) return; // hali hech bir admin botni ishga tushirmagan
    const msg = await tg.callFile('sendDocument', {
      chat_id: target.chatId, caption, disable_notification: true,
    }, 'document', json, BACKUP_NAME, 'application/json');
    try { await tg.call('pinChatMessage', { chat_id: target.chatId, message_id: msg.message_id, disable_notification: true }); } catch (e) { }
    data.meta.backup = { chatId: target.chatId, msgId: msg.message_id };
    writeLocal();
    backupDirty = false; lastBackupAt = Date.now();
    console.log('[db] yangi zaxira yaratildi');
  } catch (e) { console.error('[db] zaxira xatosi:', e.message); }
}

// Rasm saqlash: zaxira chatga yuborib file_id olinadi
async function storePhoto(buffer) {
  if (cfg.DEV || !cfg.BOT_TOKEN) return null;
  const target = data.meta.backup ? { chatId: data.meta.backup.chatId } : await findBackupChat();
  if (!target) return null;
  const msg = await tg.callFile('sendPhoto', { chat_id: target.chatId, caption: '🖼 Savol rasmi (bot uchun saqlandi)', disable_notification: true }, 'photo', buffer, 'image.jpg', 'image/jpeg');
  const sizes = msg.photo || [];
  return sizes.length ? sizes[sizes.length - 1].file_id : null;
}

module.exports = {
  get: () => data,
  loadLocal, restoreFromTelegram, save, flush, backupToTelegram, setAdminCandidates, storePhoto,
  status: () => ({ backup: data.meta.backup, lastBackupAt, dirty: backupDirty }),
};
