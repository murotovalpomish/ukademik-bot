// ============ Shaxsiy o'yin (Svoyak) ============
'use strict';

page('svoyak', {
  async render(el, p) {
    const f = p.f || 'live';
    el.innerHTML = `<div class="page nonav">${pageHead('🎯 Shaxsiy o\'yin', 'Boshlovchi bilan jonli o\'yin')}
      <div class="row"><button class="btn grow" id="svNew">➕ Turnir yaratish</button><button class="btn ghost grow" id="svJoin">🔑 Kod bilan kirish</button></div>
      <input class="input mt" id="svQ" placeholder="🔎 Turnir yoki boshlovchi nomi" value="${esc(p.q || '')}">
      <div class="chips mt">${[['live', '🔴 Faol'], ['finished', '🏁 Tugagan'], ['mine', '👤 Meniki'], ['closed', '🔒 Yopiq']].map(([k, t]) => `<button class="chip ${k === f ? 'on' : ''}" data-f="${k}">${t}</button>`).join('')}</div>
      <div id="svl"><div class="empty"><div class="spinner" style="margin:auto"></div></div></div></div>`;
    $('#svNew').onclick = () => go('svCreate');
    $('#svJoin').onclick = () => joinByCodeDlg();
    $$('.chip[data-f]', el).forEach((b) => b.onclick = () => { App.stack.pop(); go('svoyak', { f: b.dataset.f, q: $('#svQ').value }); });
    const load = async () => {
      const r = await api(`/api/sv?f=${f}&q=${encodeURIComponent($('#svQ') ? $('#svQ').value : '')}`);
      const box = $('#svl'); if (!box) return;
      if (!r.games.length) { box.innerHTML = `<div class="empty"><div class="e">🎯</div>${f === 'live' ? 'Hozir faol turnir yo\'q. O\'zingiz yarating!' : 'Turnirlar topilmadi'}</div>`; return; }
      box.innerHTML = `<div class="list">${r.games.map((g) => `<div class="li tap" data-id="${g.id}">
        <div class="av" style="--s:40px;--c:${g.status === 'finished' ? '#868e96' : g.closed ? '#495057' : '#f2a900'}">${g.locked ? '🔒' : g.status === 'live' ? '🔴' : g.status === 'lobby' ? '⏳' : '🏁'}</div>
        <div class="grow" style="min-width:0"><div class="t ell">${g.closed ? '🔒 ' : ''}${esc(g.title)}</div><div class="s ell">${g.status === 'live' ? 'Jonli' : g.status === 'lobby' ? 'Yig\'ilmoqda' : 'Tugagan'} · ${g.players} ishtirokchi · ${esc(g.host ? g.host.name : '')}</div></div>
        ${g.leader && g.status !== 'lobby' && !g.locked ? `<div class="center"><div class="small muted ell" style="max-width:76px">${esc(g.leader.name)}</div><b>${g.leader.total}</b></div>` : ''}</div>`).join('')}</div>`;
      $$('[data-id]', box).forEach((x) => x.onclick = () => go('svGame', { id: x.dataset.id }));
    };
    let t = null;
    $('#svQ').oninput = () => { clearTimeout(t); t = setTimeout(load, 350); };
    await load();
  },
});

function joinByCodeDlg(gameId) {
  const m = modal('🔑 Kod bilan kirish', `<div class="muted small mb">Boshlovchidan olingan 6 xonali kodni kiriting. Ishtirok etish uchun boshlovchi tasdiqlaydi.</div><input class="input code-input" id="jc" inputmode="numeric" maxlength="6" placeholder="••••••">`,
    `<button class="btn plain" id="jcc">Bekor</button><button class="btn" id="jcs">Kirish</button>`);
  const inp = $('#jc', m.el); setTimeout(() => inp.focus(), 50);
  $('#jcc', m.el).onclick = m.close;
  $('#jcs', m.el).onclick = async () => {
    try {
      if (gameId) { await post(`/api/sv/${gameId}/join`, { code: inp.value }); m.close(); toast('So\'rov yuborildi ⏳', 'ok'); reload(); }
      else { const r = await post('/api/sv/join', { code: inp.value }); m.close(); toast('So\'rov yuborildi ⏳', 'ok'); go('svGame', { id: r.id }); }
      haptic('success');
    } catch (e) { errToast(e); }
  };
}

