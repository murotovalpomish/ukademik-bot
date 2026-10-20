// ============ Svoyak ============
'use strict';

page('svoyak', {
  async render(el, p) {
    const f = p.f || 'live';
    el.innerHTML = `<div class="page nonav">${pageHead('🎯 Svoyak', 'Boshlovchi bilan jonli o\'yin')}
      <div class="row"><button class="btn grow" id="svNew">➕ Yangi turnir</button><button class="btn ghost grow" id="svJoin">🔑 Kod bilan kirish</button></div>
      <div class="tabs mt">${[['live', '🔴 Jonli'], ['finished', '🏁 Tugagan'], ['mine', '👤 Meniki']].map(([k, t]) => `<button class="tab ${k === f ? 'on' : ''}" data-f="${k}">${t}</button>`).join('')}</div>
      <div id="svl"><div class="empty"><div class="spinner" style="margin:auto"></div></div></div></div>`;
    $('#svNew').onclick = () => go('svCreate');
    $('#svJoin').onclick = () => joinByCodeDlg();
    $$('.tab', el).forEach((b) => b.onclick = () => { App.stack.pop(); go('svoyak', { f: b.dataset.f }); });
    const r = await api('/api/sv?f=' + f);
    const box = $('#svl');
    if (!r.games.length) { box.innerHTML = `<div class="empty"><div class="e">🎯</div>${f === 'live' ? 'Hozir jonli o\'yin yo\'q. O\'zingiz turnir oching!' : 'O\'yinlar topilmadi'}</div>`; return; }
    box.innerHTML = `<div class="list">${r.games.map((g) => `<div class="li tap" data-id="${g.id}">
      <div class="av" style="--s:42px;--c:${g.status === 'finished' ? '#868e96' : '#f2a900'}">${g.status === 'live' ? '🔴' : g.status === 'lobby' ? '⏳' : '🏁'}</div>
      <div class="grow"><div class="t ell">${esc(g.title)}</div><div class="s ell">${g.status === 'live' ? 'Jonli' : g.status === 'lobby' ? 'Ishtirokchilar yig\'ilmoqda' : 'Tugagan'} · ${g.players} ishtirokchi · ${g.themes} mavzu · ${esc(g.host ? g.host.name : '')}</div></div>
      ${g.leader && g.status !== 'lobby' ? `<div class="center"><div class="small muted ell" style="max-width:80px">${g.status === 'finished' ? '🏆 ' : ''}${esc(g.leader.name)}</div><b>${g.leader.total}</b></div>` : ''}
    </div>`).join('')}</div>`;
    $$('[data-id]', box).forEach((x) => x.onclick = () => go('svGame', { id: x.dataset.id }));
  },
});

function joinByCodeDlg(gameId) {
  const m = modal('🔑 Turnirga qo\'shilish', `<div class="muted small mb">Boshlovchidan olingan 6 xonali turnir kodini kiriting. Boshlovchi tasdiqlagandan so'ng ishtirokchi bo'lasiz.</div><input class="input code-input" id="jc" inputmode="numeric" maxlength="6" placeholder="••••••">`,
    `<button class="btn plain" id="jcc">Bekor</button><button class="btn" id="jcs">Qo'shilish</button>`);
  const inp = $('#jc', m.el); setTimeout(() => inp.focus(), 50);
  $('#jcc', m.el).onclick = m.close;
  $('#jcs', m.el).onclick = async () => {
    try {
      if (gameId) { await post(`/api/sv/${gameId}/join`, { code: inp.value }); m.close(); toast('So\'rov yuborildi. Boshlovchi tasdiqlashini kuting ⏳', 'ok'); }
      else { const r = await post('/api/sv/join', { code: inp.value }); m.close(); toast('So\'rov yuborildi ⏳', 'ok'); go('svGame', { id: r.id }); }
      haptic('success');
    } catch (e) { errToast(e); }
  };
}

