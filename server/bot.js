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
  football: ['⚽ Penalti', 'penalty', '⚽ Penalti — do\'stlar bilan, onlayn va turnirlar'],
  admin: ['⚙️ Admin panel', 'admin', '⚙️ Admin panel'],
  penalty: ['⚽ Penalti', 'penalty', '⚽ Penalti — do\'stlar bilan, onlayn va turnirlar'],
  tosiq: ['🧱 To\'siq', 'tosiq', '🧱 To\'siq — aqliy strategiya o\'yini'],
  group: ['🚀 Ilovani ochish', '', ''],
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
  } else if (payload && payload.startsWith('pj_')) {
    route = 'pen/join/' + payload.slice(3);
    btnText = '⚽ Penalti o\'yiniga kirish';
    text = '⚽ <b>Penalti</b>\n\nSizni penalti o\'yiniga chaqirishdi! Kirish uchun tugmani bosing.';
  } else if (payload && payload.startsWith('pt_')) {
    route = 'pt/' + payload.slice(3);
    btnText = '🏆 Turnirni ochish';
    text = '🏆 <b>Penalti turniri</b>\n\nTurnirni ko\'rish yoki qatnashish uchun tugmani bosing.';
  } else if (payload && payload.startsWith('q_')) {
    route = 'q/join/' + payload.slice(2);
    btnText = '🧱 O\'yinga qo\'shilish';
    text = '🧱 <b>To\'siq</b>\n\nDo\'stingiz sizni o\'yinga chaqirdi! Qo\'shilish uchun tugmani bosing.';
  }
  if (!text) {
    text = '🎓 <b>Ukademik</b> — Ukademiklar kanalining intellektual o\'yinlar boti!\n\n' +
      '🧠 <b>Kunlik savol</b> — eng tez to\'g\'ri javob bergan ko\'proq ball oladi\n' +
      '📚 <b>Zakovat savollari</b> — mashq uchun savollar bazasi\n' +
      '🎯 <b>Shaxsiy o\'yin</b> — boshlovchi bilan onlayn Svoyak\n' +
      '⏱ <b>Zakovat soati</b> — o\'yin taymeri\n' +
      '⚽ <b>Penalti</b> va 🧱 <b>To\'siq</b> — do\'stlar bilan, onlayn va turnirlarda\n\n' +
      'Boshlash uchun pastdagi tugmani bosing 👇';
  }
  const kb = [[{ text: btnText, web_app: { url: appUrl(route) } }]];
  if (!payload && cfg.CHANNEL_LINK) kb.push([{ text: '📢 Ukademiklar kanali', url: cfg.CHANNEL_LINK }]);
  await tg.call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', reply_markup: { inline_keyboard: kb }, link_preview_options: { is_disabled: true } });
}

let penalty = null, tosiq = null;
function setGames(p, t) { penalty = p; tosiq = t; }

function trackChat(mcm) {
  const c = mcm.chat;
  if (!c || c.type === 'private') return;
  const g = db.get().groups;
  g[c.id] = {
    id: c.id, title: c.title || '', type: c.type, username: c.username || null, status: mcm.new_chat_member.status,
    by: mcm.from ? { id: mcm.from.id, name: [mcm.from.first_name, mcm.from.last_name].filter(Boolean).join(' ') } : null,
    at: Date.now(), since: (g[c.id] && g[c.id].since) || Date.now(),
  };
  db.save();
}

async function groupCommand(msg, cmd) {
  const from = msg.from;
  const name = [from.first_name, from.last_name].filter(Boolean).join(' ');
  if (cmd === 'penalti' && penalty) {
    const m = penalty.groupInvite(from);
    await tg.call('sendMessage', {
      chat_id: msg.chat.id, parse_mode: 'HTML',
      text: `⚽ <b>${name.replace(/[<>&]/g, '')}</b> penalti o'yiniga chaqirmoqda!\nKim birinchi qabul qilsa — o'sha bilan o'ynaydi. Har bir zarbaga 7 soniya!`,
      reply_markup: { inline_keyboard: [[{ text: '⚽ Qabul qilish', url: `https://t.me/${botUsername}?start=pj_${m.code}` }]] },
    });
  } else if (cmd === 'tosiq' && tosiq) {
    const g = tosiq.friendCreate(from.id, name);
    await tg.call('sendMessage', {
      chat_id: msg.chat.id, parse_mode: 'HTML',
      text: `🧱 <b>${name.replace(/[<>&]/g, '')}</b> To'siq o'yiniga chaqirmoqda! Birinchi qabul qilgan o'ynaydi.`,
      reply_markup: { inline_keyboard: [[{ text: '🧱 Qabul qilish', url: `https://t.me/${botUsername}?start=q_${g.code}` }]] },
    });
  } else if (cmd === 'start' || cmd === 'help' || cmd === 'oyin') {
    await tg.call('sendMessage', {
      chat_id: msg.chat.id, parse_mode: 'HTML',
      text: '🎓 <b>Ukademik</b> o\'yinlari:\n/penalti — penalti bellashuvi\n/tosiq — To\'siq aqliy o\'yini\n\nIlovani ochish uchun tugmani bosing 👇',
      reply_markup: { inline_keyboard: [[{ text: '🚀 Ilovani ochish', url: `https://t.me/${botUsername}?start=group` }]] },
    });
  }
}

