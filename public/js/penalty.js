// ============ Penalti: onlayn, do'st bilan, AI, turnirlar ============
'use strict';
const PEN_KEEPER = (shirt, num) => `<svg viewBox="0 0 70 110"><ellipse cx="35" cy="106" rx="20" ry="3.5" fill="rgba(0,0,0,.25)"/>
  <rect x="22" y="70" width="10" height="34" rx="5" fill="#1d2233"/><rect x="38" y="70" width="10" height="34" rx="5" fill="#1d2233"/>
  <rect x="17" y="34" width="36" height="42" rx="12" fill="${shirt}"/><text x="35" y="62" text-anchor="middle" font-size="15" font-weight="800" fill="rgba(255,255,255,.85)" font-family="Manrope,sans-serif">${num}</text>
  <rect x="2" y="32" width="20" height="9" rx="4.5" fill="${shirt}" transform="rotate(-38 12 36)"/><rect x="48" y="32" width="20" height="9" rx="4.5" fill="${shirt}" transform="rotate(38 58 36)"/>
  <circle cx="5" cy="23" r="7" fill="#f8f9fa" stroke="#adb5bd" stroke-width="1.5"/><circle cx="65" cy="23" r="7" fill="#f8f9fa" stroke="#adb5bd" stroke-width="1.5"/>
  <circle cx="35" cy="20" r="13" fill="#f1c27d"/><path d="M22 18c0-9 6-14 13-14s13 5 13 14c-3-4-7-6-13-6s-10 2-13 6z" fill="#2c1b10"/></svg>`;
const PEN_BALL = `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="18.5" fill="#fff" stroke="#222" stroke-width="1.6"/><polygon points="20,12 27.5,17.5 24.6,26 15.4,26 12.5,17.5" fill="#222"/><path d="M20 1.5v10.5M27.5 17.5l9.5-3.5M24.6 26l6 8.5M15.4 26l-6 8.5M12.5 17.5L3 14" stroke="#222" stroke-width="1.6"/></svg>`;
const ZONE_XY = (z) => ({ x: 8 + 84 * ((z % 3) + 0.5) / 3, y: 18 + 36 * (Math.floor(z / 3) + 0.5) / 2 });
const RES_TXT = { goal: 'GOL! ⚽', save: 'QAYTARDI! 🧤', post: 'USTUNGA! 😱', nopick: 'TEPILMADI ⌛' };

page('penalty', {
  async render(el) {
    const s = App.user.st;
    el.innerHTML = `<div class="page nonav">${pageHead('⚽ Penalti', 'Har bir zarbaga 7 soniya!')}
      <div class="pen-hero"><div><div class="big">${s.pw}</div><div class="small">g'alaba</div></div><div><div class="big">${s.pg}</div><div class="small">o'yin</div></div><div><div class="big">${s.pgoals}</div><div class="small">gol</div></div></div>
      <div class="ts-card" id="pQuick" style="background:linear-gradient(120deg,#14b268,#0b7a47);box-shadow:0 10px 26px rgba(20,178,104,.3)"><div class="ic">⚡</div><div><div class="t">Tezkor o'yin</div><div class="s">Onlayn raqib bilan</div></div><div class="arr">›</div></div>
      <div class="ts-two">
        <div class="ts-card" id="pFriend" style="background:linear-gradient(120deg,#2f66ff,#1f45c8)"><div class="ic">🤝</div><div><div class="t">Do'st bilan</div><div class="s">Kod yoki havola</div></div></div>
        <div class="ts-card" id="pAi" style="background:linear-gradient(120deg,#7a5cff,#5b3fd6)"><div class="ic">🤖</div><div><div class="t">AI bilan</div><div class="s">Mashq</div></div></div>
      </div>
      <div class="ts-card" id="pTours" style="background:linear-gradient(120deg,#f2a900,#e46b00);box-shadow:0 10px 26px rgba(242,169,0,.3)"><div class="ic">🏆</div><div><div class="t">Turnirlar</div><div class="s">Guruh bosqichi · Play-off</div></div><div class="arr">›</div></div>
      <div class="ts-card ts-white" id="pGroup"><div class="ic">👥</div><div><div class="t">Telegram guruhda o'ynash</div><div class="s">Botni guruhga qo'shing va /penalti yozing</div></div><div class="arr">›</div></div>
      <div class="ts-card ts-white" id="pHelp"><div class="ic">📖</div><div><div class="t">Qoidalar</div><div class="s">1 daqiqada tushunasiz</div></div><div class="arr">›</div></div></div>`;
    $('#pQuick').onclick = () => go('penSearch');
    $('#pFriend').onclick = () => go('penFriend');
    $('#pAi').onclick = async () => { try { const r = await post('/api/pen/ai'); go('penGame', { id: r.id }); } catch (e) { errToast(e); } };
    $('#pTours').onclick = () => go('penTours');
    $('#pHelp').onclick = () => go('penHelp');
    $('#pGroup').onclick = () => {
      const m = modal('👥 Guruhda o\'ynash', `<div class="stack small"><div>1️⃣ Botni (@${esc(App.bot)}) Telegram guruhingizga qo'shing.</div><div>2️⃣ Guruhda <b>/penalti</b> yoki <b>/tosiq</b> deb yozing.</div><div>3️⃣ Bot chaqiruv xabarini yuboradi — birinchi «Qabul qilish»ni bosgan bilan o'ynaysiz.</div><div>💬 Shaxsiy chatda ham: istalgan chatda <b>@${esc(App.bot)}</b> deb yozib, o'yin taklifini yuborish mumkin (inline rejim yoqilgan bo'lsa).</div></div>`,
        `<button class="btn" id="gAdd">➕ Guruhga qo'shish</button>`);
      $('#gAdd', m.el).onclick = () => { m.close(); openTgLink(`https://t.me/${App.bot}?startgroup=play`); };
    };
    try { const a = await api('/api/pen/active'); if (a.id && App.cur === 'penalty') go('penGame', { id: a.id }); } catch (e) { }
  },
});

