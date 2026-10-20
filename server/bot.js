'use strict';
// Bot xabarlariga javob berish
const cfg = require('./config');
const tg = require('./tg');
const db = require('./db');
const users = require('./users');

let botUsername = 'bot';
function setUsername(u) { botUsername = u; }

function appUrl(route) {
  const base = cfg.PUBLIC_URL || '';
  return route ? `${base}/?r=${encodeURIComponent(route)}` : `${base}/`;
}

const ROUTES = {
  daily: ['🧠 Kunlik savolni ochish', 'daily', '🧠 <b>Kunlik Zakovat savoli</b>\n\nSavolni ochish uchun pastdagi tugmani bosing. Esingizda bo\'lsin: savol ochilgach vaqt hisoblana boshlaydi! ⏱'],
  rating: ['🏆 Reytingni ko\'rish', 'rating', '🏆 Ukademik reytingi'],
  timer: ['⏱ Zakovat soati', 'timer', '⏱ Zakovat soati — o\'yin taymeri'],
  football: ['⚽ Futbol', 'football', '⚽ Prognoz va penalti'],
  admin: ['⚙️ Admin panel', 'admin', '⚙️ Admin panel'],
};

async function sendWelcome(chatId, payload) {
  let btnText = '🚀 Ilovani ochish', route = '', text;
  if (payload && ROUTES[payload]) {
    [btnText, route, text] = ROUTES[payload];
  } else if (payload && payload.startsWith('sv_')) {
    route = 'sv/' + payload.slice(3);
    btnText = '🎯 Svoyak o\'yinini ochish';
    const g = db.get().svoyak.games[payload.slice(3)];
    text = g ? `🎯 <b>Svoyak: ${g.title.replace(/[<>&]/g, '')}</b>\n\nO'yinni jonli kuzatish uchun tugmani bosing. Qatnashmoqchi bo'lsangiz, ichkarida turnir kodini kiriting.` : '🎯 Svoyak o\'yini';
  } else if (payload && payload.startsWith('q_')) {
    route = 'q/join/' + payload.slice(2);
    btnText = '🧱 O\'yinga qo\'shilish';
    text = '🧱 <b>To\'siq</b>\n\nDo\'stingiz sizni o\'yinga chaqirdi! Qo\'shilish uchun tugmani bosing.';
  }
  if (!text) {
    text = '🎓 <b>Ukademik</b> — Ukademiklar kanalining intellektual o\'yinlar boti!\n\n' +
      '🧠 <b>Kunlik savol</b> — eng tez to\'g\'ri javob bergan ko\'proq ball oladi\n' +
      '⏱ <b>Zakovat soati</b> — o\'yin taymeri\n' +
      '🎯 <b>Svoyak</b> — boshlovchi bilan jonli o\'yin\n' +
      '🧱 <b>To\'siq</b> — aqliy strategiya o\'yini\n' +
      '⚽ <b>Futbol</b> — prognoz va penalti\n\n' +
      'Boshlash uchun pastdagi tugmani bosing 👇';
  }
  const kb = [[{ text: btnText, web_app: { url: appUrl(route) } }]];
  if (!payload && cfg.CHANNEL_LINK) kb.push([{ text: '📢 Ukademiklar kanali', url: cfg.CHANNEL_LINK }]);
  await tg.call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', reply_markup: { inline_keyboard: kb }, link_preview_options: { is_disabled: true } });
}

async function handleUpdate(upd) {
  try {
    const msg = upd.message;
    if (!msg || !msg.chat || msg.chat.type !== 'private' || !msg.from) return;
    const text = (msg.text || '').trim();
    const uid = msg.from.id;
    if (text.startsWith('/start')) {
      const payload = text.split(/\s+/)[1] || '';
      await sendWelcome(msg.chat.id, payload);
      // Admin botni ishga tushirgan bo'lsa — zaxira uchun chat paydo bo'ladi
      if (!db.get().meta.backup && await users.isAdmin(uid)) setTimeout(() => db.backupToTelegram(true), 3000);
      return;
    }
    if (text === '/admin') {
      if (await users.isAdmin(uid)) await sendWelcome(msg.chat.id, 'admin');
      else await tg.call('sendMessage', { chat_id: msg.chat.id, text: 'Admin panel faqat Ukademiklar kanali adminlari uchun.' });
      return;
    }
    if (text === '/savol') return sendWelcome(msg.chat.id, 'daily');
    if (text === '/reyting') return sendWelcome(msg.chat.id, 'rating');
    if (text === '/soat') return sendWelcome(msg.chat.id, 'timer');
    await sendWelcome(msg.chat.id, '');
  } catch (e) { console.error('[bot] xato:', e.message); }
}

async function setup() {
  const me = await tg.call('getMe');
  botUsername = me.username;
  if (cfg.DEV || !cfg.BOT_TOKEN) return me;
  try {
    await tg.call('setMyCommands', {
      commands: [
        { command: 'start', description: 'Ilovani ochish' },
        { command: 'savol', description: 'Kunlik Zakovat savoli' },
        { command: 'soat', description: 'Zakovat soati (taymer)' },
        { command: 'reyting', description: 'Reyting' },
        { command: 'admin', description: 'Admin panel' },
      ],
    });
    if (cfg.PUBLIC_URL) {
      await tg.call('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Ochish', web_app: { url: appUrl('') } } });
    }
    await tg.call('setMyDescription', { description: '🎓 Ukademiklar kanalining intellektual o\'yinlar boti: kunlik Zakovat savoli, Zakovat soati, Svoyak, To\'siq va futbol prognozlari.' }).catch(() => { });
    await tg.call('setMyShortDescription', { short_description: 'Zakovat, Svoyak, aqliy o\'yinlar va futbol — Ukademiklar uchun' }).catch(() => { });
  } catch (e) { console.error('[bot] sozlashda xato:', e.message); }
  return me;
}

module.exports = { handleUpdate, setup, setUsername, appUrl, username: () => botUsername };