async function inlineQuery(iq) {
  if (!penalty || !tosiq) return;
  const name = [iq.from.first_name, iq.from.last_name].filter(Boolean).join(' ');
  const pm = penalty.groupInvite(iq.from);
  const tq = tosiq.friendCreate(iq.from.id, name);
  await tg.call('answerInlineQuery', {
    inline_query_id: iq.id, cache_time: 0, is_personal: true,
    results: [
      { type: 'article', id: 'pen' + pm.code, title: '⚽ Penalti o\'ynash', description: 'Do\'stingizni penalti bellashuviga chaqiring',
        input_message_content: { message_text: `⚽ ${name} sizni penalti o'yiniga chaqirmoqda! Har bir zarbaga 7 soniya.` },
        reply_markup: { inline_keyboard: [[{ text: '⚽ Qabul qilish', url: `https://t.me/${botUsername}?start=pj_${pm.code}` }]] } },
      { type: 'article', id: 'ts' + tq.code, title: '🧱 To\'siq o\'ynash', description: 'Aqliy strategiya o\'yiniga chaqiring',
        input_message_content: { message_text: `🧱 ${name} sizni To'siq o'yiniga chaqirmoqda!` },
        reply_markup: { inline_keyboard: [[{ text: '🧱 Qabul qilish', url: `https://t.me/${botUsername}?start=q_${tq.code}` }]] } },
    ],
  });
}

async function handleUpdate(upd) {
  try {
    if (upd.my_chat_member) return trackChat(upd.my_chat_member);
    if (upd.inline_query) return inlineQuery(upd.inline_query);
    const msg = upd.message;
    if (msg && msg.chat && (msg.chat.type === 'group' || msg.chat.type === 'supergroup') && msg.text && msg.text.startsWith('/')) {
      const m = msg.text.match(/^\/(\w+)(@(\w+))?/);
      if (m && (!m[3] || m[3].toLowerCase() === String(botUsername).toLowerCase())) await groupCommand(msg, m[1].toLowerCase());
      return;
    }
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
    if (text === '/penalti') return sendWelcome(msg.chat.id, 'penalty');
    if (text === '/tosiq') return sendWelcome(msg.chat.id, 'tosiq');
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
        { command: 'penalti', description: 'Penalti o\'yini (guruhda ham ishlaydi)' },
        { command: 'tosiq', description: 'To\'siq o\'yini (guruhda ham ishlaydi)' },
      ],
    });
    if (cfg.PUBLIC_URL) {
      await tg.call('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Ochish', web_app: { url: appUrl('') } } });
    }
    await tg.call('setMyDescription', { description: '🎓 Ukademiklar kanalining intellektual o\'yinlar boti: kunlik Zakovat savoli, savollar bazasi, Shaxsiy o\'yin (onlayn Svoyak), Zakovat soati, Penalti va To\'siq o\'yinlari.\n\nBoshlash uchun «Start» tugmasini bosing 👇' }).catch(() => { });
    await tg.call('setMyShortDescription', { short_description: 'Zakovat, Svoyak va aqliy o\'yinlar — Ukademiklar uchun' }).catch(() => { });
  } catch (e) { console.error('[bot] sozlashda xato:', e.message); }
  return me;
}

async function notifyTour(uid, t, opName) {
  try {
    await tg.call('sendMessage', {
      chat_id: uid, parse_mode: 'HTML',
      text: `⚽ <b>${t.title.replace(/[<>&]/g, '')}</b>\nNavbatdagi o'yiningiz tayyor! Raqib: <b>${String(opName).replace(/[<>&]/g, '')}</b>`,
      reply_markup: { inline_keyboard: [[{ text: '⚽ O\'ynash', web_app: { url: appUrl('pt/' + t.id) } }]] },
    });
  } catch (e) { }
}

module.exports = { setGames, notifyTour, handleUpdate, setup, setUsername, appUrl, username: () => botUsername };