page('penHelp', {
  async render(el) {
    el.innerHTML = `<div class="page nonav">${pageHead('📖 Penalti qoidalari')}<div class="card stack">
      <div>⚽ Har bir o'yinchi navbat bilan 5 tadan zarba beradi. Teng bo'lsa — «oltin gol» seriyasi.</div>
      <div>🥅 Darvoza <b>6 qismga</b> bo'lingan. Tepuvchi zarba joyini, darvozabon sakrash tomonini tanlaydi.</div>
      <div>⏱ Ikkalasiga <b>7 soniya</b>. Ikkalasi ham tanlashi bilan zarba beriladi, aks holda 7-soniyagacha kutiladi.</div>
      <div>🧤 Darvozabon tanlamasa — joyida qoladi (faqat markazga tepilgan to'pni ushlaydi).</div>
      <div>⌛ Tepuvchi tanlamasa — zarba tepilmagan hisoblanadi va navbat raqibga o'tadi.</div>
      <div>🎯 Darvozabon to'g'ri qismni topsa — qaytaradi. Yuqori burchaklar xavfli: to'p ustunga tegishi mumkin!</div></div></div>`;
  },
});

page('penSearch', {
  async render(el) {
    el.innerHTML = `<div class="page nonav"><div class="ts-search"><div class="rad" style="--c:#14b268"></div><h2 style="margin:0">Raqib qidirilmoqda...</h2><div class="muted mt" id="sTime">0 s</div><button class="btn plain mt2" id="sCancel">Bekor qilish</button></div></div>`;
    const t0 = Date.now(); let left = false;
    const iv = setInterval(() => { const x = $('#sTime'); if (x) x.textContent = Math.floor((Date.now() - t0) / 1000) + ' s'; }, 500);
    const poll = setInterval(async () => { try { const a = await api('/api/pen/active'); if (a.id && App.cur === 'penSearch') { left = true; go('penGame', { id: a.id }, { replace: true }); } } catch (e) { } }, 2000);
    cleanup(() => { clearInterval(iv); clearInterval(poll); if (!left) post('/api/pen/quick-cancel').catch(() => { }); });
    $('#sCancel').onclick = () => back();
    try { const r = await post('/api/pen/quick'); if (r.id) { left = true; go('penGame', { id: r.id }, { replace: true }); } } catch (e) { errToast(e); back(); }
  },
});

function joinPenGame(code) { post('/api/pen/join', { code }).then((r) => go('penGame', { id: r.id })).catch(errToast); }

page('penFriend', {
  async render(el) {
    el.innerHTML = `<div class="page nonav">${pageHead('🤝 Do\'st bilan')}
      <div class="card"><h3>Yangi o'yin</h3><div class="muted small mb">Kod yoki havolani do'stingizga yuboring.</div><button class="btn block" id="fNew">➕ O'yin ochish</button></div>
      <div class="card"><h3>Kod bilan kirish</h3><input class="input code-input" id="fCode" maxlength="4" inputmode="numeric" placeholder="••••"><button class="btn block mt ghost" id="fJoin">Kirish</button></div></div>`;
    $('#fJoin').onclick = () => joinPenGame($('#fCode').value.trim());
    $('#fNew').onclick = async () => { try { const r = await post('/api/pen/friend'); go('penGame', { id: r.id }, { replace: true }); } catch (e) { errToast(e); } };
  },
});

