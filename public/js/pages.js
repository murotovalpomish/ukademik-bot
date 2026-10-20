// ============ Kirish, bosh sahifa, reyting, profil ============
'use strict';

// ---------- Kirish: obuna va captcha ----------
page('gate', {
  async render(el, p) {
    el.innerHTML = `<div class="boot"><div class="boot-logo">🎓</div><div class="spinner"></div></div>`;
    if (!TG && !DEV_USER) {
      el.innerHTML = `<div class="gate"><div class="logo">🎓</div><h1>Ukademik</h1><p>Bu ilova Telegram ichida ishlaydi. Botni oching va «Ochish» tugmasini bosing.</p></div>`;
      return;
    }
    let me;
    try { me = await api('/api/me'); } catch (e) {
      el.innerHTML = `<div class="gate"><div class="logo">😕</div><h1>Ulanib bo'lmadi</h1><p>${esc(e.message)}</p><button class="btn lg block" onclick="go('gate')">Qayta urinish</button></div>`;
      return;
    }
    if (me.gate === 'subscribe') return renderSubscribe(el, me);
    if (me.gate === 'captcha') return renderCaptcha(el, me);
    App.user = me.user; App.isAdmin = me.isAdmin; App.bot = me.bot; App.channelLink = me.channelLink;
    startUserStream();
    routeStart();
  },
});

function renderSubscribe(el, me) {
  el.innerHTML = `<div class="gate">
    <div class="logo">📢</div>
    <h1>Kanalga obuna bo'ling</h1>
    <p>Botdan foydalanish uchun <b>Ukademiklar</b> kanaliga obuna bo'lishingiz kerak. Obuna bo'lgach «Tekshirish» tugmasini bosing.</p>
    <button class="btn lg block" id="sub">📢 Kanalga o'tish</button>
    <button class="btn lg block ghost mt" id="chk">✅ Tekshirish</button>
  </div>`;
  $('#sub').onclick = () => openTgLink(me.channelLink || 'https://t.me/ukademiklar');
  $('#chk').onclick = async () => {
    const r = await post('/api/recheck').catch(errToast);
    if (r && r.ok) { haptic('success'); go('gate', {}, { root: true }); }
    else { haptic('error'); toast('Hali obuna bo\'lmagansiz 🙂', 'err'); }
  };
}

async function renderCaptcha(el, me) {
  let picks = new Set();
  const c = await api('/api/captcha');
  el.innerHTML = `<div class="gate">
    <div class="logo">🤖</div>
    <h1>Bot emasligingizni tasdiqlang</h1>
    <p>Salom, <b>${esc(me.tgName || '')}</b>! Quyidagi rasmlardan <b>barcha futbol to'plarini ⚽</b> belgilang.</p>
    <div class="captcha-grid">${c.cells.map((e, i) => `<button data-i="${i}">${e}</button>`).join('')}</div>
    <button class="btn lg block" id="ok">Tasdiqlash</button>
  </div>`;
  $$('.captcha-grid button', el).forEach((b) => b.onclick = () => {
    const i = Number(b.dataset.i);
    if (picks.has(i)) picks.delete(i); else picks.add(i);
    b.classList.toggle('on'); haptic('select');
  });
  $('#ok').onclick = async () => {
    if (!picks.size) return toast('Rasmlarni belgilang');
    $('#ok').disabled = true;
    try {
      const r = await post('/api/captcha', { id: c.id, picks: [...picks] });
      if (r.ok) {
        haptic('success');
        el.innerHTML = `<div class="gate"><div class="logo" style="background:linear-gradient(135deg,#0f9d58,#20c997)">✅</div><h1>Xush kelibsiz!</h1><p>Akkauntingiz yaratildi</p>${av(r.user, 96, '')}<div class="mt" style="font-weight:800;font-size:20px">${esc(r.user.name)}</div></div>`;
        $('.gate .av', el).style.margin = '0 auto';
        setTimeout(() => go('gate', {}, { root: true }), 1400);
      } else { haptic('error'); toast('Noto\'g\'ri, qaytadan urinib ko\'ring', 'err'); renderCaptcha(el, me); }
    } catch (e) { errToast(e); $('#ok').disabled = false; }
  };
}

