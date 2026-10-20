// ============ Kunlik Zakovat savoli ============
'use strict';

page('daily', {
  async render(el) {
    el.innerHTML = `<div class="page nonav">${pageHead('🧠 Kunlik savol', 'Eng tez to\'g\'ri javob — eng ko\'p ball')}<div id="dl"><div class="empty"><div class="spinner" style="margin:auto"></div></div></div></div>`;
    const load = async () => {
      const d = await api('/api/daily');
      if (App.cur !== 'daily') return;
      const box = $('#dl');
      let html = '';
      for (const q of d.open) {
        const st = q.my.status;
        html += `<div class="card">
          <div class="row"><span class="badge green"><span class="live-dot" style="background:var(--green)"></span> Ochiq</span><span class="muted small grow">№${q.num} · natijalar ${fmtTime(q.closesAt)} da</span><span class="badge gray">👥 ${q.count}</span></div>`;
        if (st === 'none') {
          html += `<h3 class="mt">Bugungi savol sizni kutmoqda! 🤔</h3>
            <div class="rules">⏱ Savolni ochishingiz bilan <b>${q.timeLimit} soniya</b> o'ylash va <b>10 soniya</b> yozish vaqti boshlanadi.<br>🎯 Faqat <b>1 urinish</b>.<br>🏆 Tartib bo'yicha ball: 🥇10 · 🥈8 · 🥉6 · 4–10-o'rin 4 · qolgan to'g'ri javoblar 2.<br>📣 To'g'ri javob ${fmtTime(q.closesAt)} da e'lon qilinadi.</div>
            <button class="btn lg block mt" data-start="${q.id}">🧠 Savolni ochish</button>`;
        } else if (st === 'started') {
          html += `<h3 class="mt">Vaqt ketyapti! ⏳</h3><button class="btn lg block mt gold" data-start="${q.id}">Savolga qaytish</button>`;
        } else if (st === 'answered') {
          html += `<div class="card result-ok mt" style="box-shadow:none"><b>✅ Javobingiz qabul qilindi</b><div class="mt" style="font-size:17px;font-weight:700">«${esc(q.my.answer)}»</div><div class="small muted mt">Natija va ballar ${fmtTime(q.closesAt)} da e'lon qilinadi</div></div>`;
        } else {
          html += `<div class="card result-bad mt" style="box-shadow:none"><b>⌛ Vaqt tugadi</b><div class="small muted">Bu savolga javob yuborilmadi. Ertangi savolni o'tkazib yubormang!</div></div>`;
        }
        html += `</div>`;
      }
      if (!d.open.length) {
        html += `<div class="card center"><div style="font-size:40px">🌙</div><h3>Hozircha ochiq savol yo'q</h3><div class="muted">${d.next ? `Keyingi savol: <b>${fmtDay(d.next.date)}, soat ${d.next.time}</b>` : `Savollar har kuni soat ${d.settings.openTime} da chiqadi`}</div></div>`;
      }
      if (d.recent.length) {
        html += `<h2>📜 Oldingi savollar</h2>`;
        for (const q of d.recent) html += recentCard(q);
      }
      box.innerHTML = html;
      $$('[data-start]', box).forEach((b) => b.onclick = async () => {
        const id = b.dataset.start;
        if (b.textContent.includes('ochish')) {
          const ok = await confirmDlg('Savolni ochasizmi? Vaqt darhol boshlanadi ⏱', 'Ochish');
          if (!ok) return;
        }
        go('dailyQ', { id });
      });
      $$('[data-appeal]', box).forEach((b) => b.onclick = () => appealDlg(b.dataset.appeal));
      $$('[data-more]', box).forEach((b) => b.onclick = () => { $('#top' + b.dataset.more).hidden = false; b.remove(); });
    };
    await load();
    cleanup(stream(['daily'], { changed: () => load(), count: (x) => { const b = $(`[data-start="${x.id}"]`); if (b) load(); } }));
  },
});