page('penGame', {
  async render(el, p) {
    let m;
    try { m = await api('/api/pen/' + p.id); } catch (e) { toast(e.message, 'err'); return go('penalty', {}, { replace: true }); }
    let offset = 0, lastShown = -1, myPick = null, overShown = false;
    el.innerHTML = `<div class="page nonav pen-page" id="pp"></div>`;
    const root = $('#pp');
    const me = () => m.me;
    const role = () => (m.cur ? (m.cur.k === m.me ? 'kick' : 'save') : null);

    function dots(idx) {
      const ks = m.kicks.filter((k) => k.k === idx);
      const n = Math.max(5, ks.length);
      return Array.from({ length: n }, (_, i) => `<i class="${ks[i] ? (ks[i].res === 'goal' ? 'g' : 'm') : ''}"></i>`).join('');
    }
    function head() {
      const P = (i) => m.players[i] || { name: 'Kutilmoqda…' };
      const turn = (i) => (m.cur && m.cur.k === i ? 'turn' : '');
      return `<div class="pen-sb"><div class="pside ${turn(0)}">${av(P(0), 40)}<div class="nm ell">${esc(P(0).name)}${m.me === 0 ? ' (siz)' : ''}</div><div class="pen-dots">${dots(0)}</div></div>
        <div class="pscore">${m.score[0]} : ${m.score[1]}</div>
        <div class="pside ${turn(1)}">${av(P(1), 40)}<div class="nm ell">${esc(P(1).name)}${m.me === 1 ? ' (siz)' : ''}</div><div class="pen-dots">${dots(1)}</div></div></div>`;
    }
    function pitch() {
      return `<div class="pen" id="pen"><div class="stands"></div><div class="stripes"></div>
        <div class="goal"><div class="zones" id="zones">${[0, 1, 2, 3, 4, 5].map((i) => `<button data-z="${i}"><span>${['↖', '⬆', '↗', '↙', '⬇', '↘'][i]}</span></button>`).join('')}</div></div>
        <div class="keeper" id="kp">${PEN_KEEPER('#f2a900', 1)}</div>
        <div class="spot"></div><div class="ball" id="ball">${PEN_BALL}</div><div id="pmsg"></div></div>`;
    }
    function statusHtml() {
      if (m.status === 'waiting') {
        return `<div class="sv-status"><div class="big">⏳ Raqib kutilmoqda</div>${m.code ? `<div class="sv-code mt">${m.code}</div><div class="row mt"><button class="btn grow" id="wShare">📤 Taklif yuborish</button><button class="btn plain" id="wCopy">📋</button></div>` : '<div class="small muted mt">Raqibingiz kirishi bilan o\'yin boshlanadi</div>'}<button class="btn plain block mt sm" id="wCancel">Bekor qilish</button></div>`;
      }
      if (m.status === 'cancelled') return `<div class="sv-status"><div class="big">O'yin bekor qilindi</div><button class="btn block mt" onclick="go('penalty',{},{replace:true})">Menyu</button></div>`;
      if (m.status === 'starting') return `<div class="sv-status open"><div class="big">O'yin boshlanmoqda <span id="stc"></span></div><div class="small">${m.me === 0 ? 'Birinchi zarbani siz tepasiz ⚽' : m.me === 1 ? 'Avval siz darvozada turasiz 🧤' : ''}</div></div>`;
      if (m.status === 'over') return '';
      if (m.status === 'show') return `<div class="sv-status"><div class="big">${m.kicks.length ? RES_TXT[m.kicks[m.kicks.length - 1].res] : ''}</div></div>`;
      if (!m.cur) return '';
      const r = role();
      const mine = m.cur.mine;
      let t;
      if (m.me < 0) t = `<div class="big">${esc(m.players[m.cur.k].name)} tepadi</div>`;
      else if (r === 'kick') t = mine !== null ? `<div class="big">🎯 Tanlandi!</div><div class="small">${m.cur.saveDone ? 'Zarba...' : 'Darvozabon o\'ylamoqda…'}</div>` : `<div class="big">⚽ Siz tepasiz</div><div class="small">Darvozaning qayeriga tepasiz?</div>`;
      else t = mine !== null ? `<div class="big">🧤 Tanlandi!</div><div class="small">${m.cur.kickDone ? 'Zarba...' : 'Tepuvchi o\'ylamoqda…'}</div>` : `<div class="big">🧤 Siz darvozabonsiz</div><div class="small">Qaysi tomonga sakraysiz?</div>`;
      return `<div class="sv-status ${mine === null && m.me >= 0 ? 'open' : ''}">${t}<div class="pbar"><i id="pbar"></i></div><div class="ptime" id="ptime">7</div></div>`;
    }
    function draw() {
      root.innerHTML = `${head()}${pitch()}<div id="pst">${statusHtml()}</div>`;
      bind(); placeIdle();
    }
    function placeIdle() {
      const kp = $('#kp'), ball = $('#ball');
      if (!kp) return;
      kp.style.transform = ''; ball.style.left = '45.5%'; ball.style.top = '80%'; ball.style.transform = '';
      const r = role();
      kp.innerHTML = PEN_KEEPER(m.cur && m.cur.k === 0 ? '#e0354b' : '#2f66ff', 1);
      const zs = $('#zones');
      if (zs) {
        zs.classList.toggle('active', m.status === 'playing' && m.me >= 0 && !!m.cur && m.cur.mine === null);
        zs.classList.toggle('keep', r === 'save');
        $$('button', zs).forEach((b) => b.classList.toggle('sel', m.cur && m.cur.mine === Number(b.dataset.z)));
      }
    }
    function keeperTo(z) {
      const kp = $('#kp'); if (!kp) return;
      if (z === null || z === undefined) { kp.style.transform = 'translateY(2%)'; return; }
      const col = z % 3, row = Math.floor(z / 3);
      const tx = col === 0 ? -128 : col === 2 ? 128 : 0;
      const ty = row === 0 ? (col === 1 ? -26 : -12) : (col === 1 ? 6 : 14);
      const rot = col === 0 ? -68 : col === 2 ? 68 : 0;
      kp.style.transform = `translate(${tx}%, ${ty}%) rotate(${rot}deg)`;
    }
    function animateLast() {
      const k = m.kicks[m.kicks.length - 1];
      if (!k) return;
      const ball = $('#ball');
      $('#kp').innerHTML = PEN_KEEPER(k.k === 0 ? '#e0354b' : '#2f66ff', 1);
      keeperTo(k.save);
      if (k.kick !== null) {
        const t = ZONE_XY(k.kick);
        const dx = k.res === 'post' ? (k.kick === 0 ? -6 : 6) : 0, dy = k.res === 'post' ? -6 : 0;
        ball.style.left = (t.x - 4.5 + dx) + '%'; ball.style.top = (t.y - 4.5 + dy) + '%'; ball.style.transform = `scale(.6) rotate(${k.res === 'save' ? 300 : 720}deg)`;
      }
      setTimeout(() => {
        const msg = $('#pmsg'); if (msg) msg.innerHTML = `<div class="pres r-${k.res}">${RES_TXT[k.res]}</div>`;
        const mine = (k.k === m.me && k.res === 'goal') || (k.k !== m.me && k.res !== 'goal' && m.me >= 0);
        if (k.res === 'goal') SFX.goal(); else SFX.bad();
        haptic(m.me < 0 ? 'light' : mine ? 'success' : 'error');
      }, 520);
    }
    function bind() {
      $$('#zones button').forEach((b) => b.onclick = async () => {
        if (!(m.status === 'playing' && m.cur && m.cur.mine === null && m.me >= 0)) return;
        const z = Number(b.dataset.z);
        m.cur.mine = z; placeIdle(); $('#pst').innerHTML = statusHtml(); haptic('medium'); SFX.click();
        try { const s = await post(`/api/pen/${m.id}/pick`, { zone: z }); update(s); } catch (e) { errToast(e); }
      });
      const on = (id, fn) => { const x = $('#' + id); if (x) x.onclick = fn; };
      on('wShare', () => shareLink(`https://t.me/${App.bot}?start=pj_${m.code}`, `⚽ Penalti o'ynaymizmi? Kod: ${m.code}`));
      on('wCopy', () => copyText(m.code));
      on('wCancel', async () => { await post(`/api/pen/${m.id}/leave`).catch(() => { }); go('penalty', {}, { replace: true }); });
    }
    function showOver() {
      if (overShown || m.status !== 'over') return;
      overShown = true;
      const won = m.winner === m.me;
      setTimeout(() => {
        if (m.me >= 0) { won ? SFX.ok() : SFX.bad(); haptic(won ? 'success' : 'error'); }
        const md = modal('', `<div class="ts-over"><div class="e">${m.me < 0 ? '🏁' : won ? '🏆' : '😔'}</div><div class="t">${m.me < 0 ? esc(m.players[m.winner].name) + ' yutdi' : won ? 'G\'alaba!' : 'Mag\'lubiyat'}</div><div class="mt" style="font-size:30px;font-weight:800">${m.score[0]} : ${m.score[1]}</div></div>`,
          m.tour ? `<button class="btn" id="oT">🏆 Turnirga qaytish</button>` : `<button class="btn plain" id="oM">Menyu</button><button class="btn" id="oA">🔄 Yana</button>`);
        const b = (id, fn) => { const x = $('#' + id, md.el); if (x) x.onclick = () => { md.close(); fn(); }; };
        b('oT', () => go('penTour', { id: m.tour.tid }, { replace: true }));
        b('oM', () => go('penalty', {}, { replace: true }));
        b('oA', async () => {
          if (m.mode === 'ai') { const r = await post('/api/pen/ai'); go('penGame', { id: r.id }, { replace: true }); }
          else if (m.mode === 'friend') go('penFriend', {}, { replace: true });
          else go('penSearch', {}, { replace: true });
        });
        cleanup(md.close);
      }, 1500);
    }
    function update(s) {
      const prevStatus = m.status, prevKicks = m.kicks.length, prevN = m.cur ? m.cur.n : -1;
      m = s; offset = Date.now() - m.serverNow;
      if (m.status === 'show' && m.kicks.length !== lastShown) {
        lastShown = m.kicks.length;
        root.innerHTML = `${head()}${pitch()}<div id="pst">${statusHtml()}</div>`; bind(); placeIdle();
        $('#zones').classList.remove('active');
        requestAnimationFrame(() => animateLast());
        return;
      }
      if (m.status === 'playing' && m.cur && m.cur.n !== prevN) { SFX.whistle(); if (m.me >= 0) haptic('medium'); draw(); return; }
      if (m.status !== prevStatus || m.kicks.length !== prevKicks) { draw(); showOver(); return; }
      // faqat holat matni
      $('#pst').innerHTML = statusHtml(); bind(); placeIdle();
      showOver();
    }
    function tick() {
      if (m.status === 'starting' && m.startAt) { const x = $('#stc'); if (x) x.textContent = Math.max(0, Math.ceil((m.startAt - (Date.now() - offset)) / 1000)); }
      if (m.status === 'playing' && m.cur) {
        const left = m.cur.deadline - (Date.now() - offset);
        const bar = $('#pbar'), tm = $('#ptime');
        if (bar) bar.style.width = Math.max(0, left / 7000 * 100) + '%';
        if (tm) { const sv = Math.max(0, Math.ceil(left / 1000)); if (tm.textContent !== String(sv)) { tm.textContent = sv; if (sv <= 3 && sv > 0 && m.cur.mine === null && m.me >= 0) SFX.tick(); } }
      }
    }
    m.serverNow && (offset = Date.now() - m.serverNow);
    draw();
    if (m.status === 'show') { lastShown = m.kicks.length; animateLast(); }
    showOver();
    const iv = setInterval(tick, 120);
    cleanup(() => clearInterval(iv));
    cleanup(stream(['pen:' + m.id], { state: update }));
  },
});

