// ============ Zakovat soati — o'yin taymeri ============
'use strict';
const ZS_MODES = {
  savol: { name: 'SAVOL', segs: [60], warnAt: 50 },
  dublet: { name: 'DUBLET', segs: [30, 30] },
  blits: { name: 'BLITS', segs: [20, 20, 20] },
};
const ZS_DEF = { hand: false, ccw: true, warn: true, write: true, sound: true, manual: false, mode: 'savol' };
function zsLoad() { try { return { ...ZS_DEF, ...JSON.parse(localStorage.getItem('zs') || '{}') }; } catch (e) { return { ...ZS_DEF }; } }
function zsSave(s) { try { localStorage.setItem('zs', JSON.stringify(s)); } catch (e) { } }

page('timer', {
  async render(el) {
    const S = zsLoad();
    const T = { phase: 'idle', seg: 0, segStart: 0, pausedAt: 0, writeStart: 0, warned: false, done: 0 };
    const WRITE = 10;
    let raf = null, wake = null, lastDraw = 0;

    const mode = () => (S.manual ? { name: 'QO\'LDA', segs: [60] } : ZS_MODES[S.mode]);
    const segOffset = (i) => mode().segs.slice(0, i).reduce((a, b) => a + b, 0);

    el.innerHTML = `<div class="zs">
      <div class="zs-top">
        ${!TG ? '<button class="iconbtn" onclick="back()">←</button>' : ''}
        <div class="ttl">⏱ Zakovat soati</div>
        <button class="iconbtn" id="zsTheme">${document.documentElement.dataset.theme === 'dark' ? '☀️' : '🌙'}</button>
        <button class="iconbtn" id="zsSet">☰</button>
      </div>
      <div class="zs-dialwrap"><div class="zs-dial" id="dial"><svg viewBox="0 0 200 200" id="dsvg"></svg>
        <div class="zs-inner"><div class="zs-lbl" id="lbl"></div><div class="zs-num" id="num">60</div>
        <div class="zs-ctrl" id="ctrl"></div></div></div></div>
      <div class="zs-modes" id="modes"></div>
    </div>`;

    function ringSvg(segs) {
      let s = '<svg viewBox="0 0 64 64">';
      let acc = 0;
      for (const sg of segs) {
        const a = ((S.ccw ? -1 : 1) * acc * 6 - 90) * Math.PI / 180;
        s += `<line x1="${32 + 22 * Math.cos(a)}" y1="${32 + 22 * Math.sin(a)}" x2="${32 + 30 * Math.cos(a)}" y2="${32 + 30 * Math.sin(a)}" stroke="#d6283c" stroke-width="4" stroke-linecap="round"/>`;
        acc += sg;
      }
      return s + '</svg>';
    }
    function renderModes() {
      $('#modes').innerHTML = Object.entries(ZS_MODES).map(([k, m]) => `<button class="zs-mode ${!S.manual && S.mode === k ? 'on' : ''}" data-m="${k}"><div class="ring">${ringSvg(m.segs)}</div>${m.name}</button>`).join('');
      $$('#modes .zs-mode').forEach((b) => b.onclick = () => {
        if (T.phase !== 'idle' && T.phase !== 'done') return toast('Avval taymerni to\'xtating');
        S.mode = b.dataset.m; S.manual = false; zsSave(S); haptic('select'); reset();
      });
    }

    function elapsedTotal() {
      // Siferblatdagi umumiy o'tgan soniya
      const m = mode();
      if (T.phase === 'idle') return 0;
      if (T.phase === 'write' || T.phase === 'done') return 60;
      const base = segOffset(T.seg);
      if (T.phase === 'between') return base;
      const now = T.phase === 'paused' ? T.pausedAt : Date.now();
      return Math.min(base + m.segs[T.seg], base + (now - T.segStart) / 1000);
    }

    function drawDial() {
      const m = mode();
      const et = elapsedTotal();
      const dir = S.ccw ? -1 : 1;
      let s = '';
      for (let i = 0; i < 60; i++) {
        const a = (dir * i * 6 - 90) * Math.PI / 180;
        const isWarn = !S.manual && S.mode === 'savol' && i >= 50;
        const gone = i < Math.floor(et + 0.0001) || (T.phase === 'write' || T.phase === 'done');
        const r1 = 76, r2 = i % 5 === 0 ? 89 : 86;
        const col = isWarn ? '#f59f00' : 'var(--primary)';
        s += `<line x1="${100 + r1 * Math.cos(a)}" y1="${100 + r1 * Math.sin(a)}" x2="${100 + r2 * Math.cos(a)}" y2="${100 + r2 * Math.sin(a)}" stroke="${col}" stroke-width="${i % 5 === 0 ? 3.2 : 2.4}" stroke-linecap="round" opacity="${gone ? 0.1 : 1}"/>`;
      }
      let acc = 0;
      for (const sg of m.segs) {
        const a = (dir * acc * 6 - 90) * Math.PI / 180;
        s += `<line x1="${100 + 72 * Math.cos(a)}" y1="${100 + 72 * Math.sin(a)}" x2="${100 + 95 * Math.cos(a)}" y2="${100 + 95 * Math.sin(a)}" stroke="#d6283c" stroke-width="5" stroke-linecap="round"/>`;
        acc += sg;
      }
      if (S.hand) {
        const a = (dir * et * 6 - 90) * Math.PI / 180;
        s += `<line x1="100" y1="100" x2="${100 + 80 * Math.cos(a)}" y2="${100 + 80 * Math.sin(a)}" stroke="#d6283c" stroke-width="3.5" stroke-linecap="round"/><circle cx="100" cy="100" r="6" fill="#d6283c"/>`;
      }
      $('#dsvg').innerHTML = s;
    }

    function display() {
      const m = mode();
      const num = $('#num'), lbl = $('#lbl');
      if (!num) return;
      let n, label = '', cls = '';
      if (T.phase === 'idle') { n = m.segs[0]; label = m.segs.length > 1 ? `1-savol` : ''; }
      else if (T.phase === 'run' || T.phase === 'paused') {
        const left = m.segs[T.seg] - ((T.phase === 'paused' ? T.pausedAt : Date.now()) - T.segStart) / 1000;
        n = Math.max(0, Math.ceil(left));
        label = T.phase === 'paused' ? 'pauza' : (m.segs.length > 1 ? `${T.seg + 1}-savol` : 'o\'ylash');
        if (!S.manual && S.mode === 'savol' && n <= 10) cls = 'warn';
      } else if (T.phase === 'between') { n = m.segs[T.seg]; label = `${T.seg + 1}-savol · tayyor`; }
      else if (T.phase === 'write') { n = Math.max(0, Math.ceil(WRITE - (Date.now() - T.writeStart) / 1000)); label = 'javobni yozing'; cls = 'write'; }
      else { n = 0; label = 'vaqt tugadi'; cls = 'write'; }
      num.style.display = S.hand && T.phase !== 'write' ? 'none' : '';
      num.textContent = n; num.className = 'zs-num ' + cls; lbl.textContent = label;
    }

    function controls() {
      const c = $('#ctrl');
      const b = (id, ic, main) => `<button id="${id}" class="${main ? 'main' : ''}">${ic}</button>`;
      if (T.phase === 'idle' || T.phase === 'done') c.innerHTML = b('cPlay', '▶', true);
      else if (T.phase === 'between') c.innerHTML = b('cStop', '■') + b('cPlay', '▶', true);
      else if (T.phase === 'paused') c.innerHTML = b('cStop', '■') + b('cResume', '▶', true);
      else if (S.manual && T.phase === 'run') c.innerHTML = b('cStop', '■') + b('cPause', '❚❚', true);
      else c.innerHTML = b('cStop', '■') + b('cSkip', '⏭');
      const on = (id, fn) => { const x = $('#' + id); if (x) x.onclick = (e) => { e.stopPropagation(); audio(); haptic('medium'); fn(); }; };
      on('cPlay', () => { if (T.phase === 'done') reset(); startSeg(); });
      on('cStop', reset);
      on('cSkip', endSeg);
      on('cPause', () => { T.phase = 'paused'; T.pausedAt = Date.now(); controls(); });
      on('cResume', () => { T.segStart += Date.now() - T.pausedAt; T.phase = 'run'; controls(); });
    }

    const snd = (f) => { if (S.sound) SFX[f](); };
    const testSnd = () => { audio(); SFX.start(); };
    function startSeg() {
      T.phase = 'run'; T.segStart = Date.now(); T.warned = false; T.midDone = false;
      snd('start'); keepAwake(true); controls();
    }
    function endSeg() {
      const m = mode();
      const last = T.seg >= m.segs.length - 1;
      snd(last ? 'main' : 'mid'); haptic('heavy');
      if (!last) { T.seg++; T.phase = 'between'; controls(); return; }
      if (S.write) { T.phase = 'write'; T.writeStart = Date.now(); controls(); return; }
      finish();
    }
    function finish() { T.phase = 'done'; snd('end'); haptic('success'); keepAwake(false); controls(); }
    function reset() { T.phase = 'idle'; T.seg = 0; keepAwake(false); renderModes(); controls(); drawDial(); display(); }

    async function keepAwake(on) {
      try {
        if (on && !wake && navigator.wakeLock) wake = await navigator.wakeLock.request('screen');
        if (!on && wake) { wake.release(); wake = null; }
      } catch (e) { }
    }

    function loop() {
      const m = mode();
      if (T.phase === 'run') {
        const el2 = (Date.now() - T.segStart) / 1000;
        const segLen = m.segs[T.seg];
        // Oraliq signal: bitta uzun savolda yarmida (30-soniya)
        if (m.segs.length === 1 && segLen >= 40 && !T.midDone && el2 >= segLen / 2) { T.midDone = true; snd('mid'); haptic('medium'); }
        // Tugashiga 10 soniya qolganda ogohlantirish (barcha rejimlarda)
        if (S.warn && segLen >= 20 && !T.warned && el2 >= segLen - 10) { T.warned = true; snd('pre'); haptic('warning'); }
        if (el2 >= m.segs[T.seg]) endSeg();
      } else if (T.phase === 'write' && Date.now() - T.writeStart >= WRITE * 1000) finish();
      const nowT = Date.now();
      if (nowT - lastDraw > 80) { lastDraw = nowT; drawDial(); display(); }
      raf = requestAnimationFrame(loop);
    }

    $('#zsTheme').onclick = () => { setThemePref(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); $('#zsTheme').textContent = document.documentElement.dataset.theme === 'dark' ? '☀️' : '🌙'; haptic('select'); };
    $('#zsSet').onclick = () => settingsDlg();
    function settingsDlg() {
      const tp = themePref();
      const sw = (k, t, d) => `<div class="set"><div class="grow">${t}${d ? `<div class="d">${d}</div>` : ''}</div><button class="switch ${S[k] ? 'on' : ''}" data-k="${k}"></button></div>`;
      const m = modal('⚙️ Sozlamalar', `<div class="zs-settings">
        <div class="muted small" style="font-weight:800;margin-top:4px">SIFERBLAT</div>
        ${sw('hand', 'Raqamlar o\'rniga strelka')}
        ${sw('ccw', 'Soat strelkasiga teskari sanash')}
        <div class="muted small" style="font-weight:800;margin-top:14px">VAQT</div>
        ${sw('warn', '10 soniya qolganda signal', 'Har bir savol vaqti tugashiga 10 soniya qolganda')}
        ${sw('write', 'Javob yozish uchun vaqt', 'Asosiy vaqtdan keyin yana 10 soniya')}
        ${sw('sound', 'Ovozli signallar', 'Boshlanish, oraliq, 10 soniya qoldi va tugash signallari')}
        <button class="btn plain sm mt" id="zsTest" style="margin-bottom:6px">🔊 Ovozni sinab ko'rish</button>
        ${sw('manual', 'Qo\'lda rejim', 'Taymerni qo\'lda to\'xtatib-davom ettirish (nostandart blits, tetrablits uchun)')}
        <div class="muted small" style="font-weight:800;margin:14px 0 8px">REJIM</div>
        <div class="seg" id="zsTp"><button data-v="light" class="${tp === 'light' ? 'on' : ''}">☀️ Kunduzgi</button><button data-v="dark" class="${tp === 'dark' ? 'on' : ''}">🌙 Tungi</button><button data-v="auto" class="${tp === 'auto' ? 'on' : ''}">📱 Qurilmadek</button></div>
      </div>`, `<button class="btn" id="zsOk">Tayyor</button>`);
      $$('.switch', m.el).forEach((b) => b.onclick = () => {
        S[b.dataset.k] = !S[b.dataset.k]; b.classList.toggle('on'); zsSave(S); haptic('select');
        if (b.dataset.k === 'manual' || b.dataset.k === 'ccw') reset();
      });
      $$('#zsTp button', m.el).forEach((b) => b.onclick = () => { setThemePref(b.dataset.v); $$('#zsTp button', m.el).forEach((x) => x.classList.toggle('on', x === b)); $('#zsTheme').textContent = document.documentElement.dataset.theme === 'dark' ? '☀️' : '🌙'; });
      $('#zsOk', m.el).onclick = m.close;
      $('#zsTest', m.el).onclick = () => { audio(); SFX.start(); setTimeout(() => SFX.mid(), 600); setTimeout(() => SFX.pre(), 1300); setTimeout(() => SFX.main(), 2100); };
    }

    renderModes(); controls(); drawDial(); display();
    raf = requestAnimationFrame(loop);
    if (TG && TG.disableVerticalSwipes) try { TG.disableVerticalSwipes(); } catch (e) { }
    cleanup(() => { cancelAnimationFrame(raf); keepAwake(false); if (TG && TG.enableVerticalSwipes) try { TG.enableVerticalSwipes(); } catch (e) { } });
  },
});