function recentCard(q) {
  const my = q.my;
  let myHtml = '';
  if (my && my.answer !== null && my.answer !== undefined) {
    myHtml = `<div class="card tight ${my.ok ? 'result-ok' : 'result-bad'} mt" style="box-shadow:none">
      <div class="row"><div class="grow"><div class="small muted">Sizning javobingiz</div><b>«${esc(my.answer)}»</b>${my.late ? ' <span class="badge red">kechikdi</span>' : ''}</div><div class="score">${my.ok ? '+' + my.p : '0'}</div></div>
      ${!my.ok && !my.appeal && !my.late ? `<button class="btn sm plain mt" data-appeal="${q.id}">⚖️ Apellyatsiya berish</button>` : ''}
      ${my.appeal ? `<div class="small mt">⚖️ Apellyatsiya: <b>${my.appeal.st === 'pending' ? 'ko\'rib chiqilmoqda' : my.appeal.st === 'accepted' ? 'qabul qilindi ✅' : 'rad etildi'}</b></div>` : ''}
    </div>`;
  } else if (my && my.expired) myHtml = `<div class="small muted mt">⌛ Siz savolni ochdingiz, lekin javob yubormadingiz</div>`;
  const medals = ['🥇', '🥈', '🥉'];
  const top = q.top.map((t, i) => `<div class="li"><div class="rank">${medals[i] || i + 1}</div>${av(t.user, 30)}<div class="grow ell t">${esc(t.user ? t.user.name : '—')}</div><span class="muted small">${t.sec} s</span><b>+${t.p}</b></div>`);
  return `<div class="card">
    <div class="row"><span class="badge gray">№${q.num}</span><span class="muted small grow">${fmtDay(q.date)}</span><span class="small muted">✅ ${q.correct}/${q.count}</span></div>
    ${q.text ? `<div class="mt" style="white-space:pre-wrap">${esc(q.text)}</div>` : ''}
    ${q.image ? `<img class="dq-img" src="${esc(q.image)}" alt="">` : ''}
    <div class="mt"><span class="badge green">💡 Javob</span> <b>${esc(q.answer)}</b></div>
    ${q.comment ? `<div class="small muted mt">💬 ${esc(q.comment)}</div>` : ''}
    ${q.author ? `<div class="small muted">✍️ ${esc(q.author)}</div>` : ''}
    ${myHtml}
    ${top.length ? `<div class="list mt" style="border:0">${top.slice(0, 3).join('')}<div id="top${q.id}" hidden>${top.slice(3).join('')}</div></div>${top.length > 3 ? `<button class="btn sm plain block mt" data-more="${q.id}">Barcha tezkorlar (${top.length})</button>` : ''}` : ''}
  </div>`;
}

function appealDlg(qid) {
  const m = modal('⚖️ Apellyatsiya', `<div class="muted small mb">Nima uchun javobingiz qabul qilinishi kerakligini qisqacha tushuntiring. Admin ko'rib chiqadi.</div><textarea class="input" id="apt" maxlength="600" placeholder="Masalan: javobim mohiyatan to'g'ri, chunki..."></textarea>`,
    `<button class="btn plain" id="apc">Bekor</button><button class="btn" id="aps">Yuborish</button>`);
  $('#apc', m.el).onclick = m.close;
  $('#aps', m.el).onclick = async () => {
    const text = $('#apt', m.el).value.trim();
    if (text.length < 5) return toast('Izoh yozing');
    try { await post(`/api/daily/${qid}/appeal`, { text }); m.close(); toast('Apellyatsiya yuborildi ✅', 'ok'); go('daily', {}, { replace: true }); } catch (e) { errToast(e); }
  };
}