// ---------------- Turnirlar ----------------
const PT_SIZES = { groups: [[8, '8 kishi · 2 guruh'], [16, '16 kishi · 4 guruh']], playoff: [[4, '4 · 1/2 final'], [8, '8 · 1/4 final'], [16, '16 · 1/8 final'], [32, '32 · 1/16 final'], [64, '64 · 1/32 final']] };
const ptFormat = (t) => (t.format === 'groups' ? `Guruh bosqichi · ${t.size}` : `Play-off · ${t.size}`);

page('penTours', {
  async render(el, p) {
    const f = p.f || 'active';
    el.innerHTML = `<div class="page nonav">${pageHead('🏆 Penalti turnirlari')}
      <div class="row"><button class="btn grow" id="tNew">➕ Turnir yaratish</button></div>
      <input class="input mt" id="tq" placeholder="🔎 Turnir yoki tashkilotchi nomi" value="${esc(p.q || '')}">
      <div class="chips mt">${[['active', '🔥 Faol'], ['open', '🌐 Ochiq'], ['closed', '🔒 Yopiq'], ['mine', '👤 Meniki'], ['finished', '🏁 Tugagan']].map(([k, t]) => `<button class="chip ${k === f ? 'on' : ''}" data-f="${k}">${t}</button>`).join('')}</div>
      <div id="tl"></div></div>`;
    $('#tNew').onclick = () => go('penTourCreate');
    $$('.chip[data-f]', el).forEach((b) => b.onclick = () => { App.stack.pop(); go('penTours', { f: b.dataset.f, q: $('#tq').value }); });
    const load = async () => {
      const r = await api(`/api/pt?f=${f}&q=${encodeURIComponent($('#tq') ? $('#tq').value : '')}`);
      const box = $('#tl'); if (!box) return;
      if (!r.list.length) { box.innerHTML = `<div class="empty"><div class="e">🏆</div>Turnirlar topilmadi</div>`; return; }
      box.innerHTML = `<div class="list">${r.list.map((t) => `<div class="li tap" data-id="${t.id}"><div class="av" style="--s:42px;--c:${t.status === 'finished' ? '#868e96' : t.closed ? '#495057' : '#f2a900'}">${t.locked ? '🔒' : t.status === 'running' ? '⚽' : t.status === 'lobby' ? '⏳' : '🏆'}</div>
        <div class="grow" style="min-width:0"><div class="t ell">${t.closed ? '🔒 ' : ''}${esc(t.title)}</div><div class="s ell">${ptFormat(t)} · ${t.count}/${t.size} · ${esc(t.creator ? t.creator.name : '')}</div></div>
        ${t.champion ? `<div class="small center">🏆<div class="ell" style="max-width:70px">${esc(t.champion.name)}</div></div>` : `<span class="badge ${t.status === 'running' ? 'green' : 'gray'}">${t.status === 'running' ? 'Jonli' : t.status === 'lobby' ? 'Yig\'ilmoqda' : 'Tugagan'}</span>`}</div>`).join('')}</div>`;
      $$('[data-id]', box).forEach((x) => x.onclick = () => go('penTour', { id: x.dataset.id }));
    };
    let tt = null; $('#tq').oninput = () => { clearTimeout(tt); tt = setTimeout(load, 350); };
    await load();
  },
});

