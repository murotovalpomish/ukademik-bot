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
  $('#toasts').appendChild(el);
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

// ---------- Ovoz (WebAudio) ----------
let actx = null;
function audio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } if (actx && actx.state === 'suspended') actx.resume(); return actx; }
function tone(freq, dur, { type = 'sine', vol = 0.35, when = 0 } = {}) {
  const ctx = audio(); if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.setValueAtTime(vol, t + Math.max(0.03, dur - 0.08)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur + 0.05);
}
const SFX = {
  start() { tone(880, 0.35, { type: 'triangle' }); },
  pre() { tone(1320, 0.12, { vol: .3 }); tone(1320, 0.12, { vol: .3, when: .18 }); },
  main() { tone(660, 0.9, { type: 'square', vol: .18 }); tone(990, 0.9, { type: 'sine', vol: .25 }); },
  end() { tone(523, 0.25, { type: 'triangle' }); tone(523, 0.25, { type: 'triangle', when: .3 }); tone(392, 0.6, { type: 'triangle', when: .6 }); },
  click() { tone(1200, 0.05, { vol: .12, type: 'triangle' }); },
  buzz() { tone(220, 0.3, { type: 'sawtooth', vol: .2 }); },
  ok() { tone(784, 0.12, { vol: .25 }); tone(1046, 0.25, { vol: .25, when: .12 }); },
  bad() { tone(300, 0.2, { type: 'sawtooth', vol: .15 }); tone(200, 0.35, { type: 'sawtooth', vol: .15, when: .18 }); },
  tick() { tone(1000, 0.04, { vol: .1 }); },
};

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