page('svCreate', {
  async render(el) {
    let n = 5, maxP = 6;
    el.innerHTML = `<div class="page nonav">${pageHead('Yangi turnir', 'Nom kiriting — sizga turnir kodi beriladi')}
      <div class="card">
        <label class="field"><span>Turnir nomi</span><input class="input" id="ttl" maxlength="60" placeholder="Masalan: Ukademik kubogi — 1-tur"></label>
        <div class="row field"><div class="grow"><b>Mavzular soni</b><div class="small muted">Har bir mavzuda 10–50 ballik 5 ta savol</div></div><div class="stepper"><button id="tm">−</button><div class="v" id="tn">${n}</div><button id="tp">+</button></div></div>
        <div class="row field"><div class="grow"><b>Ishtirokchilar soni</b><div class="small muted">Boshlovchi saralab qabul qiladi</div></div><div class="stepper"><button id="pm">−</button><div class="v" id="pn">${maxP}</div><button id="pp">+</button></div></div>
      </div>
      <h2>Mavzular</h2><div class="muted small mb">Nomlarni keyin ham o'zgartirish mumkin. Savol matnlari ixtiyoriy — kiritsangiz, ishtirokchilar ekranida ko'rinadi.</div>
      <div id="themes"></div>
      <button class="btn lg block mt" id="create">🎯 Turnir yaratish</button></div>`;
    const drawThemes = () => {
      const old = $$('#themes input').map((i) => i.value);
      $('#themes').innerHTML = Array.from({ length: n }, (_, i) => `<input class="input mb" data-ti="${i}" maxlength="50" placeholder="${i + 1}-mavzu nomi" value="${esc(old[i] || '')}">`).join('');
    };
    drawThemes();
    const step = (id, d, min, max, set) => $('#' + id).onclick = () => { set(d, min, max); haptic('select'); };
    step('tm', -1, 1, 12, (d) => { n = Math.max(1, n + d); $('#tn').textContent = n; drawThemes(); });
    step('tp', 1, 1, 12, (d) => { n = Math.min(12, n + d); $('#tn').textContent = n; drawThemes(); });
    step('pm', -1, 2, 16, (d) => { maxP = Math.max(2, maxP + d); $('#pn').textContent = maxP; });
    step('pp', 1, 2, 16, (d) => { maxP = Math.min(16, maxP + d); $('#pn').textContent = maxP; });
    $('#create').onclick = async () => {
      const title = $('#ttl').value.trim();
      if (!title) return toast('Turnir nomini kiriting', 'err');
      const themes = $$('#themes input').map((i) => ({ name: i.value.trim() }));
      try {
        const r = await post('/api/sv', { title, themeCount: n, maxPlayers: maxP, themes });
        haptic('success');
        go('svGame', { id: r.id }, { replace: true });
      } catch (e) { errToast(e); }
    };
  },
});

