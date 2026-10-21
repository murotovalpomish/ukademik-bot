// ============ Ukademik — yadro: API, router, UI yordamchilar ============
'use strict';
const TG = (window.Telegram && Telegram.WebApp && Telegram.WebApp.initData) ? Telegram.WebApp : null;
const QS = new URLSearchParams(location.search);
const DEV_USER = QS.get('dev');
const App = { user: null, isAdmin: false, bot: '', channelLink: '', pages: {}, stack: [], cur: null, cleanups: [] };

// ---------- API ----------
function apiHeaders() {
  const h = { 'content-type': 'application/json' };
  if (TG) h['x-init-data'] = TG.initData;
  else if (DEV_USER) h['x-dev-user'] = DEV_USER;
  return h;
}
async function api(path, body, method) {
  const opts = { method: method || (body !== undefined ? 'POST' : 'GET'), headers: apiHeaders() };
  if (body !== undefined && opts.method !== 'GET') opts.body = JSON.stringify(body);
  let r;
  try { r = await fetch(path, opts); } catch (e) { throw new Error('Internet bilan aloqa yo\'q'); }
  let j = {};
  try { j = await r.json(); } catch (e) { }
  if (!r.ok) {
    const err = new Error(j.error || 'Xatolik yuz berdi');
    err.status = r.status; err.data = j;
    if (j.gate && App.user) { App.user = null; go('gate', {}, { root: true }); }
    throw err;
  }
  return j;
}
const post = (p, b) => api(p, b || {}, 'POST');
const del = (p) => api(p, {}, 'DELETE');

// ---------- Real vaqt (SSE) ----------
function stream(chs, handlers) {
  let es = null, closed = false;
  (async () => {
    try {
      const { t } = await post('/api/stream-token');
      if (closed) return;
      es = new EventSource(`/api/stream?t=${encodeURIComponent(t)}&ch=${encodeURIComponent(chs.join(','))}`);
      for (const [ev, fn] of Object.entries(handlers)) es.addEventListener(ev, (e) => { try { fn(JSON.parse(e.data)); } catch (er) { console.error(er); } });
      if (handlers.open) es.onopen = handlers.open;
    } catch (e) { console.error('stream', e); }
  })();
  return () => { closed = true; if (es) es.close(); };
}

