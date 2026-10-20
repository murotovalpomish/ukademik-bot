// ============ Admin panel ============
'use strict';
const tzLocalToTs = (v) => Date.parse(v + ':00Z') - 5 * 3600e3;
const tsToTzLocal = (ts) => new Date(ts + 5 * 3600e3).toISOString().slice(0, 16);
const ST_BADGE = { scheduled: '<span class="badge gray">📅 Rejada</span>', open: '<span class="badge green">🟢 Ochiq</span>', closed: '<span class="badge">✅ Yopilgan</span>' };

page('admin', {
  async render(el, p) {
    if (!App.isAdmin) return go('home');
    const tab = p.tab || 'daily';
    el.innerHTML = `<div class="page nonav">${pageHead('⚙️ Admin panel')}
      <div class="tabs">${[['daily', '🧠 Savollar'], ['fb', '⚽ Futbol'], ['set', '🔧 Sozlamalar']].map(([k, t]) => `<button class="tab ${k === tab ? 'on' : ''}" data-t="${k}">${t}</button>`).join('')}</div><div id="adm"></div></div>`;
    $$('.tab', el).forEach((b) => b.onclick = () => { App.stack.pop(); go('admin', { tab: b.dataset.t }); });
    const box = $('#adm');
    if (tab === 'daily') {
      const d = await api('/api/admin/daily');
      box.innerHTML = `<button class="btn block lg" id="newQ">➕ Yangi savol qo'shish</button>
        <div class="muted small mt mb">Savollar har kuni soat <b>${d.settings.openTime}</b> da kanalga chiqadi va <b>${d.settings.closeTime}</b> da natijalar e'lon qilinadi.</div>
        ${d.questions.length ? d.questions.map((q) => `<div class="card adm-q" data-q="${q.id}"><div class="row mb">${ST_BADGE[q.status]}<span class="small muted grow">№${q.num} · ${fmtDay(q.date)}</span>${q.appeals ? `<span class="badge red">⚖️ ${q.appeals}</span>` : ''}<span class="badge gray">👥 ${q.count}</span></div><div class="txt">${esc(q.text || '(rasmli savol)')}</div><div class="small mt"><b>Javob:</b> ${esc(q.answers.join(' / '))}</div>${q.postError ? `<div class="small" style="color:var(--red)">⚠️ Kanalga chiqmadi: ${esc(q.postError)}</div>` : ''}</div>`).join('') : '<div class="empty"><div class="e">📝</div>Hali savollar yo\'q</div>'}`;
      $('#newQ').onclick = () => go('adminQ', {});
      $$('[data-q]', box).forEach((c) => c.onclick = () => go('adminQ', { id: Number(c.dataset.q) }));
    } else if (tab === 'fb') {
      const d = await api('/api/fb');
      const all = [...d.upcoming, ...d.finished];
      box.innerHTML = `<button class="btn block lg" id="newM">➕ O'yin qo'shish</button><div class="mt">${all.map((m) => `<div class="card tight"><div class="row"><div class="grow"><b>${esc(m.hf)} ${esc(m.home)} — ${esc(m.away)} ${esc(m.af)}</b><div class="small muted">${esc(m.league)} · ${fmtDT(m.kickoff)} · ${m.total} prognoz</div></div>${m.score ? `<b>${m.score[0]}:${m.score[1]}</b>` : ''}</div>
        <div class="row mt"><button class="btn sm grow" data-res="${m.id}">${m.score ? '✏️ Natija' : '🏁 Natija kiritish'}</button><button class="btn sm plain" data-edit="${m.id}">✏️</button><button class="btn sm plain" data-del="${m.id}">🗑</button></div></div>`).join('') || '<div class="empty"><div class="e">⚽</div>O\'yinlar yo\'q</div>'}</div>`;
      $('#newM').onclick = () => matchDlg();
      $$('[data-edit]', box).forEach((b) => b.onclick = () => matchDlg(all.find((m) => m.id === Number(b.dataset.edit))));
      $$('[data-del]', box).forEach((b) => b.onclick = async () => { if (await confirmDlg('O\'yin o\'chirilsinmi?', 'O\'chirish', true)) { await del('/api/admin/fb/' + b.dataset.del).catch(errToast); reload(); } });
      $$('[data-res]', box).forEach((b) => b.onclick = () => {
        const m = all.find((x) => x.id === Number(b.dataset.res));
        const md = modal(`🏁 ${esc(m.home)} — ${esc(m.away)}`, `<div class="row" style="justify-content:center"><input class="input code-input" id="rh" style="width:90px;letter-spacing:0" inputmode="numeric" value="${m.score ? m.score[0] : ''}"><b style="font-size:26px">:</b><input class="input code-input" id="ra" style="width:90px;letter-spacing:0" inputmode="numeric" value="${m.score ? m.score[1] : ''}"></div><div class="small muted center mt">Ballar avtomatik hisoblanadi</div>`, `<button class="btn plain" id="rx">Bekor</button><button class="btn" id="rs">Saqlash</button>`);
        $('#rx', md.el).onclick = md.close;
        $('#rs', md.el).onclick = async () => { try { await post(`/api/admin/fb/${m.id}/result`, { h: $('#rh', md.el).value, a: $('#ra', md.el).value }); md.close(); toast('Saqlandi ✅', 'ok'); reload(); } catch (e) { errToast(e); } };
      });
    } else {
      const s = await api('/api/admin/status');
      box.innerHTML = `${s.channelError ? `<div class="notice red mb">⚠️ <b>Bot kanalga admin qilinmagan</b> yoki kanal topilmadi (${esc(s.channel)}). Obuna tekshiruvi va kanalga post chiqarish ishlamaydi.<div class="small mt">${esc(s.channelError)}</div></div>` : `<div class="notice mb" style="background:var(--green-soft)">✅ Bot ${esc(s.channel)} kanalida admin — hammasi ishlayapti</div>`}
        <div class="card"><h3>🕒 Kunlik savol vaqti (Toshkent)</h3>
          <div class="row"><label class="field grow"><span>E'lon qilish</span><input class="input" type="time" id="ot" value="${s.settings.openTime}"></label><label class="field grow"><span>Natijalar</span><input class="input" type="time" id="ct" value="${s.settings.closeTime}"></label></div>
          <button class="btn block" id="saveT">Saqlash</button></div>
        <div class="card"><h3>📊 Holat</h3><div class="small stack">
          <div>👥 Foydalanuvchilar: <b>${s.users}</b></div>
          <div>📦 Zaxira nusxa: <b>${s.backup.backup ? 'Telegram\'da saqlanmoqda ✅' : 'hali yaratilmagan (admin botga /start yozishi kerak)'}</b>${s.backup.lastBackupAt ? ` · oxirgisi ${fmtDT(s.backup.lastBackupAt)}` : ''}</div>
          <div>🌐 Manzil: <b>${esc(s.publicUrl || '—')}</b></div></div></div>`;
      $('#saveT').onclick = async () => { try { await post('/api/admin/settings', { openTime: $('#ot').value, closeTime: $('#ct').value }); toast('Saqlandi ✅', 'ok'); } catch (e) { errToast(e); } };
    }
  },
});