page('penTourCreate', {
  async render(el) {
    let format = 'playoff', size = 8, closed = false, joinSelf = true;
    el.innerHTML = `<div class="page nonav">${pageHead('Yangi turnir')}<div class="card">
      <label class="field"><span>Turnir nomi</span><input class="input" id="tt" maxlength="60" placeholder="Masalan: Ukademik penalti kubogi"></label>
      <div class="field"><span>Format</span><div class="seg" id="tf"><button data-v="playoff" class="on">🏆 Play-off</button><button data-v="groups">📊 Guruh bosqichi</button></div></div>
      <div class="field"><span>Ishtirokchilar soni</span><div class="chips" id="ts"></div><div class="small muted" id="tsHint"></div></div>
      <div class="field"><span>Turi</span><div class="seg" id="tc"><button data-v="0" class="on">🌐 Ochiq</button><button data-v="1">🔒 Yopiq</button></div><div class="small muted mt" id="tcHint">Hamma ko'radi va qatnashish uchun so'rov yuboradi</div></div>
      <label class="row" style="gap:10px"><button class="switch on" id="tj"></button><span>Men ham qatnashaman</span></label>
      <div class="small muted mt">O'rinlar to'lmasa, AI ishtirokchilar bilan to'ldirishingiz mumkin.</div>
      <button class="btn lg block mt" id="tgo">🏆 Yaratish</button></div></div>`;
    const drawSizes = () => {
      $('#ts').innerHTML = PT_SIZES[format].map(([n, t]) => `<button class="chip ${n === size ? 'on' : ''}" data-n="${n}">${t}</button>`).join('');
      $$('#ts .chip').forEach((b) => b.onclick = () => { size = Number(b.dataset.n); drawSizes(); });
      $('#tsHint').textContent = format === 'groups' ? 'Har guruhdan 2 tadan o\'yinchi play-offga chiqadi' : 'Yutqazgan chiqib ketadi';
    };
    drawSizes();
    $$('#tf button').forEach((b) => b.onclick = () => { format = b.dataset.v; size = PT_SIZES[format][0][0]; $$('#tf button').forEach((x) => x.classList.toggle('on', x === b)); drawSizes(); });
    $$('#tc button').forEach((b) => b.onclick = () => { closed = b.dataset.v === '1'; $$('#tc button').forEach((x) => x.classList.toggle('on', x === b)); $('#tcHint').textContent = closed ? 'Faqat maxsus kod orqali kiriladi' : 'Hamma ko\'radi va qatnashish uchun so\'rov yuboradi'; });
    $('#tj').onclick = () => { joinSelf = !joinSelf; $('#tj').classList.toggle('on', joinSelf); };
    $('#tgo').onclick = async () => {
      try { const r = await post('/api/pt', { title: $('#tt').value, format, size, closed, joinSelf }); haptic('success'); go('penTour', { id: r.id }, { replace: true }); } catch (e) { errToast(e); }
    };
  },
});