page('svCreate', {
  async render(el) {
    let n = 5, maxP = 6, closed = false;
    el.innerHTML = `<div class="page nonav">${pageHead('Yangi turnir', 'Nom kiriting — sizga turnir kodi beriladi')}
      <div class="card">
        <label class="field"><span>Turnir nomi</span><input class="input" id="ttl" maxlength="60" placeholder="Masalan: Ukademik kubogi — 1-tur"></label>
        <div class="field"><span>Turnir turi</span><div class="seg" id="cl"><button class="on" data-v="0">🌐 Ochiq</button><button data-v="1">🔒 Yopiq</button></div>
          <div class="small muted mt" id="clHint">Hamma ko'ra oladi, qatnashish uchun so'rov yuboradi</div></div>
        <div class="row field"><div class="grow"><b>Mavzular soni</b><div class="small muted">Har mavzuda 10–50 ballik 5 savol</div></div><div class="stepper"><button id="tm">−</button><div class="v" id="tn">${n}</div><button id="tp">+</button></div></div>
        <div class="row field"><div class="grow"><b>Ishtirokchilar</b><div class="small muted">Boshlovchi saralab qabul qiladi</div></div><div class="stepper"><button id="pm">−</button><div class="v" id="pn">${maxP}</div><button id="pp">+</button></div></div>
        <label class="field"><span>🎙 Ovozli chat havolasi (ixtiyoriy)</span><input class="input" id="vl" placeholder="https://t.me/guruh?voicechat"></label>
        <div class="small muted" style="margin-top:-6px">Telegram guruhingizda ovozli chat oching va havolasini qo'ying — ishtirokchilar bir tugma bilan kiradi.</div>
      </div>
      <h2>Mavzular</h2>
      <div id="themes"></div>
      <button class="btn lg block mt" id="create">🎯 Turnir yaratish</button></div>`;
    const drawThemes = () => {
      const old = $$('#themes input').map((i) => i.value);
      $('#themes').innerHTML = Array.from({ length: n }, (_, i) => `<input class="input mb" maxlength="50" placeholder="${i + 1}-mavzu nomi" value="${esc(old[i] || '')}">`).join('');
    };
    drawThemes();
    $$('#cl button').forEach((b) => b.onclick = () => { closed = b.dataset.v === '1'; $$('#cl button').forEach((x) => x.classList.toggle('on', x === b)); $('#clHint').textContent = closed ? 'Ro\'yxatda ko\'rinadi, lekin kirish uchun sizning ruxsatingiz yoki kod kerak' : 'Hamma ko\'ra oladi, qatnashish uchun so\'rov yuboradi'; haptic('select'); });
    $('#tm').onclick = () => { n = Math.max(1, n - 1); $('#tn').textContent = n; drawThemes(); };
    $('#tp').onclick = () => { n = Math.min(12, n + 1); $('#tn').textContent = n; drawThemes(); };
    $('#pm').onclick = () => { maxP = Math.max(2, maxP - 1); $('#pn').textContent = maxP; };
    $('#pp').onclick = () => { maxP = Math.min(16, maxP + 1); $('#pn').textContent = maxP; };
    $('#create').onclick = async () => {
      const title = $('#ttl').value.trim();
      if (!title) return toast('Turnir nomini kiriting', 'err');
      try {
        const r = await post('/api/sv', { title, themeCount: n, maxPlayers: maxP, closed, voiceLink: $('#vl').value.trim(), themes: $$('#themes input').map((i) => ({ name: i.value.trim() })) });
        haptic('success'); go('svGame', { id: r.id }, { replace: true });
      } catch (e) { errToast(e); }
    };
  },
});

