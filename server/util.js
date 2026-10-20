'use strict';
const crypto = require('crypto');
const cfg = require('./config');

function rid(n = 8) {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  const b = crypto.randomBytes(n);
  let s = '';
  for (let i = 0; i < n; i++) s += abc[b[i] % abc.length];
  return s;
}
function digits(n) {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  if (s[0] === '0') s = String(1 + Math.floor(Math.random() * 9)) + s.slice(1);
  return s;
}

// Toshkent vaqti
function tzNow(ts = Date.now()) {
  const d = new Date(ts + cfg.TZ_OFFSET_MIN * 60e3);
  return {
    date: d.toISOString().slice(0, 10),
    hm: d.toISOString().slice(11, 16),
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}
// 'YYYY-MM-DD' + 'HH:MM' (Toshkent) -> UTC ms
function tzToTs(date, hm) {
  const [h, m] = (hm || '00:00').split(':').map(Number);
  return Date.parse(date + 'T00:00:00Z') + (h * 60 + m - cfg.TZ_OFFSET_MIN) * 60e3;
}
function addDays(date, n) {
  return new Date(Date.parse(date + 'T00:00:00Z') + n * 86400e3).toISOString().slice(0, 10);
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ---------- Javoblarni solishtirish (lotin/kirill, apostroflar, kichik xatolar) ----------
const CYR = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 's', ч: 'ch', ш: 'sh', щ: 'sh',
  ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h', і: 'i', ї: 'yi', є: 'ye',
};
function norm(s) {
  s = String(s || '').toLowerCase();
  s = [...s].map((ch) => (CYR[ch] !== undefined ? CYR[ch] : ch)).join('');
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  s = s.replace(/[ʻʼ'`’‘´ʹ"«»“”„]/g, '');
  s = s.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}
function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = new Array(n + 1), cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}
// "Amir Temur [Ko'ragoniy]" -> ["Amir Temur Ko'ragoniy", "Amir Temur"]
function expandOptional(ans) {
  const out = [ans.replace(/[\[\]]/g, ' ')];
  if (/\[.*?\]/.test(ans)) out.push(ans.replace(/\[.*?\]/g, ' '));
  return out;
}
function isCorrect(answer, accepted) {
  const a = norm(answer);
  if (!a) return false;
  for (const raw of accepted || []) {
    for (const acc of expandOptional(raw)) {
      const b = norm(acc);
      if (!b) continue;
      if (a === b) return true;
      if (a.replace(/ /g, '') === b.replace(/ /g, '')) return true;
      const tol = b.length <= 4 ? 0 : b.length <= 8 ? 1 : b.length <= 15 ? 2 : 3;
      if (Math.abs(a.length - b.length) <= tol && lev(a, b) <= tol) return true;
    }
  }
  return false;
}

module.exports = { rid, digits, tzNow, tzToTs, addDays, esc, norm, lev, isCorrect };