// ---------- Yordamchilar ----------
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const COLORS = ['#5b7cfa', '#f06595', '#20c997', '#fd7e14', '#845ef7', '#22b8cf', '#e64980', '#40c057', '#fab005', '#4c6ef5'];
function av(u, size = 40, extra = '') {
  if (!u) return `<div class="av" style="--s:${size}px;--c:#adb5bd">?</div>`;
  const c = COLORS[Math.abs(hash(String(u.id || u.name))) % COLORS.length];
  const ini = esc((u.name || '?').trim().split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase());
  const img = u.avatar ? `<img src="${esc(u.avatar)}" alt="" onerror="this.remove()">` : '';
  return `<div class="av ${extra}" style="--s:${size}px;--c:${c}">${ini}${img ? `<span style="position:absolute;inset:0">${img}</span>` : ''}</div>`;
}
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
function toast(text, type) {
  const el = document.createElement('div');
  el.className = 'toast ' + (type || '');
  el.textContent = text;
  const box = $('#toasts');
  while (box.children.length >= 2) box.firstChild.remove();
  box.appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2800);
}
function errToast(e) { toast(e && e.message ? e.message : String(e), 'err'); haptic('error'); }
function haptic(kind) {
  try {
    const h = TG && TG.HapticFeedback;
    if (!h) { if (navigator.vibrate && (kind === 'heavy' || kind === 'error')) navigator.vibrate(kind === 'heavy' ? 40 : [30, 40, 30]); return; }
    if (kind === 'success' || kind === 'error' || kind === 'warning') h.notificationOccurred(kind);
    else if (kind === 'select') h.selectionChanged();
    else h.impactOccurred(kind || 'light');
  } catch (e) { }
}
function modal(title, bodyHtml, actions) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal"><h3>${title}</h3><div class="mb-body">${bodyHtml}</div>${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;
  document.body.appendChild(bg);
  const close = () => { bg.remove(); };
  bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
  return { el: $('.modal', bg), close };
}
function confirmDlg(text, okText = 'Ha', danger) {
  return new Promise((res) => {
    const m = modal(text, '', `<button class="btn plain" data-v="0">Yo'q</button><button class="btn ${danger ? 'red' : ''}" data-v="1">${okText}</button>`);
    $$('[data-v]', m.el).forEach((b) => b.onclick = () => { m.close(); res(b.dataset.v === '1'); });
  });
}
function promptDlg(title, { value = '', placeholder = '', type = 'text', okText = 'Saqlash' } = {}) {
  return new Promise((res) => {
    const m = modal(title, `<input class="input" id="pd" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}">`, `<button class="btn plain" data-v="0">Bekor</button><button class="btn" data-v="1">${okText}</button>`);
    const inp = $('#pd', m.el); setTimeout(() => inp.focus(), 50);
    $$('[data-v]', m.el).forEach((b) => b.onclick = () => { m.close(); res(b.dataset.v === '1' ? inp.value : null); });
  });
}
const TZ = 'Asia/Tashkent';
function fmtDate(ts, opts) { return new Intl.DateTimeFormat('uz-UZ', { timeZone: TZ, ...(opts || { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }).format(new Date(ts)); }
function fmtTime(ts) { return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(ts)); }
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
function fmtDay(dateStr) { const [y, m, d] = dateStr.split('-').map(Number); return `${d}-${MONTHS[m - 1]}`; }
function fmtDT(ts) {
  const d = new Date(ts + 5 * 3600e3);
  return `${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}
function timeLeft(ms) {
  if (ms <= 0) return '0:00';
  const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h ? `${h} soat ${m} daq` : `${m}:${String(ss).padStart(2, '0')}`;
}
function plural(n, w) { return `${n} ${w}`; }

// Rasmni kichraytirish (profil rasmi, savol rasmi)
function pickImage(maxSize, square, quality = 0.82) {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = () => {
      const f = inp.files[0]; if (!f) return resolve(null);
      const img = new Image();
      img.onload = () => {
        let { width: w, height: h } = img, sx = 0, sy = 0, sw = w, sh = h;
        if (square) { const m = Math.min(w, h); sx = (w - m) / 2; sy = (h - m) / 2; sw = sh = m; w = h = Math.min(m, maxSize); }
        else { const k = Math.min(1, maxSize / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k); }
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', quality));
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(f);
    };
    inp.click();
  });
}

// ---------- Ovoz ----------
// Tovushlar WAV fayl sifatida yaratiladi va <audio> orqali chalinadi:
// iPhone "jim" rejimida ham, Telegram ichida ham ishonchli eshitiladi.
const SND_NOTES = {
  start: [[880, 0, .32, 'tri', .9], [1320, .05, .25, 'sin', .35]],
  mid: [[1046, 0, .14, 'sin', .9], [1046, .2, .14, 'sin', .9]],
  pre: [[1480, 0, .11, 'sq', .45], [1480, .17, .11, 'sq', .45], [1480, .34, .11, 'sq', .45]],
  main: [[660, 0, .95, 'sq', .35], [990, 0, .95, 'sin', .6], [1320, 0, .95, 'sin', .25]],
  end: [[523, 0, .22, 'tri', .9], [523, .28, .22, 'tri', .9], [392, .56, .7, 'tri', .9]],
  click: [[1200, 0, .05, 'tri', .4]],
  buzz: [[220, 0, .3, 'saw', .45]],
  ok: [[784, 0, .12, 'sin', .8], [1046, .12, .25, 'sin', .8]],
  bad: [[300, 0, .2, 'saw', .35], [200, .18, .35, 'saw', .35]],
  tick: [[1000, 0, .04, 'sin', .35]],
  whistle: [[2600, 0, .5, 'sin', .5], [2750, 0, .5, 'sin', .3]],
  goal: [[523, 0, .15, 'tri', .8], [659, .15, .15, 'tri', .8], [784, .3, .4, 'tri', .9]],
};
function synthWav(notes) {
  const sr = 22050;
  const len = Math.ceil(sr * Math.max(...notes.map((n) => n[1] + n[2])) + sr * 0.05);
  const buf = new Float32Array(len);
  for (const [f, t0, d, type, v] of notes) {
    const s0 = Math.floor(t0 * sr), n = Math.floor(d * sr);
    for (let i = 0; i < n; i++) {
      const ph = (f * i / sr) % 1;
      let x = type === 'sq' ? (ph < .5 ? 1 : -1) : type === 'saw' ? 2 * ph - 1 : type === 'tri' ? 1 - 4 * Math.abs(ph - .5) : Math.sin(2 * Math.PI * ph);
      const env = Math.min(1, i / (sr * .008)) * Math.min(1, (n - i) / (sr * .06));
      buf[s0 + i] += x * v * env;
    }
  }
  let peak = 0; for (const x of buf) peak = Math.max(peak, Math.abs(x));
  const k = peak > 0 ? 0.95 / peak : 1;
  const out = new DataView(new ArrayBuffer(44 + len * 2));
  const w = (o, str) => { for (let i = 0; i < str.length; i++) out.setUint8(o + i, str.charCodeAt(i)); };
  w(0, 'RIFF'); out.setUint32(4, 36 + len * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true); out.setUint32(24, sr, true);
  out.setUint32(28, sr * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, len * 2, true);
  for (let i = 0; i < len; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, buf[i] * k)) * 32767, true);
  return URL.createObjectURL(new Blob([out.buffer], { type: 'audio/wav' }));
}
const SND = {};
function sndPool(name) {
  if (!SND[name]) {
    const url = synthWav(SND_NOTES[name]);
    SND[name] = { url, els: [new Audio(url), new Audio(url)], i: 0 };
    SND[name].els.forEach((a) => { a.preload = 'auto'; });
  }
  return SND[name];
}
let audioUnlocked = false;
function audio() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { }
  if (audioUnlocked) return;
  audioUnlocked = true;
  if (!App.voiceEl) {
    const v = App.voiceEl = new Audio(sndPool('tick').url);
    v.muted = true;
    const pr = v.play(); if (pr && pr.then) pr.then(() => { v.pause(); v.muted = false; }).catch(() => { v.muted = false; });
  }
  for (const name of Object.keys(SND_NOTES)) {
    for (const a of sndPool(name).els) {
      a.muted = true;
      const p = a.play();
      if (p && p.then) p.then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; audioUnlocked = false; });
      else { a.pause(); a.muted = false; }
    }
  }
}
function playSnd(name) {
  try {
    const p = sndPool(name);
    const a = p.els[p.i++ % p.els.length];
    a.muted = false; a.volume = 1; a.currentTime = 0;
    const r = a.play(); if (r && r.catch) r.catch(() => { });
  } catch (e) { }
}
const SFX = {};
for (const k of Object.keys(SND_NOTES)) SFX[k] = () => playSnd(k);

// ---------- Mavzu (kunduzgi / tungi) ----------
function themePref() { try { return localStorage.getItem('theme') || 'auto'; } catch (e) { return 'auto'; } }
function setThemePref(v) { try { localStorage.setItem('theme', v); } catch (e) { } applyTheme(); }
function applyTheme() {
  const p = themePref();
  let dark;
  if (p === 'auto') dark = TG ? TG.colorScheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  else dark = p === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  if (TG) { try { TG.setHeaderColor(bg); TG.setBackgroundColor(bg); if (TG.setBottomBarColor) TG.setBottomBarColor(bg); } catch (e) { } }
}

// ---------- Router ----------
function page(name, def) { App.pages[name] = def; }
function cleanup(fn) { App.cleanups.push(fn); }
function runCleanups() { const c = App.cleanups; App.cleanups = []; c.forEach((f) => { try { f(); } catch (e) { } }); }
const ROOTS = ['home', 'rating', 'profile', 'gate'];
async function go(name, params = {}, opts = {}) {
  const def = App.pages[name];
  if (!def) return go('home', {}, { root: true });
  runCleanups();
  $$('.modal-bg').forEach((m) => m.remove());
  if (opts.root || ROOTS.includes(name)) App.stack = [];
  else if (opts.replace && App.stack.length) App.stack.pop();
  App.stack.push({ name, params });
  App.cur = name;
  renderNav(def.nav ? name : null);
  updateBack();
  const el = $('#app');
  el.innerHTML = '';
  window.scrollTo(0, 0);
  try { await def.render(el, params); } catch (e) { console.error(e); el.innerHTML = `<div class="page"><div class="empty"><div class="e">😕</div>${esc(e.message || 'Xatolik')}<div class="mt"><button class="btn" onclick="reload()">Qayta urinish</button></div></div></div>`; }
}
function back() {
  if (App.stack.length <= 1) return go('home', {}, { root: true });
  App.stack.pop();
  const prev = App.stack.pop();
  go(prev.name, prev.params);
}
function reload() { const c = App.stack[App.stack.length - 1]; if (c) { App.stack.pop(); go(c.name, c.params); } }
function updateBack() {
  if (!TG || !TG.BackButton) return;
  if (App.stack.length > 1 || (App.stack.length === 1 && !ROOTS.includes(App.cur))) TG.BackButton.show(); else TG.BackButton.hide();
}
function renderNav(active) {
  const nav = $('#nav');
  if (!active) { nav.hidden = true; return; }
  nav.hidden = false;
  const items = [['home', '🏠', 'Asosiy'], ['rating', '🏆', 'Reyting'], ['profile', '👤', 'Profil']];
  nav.innerHTML = items.map(([n, i, t]) => `<button class="${n === active ? 'on' : ''}" data-go="${n}"><span class="i">${i}</span>${t}</button>`).join('');
  $$('button', nav).forEach((b) => b.onclick = () => { haptic('select'); go(b.dataset.go); });
}
function pageHead(title, sub, right) {
  return `<div class="ptitle">${App.stack.length > 1 && !TG ? '<button class="iconbtn" onclick="back()">←</button>' : ''}<div class="grow"><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${right || ''}</div>`;
}
function shareLink(url, text) {
  const u = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text || '')}`;
  if (TG && TG.openTelegramLink) TG.openTelegramLink(u); else window.open(u, '_blank');
}
function openTgLink(url) { if (TG && TG.openTelegramLink && url.startsWith('https://t.me/')) TG.openTelegramLink(url); else window.open(url, '_blank'); }
function copyText(t) {
  if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => toast('Nusxa olindi ✅', 'ok')).catch(() => toast(t));
  else toast(t);
}