page('dailyQ', {
  async render(el, p) {
    let q;
    try { q = await post(`/api/daily/${p.id}/start`); } catch (e) { toast(e.message, 'err'); return go('daily', {}, { replace: true }); }
    const offset = Date.now() - q.serverNow;
    const t0 = q.startedAt + offset;
    const total = (q.timeLimit + q.writeSec) * 1000;
    el.innerHTML = `<div class="page nonav">
      <div class="row mb"><span class="badge">№${q.num}</span><div class="grow"></div><span class="badge gold" id="phase">O'ylash vaqti</span></div>
      <div class="dq-timer"><div class="dq-bar"><i id="bar" style="width:100%"></i></div><div class="dq-sec" id="sec">${q.timeLimit}</div></div>
      <div class="card">${q.image ? `<img class="dq-img" src="${esc(q.image)}" alt="">` : ''}<div class="dq-text">${esc(q.text)}</div></div>
      <div class="card mt"><label class="field" style="margin:0"><span>Javobingiz</span><input class="input" id="ans" maxlength="200" autocomplete="off" placeholder="Javobni yozing..."></label>
      <button class="btn lg block mt" id="send">📨 Javobni yuborish</button><div class="muted small center mt">Faqat 1 marta yuborish mumkin</div></div>
    </div>`;
    let sent = false, warned = false, lastSec = -1;
    const send = async (auto) => {
      if (sent) return;
      const text = $('#ans').value.trim();
      if (!text) { if (!auto) toast('Javobni yozing'); return; }
      sent = true; $('#send').disabled = true;
      try {
        const r = await post(`/api/daily/${q.id}/answer`, { text });
        haptic('success'); SFX.ok();
        el.innerHTML = `<div class="page nonav"><div class="gate" style="min-height:70vh"><div class="logo" style="background:linear-gradient(135deg,#0f9d58,#20c997)">📨</div>
          <h1>Javob qabul qilindi!</h1><p>«${esc(text)}»<br><br>Siz <b>${r.order}-bo'lib</b> javob berdingiz (${r.sec} soniyada).${r.late ? '<br>⚠️ Javob vaqtdan keyin yuborildi.' : ''}<br>To'g'ri javob va ballar kechqurun e'lon qilinadi.</p>
          <button class="btn lg block" onclick="go('daily',{},{replace:true})">Yaxshi</button></div></div>`;
      } catch (e) { sent = false; $('#send').disabled = false; errToast(e); }
    };
    $('#send').onclick = () => send(false);
    $('#ans').addEventListener('keydown', (e) => { if (e.key === 'Enter') send(false); });
    setTimeout(() => { const a = $('#ans'); if (a) a.focus(); }, 300);
    const iv = setInterval(() => {
      if (sent) return clearInterval(iv);
      const el2 = Date.now() - t0;
      const thinkLeft = q.timeLimit * 1000 - el2;
      const totalLeft = total - el2;
      const bar = $('#bar'), sec = $('#sec'), ph = $('#phase');
      if (!bar) return clearInterval(iv);
      if (thinkLeft > 0) {
        const s = Math.ceil(thinkLeft / 1000);
        bar.style.width = (thinkLeft / (q.timeLimit * 1000) * 100) + '%';
        bar.style.background = s <= 10 ? '#f08c00' : 'var(--primary)';
        sec.textContent = s;
        if (s === 10 && !warned) { warned = true; SFX.pre(); haptic('warning'); }
      } else if (totalLeft > 0) {
        const s = Math.ceil(totalLeft / 1000);
        if (ph.textContent !== 'Yozish vaqti!') { ph.textContent = 'Yozish vaqti!'; ph.className = 'badge red'; SFX.main(); haptic('heavy'); }
        bar.style.width = (totalLeft / (q.writeSec * 1000) * 100) + '%';
        bar.style.background = 'var(--red)';
        sec.textContent = s;
        if (s !== lastSec && s <= 5) { lastSec = s; SFX.tick(); }
      } else {
        clearInterval(iv);
        if ($('#ans').value.trim()) send(true);
        else { SFX.end(); $('#send').disabled = true; ph.textContent = 'Vaqt tugadi'; sec.textContent = '0'; bar.style.width = '0'; toast('⌛ Vaqt tugadi', 'err'); }
      }
    }, 200);
    cleanup(() => clearInterval(iv));
  },
});
