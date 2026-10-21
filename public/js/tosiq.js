// ============ To'siq — WallRush uslubidagi aqliy o'yin ============
'use strict';
const TS_LOGO = `<div class="ts-logo"><div class="mark"><i></i><i></i><i></i></div><b>To'siq</b></div>`;

function tsWrap(el, inner) { el.innerHTML = `<div class="ts"><div class="page nonav">${inner}</div></div>`; }

page('tosiq', {
  async render(el) {
    const st = App.user.st;
    tsWrap(el, `${!TG ? '<button class="iconbtn" onclick="back()">←</button>' : ''}${TS_LOGO}<div class="ts-tag">Yo'lini to'sib qo'y</div>
      <div class="ts-pills"><div class="ts-pill"><span class="g"></span><span id="tsOn">…</span> onlayn</div><div class="ts-pill">⭐ ${Math.round(st.qr)} reyting</div><div class="ts-pill">🏆 ${st.qw}</div></div>
      <div class="ts-card" id="tQuick"><div class="ic">⚡</div><div><div class="t">Tezkor o'yin</div><div class="s">Raqib topish</div></div><div class="arr">›</div></div>
      <div class="ts-two">
        <div class="ts-card" id="tFriend"><div class="ic">🤝</div><div><div class="t">Do'st bilan</div><div class="s">Kod orqali</div></div></div>
        <div class="ts-card b2" id="tAi"><div class="ic">🤖</div><div><div class="t">AI bilan</div><div class="s">Mashq qilish</div></div></div>
      </div>
      <div class="ts-card ts-white" id="tHelp"><div class="ic">📖</div><div><div class="t">Qanday o'ynaladi</div><div class="s">Qoidalar 1 daqiqada</div></div><div class="arr">›</div></div>
      <div class="ts-card ts-white" id="tRate"><div class="ic">🏆</div><div><div class="t">Reyting</div><div class="s">Eng kuchli o'yinchilar</div></div><div class="arr">›</div></div>`);
    $('#tQuick').onclick = () => { haptic('medium'); go('tosiqSearch'); };
    $('#tFriend').onclick = () => go('tosiqFriend');
    $('#tAi').onclick = () => go('tosiqAi');
    $('#tHelp').onclick = () => go('tosiqHelp');
    $('#tRate').onclick = () => go('rating', { type: 'tosiq' });
    try { const h = await api('/api/home'); const o = $('#tsOn'); if (o) o.textContent = Math.max(1, h.tosiq.online + h.tosiq.playing * 2); if (h.activeGame) go('tosiqGame', { id: h.activeGame }); } catch (e) { }
  },
});

page('tosiqSearch', {
  async render(el) {
    tsWrap(el, `${TS_LOGO}<div class="ts-search"><div class="rad"></div><h2 style="margin:0">Raqib qidirilmoqda...</h2><div class="muted mt" id="sTime">0 s</div><button class="btn plain mt2" id="sCancel">Bekor qilish</button></div>`);
    const t0 = Date.now();
    const iv = setInterval(() => { const x = $('#sTime'); if (x) x.textContent = Math.floor((Date.now() - t0) / 1000) + ' s'; }, 500);
    let left = false;
    cleanup(() => { clearInterval(iv); if (!left) post('/api/q/cancel').catch(() => { }); });
    $('#sCancel').onclick = () => back();
    try {
      const r = await post('/api/q/quick');
      if (r.id) { left = true; go('tosiqGame', { id: r.id }, { replace: true }); }
    } catch (e) { errToast(e); back(); }
    // Topilganda foydalanuvchi oqimidagi "q:matched" hodisasi o'yinni ochadi
    const poll = setInterval(async () => {
      try { const a = await api('/api/q/active'); if (a.id && App.cur === 'tosiqSearch') { left = true; go('tosiqGame', { id: a.id }, { replace: true }); } } catch (e) { }
    }, 2500);
    cleanup(() => { clearInterval(poll); left = true; });
  },
});

