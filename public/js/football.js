// ============ Futbol: prognoz + penalti ============
'use strict';

page('football', {
  async render(el, p) {
    const tab = p.tab || 'prognoz';
    el.innerHTML = `<div class="page nonav">${pageHead('⚽ Futbol', 'Hisobni taxmin qiling va penalti tepib ko\'ring')}
      <div class="tabs"><button class="tab ${tab === 'prognoz' ? 'on' : ''}" data-t="prognoz">🔮 Prognoz</button><button class="tab ${tab === 'penalti' ? 'on' : ''}" data-t="penalti">🥅 Penalti</button></div><div id="fb"></div></div>`;
    $$('.tab', el).forEach((b) => b.onclick = () => { App.stack.pop(); go('football', { tab: b.dataset.t }); });
    if (tab === 'penalti') return penaltyIntro($('#fb'));
    const d = await api('/api/fb');
    const box = $('#fb');
    let h = `<div class="card tight mb" style="background:var(--green-soft);border:0"><div class="small"><b>Ball tizimi:</b> aniq hisob — <b>5</b>, farq to'g'ri — <b>3</b>, g'olib/durang to'g'ri — <b>2</b>. Prognoz o'yin boshlanguncha qabul qilinadi.</div></div>`;
    if (!d.upcoming.length && !d.finished.length) h += `<div class="empty"><div class="e">⚽</div>Hozircha o'yinlar qo'shilmagan.<br>Adminlar tez orada qiziqarli o'yinlarni qo'shadi!</div>`;
    for (const m of d.upcoming) h += matchCard(m);
    if (d.finished.length) { h += `<h2>✅ Yakunlangan</h2>`; for (const m of d.finished) h += matchCard(m); }
    h += `<button class="btn plain block mt" onclick="go('rating',{type:'football'})">🏆 Prognozchilar reytingi</button>`;
    box.innerHTML = h;
    $$('.stepper button', box).forEach((b) => b.onclick = () => {
      const v = $('#' + b.dataset.for); const n = Math.max(0, Math.min(20, Number(v.textContent) + Number(b.dataset.d)));
      v.textContent = n; haptic('select');
      const save = $(`[data-save="${b.dataset.m}"]`); if (save) { save.disabled = false; save.textContent = '💾 Saqlash'; }
    });
    $$('[data-save]', box).forEach((b) => b.onclick = async () => {
      const id = b.dataset.save;
      try {
        await post(`/api/fb/${id}/predict`, { h: $('#h' + id).textContent, a: $('#a' + id).textContent });
        haptic('success'); b.textContent = '✅ Saqlandi'; b.disabled = true;
      } catch (e) { errToast(e); }
    });
  },
});

function matchCard(m) {
  const fin = m.status === 'finished', live = m.status === 'live';
  const ph = m.my ? m.my.h : 0, pa = m.my ? m.my.a : 0;
  const tot = m.dist.home + m.dist.draw + m.dist.away;
  const pc = (x) => (tot ? Math.round(x / tot * 100) : 0);
  let mid;
  if (fin) mid = `<div class="sc">${m.score[0]} : ${m.score[1]}</div>`;
  else if (live) mid = `<div class="center"><span class="badge red"><span class="live-dot"></span> Jonli</span>${m.my ? `<div class="small muted mt">Siz: ${m.my.h}:${m.my.a}</div>` : ''}</div>`;
  else mid = `<div class="predict"><div class="stepper" style="flex-direction:column"><button data-for="h${m.id}" data-m="${m.id}" data-d="1">+</button><div class="v" id="h${m.id}">${ph}</div><button data-for="h${m.id}" data-m="${m.id}" data-d="-1">−</button></div><b>:</b><div class="stepper" style="flex-direction:column"><button data-for="a${m.id}" data-m="${m.id}" data-d="1">+</button><div class="v" id="a${m.id}">${pa}</div><button data-for="a${m.id}" data-m="${m.id}" data-d="-1">−</button></div></div>`;
  return `<div class="match">
    <div class="lg"><span>${esc(m.league || 'Futbol')}</span><span>${fmtDT(m.kickoff)}</span></div>
    <div class="teams"><div class="team"><span class="f">${esc(m.hf || '⚽')}</span>${esc(m.home)}</div>${mid}<div class="team"><span class="f">${esc(m.af || '⚽')}</span>${esc(m.away)}</div></div>
    ${!fin && !live ? `<button class="btn block ${m.my ? 'plain' : ''}" data-save="${m.id}" ${m.my ? 'disabled' : ''}>${m.my ? `✅ Prognozingiz: ${m.my.h}:${m.my.a}` : '💾 Saqlash'}</button>` : ''}
    ${fin ? `<div class="row"><span class="muted small grow">${m.my ? `Sizning prognoz: <b>${m.my.h}:${m.my.a}</b>` : 'Prognoz qilmagansiz'}</span>${m.my ? `<span class="badge ${m.my.p ? 'green' : 'gray'}">+${m.my.p} ball</span>` : ''}</div>` : ''}
    ${tot ? `<div class="distbar"><i style="width:${pc(m.dist.home)}%;background:var(--primary)"></i><i style="width:${pc(m.dist.draw)}%;background:var(--muted)"></i><i style="width:${pc(m.dist.away)}%;background:var(--red)"></i></div><div class="row small muted" style="justify-content:space-between;margin-top:4px"><span>${pc(m.dist.home)}%</span><span>Durang ${pc(m.dist.draw)}%</span><span>${pc(m.dist.away)}%</span></div>` : ''}
  </div>`;
}

