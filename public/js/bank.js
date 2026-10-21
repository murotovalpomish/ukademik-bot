// ============ Zakovat savollari (savollar bazasi) ============
'use strict';

page('bank', {
  async render(el, p) {
    el.innerHTML = `<div class="page nonav">${pageHead('📚 Zakovat savollari', 'Mashq qiling: o\'ylang, javob yozing, tekshiring')}
      <div class="row mb"><input class="input grow" id="bq" placeholder="🔎 Savol matnidan qidirish" value="${esc(p.q || '')}"></div>
      <div class="chips" id="bpacks"></div><div id="bl"><div class="empty"><div class="spinner" style="margin:auto"></div></div></div></div>`;
    const load = async () => {
      const d = await api(`/api/bank?pack=${encodeURIComponent(p.pack || '')}&q=${encodeURIComponent(p.q || '')}`);
      if (App.cur !== 'bank') return;
      $('#bpacks').innerHTML = `<button class="chip ${!p.pack ? 'on' : ''}" data-pack="">Hammasi · ${d.total}</button>` + d.packs.map((x) => `<button class="chip ${p.pack === x.name ? 'on' : ''}" data-pack="${esc(x.name)}">${esc(x.name)} · ${x.n}</button>`).join('');
      $$('#bpacks .chip').forEach((b) => b.onclick = () => { p.pack = b.dataset.pack; App.stack[App.stack.length - 1].params = p; load(); });
      const box = $('#bl');
      if (!d.items.length) { box.innerHTML = `<div class="empty"><div class="e">📚</div>Hozircha savollar yo'q. Kunlik savollar yopilgach shu yerga qo'shiladi.</div>`; return; }
      box.innerHTML = `<div class="card tight mb row"><div class="grow"><b>Yechilgan: ${d.solved} / ${d.total}</b><div class="dq-bar mt"><i style="width:${d.total ? d.solved / d.total * 100 : 0}%;background:var(--green)"></i></div></div></div>
        <div class="list">${d.items.map((x) => `<div class="li tap" data-k="${x.key}"><div class="av" style="--s:38px;--c:${x.st === 'ok' ? 'var(--green)' : x.st === 'bad' ? 'var(--red)' : x.st === 'seen' ? '#868e96' : 'var(--primary)'}">${x.st === 'ok' ? '✓' : x.st === 'bad' ? '✗' : x.st === 'seen' ? '👁' : '?'}</div>
          <div class="grow" style="min-width:0"><div class="s">${esc(x.pack)} · №${x.num}${x.hasImage ? ' · 🖼' : ''}</div><div class="t" style="font-weight:600;font-size:14px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(x.text || 'Rasmli savol')}</div></div></div>`).join('')}</div>`;
      $$('[data-k]', box).forEach((x) => x.onclick = () => go('bankQ', { key: x.dataset.k }));
    };
    let t = null;
    $('#bq').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { p.q = e.target.value; load(); }, 350); };
    await load();
  },
});

page('bankQ', {
  async render(el, p) {
    const q = await api('/api/bank/' + p.key);
    let iv = null;
    const showAnswer = (r, ok) => {
      clearInterval(iv);
      $('#bres').innerHTML = `<div class="card ${ok === true ? 'result-ok' : ok === false ? 'result-bad' : ''}" style="box-shadow:none">
        ${ok === true ? '<b>✅ To\'g\'ri!</b>' : ok === false ? '<b>❌ Noto\'g\'ri</b>' : ''}
        <div class="mt"><span class="badge green">💡 Javob</span> <b>${esc(r.answers[0])}</b>${r.answers.length > 1 ? `<div class="small muted mt">Qabul qilinadi: ${esc(r.answers.slice(1).join(', '))}</div>` : ''}</div>
        ${r.comment ? `<div class="small mt">💬 ${esc(r.comment)}</div>` : ''}${r.author ? `<div class="small muted">✍️ ${esc(r.author)}</div>` : ''}</div>`;
      $('#bform').hidden = true;
    };
    el.innerHTML = `<div class="page nonav">
      <div class="row mb"><span class="badge">${esc(q.pack)} · №${q.num}</span><div class="grow"></div><span class="badge gray" id="btm">⏱ 60</span></div>
      <div class="card">${q.image ? `<img class="dq-img" src="${esc(q.image)}">` : ''}<div class="dq-text">${esc(q.text)}</div></div>
      <div class="card mt" id="bform"><input class="input" id="ba" maxlength="200" autocomplete="off" placeholder="Javobingiz...">
        <div class="row mt"><button class="btn grow" id="bcheck">✓ Tekshirish</button><button class="btn plain" id="bshow">👁 Javob</button></div></div>
      <div id="bres" class="mt"></div>
      <button class="btn plain block mt" onclick="back()">← Ro'yxatga qaytish</button></div>`;
    if (q.done) return showAnswer(q, q.st === 1 ? true : q.st === 0 ? false : null);
    let left = 60;
    iv = setInterval(() => { left--; const b = $('#btm'); if (!b) return clearInterval(iv); b.textContent = '⏱ ' + Math.max(0, left); if (left === 10) { SFX.pre(); haptic('warning'); } if (left <= 0) { clearInterval(iv); SFX.main(); b.className = 'badge red'; b.textContent = 'Vaqt tugadi'; } }, 1000);
    cleanup(() => clearInterval(iv));
    $('#bcheck').onclick = async () => {
      const text = $('#ba').value.trim(); if (!text) return toast('Javob yozing');
      try { const r = await post(`/api/bank/${p.key}/check`, { text }); haptic(r.ok ? 'success' : 'error'); r.ok ? SFX.ok() : SFX.bad(); showAnswer(r, r.ok); } catch (e) { errToast(e); }
    };
    $('#ba').onkeydown = (e) => { if (e.key === 'Enter') $('#bcheck').click(); };
    $('#bshow').onclick = async () => { try { showAnswer(await post(`/api/bank/${p.key}/reveal`), null); } catch (e) { errToast(e); } };
  },
});