page('svGame', {
  async render(el, p) {
    let g, tab = null, themeFilter = 'all', offset = 0, prevCells = {}, chat = [], unread = 0, lastScrollKey = '', rec = null;
    try { g = await api('/api/sv/' + p.id); } catch (e) { el.innerHTML = `<div class="page nonav"><div class="empty"><div class="e">🤷</div>${esc(e.message)}</div></div>`; return; }
    el.innerHTML = `<div class="svp" id="svp"></div>`;
    const root = $('#svp');
    const autoVoice = () => { try { return localStorage.getItem('svAutoVoice') !== '0'; } catch (e) { return true; } };
    const pname = (id) => { const x = g.players.find((pl) => String(pl.id) === String(id)); return x ? x.name : '—'; };
    const curLabel = () => (g.cur ? `${esc(g.themes[g.cur.t] ? g.themes[g.cur.t].name : '')} · ${g.values[g.cur.vi]}` : '');

    // ---------- Yuqori qism ----------
    function nowBar() {
      if (g.locked) return '';
      let cls = '', right = '';
      if (g.status === 'lobby') { right = '⏳ Ishtirokchilar yig\'ilmoqda'; }
      else if (g.status === 'finished') {
        const s = g.players.slice().sort((a, b) => (g.totals[b.id] || 0) - (g.totals[a.id] || 0))[0];
        right = s ? `🏆 G'olib: <b>${esc(s.name)}</b> · ${g.totals[s.id] || 0}` : '🏁 Tugadi';
      } else if (!g.cur) right = '🎯 Savol tanlanmoqda…';
      else if (g.cur.phase === 'reading') { right = '📖 Savol o\'qilmoqda'; cls = 'read'; }
      else if (g.cur.phase === 'open') { right = '🟢 Tugmalar ochiq!'; cls = 'open'; }
      else if (g.cur.phase === 'answering') { right = `🙋 <b>${esc(pname(g.cur.answering))}</b> javob bermoqda <span class="cd" id="cd">7</span>`; cls = 'ans'; }
      else { const r = g.cur.result; right = r && r.ok ? `✅ ${esc(pname(r.uid))} +${g.values[g.cur.vi]}` : '⏹ Savol yopildi'; }
      return `<div class="sv-now ${cls}">${g.cur && g.status === 'live' ? `<span class="q">${curLabel()}</span>` : ''}<span class="st">${right}</span></div>
        ${g.cur && g.cur.text && g.cur.phase !== 'closed' && g.status === 'live' ? `<div class="sv-qtext">${esc(g.cur.text)}</div>` : ''}`;
    }
    function topBar() {
      return `<div class="sv-top">${!TG ? '<button class="iconbtn sm" onclick="back()">←</button>' : ''}
        <div class="grow" style="min-width:0"><div class="t ell">${g.closed ? '🔒 ' : ''}${esc(g.title)}</div><div class="s ell">${g.status === 'live' ? '<span class="live-dot"></span> Jonli' : g.status === 'lobby' ? 'Kutish' : 'Tugagan'} · ${esc(g.host ? g.host.name : '')}</div></div>
        ${g.voiceLink ? '<button class="iconbtn sm" id="vBtn" title="Ovozli chat">🎙</button>' : ''}<button class="iconbtn sm" id="shr">📤</button></div>`;
    }
    function joinBar() {
      if (g.locked || g.isHost || g.isPlayer || g.status === 'finished') return '';
      if (g.myRequest) return `<div class="sv-join">⏳ So'rovingiz boshlovchiga yuborildi</div>`;
      return `<div class="sv-join"><span class="grow">👀 Siz kuzatuvchisiz</span><button class="btn gold sm" id="jReq">🙋 Qatnashish</button></div>`;
    }
    function tabsHtml() {
      const T = [['table', '📊 Jadval'], ['chat', `💬 Chat${unread ? ` <span class="badge red">${unread}</span>` : ''}`]];
      if (g.isHost) T.unshift(['ctrl', '🎛 Boshqaruv']), T.push(['people', `👥 ${g.players.length}${(g.requests || []).length + (g.access || []).length ? ` <span class="badge red">${(g.requests || []).length + (g.access || []).length}</span>` : ''}`]);
      return `<div class="tabs sv-tabs">${T.map(([k, t]) => `<button class="tab ${k === tab ? 'on' : ''}" data-tab="${k}">${t}</button>`).join('')}</div>`;
    }

    // ---------- Jadval ----------
    function tableHtml() {
      const T = g.themes.map((t, i) => ({ ...t, i })).filter((t) => themeFilter === 'all' || String(t.i) === themeFilter);
      const sorted = g.players.slice().sort((a, b) => (g.totals[b.id] || 0) - (g.totals[a.id] || 0));
      const lead = sorted.length && g.totals[sorted[0].id] > 0 ? sorted[0].id : null;
      const curT = g.cur && g.status === 'live' ? g.cur.t : -1, curV = g.cur && g.status === 'live' ? g.cur.vi : -1;
      let h = `<div class="chips sv-chips"><button class="chip ${themeFilter === 'all' ? 'on' : ''}" data-tf="all">Hammasi</button>${g.themes.map((t, i) => `<button class="chip ${themeFilter === String(i) ? 'on' : ''} ${i === curT ? 'cur' : ''}" data-tf="${i}">${esc(t.name)}</button>`).join('')}</div>`;
      h += `<div class="sv-table-wrap"><table class="sv"><thead><tr class="themes"><th class="name" rowspan="2"></th>`;
      h += T.map((t) => `<th colspan="5" data-th="${t.i}" class="${t.i === curT ? 'curth' : ''}">${esc(t.name)}</th>`).join('') + `<th class="tot" rowspan="2">Σ</th></tr><tr class="vals">`;
      h += T.map((t) => g.values.map((v, vi) => `<th class="${t.i === curT && vi === curV ? 'curv' : ''}">${v}</th>`).join('')).join('') + `</tr></thead><tbody>`;
      for (const pl of sorted) {
        h += `<tr class="${String(pl.id) === String(lead) ? 'lead' : ''}"><td class="name"><div class="row">${av(pl, 22)}<span class="nm">${esc(pl.name)}</span></div></td>`;
        for (const t of T) for (let vi = 0; vi < 5; vi++) {
          const key = `${pl.id}|${t.i}|${vi}`, v = g.cells[key];
          const active = g.cur && g.cur.phase === 'answering' && String(g.cur.answering) === String(pl.id) && g.cur.t === t.i && g.cur.vi === vi;
          let cls = 'c', txt = '';
          if (active) { cls += ' act'; txt = g.values[vi]; }
          else if (v > 0) { cls += ' pos'; txt = '+' + v; } else if (v < 0) { cls += ' neg'; txt = '−' + Math.abs(v); }
          if (v !== undefined && prevCells[key] !== v) cls += ' pop';
          if (g.isHost) cls += ' edit';
          h += `<td class="${cls}" data-cell="${key}">${txt}</td>`;
        }
        h += `<td class="tot">${g.totals[pl.id] || 0}</td></tr>`;
      }
      if (!sorted.length) h += `<tr><td class="name muted" colspan="${T.length * 5 + 2}" style="text-align:center">Ishtirokchilar hali yo'q</td></tr>`;
      return h + `</tbody></table></div>`;
    }

    // ---------- Boshqaruv (boshlovchi) ----------
    function ctrlHtml() {
      let h = '';
      if (g.status === 'lobby') {
        h += `<div class="card tight"><div class="row"><div class="grow"><div class="small muted">Turnir kodi</div><div class="sv-code sm">${g.code}</div></div>
          <div style="display:flex;flex-direction:column;gap:6px"><button class="btn sm ghost" id="hCopy">📋 Nusxa</button><button class="btn sm" id="hShare">📤 Ulashish</button></div></div>
          <div class="small muted mt">Kod — qatnashish uchun. Havola orqali kirganlar ${g.closed ? 'ruxsat so\'raydi' : 'kuzatuvchi bo\'ladi'}.</div></div>
          <div class="card tight"><div class="row"><div class="grow"><b>${g.closed ? '🔒 Yopiq turnir' : '🌐 Ochiq turnir'}</b></div><button class="switch ${g.closed ? 'on' : ''}" id="hClosed"></button></div>
          <div class="row mt"><div class="grow small">🎙 Ovozli chat: ${g.voiceLink ? `<a href="#" id="vOpen">ulangan</a>` : '<span class="muted">yo\'q</span>'}</div><button class="btn sm plain" id="hVoice">${g.voiceLink ? 'O\'zgartirish' : 'Qo\'shish'}</button></div></div>
          <button class="btn plain block" id="hThemes">📝 Mavzular va savollar</button>
          <button class="btn lg block mt green" id="hStart">▶️ O'yinni boshlash (${g.players.length} ishtirokchi)</button>`;
        return h;
      }
      if (g.status === 'live') {
        const c = g.cur;
        h += `<div class="card tight sv-act">`;
        if (c && c.phase === 'reading') h += `<div class="small muted mb">Savolni o'qing, so'ng tugmalarni oching</div><button class="btn lg block green" id="hUnlock">🔓 Tugmalarni ochish</button><button class="btn plain block sm mt" id="hCancel">Bekor qilish</button>`;
        else if (c && c.phase === 'open') h += `<div class="small muted mb">Ishtirokchi tugmani bosishini kuting yoki o'zingiz tanlang:</div><div class="row wrap">${g.players.filter((pl) => !c.tried.includes(pl.id)).map((pl) => `<button class="btn sm plain" data-assign="${pl.id}">${esc(pl.name)}</button>`).join('')}</div><button class="btn plain block sm mt" id="hClose">⏹ Hech kim topmadi — yopish</button>`;
        else if (c && c.phase === 'answering') h += `<div class="center mb"><b>${esc(pname(c.answering))}</b> javob bermoqda · <span id="cd2">7</span></div><div class="judge"><button class="btn green" id="hOk">✓ To'g'ri +${g.values[c.vi]}</button><button class="btn red" id="hBad">✗ Xato −${g.values[c.vi]}</button></div>`;
        else h += `<div class="small muted center">👇 Keyingi savolni tanlang</div>`;
        h += `</div>`;
        h += `<div class="board" style="grid-template-columns:minmax(70px,1.3fr) repeat(5,1fr)">`;
        g.themes.forEach((t, ti) => {
          h += `<div class="th">${esc(t.name)}</div>`;
          g.values.forEach((v, vi) => {
            const used = g.used[`${ti}|${vi}`], cur = c && c.t === ti && c.vi === vi && c.phase !== 'closed';
            h += `<button class="cell ${used ? 'used' : ''} ${cur ? 'cur' : ''}" data-open="${ti}|${vi}">${v}</button>`;
          });
        });
        h += `</div><label class="row small mt" style="gap:8px"><button class="switch sm ${quickOpen() ? 'on' : ''}" id="hQuick"></button> Savolni tanlaganda tugmalar darhol ochilsin</label>
          <div class="row mt"><button class="btn plain grow sm" id="hThemes">📝 Mavzular</button><button class="btn red grow sm" id="hFinish">🏁 Yakunlash</button></div>`;
      }
      if (g.status === 'finished') h += `<div class="row"><button class="btn plain grow" id="hResume">↩️ Davom ettirish</button><button class="btn red grow" id="hDel">🗑 O'chirish</button></div>`;
      return h;
    }
    const quickOpen = () => { try { return localStorage.getItem('svQuick') === '1'; } catch (e) { return false; } };

    function peopleHtml() {
      const acc = g.access || [], req = g.requests || [];
      let h = '';
      if (acc.length) h += `<div class="card tight"><h3>🔐 Kirish so'rovlari</h3>${acc.map((r) => `<div class="resp">${av(r, 30)}<div class="grow t ell">${esc(r.name)}</div><button class="btn sm green" data-acc="${r.id}">✓</button><button class="btn sm plain" data-accno="${r.id}">✕</button></div>`).join('')}</div>`;
      h += `<div class="card tight"><h3>🙋 Qatnashish so'rovlari (${req.length})</h3>${req.length ? req.map((r) => `<div class="resp">${av(r, 30)}<div class="grow t ell">${esc(r.name)}</div><button class="btn sm green" data-appr="${r.id}">✓</button><button class="btn sm plain" data-rej="${r.id}">✕</button></div>`).join('') : '<div class="muted small">So\'rov yo\'q</div>'}</div>
        <div class="card tight"><div class="row"><h3 class="grow" style="margin:0">👥 Ishtirokchilar (${g.players.length}/${g.maxPlayers})</h3><button class="btn sm plain" id="hGuest">+ Mehmon</button></div>
        ${g.players.map((pl) => `<div class="resp">${av(pl, 30)}<div class="grow t ell">${esc(pl.name)}${pl.guest ? ' <span class="badge gray">mehmon</span>' : ''}</div><button class="btn sm plain" data-kick="${pl.id}">Chiqarish</button></div>`).join('') || '<div class="muted small mt">Hali yo\'q</div>'}</div>`;
      return h;
    }

    // ---------- Chat ----------
    function msgHtml(m) {
      const mine = m.uid === App.user.id;
      const body = m.t === 'voice'
        ? `<div class="vmsg"><button class="vplay" data-vplay="${m.vid}">▶</button><div class="vbar"><i></i></div><span class="small">${Math.floor(m.dur / 60)}:${String(m.dur % 60).padStart(2, '0')}</span></div>`
        : `<div class="mtext">${esc(m.text)}</div>`;
      return `<div class="msg ${mine ? 'mine' : ''}" data-mid="${m.id}">${mine ? '' : av(m.u || { name: '?' }, 28)}<div class="bub"><div class="mname">${esc(m.u ? m.u.name : '')}${m.uid === (g.host && g.host.id) ? ' <span class="badge gold" style="padding:1px 6px">boshlovchi</span>' : ''}</div>${body}<div class="mtime">${m.ed ? 'tahrirlangan · ' : ''}${fmtTime(m.at)}</div></div></div>`;
    }
    function chatHtml() {
      return `${g.pinned ? `<div class="pinbar" id="pinbar">📌 <span class="ell grow">${g.pinned.t === 'voice' ? '🎤 Ovozli xabar' : esc(g.pinned.text)}</span></div>` : ''}
        <div class="msgs" id="msgs">${chat.length ? chat.map(msgHtml).join('') : '<div class="empty small">Hali xabarlar yo\'q</div>'}</div>
        ${g.canChat ? `<div class="chatbar"><input class="input" id="cIn" maxlength="1000" placeholder="Javob yoki xabar yozing..."><button class="iconbtn" id="cMic">🎤</button><button class="btn" id="cSend">➤</button></div>` : '<div class="muted small center mt">Yozish faqat ishtirokchilar va boshlovchi uchun</div>'}
        <label class="row small mt" style="gap:8px;justify-content:center"><button class="switch sm ${autoVoice() ? 'on' : ''}" id="cAuto"></button> Boshlovchining ovozli xabarlari avtomatik eshittirilsin</label>`;
    }
    function scrollChat() { const m = $('#msgs'); if (m) m.scrollTop = m.scrollHeight; }

    // ---------- Chizish ----------
    function draw() {
      if (!tab) tab = g.isHost ? 'ctrl' : 'table';
      if (tab === 'ctrl' && !g.isHost) tab = 'table';
      const oldWrap = $('.sv-table-wrap', root);
      const keepScroll = oldWrap ? oldWrap.scrollLeft : 0;
      const keepInput = $('#cIn') ? $('#cIn').value : '';
      if (g.locked) {
        root.innerHTML = `<div class="page nonav">${topBar()}<div class="card center mt2"><div style="font-size:46px">🔒</div><h3>Yopiq turnir</h3><div class="muted small">Ko'rish uchun boshlovchidan ruxsat so'rang yoki turnir kodini kiriting.</div>
          ${g.myAccess ? '<div class="notice mt">⏳ Ruxsat so\'raldi, boshlovchi javobini kuting</div>' : '<button class="btn block mt" id="lAcc">🔐 Ruxsat so\'rash</button>'}<button class="btn ghost block mt" id="lCode">🔑 Kod bilan kirish</button></div></div>`;
        bindCommon(); return;
      }
      root.innerHTML = `<div class="sv-head">${topBar()}${nowBar()}</div><div class="page nonav sv-body">${joinBar()}${tabsHtml()}<div id="tabc">${tab === 'table' ? tableHtml() : tab === 'chat' ? chatHtml() : tab === 'ctrl' ? ctrlHtml() : peopleHtml()}</div></div>${buzzerHtml()}`;
      bindCommon();
      if (tab === 'chat') { scrollChat(); if ($('#cIn')) $('#cIn').value = keepInput; }
      const wrap = $('.sv-table-wrap', root);
      if (wrap) {
        wrap.scrollLeft = keepScroll;
        const sk = g.cur ? g.cur.t + '|' + g.cur.vi : '';
        if (sk && sk !== lastScrollKey) { const th = $(`[data-th="${g.cur.t}"]`, wrap); if (th) { const nw = ($('th.name', wrap) || {}).offsetWidth || 104; wrap.scrollLeft = Math.max(0, th.offsetLeft - nw); } }
        lastScrollKey = sk;
      }
      prevCells = { ...g.cells };
      tickCd();
    }
    function buzzerHtml() {
      if (!g.isPlayer || g.status !== 'live' || g.locked) return '';
      const c = g.cur, me = App.user.id;
      let cls = '', txt = '⏳ Kuting';
      if (c && c.phase === 'open') { if (c.tried.includes(me)) { cls = 'locked'; txt = '🔒 Javob berdingiz'; } else { cls = 'ready'; txt = '🔔 BOSING!'; } }
      else if (c && c.phase === 'answering') { if (c.answering === me) { cls = 'mine'; txt = '🗣 JAVOB BERING! <span id="bcd"></span>'; } else { cls = 'locked'; txt = `🔒 ${esc(pname(c.answering))} javob bermoqda`; } }
      else if (c && c.phase === 'reading') txt = '📖 Savolni tinglang';
      return `<div class="buzzbar"><button class="buzz2 ${cls}" id="buzz">${txt}</button></div>`;
    }

    async function act(a) { try { const r = await post(`/api/sv/${g.id}/act`, a); if (r && r.id) update(r); } catch (e) { errToast(e); } }

    function bindCommon() {
      const on = (id, fn) => { const x = $('#' + id); if (x) x.onclick = fn; };
      on('shr', () => shareLink(`https://t.me/${App.bot}?start=sv_${g.id}`, `🎯 «${g.title}» — Shaxsiy o'yin turnirini jonli kuzating!`));
      on('vBtn', () => openTgLink(g.voiceLink));
      on('vOpen', (e) => { e.preventDefault(); openTgLink(g.voiceLink); });
      on('lAcc', () => act({ type: 'access' }).then(() => toast('Ruxsat so\'raldi ⏳', 'ok')));
      on('lCode', () => joinByCodeDlg(g.id));
      on('jReq', () => act({ type: 'request' }).then(() => toast('So\'rov yuborildi ⏳', 'ok')));
      on('buzz', async () => {
        const c = g.cur; if (!c || c.phase !== 'open' || c.tried.includes(App.user.id)) return;
        haptic('heavy'); SFX.buzz();
        try { update(await post(`/api/sv/${g.id}/act`, { type: 'buzz' })); } catch (e) { toast(e.message, 'err'); }
      });
      $$('[data-tab]').forEach((b) => b.onclick = () => { tab = b.dataset.tab; if (tab === 'chat') unread = 0; haptic('select'); draw(); });
      $$('[data-tf]').forEach((b) => b.onclick = () => { themeFilter = b.dataset.tf; draw(); });
      // chat
      on('cSend', sendText);
      const ci = $('#cIn'); if (ci) ci.onkeydown = (e) => { if (e.key === 'Enter') sendText(); };
      on('cMic', toggleRec);
      on('cAuto', () => { try { localStorage.setItem('svAutoVoice', autoVoice() ? '0' : '1'); } catch (e) { } draw(); });
      on('pinbar', () => { const el2 = $(`[data-mid="${g.pinned.id}"]`); if (el2) el2.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
      $$('[data-mid]').forEach((m) => m.onclick = (e) => { if (e.target.closest('[data-vplay]')) return; msgMenu(m.dataset.mid); });
      $$('[data-vplay]').forEach((b) => b.onclick = () => playVoice(b.dataset.vplay, b));
      if (!g.isHost) return;
      on('hCopy', () => copyText(g.code));
      on('hShare', () => shareLink(`https://t.me/${App.bot}?start=sv_${g.id}`, `🎯 «${g.title}» turniri! Kuzatish uchun havolani oching. Qatnashish kodi: ${g.code}`));
      on('hClosed', () => act({ type: 'settings', closed: !g.closed }));
      on('hVoice', async () => { const v = await promptDlg('🎙 Ovozli chat havolasi', { value: g.voiceLink, placeholder: 'https://t.me/guruh?voicechat' }); if (v !== null) act({ type: 'settings', voiceLink: v }); });
      on('hStart', () => act({ type: 'start' }));
      on('hUnlock', () => { haptic('medium'); act({ type: 'unlock' }); });
      on('hCancel', () => act({ type: 'cancel' }));
      on('hClose', () => act({ type: 'close' }));
      on('hOk', () => { haptic('success'); SFX.ok(); act({ type: 'judge', ok: true }); });
      on('hBad', () => { haptic('error'); SFX.bad(); act({ type: 'judge', ok: false }); });
      on('hFinish', async () => { if (await confirmDlg('O\'yinni yakunlaysizmi?', 'Yakunlash', true)) act({ type: 'finish' }); });
      on('hResume', () => act({ type: 'resume' }));
      on('hDel', async () => { if (await confirmDlg('Turnirni butunlay o\'chirasizmi?', 'O\'chirish', true)) { try { await del('/api/sv/' + g.id); go('svoyak', {}, { replace: true }); } catch (e) { errToast(e); } } });
      on('hThemes', themesDlg);
      on('hQuick', () => { try { localStorage.setItem('svQuick', quickOpen() ? '0' : '1'); } catch (e) { } draw(); });
      on('hGuest', async () => { const n = await promptDlg('Mehmon ishtirokchi (botsiz)', { placeholder: 'Ismi', okText: 'Qo\'shish' }); if (n) act({ type: 'guest', name: n }); });
      $$('[data-appr]').forEach((b) => b.onclick = () => act({ type: 'approve', uid: b.dataset.appr }));
      $$('[data-rej]').forEach((b) => b.onclick = () => act({ type: 'reject', uid: b.dataset.rej }));
      $$('[data-acc]').forEach((b) => b.onclick = () => act({ type: 'access-ok', uid: b.dataset.acc }));
      $$('[data-accno]').forEach((b) => b.onclick = () => act({ type: 'access-no', uid: b.dataset.accno }));
      $$('[data-kick]').forEach((b) => b.onclick = async () => { if (await confirmDlg('Ishtirokchini chiqarasizmi?', 'Chiqarish', true)) act({ type: 'kick', uid: b.dataset.kick }); });
      $$('[data-assign]').forEach((b) => b.onclick = () => act({ type: 'assign', uid: b.dataset.assign }));
      $$('[data-open]').forEach((b) => b.onclick = async () => {
        const [t, vi] = b.dataset.open.split('|').map(Number);
        if (g.used[`${t}|${vi}`] && !(await confirmDlg('Bu savol ishlatilgan. Qayta ochilsinmi?', 'Ochish'))) return;
        if (g.cur && (g.cur.phase === 'open' || g.cur.phase === 'answering') && !(await confirmDlg('Joriy savol yopilmagan. Yangisini ochasizmi?', 'Ochish'))) return;
        haptic('medium'); act({ type: 'open', t, vi, unlock: quickOpen() });
      });
      $$('td.c.edit').forEach((td) => td.onclick = () => editCell(td.dataset.cell));
    }

    function editCell(key) {
      const [pid, t, vi] = key.split('|');
      const v = g.values[Number(vi)], cur = g.cells[key];
      const m = modal('✏️ Ballni tahrirlash', `<div class="muted small mb"><b>${esc(pname(pid))}</b> · ${esc(g.themes[t].name)} · ${v}. Hozir: <b>${cur === undefined ? 'bo\'sh' : (cur > 0 ? '+' : '') + cur}</b></div>
        <div class="edit-grid"><button class="btn green" data-ev="${v}">+${v}</button><button class="btn red" data-ev="${-v}">−${v}</button><button class="btn plain" data-ev="0">Bo'sh</button></div>
        <label class="field mt"><span>Yoki istalgan son</span><input class="input" id="evc" type="number" inputmode="numeric" placeholder="masalan 15 yoki -10"></label>`,
        `<button class="btn plain" id="evx">Bekor</button><button class="btn" id="evs">Saqlash</button>`);
      $$('[data-ev]', m.el).forEach((b) => b.onclick = () => { m.close(); act({ type: 'edit', uid: pid, t, vi, val: Number(b.dataset.ev) }); });
      $('#evx', m.el).onclick = m.close;
      $('#evs', m.el).onclick = () => { const x = $('#evc', m.el).value; if (x === '') return; m.close(); act({ type: 'edit', uid: pid, t, vi, val: Number(x) }); };
    }
    function themesDlg() {
      const m = modal('📝 Mavzular va savollar', g.themes.map((t, i) => `<div class="card tight mb" style="box-shadow:none"><input class="input mb" data-tn="${i}" value="${esc(t.name)}">
        <details><summary class="small muted" style="cursor:pointer">Savol matnlari (ixtiyoriy)</summary>${g.values.map((v, j) => `<textarea class="input mt" style="min-height:50px" data-tq="${i}|${j}" placeholder="${v} ballik savol">${esc((t.q || [])[j] || '')}</textarea>`).join('')}</details></div>`).join(''),
        `<button class="btn plain" id="tdx">Bekor</button><button class="btn" id="tds">Saqlash</button>`);
      $('#tdx', m.el).onclick = m.close;
      $('#tds', m.el).onclick = () => { const themes = g.themes.map((t, i) => ({ name: $(`[data-tn="${i}"]`, m.el).value, q: g.values.map((v, j) => $(`[data-tq="${i}|${j}"]`, m.el).value) })); m.close(); act({ type: 'themes', themes }); };
    }

    // ---------- Chat amallari ----------
    async function sendText() {
      const i = $('#cIn'); const text = i.value.trim(); if (!text) return;
      i.value = '';
      try { await post(`/api/sv/${g.id}/act`, { type: 'chat', text }); } catch (e) { errToast(e); i.value = text; }
    }
    function msgMenu(mid) {
      const m = chat.find((x) => x.id === mid); if (!m) return;
      const mine = m.uid === App.user.id;
      const btns = [];
      if (mine && m.t === 'text') btns.push('<button class="btn plain block" data-a="edit">✏️ Tahrirlash</button>');
      if (g.isHost) btns.push(`<button class="btn plain block mt" data-a="pin">📌 ${g.pinned && g.pinned.id === mid ? 'Pindan olish' : 'Pinga qadash'}</button>`);
      if (mine || g.isHost) btns.push('<button class="btn red block mt" data-a="del">🗑 O\'chirish</button>');
      if (m.t === 'text') btns.push('<button class="btn plain block mt" data-a="copy">📋 Nusxa olish</button>');
      if (!btns.length) return;
      const md = modal('Xabar', btns.join(''));
      $$('[data-a]', md.el).forEach((b) => b.onclick = async () => {
        md.close();
        try {
          if (b.dataset.a === 'edit') { const t = await promptDlg('✏️ Tahrirlash', { value: m.text }); if (t) await post(`/api/sv/${g.id}/act`, { type: 'chat-edit', mid, text: t }); }
          else if (b.dataset.a === 'pin') await act({ type: 'chat-pin', mid });
          else if (b.dataset.a === 'del') await post(`/api/sv/${g.id}/act`, { type: 'chat-del', mid });
          else copyText(m.text);
        } catch (e) { errToast(e); }
      });
    }
    let playing = null;
    function playVoice(vid, btn) {
      audio();
      const a = App.voiceEl || (App.voiceEl = new Audio());
      if (playing === vid && !a.paused) { a.pause(); return; }
      a.src = `/api/voice/${g.id}/${vid}`;
      a.play().catch(() => toast('Ovozni ijro etib bo\'lmadi', 'err'));
      playing = vid;
      $$('.vplay').forEach((x) => x.textContent = '▶');
      if (btn) btn.textContent = '⏸';
      a.onended = () => { playing = null; $$('.vplay').forEach((x) => x.textContent = '▶'); };
    }
    async function toggleRec() {
      if (rec) { rec.stop(); return; }
      if (!navigator.mediaDevices || !window.MediaRecorder) return toast('Bu qurilmada ovoz yozib bo\'lmaydi', 'err');
      let stream;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { return toast('Mikrofonga ruxsat berilmadi', 'err'); }
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'].find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks = []; const t0 = Date.now();
      r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(rec.iv); rec = null;
        const btn = $('#cMic'); if (btn) { btn.textContent = '🎤'; btn.classList.remove('rec'); }
        const dur = Math.round((Date.now() - t0) / 1000);
        if (dur < 1) return;
        const blob = new Blob(chunks, { type: (r.mimeType || mime || 'audio/webm').split(';')[0] });
        const fr = new FileReader();
        fr.onload = async () => { try { await post(`/api/sv/${g.id}/voice`, { data: fr.result, dur }); haptic('success'); } catch (e) { errToast(e); } };
        fr.readAsDataURL(blob);
      };
      r.start();
      rec = { stop: () => r.state !== 'inactive' && r.stop() };
      haptic('medium');
      const btn = $('#cMic'); if (btn) btn.classList.add('rec');
      rec.iv = setInterval(() => { const s = Math.round((Date.now() - t0) / 1000); const b = $('#cMic'); if (b) b.textContent = '⏹ ' + s; if (s >= 120) rec.stop(); }, 300);
    }
    cleanup(() => { if (rec) rec.stop(); if (App.voiceEl) App.voiceEl.pause(); });

    function onChat(ev) {
      if (ev.op === 'add') {
        chat.push(ev.msg);
        if (tab !== 'chat' && ev.msg.uid !== App.user.id) { unread++; const tb = $('[data-tab="chat"]'); if (tb) tb.innerHTML = `💬 Chat <span class="badge red">${unread}</span>`; }
        if (tab === 'chat') { const box = $('#msgs'); if (box) { if (!chat.length || box.querySelector('.empty')) box.innerHTML = ''; box.insertAdjacentHTML('beforeend', msgHtml(ev.msg)); const el2 = box.lastElementChild; el2.onclick = (e) => { if (e.target.closest('[data-vplay]')) return; msgMenu(ev.msg.id); }; const vb = el2.querySelector('[data-vplay]'); if (vb) vb.onclick = () => playVoice(vb.dataset.vplay, vb); scrollChat(); } }
        if (ev.msg.uid !== App.user.id) { SFX.tick(); }
        if (ev.msg.t === 'voice' && ev.msg.host && ev.msg.uid !== App.user.id && autoVoice()) playVoice(ev.msg.vid, $(`[data-vplay="${ev.msg.vid}"]`));
      } else if (ev.op === 'edit') {
        const i = chat.findIndex((x) => x.id === ev.msg.id); if (i >= 0) chat[i] = ev.msg;
        const el2 = $(`[data-mid="${ev.msg.id}"]`); if (el2) { el2.outerHTML = msgHtml(ev.msg); if (tab === 'chat') draw(); }
      } else if (ev.op === 'del') {
        chat = chat.filter((x) => x.id !== ev.msg.id);
        const el2 = $(`[data-mid="${ev.msg.id}"]`); if (el2) el2.remove();
      }
    }

    function update(ng) {
      const prevKey = g && g.cur ? `${g.cur.t}|${g.cur.vi}|${g.cur.phase}|${g.cur.answering}` : '';
      g = ng; offset = Date.now() - g.serverNow;
      const key = g.cur ? `${g.cur.t}|${g.cur.vi}|${g.cur.phase}|${g.cur.answering}` : '';
      if (key !== prevKey && g.cur) {
        if (g.cur.phase === 'answering') { SFX.buzz(); haptic(g.cur.answering === App.user.id ? 'heavy' : 'medium'); }
        else if (g.cur.phase === 'open' && g.isPlayer) { SFX.click(); haptic('light'); }
      }
      // Chat yozilayotgan bo'lsa, faqat yuqori qism va tugma yangilanadi
      if (tab === 'chat' && $('#svp .sv-head')) {
        $('#svp .sv-head').innerHTML = topBar() + nowBar();
        const bz = $('.buzzbar'); const nb = buzzerHtml();
        if (bz) bz.outerHTML = nb || ''; else if (nb) root.insertAdjacentHTML('beforeend', nb);
        const tb = $('.sv-tabs'); if (tb) tb.outerHTML = tabsHtml();
        bindCommon(); tickCd();
        return;
      }
      draw();
    }
    function tickCd() {
      if (!g.cur || g.cur.phase !== 'answering' || !g.cur.deadline) return;
      const left = g.cur.deadline - (Date.now() - offset);
      const s = left > 0 ? Math.ceil(left / 1000) : 0;
      for (const id of ['cd', 'cd2', 'bcd']) { const x = $('#' + id); if (x) x.textContent = left > 0 ? s : '⌛'; }
    }
    const cdTimer = setInterval(tickCd, 150);
    cleanup(() => clearInterval(cdTimer));

    if (!g.locked) { try { chat = (await api(`/api/sv/${g.id}/chat`)).chat; } catch (e) { } }
    update(g);
    cleanup(stream(['sv:' + g.id], {
      state: (s) => { const wasLocked = g.locked; update(s); if (wasLocked && !s.locked) api(`/api/sv/${g.id}/chat`).then((r) => { chat = r.chat; draw(); }).catch(() => { }); },
      chat: onChat,
      deleted: () => { toast('Turnir o\'chirildi'); go('svoyak', {}, { replace: true }); },
    }));
  },
});