page('penTour', {
  async render(el, p) {
    let t;
    const load = async () => { t = await api('/api/pt/' + p.id); if (App.cur === 'penTour') draw(); };
    const act = async (a) => { try { await post(`/api/pt/${p.id}/act`, a); await load(); } catch (e) { errToast(e); } };
    function pl(x, w) { return x ? `<div class="bp ${w ? 'win' : ''}">${av(x, 22)}<span class="ell">${esc(x.name)}${x.ai ? ' 🤖' : ''}</span></div>` : '<div class="bp muted">—</div>'; }
    function draw() {
      const root = $('#ptr');
      if (t.locked) {
        root.innerHTML = `${pageHead(esc(t.title), ptFormat(t))}<div class="card center"><div style="font-size:46px">🔒</div><h3>Yopiq turnir</h3><div class="muted small mb">Faqat maxsus kod orqali kiriladi</div><input class="input code-input" id="lc" maxlength="6" inputmode="numeric" placeholder="••••••"><button class="btn block mt" id="lgo">Kirish</button></div>`;
        $('#lgo').onclick = () => act({ type: 'code', code: $('#lc').value });
        return;
      }
      let h = `${pageHead(esc(t.title), `${ptFormat(t)} · ${t.status === 'lobby' ? 'Yig\'ilmoqda' : t.status === 'running' ? 'Davom etmoqda' : 'Tugagan'}`, '<button class="iconbtn" id="tsh">📤</button>')}`;
      if (t.champion) h += `<div class="card center" style="background:var(--gold-soft);border:0"><div style="font-size:44px">🏆</div><div class="muted small">Chempion</div><div style="font-size:22px;font-weight:800">${esc(t.champion.name)}</div></div>`;
      if (t.myMatch) h += `<div class="card" style="background:var(--green-soft);border:0"><div class="small muted">Sizning o'yiningiz</div><div class="row mt"><div class="grow"><b>${esc(t.myMatch.a.name)}</b> vs <b>${esc(t.myMatch.b.name)}</b></div><button class="btn green" id="tplay">⚽ O'ynash</button></div></div>`;
      if (t.status === 'lobby') {
        h += `<div class="card"><div class="row"><h3 class="grow" style="margin:0">👥 Ishtirokchilar ${t.count}/${t.size}</h3>${!t.isPlayer && !t.manage ? (t.myRequest ? '<span class="badge gray">So\'rov yuborildi</span>' : '<button class="btn sm gold" id="treq">🙋 Qatnashish</button>') : ''}</div>
          <div class="dq-bar mt"><i style="width:${t.count / t.size * 100}%;background:var(--gold)"></i></div>
          <div class="ptl mt">${t.players.map((x) => `<div class="ptp">${av(x, 30)}<span class="ell">${esc(x.name)}${x.ai ? ' 🤖' : ''}</span>${t.manage ? `<button class="x" data-kick="${x.id}">✕</button>` : ''}</div>`).join('') || '<div class="muted small">Hali hech kim yo\'q</div>'}</div></div>`;
        if (t.manage) {
          h += `${t.closed ? `<div class="card tight row"><div class="grow"><div class="small muted">Turnir kodi (yopiq)</div><div class="sv-code sm">${t.code}</div></div><button class="btn sm ghost" id="tcp">📋</button></div>` : ''}
            ${t.requests.length ? `<div class="card tight"><h3>🙋 So'rovlar</h3>${t.requests.map((r) => `<div class="resp">${av(r, 30)}<div class="grow t ell">${esc(r.name)}</div><button class="btn sm green" data-appr="${r.id}">✓</button><button class="btn sm plain" data-rej="${r.id}">✕</button></div>`).join('')}</div>` : ''}
            <div class="row">${!t.isPlayer ? '<button class="btn plain grow sm" id="tself">➕ Men ham</button>' : ''}<button class="btn plain grow sm" id="tai">🤖 AI bilan to'ldirish</button></div>
            <button class="btn lg block mt green" id="tstart" ${t.count < t.size ? 'disabled' : ''}>▶️ Turnirni boshlash</button>
            <button class="btn plain block mt sm" id="tdel">🗑 Turnirni o'chirish</button>`;
        }
      }
      if (t.groups) {
        h += `<h2>📊 Guruhlar</h2>` + t.groups.map((g) => `<div class="card tight"><h3>${g.name} guruh</h3>
          <table class="gtab"><tr><th></th><th style="text-align:left">O'yinchi</th><th>O</th><th>G</th><th>±</th><th>Och</th></tr>
          ${g.table.map((r, i) => `<tr class="${i < 2 ? 'q' : ''}"><td>${i + 1}</td><td><div class="row" style="gap:6px">${av(r.player, 22)}<span class="ell" style="max-width:120px">${esc(r.player.name)}${r.player.ai ? ' 🤖' : ''}</span></div></td><td>${r.p}</td><td>${r.w}</td><td>${r.gf - r.ga}</td><td><b>${r.pts}</b></td></tr>`).join('')}</table>
          <details class="mt"><summary class="small muted">O'yinlar</summary>${g.matches.map((x) => mrow(x)).join('')}</details></div>`).join('');
      }
      if (t.rounds && t.rounds.length) {
        h += `<h2>🏆 Play-off</h2><div class="bracket">${t.rounds.map((r) => `<div class="bcol"><div class="bname">${r.name}</div>${r.matches.map((x) => `<div class="bm" data-mid="${x.id}">${pl(x.a, x.res && x.res.w === x.a.id)}${pl(x.b, x.res && x.res.w === x.b.id)}<div class="bs">${x.res ? `${x.res.sa}:${x.res.sb}${x.res.tech ? '*' : ''}` : x.live ? '<span class="live-dot"></span>' : ''}</div></div>`).join('')}</div>`).join('')}</div>`;
      }
      if (t.hasAi && !t.manage) h += `<div class="small muted center mt">Turnirda AI ishtirokchilar ham qatnashmoqda</div>`;
      $('#ptr').innerHTML = h;
      const on = (id, fn) => { const x = $('#' + id); if (x) x.onclick = fn; };
      on('tsh', () => shareLink(`https://t.me/${App.bot}?start=pt_${t.id}`, `🏆 «${t.title}» penalti turniri!${t.closed ? '' : ' Qatnashish uchun so\'rov yuboring.'}`));
      on('tplay', async () => { try { const r = await post(`/api/pt/${t.id}/play`); go('penGame', { id: r.id }); } catch (e) { errToast(e); } });
      on('treq', () => act({ type: 'request' }).then(() => toast('So\'rov yuborildi ⏳', 'ok')));
      on('tcp', () => copyText(t.code));
      on('tself', () => act({ type: 'joinSelf' }));
      on('tai', () => act({ type: 'fillAi' }));
      on('tstart', () => act({ type: 'start' }));
      on('tdel', async () => { if (await confirmDlg('Turnir o\'chirilsinmi?', 'O\'chirish', true)) { await act({ type: 'delete' }); go('penTours', {}, { replace: true }); } });
      $$('[data-appr]').forEach((b) => b.onclick = () => act({ type: 'approve', uid: b.dataset.appr }));
      $$('[data-rej]').forEach((b) => b.onclick = () => act({ type: 'reject', uid: b.dataset.rej }));
      $$('[data-kick]').forEach((b) => b.onclick = () => act({ type: 'kick', uid: b.dataset.kick }));
      if (t.manage) $$('[data-mid]').forEach((b) => b.onclick = () => techDlg(b.dataset.mid));
    }
    function mrow(x) { return `<div class="row small" data-mid="${x.id}" style="padding:6px 0;border-bottom:1px solid var(--line)"><span class="grow ell">${esc(x.a.name)}</span><b style="min-width:44px;text-align:center">${x.res ? `${x.res.sa}:${x.res.sb}` : x.live ? '⚽' : '–'}</b><span class="grow ell" style="text-align:right">${esc(x.b.name)}</span></div>`; }
    function techDlg(mid) {
      const all = [...(t.groups || []).flatMap((g) => g.matches), ...t.rounds.flatMap((r) => r.matches)];
      const x = all.find((y) => y.id === mid); if (!x || x.res) return;
      const md = modal('Texnik natija', `<div class="small muted mb">O'yin o'tkazilmasa, g'olibni belgilashingiz mumkin (3:0).</div><button class="btn block" data-w="a">${esc(x.a.name)} g'olib</button><button class="btn block mt" data-w="b">${esc(x.b.name)} g'olib</button>`);
      $$('[data-w]', md.el).forEach((b) => b.onclick = () => { md.close(); act({ type: 'result', mid, w: b.dataset.w }); });
    }
    el.innerHTML = `<div class="page nonav" id="ptr"><div class="empty"><div class="spinner" style="margin:auto"></div></div></div>`;
    await load();
    cleanup(stream(['pt:' + p.id], { changed: () => load(), deleted: () => { toast('Turnir o\'chirildi'); go('penTours', {}, { replace: true }); } }));
  },
});