page('tosiqAi', {
  async render(el) {
    const L = [['🙂', 'Oson', 'Birinchi o\'yinlar uchun', '#e6f8ee'], ['😎', 'O\'rtacha', 'Ishonchli qarshilik', '#e8eeff'], ['🔥', 'Qiyin', 'O\'ylashga to\'g\'ri keladi', '#fff1e0'], ['💀', 'Hardkor', 'Shafqatsiz 💀', '#2a3150']];
    tsWrap(el, `${pageHead('AI darajasi', 'Mashq o\'yinlari reytingga ta\'sir qilmaydi')}${L.map(([e, t, s, c], i) => `<div class="ts-card ts-white" data-l="${i}"><div class="ic" style="background:${c}">${e}</div><div><div class="t">${t}</div><div class="s">${s}</div></div><div class="arr">›</div></div>`).join('')}`);
    $$('[data-l]', el).forEach((b) => b.onclick = async () => {
      try { const r = await post('/api/q/practice', { level: Number(b.dataset.l) }); go('tosiqGame', { id: r.id }, { replace: true }); } catch (e) { errToast(e); }
    });
  },
});

function joinFriendGame(code) {
  post('/api/q/join', { code }).then((r) => go('tosiqGame', { id: r.id })).catch(errToast);
}

page('tosiqFriend', {
  async render(el) {
    tsWrap(el, `${pageHead('🤝 Do\'st bilan', 'Xona oching yoki kod bilan kiring')}
      <div class="card"><h3>Yangi xona</h3><div class="muted small mb">Kod va havolani do'stingizga yuboring.</div><button class="btn block" id="fNew">➕ Xona ochish</button><div id="fRoom"></div></div>
      <div class="card"><h3>Kod bilan kirish</h3><input class="input code-input" id="fCode" maxlength="4" inputmode="numeric" placeholder="••••"><button class="btn block mt ghost" id="fJoin">Kirish</button></div>`);
    $('#fJoin').onclick = () => joinFriendGame($('#fCode').value.trim());
    $('#fNew').onclick = async () => {
      try {
        const r = await post('/api/q/friend');
        return go('tosiqGame', { id: r.id }, { replace: true });
        $('#fNew').remove();
        $('#fRoom').innerHTML = `<div class="sv-code mt">${r.code}</div><div class="center muted small mt"><span class="spinner" style="display:inline-block;width:14px;height:14px;vertical-align:middle"></span> Do'stingiz kutilmoqda...</div><button class="btn block mt" id="fShare">📤 Taklif yuborish</button>`;
        $('#fShare').onclick = () => shareLink(`https://t.me/${App.bot}?start=q_${r.code}`, `🧱 To'siq o'yiniga taklif qilaman! Kod: ${r.code}`);
        cleanup(stream(['q:' + r.id], { state: (s) => { if (s.status === 'playing') go('tosiqGame', { id: r.id }, { replace: true }); } }));
        cleanup(() => { if (App.cur !== 'tosiqGame') post(`/api/q/${r.id}/resign`).catch(() => { }); });
      } catch (e) { errToast(e); }
    };
  },
});

page('tosiqHelp', {
  async render(el) {
    tsWrap(el, `${pageHead('📖 Qoidalar')}
      <div class="card stack">
        <div>🎯 <b>Maqsad:</b> o'z to'pingizni (ko'k) maydonning qarama-qarshi tomoniga — qizil chiziqqa birinchi bo'lib yetkazish.</div>
        <div>👣 <b>Yurish:</b> o'z navbatingizda to'pni bir katak oldinga, orqaga yoki yonga suring (ko'k nuqtalarni bosing) <i>yoki</i> devor qo'ying.</div>
        <div>🧱 <b>Devorlar:</b> har bir o'yinchida 10 ta devor bor. Devor 2 katak uzunlikda bo'lib, raqib yo'lini uzaytiradi. Devorni pastdagi paneldan maydonga sudrab olib keling yoki uni bosib, keyin maydonni bosing.</div>
        <div>🚫 Devor orqali o'tib bo'lmaydi, faqat aylanib o'tiladi. Raqibning yo'lini <b>butunlay</b> berkitish mumkin emas.</div>
        <div>🦘 <b>Sakrash:</b> to'plar yonma-yon kelsa, raqib ustidan sakrab o'tish mumkin. Orqasida devor bo'lsa — qiya yurasiz.</div>
        <div>⏱ Har bir o'yinchiga 5 daqiqa beriladi. Vaqt tugasa — mag'lubiyat.</div>
        <div>⭐ Tezkor o'yinlar reytingga ta'sir qiladi. Onlayn raqib bo'lmasa, darajangizga mos AI bilan o'ynaysiz.</div>
      </div>`);
  },
});