page('svGame', {
  async render(el, p) {
    let g = null, prevCells = {}, themeFilter = 'all', cdTimer = null, offset = 0, lastPhaseKey = '';
    try { g = await api('/api/sv/' + p.id); } catch (e) { el.innerHTML = `<div class="page nonav"><div class="empty"><div class="e">🤷</div>${esc(e.message)}<div class="mt"><button class="btn" onclick="go('svoyak',{},{replace:true})">Svoyak o'yinlari</button></div></div></div>`; return; }
    el.innerHTML = `<div class="page nonav" id="svp"></div>`;
    const root = $('#svp');

    const pname = (id) => { const x = g.players.find((pl) => String(pl.id) === String(id)); return x ? x.name : '—'; };
    const curKey = () => g.cur ? `${g.cur.t}|${g.cur.vi}|${g.cur.phase}|${g.cur.answering}` : '';

    function tableHtml() {
      const T = g.themes.map((t, i) => ({ ...t, i })).filter((t) => themeFilter === 'all' || String(t.i) === themeFilter);
      const sorted = g.players.slice().sort((a, b) => (g.totals[b.id] || 0) - (g.totals[a.id] || 0));
      const lead = sorted.length && g.totals[sorted[0].id] > 0 ? sorted[0].id : null;
      let h = `<div class="sv-table-wrap"><table class="sv"><thead><tr class="themes"><th class="name" rowspan="2">Ishtirokchi</th>`;
      h += T.map((t) => `<th colspan="5" data-th="${t.i}" title="${esc(t.name)}">${esc(t.name)}</th>`).join('') + `<th class="tot" rowspan="2">Jami</th></tr><tr>`;
      h += T.map(() => g.values.map((v) => `<th>${v}</th>`).join('')).join('') + `</tr></thead><tbody>`;
      for (const pl of sorted) {
        h += `<tr class="${String(pl.id) === String(lead) ? 'lead' : ''}"><td class="name"><div class="row">${av(pl, 26)}<span class="nm">${esc(pl.name)}</span></div></td>`;
        for (const t of T) {
          for (let vi = 0; vi < 5; vi++) {
            const key = `${pl.id}|${t.i}|${vi}`;
            const v = g.cells[key];
            const active = g.cur && g.cur.phase === 'answering' && String(g.cur.answering) === String(pl.id) && g.cur.t === t.i && g.cur.vi === vi;
            let cls = 'c', txt = '';
            if (active) { cls += ' act'; txt = g.values[vi]; }
            else if (v > 0) { cls += ' pos'; txt = '+' + v; }
            else if (v < 0) { cls += ' neg'; txt = '−' + Math.abs(v); }
            if (v !== undefined && prevCells[key] !== v) cls += ' pop';
            if (g.isHost) cls += ' edit';
            h += `<td class="${cls}" data-cell="${key}">${txt}</td>`;
          }
        }
        h += `<td class="tot">${g.totals[pl.id] || 0}</td></tr>`;
      }
      if (!sorted.length) h += `<tr><td class="name muted" colspan="${T.length * 5 + 2}" style="text-align:center">Hali ishtirokchilar yo'q</td></tr>`;
      return h + `</tbody></table></div>`;
    }

    function statusHtml() {
      if (g.status === 'lobby') return `<div class="sv-status"><div class="big">⏳ Ishtirokchilar yig'ilmoqda</div><div class="small muted">O'yin tez orada boshlanadi</div></div>`;
      if (g.status === 'finished') {
        const sorted = g.players.slice().sort((a, b) => (g.totals[b.id] || 0) - (g.totals[a.id] || 0));
        return `<div class="sv-status"><div class="big">🏁 O'yin tugadi</div>${sorted[0] ? `<div class="mt">🏆 G'olib: <b>${esc(sorted[0].name)}</b> — ${g.totals[sorted[0].id] || 0} ball</div>` : ''}</div>`;
      }
      const c = g.cur;
      if (!c) return `<div class="sv-status"><div class="big">🎯 Savol tanlanmoqda...</div></div>`;
      const th = g.themes[c.t] ? g.themes[c.t].name : '';
      const qline = `<div class="small" style="opacity:.8">${esc(th)} · ${g.values[c.vi]} ball</div>`;
      const qtext = c.text && c.phase !== 'closed' ? `<div class="qbox" style="text-align:left">${esc(c.text)}</div>` : '';
      if (c.phase === 'reading') return `<div class="sv-status">${qline}<div class="big">📖 Boshlovchi savolni o'qimoqda</div>${qtext}</div>`;
      if (c.phase === 'open') return `<div class="sv-status open">${qline}<div class="big">🟢 Tugmalar ochiq!</div>${qtext}</div>`;
      if (c.phase === 'answering') return `<div class="sv-status answering">${qline}<div class="big">🙋 ${esc(pname(c.answering))} javob bermoqda</div><div class="countdown" id="cd">7</div>${qtext}</div>`;
      const res = c.result;
      return `<div class="sv-status">${qline}<div class="big">${res ? (res.ok ? `✅ ${esc(pname(res.uid))}: +${g.values[c.vi]}` : '❌ Hech kim topmadi') : '⏹ Savol yopildi'}</div>${c.text ? `<div class="qbox" style="text-align:left">${esc(c.text)}</div>` : ''}</div>`;
    }

    function buzzerHtml() {
      if (!g.isPlayer || g.status !== 'live') return '';
      const c = g.cur;
      const me = App.user.id;
      let cls = '', txt = 'KUTING', sub = 'Savol hali ochilmagan';
      if (c && c.phase === 'open') {
        if (c.tried.includes(me)) { cls = 'locked'; txt = '🔒'; sub = 'Siz javob berdingiz'; }
        else { cls = 'ready'; txt = 'BOSING!'; sub = 'Birinchi bo\'ling'; }
      } else if (c && c.phase === 'answering') {
        if (c.answering === me) { cls = 'mine'; txt = 'JAVOB BERING!'; sub = '7 soniya'; }
        else { cls = 'locked'; txt = '🔒'; sub = `${esc(pname(c.answering))} javob bermoqda`; }
      } else if (c && c.phase === 'reading') { txt = '📖'; sub = 'Savolni tinglang'; }
      return `<button class="buzzer ${cls}" id="buzz">${txt}<small>${sub}</small></button>`;
    }

    function hostHtml() {
      if (!g.isHost) return '';
      let h = '';
      if (g.status === 'lobby') {
        h += `<div class="card"><h3>🔑 Turnir kodi</h3><div class="sv-code">${g.code}</div>
          <div class="small muted mt">Ishtirokchilar shu kod bilan qo'shiladi. Havola orqali kirganlar kuzatuvchi bo'ladi.</div>
          <div class="row mt"><button class="btn ghost grow sm" id="hCopy">📋 Kodni nusxalash</button><button class="btn grow sm" id="hShare">📤 Havolani ulashish</button></div></div>`;
      }
      if (g.status !== 'finished') {
        h += `<div class="card"><h3>🙋 So'rovlar (${g.requests.length})</h3>${g.requests.length ? g.requests.map((r) => `<div class="resp">${av(r, 34)}<div class="grow t ell">${esc(r.name)}</div><button class="btn sm green" data-appr="${r.id}">✓</button><button class="btn sm plain" data-rej="${r.id}">✕</button></div>`).join('') : '<div class="muted small">Hozircha so\'rov yo\'q</div>'}</div>
          <div class="card"><div class="row"><h3 class="grow" style="margin:0">👥 Ishtirokchilar (${g.players.length}/${g.maxPlayers})</h3><button class="btn sm plain" id="hGuest">+ Mehmon</button></div>
          ${g.players.map((pl) => `<div class="resp">${av(pl, 34)}<div class="grow t ell">${esc(pl.name)}${pl.guest ? ' <span class="badge gray">mehmon</span>' : ''}</div><button class="btn sm plain" data-kick="${pl.id}">Chiqarish</button></div>`).join('') || '<div class="muted small mt">Ishtirokchilarni so\'rovlardan qabul qiling</div>'}</div>`;
      }
      if (g.status === 'lobby') {
        h += `<button class="btn plain block" id="hThemes">📝 Mavzular va savollarni tahrirlash</button><button class="btn lg block mt green" id="hStart">▶️ O'yinni boshlash</button>`;
      }
      if (g.status === 'live') {
        const c = g.cur;
        h += `<div class="card"><h3>🎛 Boshqaruv</h3>`;
        if (c && c.phase === 'reading') h += `<button class="btn lg block green" id="hUnlock">🔓 Tugmalarni ochish</button><button class="btn plain block mt sm" id="hCancel">Bekor qilish</button>`;
        else if (c && c.phase === 'open') h += `<div class="small muted mb">Ishtirokchilar tugmani bosishini kuting yoki oflayn o'yinda javob beruvchini o'zingiz tanlang:</div><div class="row wrap">${g.players.filter((pl) => !c.tried.includes(pl.id)).map((pl) => `<button class="btn sm plain" data-assign="${pl.id}">${esc(pl.name)}</button>`).join('')}</div><button class="btn plain block mt" id="hClose">⏹ Hech kim topmadi — yopish</button>`;
        else if (c && c.phase === 'answering') h += `<div class="center mb"><b>${esc(pname(c.answering))}</b> javob bermoqda</div><div class="judge"><button class="btn green" id="hOk">✓ To'g'ri +${g.values[c.vi]}</button><button class="btn red" id="hBad">✗ Xato −${g.values[c.vi]}</button></div>`;
        else h += `<div class="small muted">Quyidagi jadvaldan keyingi savolni tanlang 👇</div>`;
        h += `</div>`;
        h += `<div class="card"><h3>🗂 Savollar taxtasi</h3><div class="board" style="grid-template-columns:minmax(80px,1.4fr) repeat(5,1fr)">`;
        g.themes.forEach((t, ti) => {
          h += `<div class="th">${esc(t.name)}</div>`;
          g.values.forEach((v, vi) => {
            const used = g.used[`${ti}|${vi}`];
            const cur = c && c.t === ti && c.vi === vi && c.phase !== 'closed';
            h += `<button class="cell ${used ? 'used' : ''} ${cur ? 'cur' : ''}" data-open="${ti}|${vi}">${v}</button>`;
          });
        });
        h += `</div><div class="small muted mt">Ishlatilgan katakni qayta ochish uchun uni bosing. Jadvaldagi istalgan ballni bosib tahrirlash mumkin.</div></div>`;
        h += `<div class="row"><button class="btn plain grow" id="hThemes">📝 Mavzular</button><button class="btn red grow" id="hFinish">🏁 O'yinni yakunlash</button></div>`;
      }
      if (g.status === 'finished') h += `<div class="row"><button class="btn plain grow" id="hResume">↩️ Davom ettirish</button><button class="btn red grow" id="hDel">🗑 O'chirish</button></div>`;
      return h;
    }

    function joinHtml() {
      if (g.isHost || g.isPlayer || g.status === 'finished') return '';
      if (g.myRequest) return `<div class="notice mb">⏳ So'rovingiz yuborildi. Boshlovchi tasdiqlashini kuting.</div>`;
      return `<div class="card mb" style="background:var(--gold-soft);border:0"><div class="row"><div class="grow"><b>🙋 O'yinga qo'shilish</b><div class="small muted">Siz hozir kuzatuvchisiz. Qatnashish uchun turnir kodini kiriting.</div></div><button class="btn gold sm" id="jBtn">Kod kiritish</button></div></div>`;
    }

    async function act(a) {
      try { const r = await post(`/api/sv/${g.id}/act`, a); update(r); } catch (e) { errToast(e); }
    }

    let lastScrollKey = '';
    function draw() {
      const oldWrap = $('.sv-table-wrap', root);
      const keepScroll = oldWrap ? oldWrap.scrollLeft : 0;
      root.innerHTML = `${pageHead(esc(g.title), `${g.status === 'live' ? '<span class="live-dot"></span> Jonli' : g.status === 'lobby' ? 'Kutish' : 'Tugagan'} · Boshlovchi: ${esc(g.host ? g.host.name : '')}`, `<button class="iconbtn" id="shr">📤</button>`)}
        ${joinHtml()}
        ${g.status !== 'lobby' ? statusHtml() : ''}
        ${buzzerHtml()}
        ${g.status === 'lobby' && !g.isHost ? statusHtml() : ''}
        <div class="row" style="margin:16px 0 8px"><h2 style="margin:0" class="grow">📊 Jonli jadval</h2><select class="input" id="gsel" style="width:auto;padding:7px 10px;font-size:13px"><option value="">Boshqa o'yinlar…</option></select></div>
        <div class="chips"><button class="chip ${themeFilter === 'all' ? 'on' : ''}" data-tf="all">Hammasi</button>${g.themes.map((t, i) => `<button class="chip ${themeFilter === String(i) ? 'on' : ''}" data-tf="${i}">${esc(t.name)}</button>`).join('')}</div>
        ${tableHtml()}
        <div class="mt2">${hostHtml()}</div>`;
      bind();
      const wrap = $('.sv-table-wrap', root);
      if (wrap) {
        wrap.scrollLeft = keepScroll;
        const sk = g.cur ? g.cur.t + '|' + g.cur.vi : '';
        if (sk && sk !== lastScrollKey) {
          const th = $(`[data-th="${g.cur.t}"]`, wrap);
          if (th) wrap.scrollLeft = Math.max(0, th.offsetLeft - 140);
        }
        lastScrollKey = sk;
      }
      prevCells = { ...g.cells };
      fillGameSelect();
    }

    let gamesCache = null;
    async function fillGameSelect() {
      const sel = $('#gsel'); if (!sel) return;
      if (!gamesCache) { try { const a = await api('/api/sv?f=live'); const b = await api('/api/sv?f=finished'); gamesCache = [...a.games, ...b.games]; } catch (e) { gamesCache = []; } }
      if (!$('#gsel')) return;
      $('#gsel').innerHTML = `<option value="">Boshqa o'yinlar…</option>` + gamesCache.filter((x) => x.id !== g.id).map((x) => `<option value="${x.id}">${x.status === 'finished' ? '🏁' : '🔴'} ${esc(x.title)}</option>`).join('');
      $('#gsel').onchange = (e) => { if (e.target.value) go('svGame', { id: e.target.value }, { replace: true }); };
    }

    function bind() {
      const on = (id, fn) => { const x = $('#' + id); if (x) x.onclick = fn; };
      on('shr', () => shareLink(`https://t.me/${App.bot}?start=sv_${g.id}`, `🎯 «${g.title}» Svoyak o'yinini jonli kuzating!`));
      on('jBtn', () => joinByCodeDlg(g.id));
      on('buzz', async () => {
        const c = g.cur; if (!c || c.phase !== 'open' || c.tried.includes(App.user.id)) return;
        haptic('heavy'); SFX.buzz();
        try { const r = await post(`/api/sv/${g.id}/act`, { type: 'buzz' }); update(r); } catch (e) { toast(e.message, 'err'); }
      });
      $$('[data-tf]').forEach((b) => b.onclick = () => { themeFilter = b.dataset.tf; draw(); });
      if (!g.isHost) return;
      on('hCopy', () => copyText(g.code));
      on('hShare', () => shareLink(`https://t.me/${App.bot}?start=sv_${g.id}`, `🎯 «${g.title}» Svoyak turniri! Kuzatish uchun havolani oching. Qatnashish uchun kod: ${g.code}`));
      on('hStart', () => act({ type: 'start' }));
      on('hUnlock', () => { haptic('medium'); act({ type: 'unlock' }); });
      on('hCancel', () => act({ type: 'cancel' }));
      on('hClose', () => act({ type: 'close' }));
      on('hOk', () => { haptic('success'); SFX.ok(); act({ type: 'judge', ok: true }); });
      on('hBad', () => { haptic('error'); SFX.bad(); act({ type: 'judge', ok: false }); });
      on('hFinish', async () => { if (await confirmDlg('O\'yinni yakunlaysizmi?', 'Yakunlash', true)) act({ type: 'finish' }); });
      on('hResume', () => act({ type: 'resume' }));
      on('hDel', async () => { if (await confirmDlg('Turnirni butunlay o\'chirasizmi?', 'O\'chirish', true)) { try { await del('/api/sv/' + g.id); go('svoyak', {}, { replace: true }); } catch (e) { errToast(e); } } });
      on('hThemes', () => themesDlg());
      on('hGuest', async () => { const n = await promptDlg('Mehmon ishtirokchi (botsiz)', { placeholder: 'Ismi', okText: 'Qo\'shish' }); if (n) act({ type: 'guest', name: n }); });
      $$('[data-appr]').forEach((b) => b.onclick = () => act({ type: 'approve', uid: b.dataset.appr }));
      $$('[data-rej]').forEach((b) => b.onclick = () => act({ type: 'reject', uid: b.dataset.rej }));
      $$('[data-kick]').forEach((b) => b.onclick = async () => { if (await confirmDlg('Ishtirokchini chiqarasizmi?', 'Chiqarish', true)) act({ type: 'kick', uid: b.dataset.kick }); });
      $$('[data-assign]').forEach((b) => b.onclick = () => act({ type: 'assign', uid: b.dataset.assign }));
      $$('[data-open]').forEach((b) => b.onclick = async () => {
        const [t, vi] = b.dataset.open.split('|').map(Number);
        if (g.used[`${t}|${vi}`]) { if (await confirmDlg('Bu savol ishlatilgan. Qayta ochilsinmi?', 'Ochish')) { await act({ type: 'reopen', t, vi }); act({ type: 'open', t, vi }); } return; }
        if (g.cur && (g.cur.phase === 'open' || g.cur.phase === 'answering')) { if (!(await confirmDlg('Joriy savol hali yopilmagan. Yangisini ochasizmi?', 'Ochish'))) return; act({ type: 'close' }); }
        haptic('medium'); act({ type: 'open', t, vi });
      });
      $$('td.c.edit').forEach((td) => td.onclick = () => editCell(td.dataset.cell));
    }

    function editCell(key) {
      const [pid, t, vi] = key.split('|');
      const v = g.values[Number(vi)];
      const cur = g.cells[key];
      const m = modal(`✏️ Ballni tahrirlash`, `<div class="muted small mb"><b>${esc(pname(pid))}</b> · ${esc(g.themes[t].name)} · ${v} ball. Hozir: <b>${cur === undefined ? 'bo\'sh' : (cur > 0 ? '+' : '') + cur}</b></div>
        <div class="edit-grid"><button class="btn green" data-ev="${v}">+${v}</button><button class="btn red" data-ev="${-v}">−${v}</button><button class="btn plain" data-ev="0">Bo'sh</button></div>
        <label class="field mt"><span>Yoki istalgan son</span><input class="input" id="evc" type="number" inputmode="numeric" placeholder="masalan 15 yoki -10"></label>`,
        `<button class="btn plain" id="evx">Bekor</button><button class="btn" id="evs">Saqlash</button>`);
      $$('[data-ev]', m.el).forEach((b) => b.onclick = () => { m.close(); act({ type: 'edit', uid: pid, t, vi, val: Number(b.dataset.ev) }); });
      $('#evx', m.el).onclick = m.close;
      $('#evs', m.el).onclick = () => { const x = $('#evc', m.el).value; if (x === '') return; m.close(); act({ type: 'edit', uid: pid, t, vi, val: Number(x) }); };
    }

    function themesDlg() {
      const m = modal('📝 Mavzular va savollar', g.themes.map((t, i) => `<div class="card tight mb" style="box-shadow:none"><input class="input mb" data-tn="${i}" value="${esc(t.name)}" placeholder="${i + 1}-mavzu">
        <details><summary class="small muted" style="cursor:pointer">Savol matnlari (ixtiyoriy)</summary>${g.values.map((v, j) => `<textarea class="input mt" style="min-height:54px" data-tq="${i}|${j}" placeholder="${v} ballik savol">${esc((t.q || [])[j] || '')}</textarea>`).join('')}</details></div>`).join(''),
        `<button class="btn plain" id="tdx">Bekor</button><button class="btn" id="tds">Saqlash</button>`);
      $('#tdx', m.el).onclick = m.close;
      $('#tds', m.el).onclick = () => {
        const themes = g.themes.map((t, i) => ({ name: $(`[data-tn="${i}"]`, m.el).value, q: g.values.map((v, j) => $(`[data-tq="${i}|${j}"]`, m.el).value) }));
        m.close(); act({ type: 'themes', themes });
      };
    }

    function update(ng) {
      const prevKey = curKey();
      const prevPhase = g && g.cur ? g.cur.phase : null;
      g = ng;
      offset = Date.now() - g.serverNow;
      const key = curKey();
      if (key !== prevKey) {
        if (g.cur && g.cur.phase === 'answering') { SFX.buzz(); haptic(g.cur.answering === App.user.id ? 'heavy' : 'medium'); }
        else if (g.cur && g.cur.phase === 'open' && prevPhase !== 'open') { haptic('light'); if (g.isPlayer) SFX.click(); }
      }
      draw();
    }

    function tickCd() {
      const cd = $('#cd');
      if (!cd || !g.cur || !g.cur.deadline) return;
      const left = g.cur.deadline - (Date.now() - offset);
      const s = Math.ceil(left / 1000);
      cd.textContent = left > 0 ? s : 'Vaqt tugadi!';
      if (left <= 0) cd.style.fontSize = '24px';
      const bz = $('#buzz small');
      if (bz && g.cur.answering === App.user.id) bz.textContent = left > 0 ? `${s} soniya` : 'Vaqt tugadi';
    }
    update(g);
    cdTimer = setInterval(tickCd, 150);
    cleanup(() => clearInterval(cdTimer));
    cleanup(stream(['sv:' + g.id], { state: (s) => update(s), deleted: () => { toast('Turnir o\'chirildi'); go('svoyak', {}, { replace: true }); } }));
  },
});