function matchDlg(m) {
  m = m || {};
  const md = modal(m.id ? '✏️ O\'yinni tahrirlash' : '➕ Yangi o\'yin', `
    <div class="row"><label class="field" style="width:76px"><span>Bayroq</span><input class="input" id="mhf" value="${esc(m.hf || '')}" placeholder="🇺🇿"></label><label class="field grow"><span>Uy egasi</span><input class="input" id="mh" value="${esc(m.home || '')}" placeholder="O'zbekiston"></label></div>
    <div class="row"><label class="field" style="width:76px"><span>Bayroq</span><input class="input" id="maf" value="${esc(m.af || '')}" placeholder="🇵🇹"></label><label class="field grow"><span>Mehmon</span><input class="input" id="ma" value="${esc(m.away || '')}" placeholder="Portugaliya"></label></div>
    <label class="field"><span>Turnir</span><input class="input" id="ml" value="${esc(m.league || '')}" placeholder="Jahon chempionati 2026"></label>
    <label class="field"><span>Boshlanish vaqti (Toshkent)</span><input class="input" type="datetime-local" id="mk" value="${m.kickoff ? tsToTzLocal(m.kickoff) : ''}"></label>`,
    `<button class="btn plain" id="mx">Bekor</button><button class="btn" id="ms">Saqlash</button>`);
  $('#mx', md.el).onclick = md.close;
  $('#ms', md.el).onclick = async () => {
    const v = $('#mk', md.el).value;
    if (!v) return toast('Vaqtni kiriting', 'err');
    try {
      await post('/api/admin/fb', { id: m.id, home: $('#mh', md.el).value, away: $('#ma', md.el).value, hf: $('#mhf', md.el).value, af: $('#maf', md.el).value, league: $('#ml', md.el).value, kickoff: tzLocalToTs(v) });
      md.close(); toast('Saqlandi ✅', 'ok'); reload();
    } catch (e) { errToast(e); }
  };
}