page('tosiqGame', {
  async render(el, p) {
    let g;
    try { g = await api('/api/q/' + p.id); } catch (e) { toast(e.message, 'err'); return go('tosiq', {}, { replace: true }); }
    const E = window.QEngine;
    if (g.status === 'waiting') {
      tsWrap(el, `${TS_LOGO}<div class="card center mt"><div style="font-size:44px">⏳</div><h3>Raqib kutilmoqda</h3>${g.code ? `<div class="sv-code mt">${g.code}</div><button class="btn block mt" id="wsh">📤 Taklif yuborish</button>` : ''}<button class="btn plain block mt sm" id="wcx">Bekor qilish</button></div>`);
      const sh = $('#wsh'); if (sh) sh.onclick = () => shareLink(`https://t.me/${App.bot}?start=q_${g.code}`, `🧱 To'siq o'ynaymizmi? Kod: ${g.code}`);
      $('#wcx').onclick = async () => { await post(`/api/q/${g.id}/resign`).catch(() => { }); go('tosiq', {}, { replace: true }); };
      cleanup(stream(['q:' + g.id], { state: (s2) => { if (s2.status !== 'waiting') go('tosiqGame', { id: g.id }, { replace: true }); } }));
      return;
    }
    let recvAt = Date.now(), wallMode = null, ghost = null, drag = null, overShown = false, lastWallCount = g.st.walls.length;
    const me = g.me;
    const flip = me === 1;
    const myIdx = me >= 0 ? me : 0, opIdx = 1 - myIdx;
    const colorOf = (idx) => (idx === myIdx ? 'blue' : 'red');
    const W = Math.min(window.innerWidth - 52, 420);
    const cell = W / 9;
    const toD = (r, c) => (flip ? { r: 8 - r, c: 8 - c } : { r, c });
    const wallToD = (w) => (flip ? { r: 7 - w.r, c: 7 - w.c, o: w.o } : { r: w.r, c: w.c, o: w.o });

    tsWrap(el, `
      <div class="ts-head"><div class="ts-logo" style="margin:0;transform:scale(.8);transform-origin:left"><div class="mark"><i></i><i></i><i></i></div><b>To'siq</b></div><div class="grow"></div>${me >= 0 ? '<button class="btn plain sm" id="resign">⚑ Taslim</button>' : ''}</div>
      <div class="ts-players"><div class="ts-pl ${colorOf(myIdx)}" id="pl${myIdx}"></div><div class="ts-vs">VS</div><div class="ts-pl ${colorOf(opIdx)}" id="pl${opIdx}"></div></div>
      <div class="ts-label red" id="lblTop"></div>
      <div class="ts-boardwrap"><div class="ts-board" id="board" style="width:${W}px;height:${W}px"></div></div>
      <div class="ts-label blue" id="lblBot"></div>
      ${me >= 0 ? `<div class="ts-tray"><div class="cnt">🧱 <span id="wl">10</span></div><div class="piece h" data-o="h"><i></i></div><div class="piece v" data-o="v"><i></i></div></div>
      <div class="ts-hint">Katakni bosing — yurish · devorni maydonga sudrang</div>` : '<div class="ts-hint mt">👀 Siz kuzatuvchisiz</div>'}
      <div class="ts-bottom"><div class="ts-status" id="status"></div>${me >= 0 ? ['😂', '🫡', '🤝', '😡'].map((e) => `<button class="ts-emo" data-e="${e}">${e}</button>`).join('') : ''}</div>`);

    const board = $('#board');

    function playerCard(idx) {
      const pl = g.players[idx];
      const ball = pl.avatar ? `<div class="ball"><img src="${esc(pl.avatar)}" onerror="this.remove()"></div>` : `<div class="ball" style="background:radial-gradient(circle at 35% 30%,${colorOf(idx) === 'blue' ? '#8fb0ff,#2f5ff5' : '#ff9aa6,#e0354b'})"></div>`;
      return `${ball}<div class="grow" style="min-width:0"><div class="nm">${esc(pl.name)}</div><div class="meta"><span>🧱 ${g.st.wallsLeft[idx]}</span><span class="clock" id="clk${idx}"></span></div></div>`;
    }

    function drawStatic() {
      let h = `<div class="goal top" style="height:${cell}px"></div><div class="goal bot" style="height:${cell}px"></div>`;
      for (let i = 1; i < 9; i++) {
        h += `<div class="gl" style="left:0;right:0;top:${i * cell - 0.5}px;height:1px"></div><div class="gl" style="top:0;bottom:0;left:${i * cell - 0.5}px;width:1px"></div>`;
      }
      return h;
    }

    function wallStyle(d, thick) {
      const t = Math.max(6, cell * 0.2);
      if (d.o === 'h') return `left:${d.c * cell + 3}px;top:${(d.r + 1) * cell - t / 2}px;width:${2 * cell - 6}px;height:${t}px`;
      return `left:${(d.c + 1) * cell - t / 2}px;top:${d.r * cell + 3}px;width:${t}px;height:${2 * cell - 6}px`;
    }

    function drawBoard() {
      let h = drawStatic();
      const nWalls = g.st.walls.length;
      g.st.walls.forEach((w, i) => {
        const d = wallToD(w);
        const isNew = i >= lastWallCount;
        h += `<div class="wall ${w.p === undefined ? 'red' : colorOf(w.p)} ${isNew ? 'new' : ''}" style="${wallStyle(d)}"></div>`;
      });
      lastWallCount = nWalls;
      const ps = cell * 0.66;
      g.st.pawns.forEach((pw, idx) => {
        const d = toD(pw.r, pw.c);
        h += `<div class="pawn ${colorOf(idx)} ${idx === me ? 'me' : ''}" style="width:${ps}px;height:${ps}px;left:${d.c * cell + (cell - ps) / 2}px;top:${d.r * cell + (cell - ps) / 2}px"></div>`;
      });
      if (myTurn() && !wallMode) {
        for (const m of E.pawnMoves(g.st, me)) {
          const d = toD(m.r, m.c);
          h += `<div class="dot" data-mr="${m.r}" data-mc="${m.c}" style="width:${cell}px;height:${cell}px;left:${d.c * cell}px;top:${d.r * cell}px"><i></i></div>`;
        }
      }
      if (ghost) {
        h += `<div class="wall ghost ${ghost.ok ? '' : 'bad'}" style="${wallStyle(ghost.d)}"></div>`;
        if (ghost.confirm && ghost.ok) {
          const cx = ghost.d.o === 'h' ? (ghost.d.c + 1) * cell : (ghost.d.c + 1) * cell;
          const cy = ghost.d.o === 'h' ? (ghost.d.r + 1) * cell : ghost.d.r * cell;
          h += `<div class="ts-confirm" style="left:${cx}px;top:${cy}px"><button style="background:#14b268" id="gOk">✓ Qo'yish</button><button style="background:#6b7492" id="gNo">✕</button></div>`;
        }
      }
      board.innerHTML = h;
      $$('.dot', board).forEach((d) => d.onclick = () => sendMove({ t: 'm', r: Number(d.dataset.mr), c: Number(d.dataset.mc) }));
      const ok = $('#gOk', board); if (ok) ok.onclick = (e) => { e.stopPropagation(); placeGhost(); };
      const no = $('#gNo', board); if (no) no.onclick = (e) => { e.stopPropagation(); ghost = null; wallMode = null; drawAll(); };
    }

    const myTurn = () => me >= 0 && g.status === 'playing' && g.st.turn === me;

    function drawAll() {
      $('#pl' + myIdx).innerHTML = playerCard(myIdx);
      $('#pl' + opIdx).innerHTML = playerCard(opIdx);
      $('#pl0').classList.toggle('turn', g.status === 'playing' && g.st.turn === 0);
      $('#pl1').classList.toggle('turn', g.status === 'playing' && g.st.turn === 1);
      $('#lblTop').textContent = '▲ ' + g.players[opIdx].name;
      $('#lblBot').textContent = '▼ ' + g.players[myIdx].name;
      if (me >= 0) {
        $('#wl').textContent = g.st.wallsLeft[me];
        $$('.piece').forEach((pc) => { pc.classList.toggle('off', g.st.wallsLeft[me] <= 0 || g.status !== 'playing'); pc.classList.toggle('on', wallMode === pc.dataset.o); });
      }
      const s = $('#status');
      if (g.status === 'waiting') { s.textContent = 'Raqib kutilmoqda...'; s.className = 'ts-status wait'; }
      else if (g.status === 'over') { s.textContent = g.winner === me ? '🏆 G\'alaba!' : me >= 0 ? 'Mag\'lubiyat' : `🏆 ${g.players[g.winner].name} g'olib`; s.className = 'ts-status'; }
      else if (myTurn()) { s.textContent = wallMode ? 'Devor joyini tanlang' : 'Sizning navbatingiz'; s.className = 'ts-status'; }
      else { const op = g.players[g.st.turn]; s.textContent = me < 0 ? `${op.name} yurmoqda` : (op.ai ? '🤖 o\'ylamoqda...' : 'Raqib o\'ylamoqda...'); s.className = 'ts-status wait'; }
      drawBoard(); tickClocks();
    }

    function tickClocks() {
      for (let i = 0; i < 2; i++) {
        const c = $('#clk' + i); if (!c) continue;
        let ms = g.clocks[i];
        if (g.status === 'playing' && g.st.turn === i) ms -= Date.now() - recvAt;
        ms = Math.max(0, ms);
        const s = Math.ceil(ms / 1000);
        c.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        c.classList.toggle('low', s <= 30);
      }
    }

    // ---- Devor qo'yish ----
    function intersectionAt(clientX, clientY, lift) {
      const r = board.getBoundingClientRect();
      const x = clientX - r.left, y = clientY - r.top - (lift || 0);
      if (x < -cell * 0.5 || y < -cell * 0.5 || x > W + cell * 0.5 || y > W + cell * 0.5) return null;
      const C = Math.max(0, Math.min(7, Math.round(x / cell - 1)));
      const R = Math.max(0, Math.min(7, Math.round(y / cell - 1)));
      return { r: R, c: C };
    }
    function setGhost(pt, o, confirm) {
      if (!pt) { ghost = null; return; }
      const d = { r: pt.r, c: pt.c, o };
      const e = flip ? { r: 7 - d.r, c: 7 - d.c, o } : d;
      ghost = { d, e, ok: E.canPlaceWall(g.st, me, e), confirm };
    }
    async function placeGhost() {
      if (!ghost || !ghost.ok) { haptic('error'); return; }
      const e = ghost.e; ghost = null; wallMode = null;
      await sendMove({ t: 'w', r: e.r, c: e.c, o: e.o });
    }
    if (me >= 0) {
      $$('.piece').forEach((pc) => {
        pc.addEventListener('pointerdown', (ev) => {
          if (!myTurn() || g.st.wallsLeft[me] <= 0) return;
          ev.preventDefault();
          drag = { o: pc.dataset.o, x: ev.clientX, y: ev.clientY, moved: false, touch: ev.pointerType !== 'mouse' };
          haptic('select');
        });
      });
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      cleanup(() => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); });
      board.addEventListener('click', (ev) => {
        if (!wallMode || !myTurn() || ev.target.closest('.ts-confirm')) return;
        setGhost(intersectionAt(ev.clientX, ev.clientY), wallMode, true);
        haptic('select'); drawBoard();
      });
    }
    function onMove(ev) {
      if (!drag) return;
      if (Math.abs(ev.clientX - drag.x) + Math.abs(ev.clientY - drag.y) > 8) drag.moved = true;
      if (!drag.moved) return;
      ev.preventDefault();
      const pt = intersectionAt(ev.clientX, ev.clientY, drag.touch ? cell * 0.9 : 0);
      const key = pt ? pt.r + ',' + pt.c : '';
      if (key !== drag.key) { drag.key = key; setGhost(pt, drag.o, false); if (pt) haptic('select'); drawBoard(); }
    }
    function onUp() {
      if (!drag) return;
      const d = drag; drag = null;
      if (!d.moved) { // bosish: devor rejimini yoqish/o'chirish
        wallMode = wallMode === d.o ? null : d.o; ghost = null; drawAll(); return;
      }
      if (ghost && ghost.ok) placeGhost();
      else { if (ghost) { haptic('error'); toast('Bu yerga devor qo\'yib bo\'lmaydi', 'err'); } ghost = null; drawBoard(); }
    }

    let sending = false;
    async function sendMove(mv) {
      if (sending || !myTurn()) return;
      sending = true; haptic('light'); SFX.click();
      // Darhol ko'rsatish (optimistik)
      try { if (E.isLegal(g.st, me, mv)) { g.st = E.apply(g.st, me, mv); g.clocks[me] -= Date.now() - recvAt; recvAt = Date.now(); drawAll(); } } catch (e) { }
      try { const s = await post(`/api/q/${g.id}/move`, { mv }); update(s); }
      catch (e) { errToast(e); try { update(await api('/api/q/' + g.id)); } catch (e2) { } }
      sending = false;
    }

    function bubble(r) {
      const card = $('#pl' + r.idx); if (!card) return;
      const b = document.createElement('div');
      b.className = 'bubble';
      b.innerHTML = `<span class="e">${esc(r.e)}</span>${esc(r.text || '')}`;
      card.appendChild(b);
      setTimeout(() => b.remove(), 2700);
    }

    function showOver() {
      if (overShown || g.status !== 'over') return;
      overShown = true;
      const won = g.winner === me;
      const why = { goal: 'marraga yetib bordi', time: 'vaqt tugadi', resign: 'taslim bo\'ldi', left: 'o\'yinni tark etdi' }[g.reason] || '';
      const delta = g.ratingDelta && me >= 0 ? g.ratingDelta[me] : 0;
      if (me >= 0) { haptic(won ? 'success' : 'error'); won ? SFX.ok() : SFX.bad(); }
      setTimeout(() => {
        const m = modal('', `<div class="ts-over"><div class="e">${me < 0 ? '🏁' : won ? '🏆' : '😔'}</div><div class="t">${me < 0 ? g.players[g.winner].name + ' yutdi' : won ? 'G\'alaba!' : 'Mag\'lubiyat'}</div>
          <div class="muted mt">${g.reason === 'goal' ? `${esc(g.players[g.winner].name)} ${why}` : `${esc(g.players[1 - g.winner].name)}: ${why}`}</div>
          ${delta ? `<div class="mt" style="font-size:22px;font-weight:800;color:${delta > 0 ? 'var(--green)' : 'var(--red)'}">${delta > 0 ? '+' : ''}${delta} reyting</div>` : ''}</div>`,
          `<button class="btn plain" id="oMenu">Menyu</button><button class="btn" id="oAgain">🔄 Yana o'ynash</button>`);
        $('#oMenu', m.el).onclick = () => { m.close(); go('tosiq', {}, { replace: true }); };
        $('#oAgain', m.el).onclick = async () => {
          m.close();
          if (g.mode === 'ai' && g.aiLevel !== null) { try { const r = await post('/api/q/practice', { level: g.aiLevel }); go('tosiqGame', { id: r.id }, { replace: true }); } catch (e) { errToast(e); } }
          else if (g.mode === 'friend') go('tosiqFriend', {}, { replace: true });
          else go('tosiqSearch', {}, { replace: true });
        };
        cleanup(m.close);
      }, 900);
    }

    function update(s) {
      const prevTurn = g.st.turn, prevMoves = g.st.moves;
      g = s; recvAt = Date.now();
      if (g.st.moves !== prevMoves && g.lastMove && g.lastMove.idx !== me) { SFX.click(); if (g.st.turn === me) haptic('light'); }
      if (!myTurn()) { wallMode = null; ghost = null; }
      drawAll();
      showOver();
    }

    $$('[data-e]').forEach((b) => b.onclick = () => { haptic('light'); post(`/api/q/${g.id}/react`, { e: b.dataset.e }).catch(() => { }); });
    const rb = $('#resign');
    if (rb) rb.onclick = async () => { if (g.status !== 'playing') return go('tosiq', {}, { replace: true }); if (await confirmDlg('Rostdan taslim bo\'lasizmi?', 'Ha', true)) post(`/api/q/${g.id}/resign`).catch(errToast); };

    drawAll(); showOver();
    const iv = setInterval(tickClocks, 250);
    cleanup(() => clearInterval(iv));
    cleanup(stream(['q:' + g.id], { state: update, react: bubble }));
    if (TG && TG.disableVerticalSwipes) try { TG.disableVerticalSwipes(); } catch (e) { }
    cleanup(() => { if (TG && TG.enableVerticalSwipes) try { TG.enableVerticalSwipes(); } catch (e) { } });
  },
});