let userStreamClose = null;
function startUserStream() {
  if (userStreamClose) userStreamClose();
  userStreamClose = stream(['u:' + App.user.id], {
    toast: (d) => { toast(d.text); haptic('light'); },
    'q:matched': (d) => { if (App.cur === 'tosiqSearch') go('tosiqGame', { id: d.id }, { replace: true }); },
  });
}

// Botdagi havola orqali kelganda kerakli sahifani ochish
function routeStart() {
  let r = QS.get('r') || (TG && TG.initDataUnsafe && TG.initDataUnsafe.start_param) || '';
  QS.delete('r');
  r = decodeURIComponent(r || '');
  go('home', {}, { root: true });
  if (!r) return;
  if (r === 'daily') go('daily');
  else if (r === 'rating') go('rating');
  else if (r === 'timer') go('timer');
  else if (r === 'football') go('football');
  else if (r === 'admin' && App.isAdmin) go('admin');
  else if (r.startsWith('sv/')) go('svGame', { id: r.slice(3) });
  else if (r.startsWith('sv_')) go('svGame', { id: r.slice(3) });
  else if (r.startsWith('q/join/')) joinFriendGame(r.slice(7));
}

// ---------- Bosh sahifa ----------
page('home', {
  nav: true,
  async render(el) {
    const u = App.user;
    el.innerHTML = `<div class="page">
      <div class="hello">${av(u, 46)}<div class="grow"><div class="muted small">Assalomu alaykum 👋</div><div class="name ell">${esc(u.name)}</div></div>
        <button class="iconbtn" id="themeBtn" title="Kunduzgi/tungi rejim">${document.documentElement.dataset.theme === 'dark' ? '☀️' : '🌙'}</button></div>
      <div class="hero" id="hero"><div class="k">Kunlik Zakovat savoli</div><div class="t">Yuklanmoqda...</div><div class="d">&nbsp;</div></div>
      <div class="tiles">
        <div class="tile g-timer" data-go="timer"><div class="ic">⏱</div><div class="t">Zakovat soati</div><div class="s">O'yin taymeri</div></div>
        <div class="tile g-svoyak" data-go="svoyak"><div class="ic">🎯</div><div class="t">Svoyak</div><div class="s" id="svLive">Jonli o'yinlar</div></div>
        <div class="tile g-tosiq" data-go="tosiq"><div class="ic">🧱</div><div class="t">To'siq</div><div class="s" id="tsInfo">Aqliy o'yin</div></div>
        <div class="tile g-foot" data-go="football"><div class="ic">⚽</div><div class="t">Futbol</div><div class="s">Prognoz · Penalti</div></div>
        <div class="tile g-rating wide" data-go="rating"><div class="ic">🏆</div><div class="t">Reyting</div><div class="s">Kim eng zukko? Kunlik savol, To'siq, Futbol</div></div>
        ${App.isAdmin ? `<div class="tile g-admin wide" data-go="admin"><div class="ic">⚙️</div><div class="t">Admin panel</div><div class="s">Savollar, futbol o'yinlari, sozlamalar</div></div>` : ''}
      </div>
    </div>`;
    $$('[data-go]', el).forEach((t) => t.onclick = () => { haptic('light'); go(t.dataset.go); });
    $('#themeBtn').onclick = () => { setThemePref(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); haptic('select'); go('home'); };
    $('#hero').onclick = () => go('daily');
    try {
      const h = await api('/api/home');
      if (App.cur !== 'home') return;
      const hero = $('#hero');
      const o = h.daily.open[0];
      if (o) {
        const st = o.my.status;
        hero.innerHTML = `<div class="k">Kunlik Zakovat savoli №${o.num}</div>
          <div class="t">${st === 'answered' ? 'Javobingiz qabul qilindi ✅' : st === 'expired' ? 'Vaqt tugadi ⌛' : 'Bugungi savol tayyor! 🔥'}</div>
          <div class="d">👥 ${o.count} kishi javob berdi · Natijalar ${fmtTime(o.closesAt)} da</div>
          <button class="btn">${st === 'none' || st === 'started' ? '🧠 Javob berish' : 'Batafsil'}</button>`;
      } else if (h.daily.last) {
        const l = h.daily.last;
        hero.innerHTML = `<div class="k">Savol №${l.num} natijalari</div><div class="t">Javob: ${esc(l.answer)}</div>
          <div class="d">${l.my ? (l.my.ok ? `Siz to'g'ri topdingiz: +${l.my.p} ball 🎉` : 'Bu safar topa olmadingiz') : `${l.correct} kishi to'g'ri topdi`}${h.daily.next ? ` · Keyingi savol: ${fmtDay(h.daily.next.date)}, ${h.daily.next.time}` : ''}</div>
          <button class="btn">Natijalarni ko'rish</button>`;
      } else {
        hero.innerHTML = `<div class="k">Kunlik Zakovat savoli</div><div class="t">Tez orada birinchi savol!</div><div class="d">${h.daily.next ? `Keyingi savol: ${fmtDay(h.daily.next.date)}, soat ${h.daily.next.time}` : 'Kanal yangiliklarini kuzatib boring'}</div>`;
      }
      if (h.svoyakLive) $('#svLive').innerHTML = `<span class="live-dot"></span> ${h.svoyakLive} ta jonli o'yin`;
      $('#tsInfo').textContent = `Reyting: ${Math.round(App.user.st.qr)}`;
      if (h.activeGame) {
        const b = document.createElement('div');
        b.className = 'notice mt'; b.style.cursor = 'pointer';
        b.innerHTML = '🧱 Sizda tugallanmagan To\'siq o\'yini bor — davom ettirish uchun bosing';
        b.onclick = () => go('tosiqGame', { id: h.activeGame });
        $('.tiles', el).before(b);
      }
    } catch (e) { console.error(e); }
  },
});