function penaltyIntro(box) {
  const s = App.user.st;
  box.innerHTML = `<div class="card center"><div style="font-size:54px">🥅</div><h3>Penalti seriyasi</h3>
    <div class="muted">AI darvozabonga qarshi 5 tadan zarba. Siz tepasiz — keyin darvozada turasiz. Durang bo'lsa — «oltin gol» seriyasi!</div>
    <div class="stats mt"><div class="stat"><div class="v">${s.pw}</div><div class="l">G'alabalar</div></div><div class="stat"><div class="v">${s.pgoals}</div><div class="l">Gollar</div></div></div>
    <button class="btn lg block mt green" id="penGo">⚽ O'yinni boshlash</button>
    <button class="btn plain block mt" onclick="go('rating',{type:'penalty'})">🏆 Penalti reytingi</button></div>`;
  $('#penGo').onclick = () => go('penalty');
}

const KEEPER_SVG = (shirt) => `<svg viewBox="0 0 60 100"><circle cx="30" cy="14" r="10" fill="#f1c27d"/><rect x="18" y="26" width="24" height="36" rx="9" fill="${shirt}"/><rect x="3" y="28" width="16" height="7" rx="3.5" fill="${shirt}" transform="rotate(-35 11 31)"/><rect x="41" y="28" width="16" height="7" rx="3.5" fill="${shirt}" transform="rotate(35 49 31)"/><circle cx="5" cy="21" r="5" fill="#fff"/><circle cx="55" cy="21" r="5" fill="#fff"/><rect x="20" y="60" width="8" height="32" rx="4" fill="#222"/><rect x="32" y="60" width="8" height="32" rx="4" fill="#222"/></svg>`;
const BALL_SVG = `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="#fff" stroke="#222" stroke-width="2"/><polygon points="20,12 27,17 24,25 16,25 13,17" fill="#222"/><path d="M20 2v10M27 17l9-4M24 25l6 9M16 25l-6 9M13 17l-9-4" stroke="#222" stroke-width="2"/></svg>`;