page('adminQ', {
  async render(el, p) {
    let q = null, detail = null, imageData = null, removeImage = false;
    const list = await api('/api/admin/daily');
    if (p.id) { detail = await api('/api/admin/daily/' + p.id); q = detail; }
    const isNew = !q;
    el.innerHTML = `<div class="page nonav">${pageHead(isNew ? 'Yangi savol' : `Savol №${q.num}`, isNew ? '' : ST_BADGE[q.status])}
      <div class="card">
        <label class="field"><span>Savol matni</span><textarea class="input" id="qt" style="min-height:140px" placeholder="Savol matnini kiriting...">${esc(q ? q.text : '')}</textarea></label>
        <div class="field"><span class="small muted" style="font-weight:700">Rasm (ixtiyoriy)</span><div id="qimg">${q && q.image ? `<img class="dq-img" src="${esc(q.image)}">` : ''}</div><div class="row"><button class="btn sm plain" id="qpick">🖼 Rasm tanlash</button>${q && q.image ? '<button class="btn sm plain" id="qrm">🗑 Rasmni olib tashlash</button>' : ''}</div></div>
        <label class="field"><span>To'g'ri javob(lar) — har birini yangi qatordan</span><textarea class="input" id="qa" style="min-height:70px" placeholder="Asosiy javob&#10;Muqobil javob (ixtiyoriy)">${esc(q ? q.answers.join('\n') : '')}</textarea></label>
        <div class="small muted" style="margin:-6px 0 12px">Kichik imlo xatolar, lotin/kirill va o'/o farqlari avtomatik qabul qilinadi. [Qavs ichidagi] qism ixtiyoriy hisoblanadi.</div>
        <label class="field"><span>Izoh (javob bilan e'lon qilinadi)</span><textarea class="input" id="qc" style="min-height:60px">${esc(q ? q.comment : '')}</textarea></label>
        <div class="row"><label class="field grow"><span>Muallif</span><input class="input" id="qau" value="${esc(q ? q.author : '')}"></label><label class="field" style="width:110px"><span>Vaqt (soniya)</span><input class="input" id="qtl" type="number" value="${q ? q.timeLimit : 60}"></label></div>
        ${isNew || q.status === 'scheduled' ? `<label class="field"><span>E'lon qilinadigan sana</span><input class="input" type="date" id="qd" value="${q ? q.date : list.nextFreeDate}"></label>` : ''}
        <button class="btn block lg" id="qsave">💾 Saqlash</button>
      </div>
      ${q ? `<div class="row mt">${q.status === 'scheduled' ? '<button class="btn green grow" id="qpub">📣 Hozir e\'lon qilish</button>' : ''}${q.status === 'open' ? '<button class="btn gold grow" id="qcl">🏁 Hozir yopish va natija</button>' : ''}<button class="btn red" id="qdel">🗑</button></div>` : ''}
      ${q && q.resp.length ? `<h2>👥 Javoblar (${q.resp.filter((r) => r.answer).length})</h2><div class="card" id="resps"></div>` : ''}
    </div>`;
    const drawResps = () => {
      const box = $('#resps'); if (!box) return;
      box.innerHTML = detail.resp.map((r) => `<div class="resp">${av(r.user, 34)}<div class="grow" style="min-width:0"><div class="t ell">${esc(r.user.name)} ${r.p ? `<span class="badge green">+${r.p}</span>` : ''}</div>
        <div class="small">${r.answer ? `«${esc(r.answer)}» · ${r.sec} s` : '<span class="muted">javob yo\'q</span>'} ${r.late ? '<span class="badge red">kech</span>' : ''} ${r.acc !== null ? '<span class="badge gold">qo\'lda</span>' : ''}</div>
        ${r.ap ? `<div class="small" style="background:var(--gold-soft);padding:6px 8px;border-radius:8px;margin-top:4px">⚖️ ${esc(r.ap.text)} <b>(${r.ap.st === 'pending' ? 'kutilmoqda' : r.ap.st === 'accepted' ? 'qabul' : 'rad'})</b></div>` : ''}</div>
        ${r.answer ? `<button class="btn sm ${r.final ? 'green' : 'plain'}" data-acc="${r.user.id}|1">✓</button><button class="btn sm ${!r.final ? 'red' : 'plain'}" data-acc="${r.user.id}|0">✗</button>` : ''}</div>`).join('') || '<div class="muted">Javoblar yo\'q</div>';
      $$('[data-acc]', box).forEach((b) => b.onclick = async () => {
        const [uid, v] = b.dataset.acc.split('|');
        try { detail = await post(`/api/admin/daily/${q.id}/override`, { uid: Number(uid), acc: v === '1' }); haptic('success'); drawResps(); } catch (e) { errToast(e); }
      });
    };
    drawResps();
    $('#qpick').onclick = async () => { const d = await pickImage(1100, false, 0.8); if (d) { imageData = d; removeImage = false; $('#qimg').innerHTML = `<img class="dq-img" src="${d}">`; } };
    const rm = $('#qrm'); if (rm) rm.onclick = () => { removeImage = true; imageData = null; $('#qimg').innerHTML = ''; rm.remove(); };
    $('#qsave').onclick = async () => {
      const body = { id: q ? q.id : undefined, text: $('#qt').value, answers: $('#qa').value, comment: $('#qc').value, author: $('#qau').value, timeLimit: $('#qtl').value, date: $('#qd') ? $('#qd').value : undefined, imageData, removeImage };
      $('#qsave').disabled = true;
      try { const r = await post('/api/admin/daily', body); haptic('success'); toast('Saqlandi ✅', 'ok'); go('adminQ', { id: r.id }, { replace: true }); }
      catch (e) { errToast(e); $('#qsave').disabled = false; }
    };
    const on = (id, fn) => { const x = $('#' + id); if (x) x.onclick = fn; };
    on('qpub', async () => { if (await confirmDlg('Savol hozir kanalga chiqarilsinmi?', 'E\'lon qilish')) { try { await post(`/api/admin/daily/${q.id}/publish`); toast('E\'lon qilindi 📣', 'ok'); reload(); } catch (e) { errToast(e); } } });
    on('qcl', async () => { if (await confirmDlg('Savol yopilib, natijalar kanalga chiqarilsinmi?', 'Yopish')) { try { await post(`/api/admin/daily/${q.id}/close`); toast('Natijalar e\'lon qilindi 🏁', 'ok'); reload(); } catch (e) { errToast(e); } } });
    on('qdel', async () => { if (await confirmDlg('Savol butunlay o\'chirilsinmi?', 'O\'chirish', true)) { try { await del('/api/admin/daily/' + q.id); go('admin', {}, { replace: true }); } catch (e) { errToast(e); } } });
  },
});