// ---------- Reyting ----------
const RATING_TABS = [['daily', '🧠 Savol', 'ball'], ['tosiq', '🧱 To\'siq', 'reyting'], ['football', '⚽ Prognoz', 'ball'], ['penalty', '🥅 Penalti', 'g\'alaba']];
page('rating', {
  nav: true,
  async render(el, p) {
    const type = p.type || 'daily';
    el.innerHTML = `<div class="page">${pageHead('Reyting', 'Ukademiklarning eng zukkolari')}
      <div class="tabs">${RATING_TABS.map(([k, t]) => `<button class="tab ${k === type ? 'on' : ''}" data-t="${k}">${t}</button>`).join('')}</div>
      <div id="rt"><div class="empty"><div class="spinner" style="margin:auto"></div></div></div></div>`;
    $$('.tab', el).forEach((b) => b.onclick = () => { haptic('select'); App.stack.pop(); go('rating', { type: b.dataset.t }); });
    const r = await api('/api/rating?type=' + type);
    const unit = RATING_TABS.find((x) => x[0] === type)[2];
    const box = $('#rt');
    if (!r.rows.length) { box.innerHTML = `<div class="empty"><div class="e">🏁</div>Hali hech kim yo'q. Birinchi bo'ling!</div>`; return; }
    const top3 = r.rows.slice(0, 3);
    const order = [top3[1], top3[0], top3[2]];
    const pod = `<div class="podium">${order.map((x, i) => x ? `<div class="p p${x.rank}">${av(x.user, x.rank === 1 ? 64 : 52)}<div class="n ell">${esc(x.user.name)}</div><div class="v">${x.v}</div><div class="base">${['🥈', '🥇', '🥉'][i]}</div></div>` : '<div class="p"></div>').join('')}</div>`;
    const rows = r.rows.map((x) => `<div class="li ${x.user.id === App.user.id ? 'me' : ''}"><div class="rank">${x.rank}</div>${av(x.user, 38)}<div class="grow"><div class="t ell">${esc(x.user.name)}</div><div class="s">${esc(x.sub)}</div></div><div class="score">${x.v}</div></div>`).join('');
    const mine = r.me && r.me.rank > 100 ? `<div class="list mt"><div class="li me"><div class="rank">${r.me.rank}</div>${av(r.me.user, 38)}<div class="grow"><div class="t">Siz</div><div class="s">${esc(r.me.sub)}</div></div><div class="score">${r.me.v}</div></div></div>` : '';
    box.innerHTML = pod + `<div class="list">${rows}</div>${mine}<div class="muted small center mt">Ko'rsatkich: ${unit}</div>`;
  },
});