page('penalty', {
  async render(el) {
    const S = { round: 0, shooting: true, me: [], ai: [], busy: false, sudden: false };
    el.innerHTML = `<div class="page nonav">${pageHead('🥅 Penalti')}
      <div class="card tight mb"><div class="pen-score"><div><div class="small muted">Siz</div><div class="pen-dots" id="dMe"></div></div><div class="score" id="sc">0 : 0</div><div style="text-align:right"><div class="small muted">AI 🤖</div><div class="pen-dots" id="dAi" style="justify-content:flex-end"></div></div></div></div>
      <div class="pen" id="pen"><div class="stands"></div><div class="stripes"></div>
        <div class="goal"><div class="zones">${[0, 1, 2, 3, 4, 5].map((i) => `<button data-z="${i}"></button>`).join('')}</div></div>
        <div class="keeper" id="kp" style="left:39%;top:23%;height:30%;width:22%">${KEEPER_SVG('#f2a900')}</div>
        <div class="spot"></div><div class="ball" id="ball">${BALL_SVG}</div><div id="pmsg"></div></div>
      <div class="sv-status mt" id="ptip"></div></div>`;
    const tip = $('#ptip'), kp = $('#kp'), ball = $('#ball'), msg = $('#pmsg');
    const zoneXY = (z) => ({ x: 10 + (80 / 3) * (z % 3 + 0.5), y: 20 + 16 * (Math.floor(z / 3) + 0.5) });
    function dots() {
      const n = Math.max(5, S.me.length, S.ai.length);
      const d = (arr) => Array.from({ length: n }, (_, i) => `<i class="${arr[i] === true ? 'g' : arr[i] === false ? 'm' : ''}"></i>`).join('');
      $('#dMe').innerHTML = d(S.me); $('#dAi').innerHTML = d(S.ai);
      $('#sc').textContent = `${S.me.filter(Boolean).length} : ${S.ai.filter(Boolean).length}`;
    }
    function resetPos() {
      kp.style.transform = ''; ball.style.left = '45.5%'; ball.style.top = '80%'; ball.style.transform = ''; msg.innerHTML = '';
      kp.innerHTML = KEEPER_SVG(S.shooting ? '#f2a900' : '#2f66ff');
      tip.innerHTML = S.shooting ? '<div class="big">⚽ Siz tepasiz</div><div class="small muted">Darvozaning qayeriga tepishni tanlang</div>' : '<div class="big">🧤 Siz darvozabonsiz</div><div class="small muted">Qaysi tomonga sakrashni tanlang</div>';
    }
    function keeperTo(z) {
      const col = z % 3, row = Math.floor(z / 3);
      const tx = col === 0 ? -125 : col === 2 ? 125 : 0;
      const ty = row === 0 ? (col === 1 ? -22 : -10) : 12;
      const rot = col === 0 ? -65 : col === 2 ? 65 : 0;
      kp.style.transform = `translate(${tx}%, ${ty}%) rotate(${rot}deg)`;
    }
    function decided() {
      const a = S.me.filter(Boolean).length, b = S.ai.filter(Boolean).length;
      const n1 = S.me.length, n2 = S.ai.length;
      if (!S.sudden) {
        const left1 = 5 - n1, left2 = 5 - n2;
        if (a + left1 < b || b + left2 < a) return true;
        if (n1 === 5 && n2 === 5) { if (a !== b) return true; S.sudden = true; return false; }
        return false;
      }
      return n1 === n2 && a !== b;
    }
    async function finish() {
      const a = S.me.filter(Boolean).length, b = S.ai.filter(Boolean).length;
      const won = a > b;
      haptic(won ? 'success' : 'error'); won ? SFX.ok() : SFX.bad();
      try { const r = await post('/api/penalty', { gf: a, ga: b }); if (r.st) App.user.st = r.st; } catch (e) { }
      tip.innerHTML = `<div class="big">${won ? '🏆 G\'alaba!' : '😔 Mag\'lubiyat'}</div><div>${a} : ${b}</div><button class="btn block mt green" id="again">🔄 Yana o'ynash</button>`;
      $('#again').onclick = () => go('penalty', {}, { replace: true });
    }
    async function play(z) {
      if (S.busy) return;
      S.busy = true; haptic('medium');
      const t = zoneXY(z);
      let goal, aiZone;
      if (S.shooting) {
        // AI darvozabon: 35% to'g'ri tomonni topadi
        aiZone = Math.random() < 0.35 ? z : Math.floor(Math.random() * 6);
        const miss = (z === 0 || z === 2) && Math.random() < 0.12;
        const saved = !miss && aiZone % 3 === z % 3 && (Math.floor(aiZone / 3) === Math.floor(z / 3) || Math.random() < 0.45);
        goal = !miss && !saved;
        keeperTo(aiZone);
        ball.style.left = (t.x - 4.5 + (miss ? (z === 0 ? -9 : 9) : 0)) + '%'; ball.style.top = (t.y - (miss ? 10 : 4)) + '%'; ball.style.transform = 'scale(.62) rotate(540deg)';
        await new Promise((r) => setTimeout(r, 600));
        msg.innerHTML = `<div class="msg">${goal ? 'GOL! ⚽' : miss ? 'Tashqariga 😬' : 'Qaytardi! 🧤'}</div>`;
        goal ? SFX.ok() : SFX.bad();
        S.me.push(goal);
      } else {
        aiZone = [0, 2, 3, 5, 1, 4][Math.floor(Math.random() * 6)];
        const at = zoneXY(aiZone);
        const miss = Math.random() < 0.08;
        const saved = !miss && z % 3 === aiZone % 3 && (Math.floor(z / 3) === Math.floor(aiZone / 3) || Math.random() < 0.5);
        goal = !miss && !saved;
        keeperTo(z);
        ball.style.left = (at.x - 4.5 + (miss ? (aiZone % 3 === 0 ? -9 : 9) : 0)) + '%'; ball.style.top = (at.y - (miss ? 10 : 4)) + '%'; ball.style.transform = 'scale(.62) rotate(-540deg)';
        await new Promise((r) => setTimeout(r, 600));
        msg.innerHTML = `<div class="msg">${goal ? 'AI gol urdi 😩' : miss ? 'AI xato qildi! 😅' : 'Ushladingiz! 🧤'}</div>`;
        goal ? SFX.bad() : SFX.ok();
        haptic(goal ? 'error' : 'success');
        S.ai.push(goal);
      }
      dots();
      await new Promise((r) => setTimeout(r, 1300));
      if (decided()) return finish();
      S.shooting = !S.shooting; S.busy = false; resetPos();
    }
    $$('[data-z]', el).forEach((b) => b.onclick = () => play(Number(b.dataset.z)));
    dots(); resetPos();
  },
});