// ---------- Profil ----------
page('profile', {
  nav: true,
  async render(el) {
    try { const me = await api('/api/me'); if (me.user) App.user = me.user; } catch (e) { }
    const u = App.user, s = u.st;
    const tp = themePref();
    el.innerHTML = `<div class="page">
      <div class="prof-head">${av(u, 104)}<div class="n">${esc(u.name)}</div>${u.username ? `<div class="muted">@${esc(u.username)}</div>` : ''}
        <button class="btn ghost sm mt" id="edit">✏️ Profilni tahrirlash</button></div>
      <h2>🧠 Kunlik savol</h2>
      <div class="stats"><div class="stat"><div class="v">${s.dp}</div><div class="l">Ball</div></div><div class="stat"><div class="v">${s.dc}<span class="muted" style="font-size:15px">/${s.dq}</span></div><div class="l">To'g'ri javoblar</div></div></div>
      <h2>🧱 To'siq</h2>
      <div class="stats"><div class="stat"><div class="v">${Math.round(s.qr)}</div><div class="l">Reyting</div></div><div class="stat"><div class="v">${s.qw}<span class="muted" style="font-size:15px"> / ${s.qg}</span></div><div class="l">G'alabalar / o'yinlar</div></div></div>
      <h2>🥅 Penalti</h2>
      <div class="stats"><div class="stat"><div class="v">${s.pw}</div><div class="l">G'alabalar</div></div><div class="stat"><div class="v">${s.pgoals}</div><div class="l">Urilgan gollar</div></div></div>
      <h2>🎨 Ko'rinish</h2>
      <div class="seg" id="theme"><button data-v="light" class="${tp === 'light' ? 'on' : ''}">☀️ Kunduzgi</button><button data-v="dark" class="${tp === 'dark' ? 'on' : ''}">🌙 Tungi</button><button data-v="auto" class="${tp === 'auto' ? 'on' : ''}">📱 Avto</button></div>
      <div class="muted small center mt2">Akkaunt ochilgan: ${fmtDT(u.createdAt)}</div>
    </div>`;
    $$('#theme button', el).forEach((b) => b.onclick = () => { setThemePref(b.dataset.v); haptic('select'); go('profile'); });
    $('#edit').onclick = () => editProfile();
  },
});

function editProfile() {
  const u = App.user;
  let avatarData = null;
  const m = modal('Profilni tahrirlash', `
    <div class="center" id="epav" style="cursor:pointer">${av(u, 96)}<div class="small" style="color:var(--primary);font-weight:700;margin-top:8px">📷 Rasmni o'zgartirish</div></div>
    <label class="field mt"><span>Ism</span><input class="input" id="epn" maxlength="40" value="${esc(u.name)}"></label>
    ${u.hasCustomAvatar ? `<button class="btn plain sm" id="eprst">↩️ Telegram rasmini qaytarish</button>` : ''}`,
    `<button class="btn plain" id="epc">Bekor</button><button class="btn" id="eps">Saqlash</button>`);
  $('#epav .av', m.el).style.margin = '0 auto';
  $('#epav', m.el).onclick = async () => {
    const d = await pickImage(256, true, 0.85);
    if (!d) return;
    avatarData = d;
    $('#epav .av', m.el).innerHTML = `<img src="${d}" style="width:100%;height:100%;object-fit:cover">`;
  };
  $('#epc', m.el).onclick = m.close;
  const rst = $('#eprst', m.el);
  if (rst) rst.onclick = async () => {
    try { const r = await post('/api/profile', { resetAvatar: true }); App.user = r.user; m.close(); toast('Telegram rasmi qaytarildi', 'ok'); go('profile'); } catch (e) { errToast(e); }
  };
  $('#eps', m.el).onclick = async () => {
    const body = { name: $('#epn', m.el).value };
    if (avatarData) body.avatarData = avatarData;
    try { const r = await post('/api/profile', body); App.user = r.user; m.close(); haptic('success'); toast('Saqlandi ✅', 'ok'); go('profile'); } catch (e) { errToast(e); }
  };
}
