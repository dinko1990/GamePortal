/* anatomy-mp.js - Multiplayer menu for Anatomy Quest (step 3: nickname, ranks, locked-mode votes, leaderboard).
   Loaded by beta/anatomy.html after arcade.js. Game play itself (bot match, invites) comes in the next steps. */
(function () {
  'use strict';
  const ACTIVE = 'find-bones';
  const LOCKED = [['find-muscles', '💪 Find it · Muscles'], ['find-organs', '🫀 Find it · Organs'], ['name-green', '🟢 Name the green'], ['part-alone', '🔍 Part alone'], ['wordle', '🔤 Wordle']];
  const RANKS = [[0, 'Student', '🎓'], [1100, 'Intern', '🩺'], [1250, 'Resident', '🏥'], [1400, 'Surgeon', '🧑‍⚕️'], [1600, 'Chief', '👑']];
  const tier = r => { let k = 0; RANKS.forEach((x, i) => { if (r >= x[0]) k = i; }); return k; };
  const $ = s => document.querySelector(s);
  const esc = t => String(t).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
  let nick = null, rating = { rating: 1000, matches: 0, wins: 0 }, board = [], votes = {}, mine = new Set(), screen = null, msg = '';

  const CSS = `#mp{position:fixed;inset:0;z-index:30;background:var(--bg);color:var(--ink);overflow:auto;display:none;padding:16px;font-family:inherit}
#mp .wrap{max-width:680px;margin:0 auto;display:flex;flex-direction:column;gap:12px}#mp h2{margin:0;font-size:26px;letter-spacing:-.04em}
#mp .card{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:14px}#mp .row{display:flex;gap:8px;align-items:center;justify-content:space-between}
#mp .big{font-size:34px;font-weight:800;letter-spacing:-.04em}#mp .muted{color:var(--muted);font-size:13px}#mp input{width:100%;padding:11px 13px;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:var(--ink);font:inherit;font-size:16px;margin:8px 0}
#mp .bar{height:8px;background:var(--btn);border-radius:9px;overflow:hidden;margin-top:8px}#mp .bar i{display:block;height:100%;background:var(--accent)}
#mp .lock{opacity:.85}#mp table{width:100%;border-collapse:collapse;font-size:14px}#mp td,#mp th{padding:7px 4px;text-align:left;border-bottom:1px solid var(--line)}#mp th{color:var(--muted);font-size:11px}#mp tr.me td{font-weight:800;color:var(--accent)}
#mp .msg{color:var(--pink);font-size:13px;min-height:16px}#mp .button:disabled{opacity:.5;cursor:not-allowed}`;

  function mount() {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    screen = document.createElement('div'); screen.id = 'mp'; document.body.appendChild(screen);
    const start = $('#start'); if (!start) return;
    start.insertAdjacentHTML('afterend', '<button class="button" id="mpbtn" style="width:100%;margin-top:8px">⚔️ Multiplayer</button>');
    $('#mpbtn').onclick = open;
  }

  async function load() {
    const A = window.Arcade; if (!A || !A.sb || !A.user) return;
    const sb = A.sb, uid = A.user.id;
    const [p, r, lb, vc, mv] = await Promise.all([
      sb.from('profiles').select('nickname').eq('id', uid).maybeSingle(),
      sb.from('ratings').select('rating,matches,wins').eq('user_id', uid).eq('mode_key', ACTIVE).maybeSingle(),
      sb.from('leaderboard').select('nickname,rating,matches,wins').eq('mode_key', ACTIVE).order('rating', { ascending: false }).limit(20),
      sb.from('mode_vote_counts').select('mode_key,votes'),
      sb.from('mode_votes').select('mode_key'),
    ]);
    nick = (p.data && p.data.nickname) || null;
    rating = r.data || { rating: 1000, matches: 0, wins: 0 };
    board = lb.data || [];
    votes = Object.fromEntries((vc.data || []).map(x => [x.mode_key, x.votes]));
    mine = new Set((mv.data || []).map(x => x.mode_key));
  }

  function render() {
    const A = window.Arcade, head = '<div class="row"><button class="button" id="mpback">← Back</button><h2>⚔️ Multiplayer</h2><span></span></div>';
    let h = '<div class="wrap">' + head;
    if (!A || !A.user) {
      h += '<div class="card"><p>Log in to play against others and get a rank.</p><button class="button primary" id="mplogin">Log in</button></div>';
    } else if (!nick) {
      h += `<div class="card"><b>Choose your nickname</b><div class="muted">3–16 letters, numbers or _. Others will see this, not your email.</div><input id="mpnick" maxlength="16" placeholder="e.g. BoneHunter" autocapitalize="none" spellcheck="false"><button class="button primary" id="mpsave">Save nickname</button><div class="msg">${esc(msg)}</div></div>`;
    } else {
      const t = tier(rating.rating), next = RANKS[t + 1], base = RANKS[t][0];
      const pct = next ? Math.min(100, Math.round((rating.rating - base) / (next[0] - base) * 100)) : 100;
      h += `<div class="card"><div class="row"><div><div class="muted">Playing as</div><b style="font-size:18px">${esc(nick)}</b></div><div style="text-align:right"><div class="big">${RANKS[t][2]} ${RANKS[t][1]}</div><div class="muted">Rating ${rating.rating} · ${rating.wins} wins / ${rating.matches} matches</div></div></div><div class="bar"><i style="width:${pct}%"></i></div><div class="muted">${next ? (next[0] - rating.rating) + ' points to ' + next[1] : 'Top rank reached!'}</div></div>`;
      h += `<div class="card"><div class="row"><b>🎯 Find it · Bones</b><span class="muted">Ranked</span></div><div class="muted" style="margin:6px 0">Find the named bone before your opponent. First to lock in starts a 10-second timer for the other player.</div><div class="row"><button class="button primary" id="mpbot" style="margin:0">Play vs random</button><button class="button" id="mpinv">Invite a friend</button></div><div class="row" style="margin-top:8px"><input id="mpcode" maxlength="6" placeholder="Room code" style="margin:0;text-transform:uppercase"><button class="button" id="mpjoin">Join</button></div></div>`;
      h += '<div class="card"><b>Coming soon</b><div class="muted" style="margin-bottom:8px">Tap "I want this" to tell us which mode to build next.</div>';
      LOCKED.forEach(([k, t2]) => { h += `<div class="row lock" style="padding:6px 0"><span>🔒 ${t2}</span><span class="row" style="gap:8px"><span class="muted">${votes[k] || 0} votes</span><button class="button" data-vote="${k}" ${mine.has(k) ? 'disabled' : ''}>${mine.has(k) ? '✓ Voted' : 'I want this'}</button></span></div>`; });
      h += '</div>';
      h += '<div class="card"><b>🏆 Leaderboard · Find it · Bones</b>';
      h += board.length ? '<table><tr><th>#</th><th>Player</th><th>Rank</th><th>Rating</th><th>W/M</th></tr>' + board.map((x, i) => `<tr class="${x.nickname === nick ? 'me' : ''}"><td>${i + 1}</td><td>${esc(x.nickname)}</td><td>${RANKS[tier(x.rating)][2]}</td><td>${x.rating}</td><td>${x.wins}/${x.matches}</td></tr>`).join('') + '</table>' : '<div class="muted">No ranked players yet. Be the first!</div>';
      h += '</div>';
    }
    screen.innerHTML = h + '</div>';
    $('#mpback').onclick = () => { screen.style.display = 'none'; };
    const bb = $('#mpbot'); if (bb) { bb.onclick = () => startBot(); $('#mpinv').onclick = () => room(); $('#mpjoin').onclick = () => { const c = $('#mpcode').value.trim().toUpperCase(); if (c.length === 6) room(c); }; }
    const lg = $('#mplogin'); if (lg) lg.onclick = () => window.Arcade && Arcade.open();
    const sv = $('#mpsave'); if (sv) sv.onclick = async () => {
      const v = $('#mpnick').value.trim(); sv.textContent = 'Saving…';
      const { data, error } = await Arcade.sb.rpc('set_nickname', { nick: v });
      msg = error ? error.message : (data || ''); if (!msg) { await load(); } render();
    };
    screen.querySelectorAll('[data-vote]').forEach(b => b.onclick = async () => {
      const k = b.dataset.vote; b.disabled = true;
      const { error } = await Arcade.sb.rpc('vote_mode', { p_mode: k });
      if (!error && !mine.has(k)) { mine.add(k); votes[k] = (votes[k] || 0) + 1; } render();
    });
  }

  async function open() {
    screen.style.display = 'block'; screen.innerHTML = '<div class="wrap"><p class="muted">Loading…</p></div>';
    if (window.Arcade) await Arcade.ready;
    await load();
    if (pendingRoom && nick) { const c = pendingRoom; pendingRoom = null; return room(c); }
    render();
  }


  /* ================= MATCH ENGINE: bot + friend ================= */
  const MP_VER = '1.4'; // both players must run the same version of this file
  const Q = () => window.AQ, EASY = /femur|humerus|tibia|fibula|radius|ulna|clavicle|scapula|sternum|mandible|patella|sacrum|skull|pelvis|ribs/i;
  const MULT = [1, 1, 1.5, 2, 2.5], ROUNDS = 5, boxes = {};
  let G = null, ch = null, ui = null, pendingRoom = new URLSearchParams(location.search).get('room'), leaveT = null;
  if (pendingRoom) pendingRoom = pendingRoom.toUpperCase().slice(0, 6);
  const rnd = a => a[Math.floor(Math.random() * a.length)], sleep = ms => new Promise(r => setTimeout(r, ms));
  const boxesOf = k => boxes[k] || (boxes[k] = Q().meshes().filter(m => m.userData.key === k && m.userData.layer === 'bone').map(m => new (Q().THREE.Box3)().setFromObject(m)));
  function gap(a, b) { let g = 1e9; for (const x of boxesOf(a)) for (const y of boxesOf(b)) g = Math.min(g, Math.hypot(Math.max(0, x.min.x - y.max.x, y.min.x - x.max.x), Math.max(0, x.min.y - y.max.y, y.min.y - x.max.y), Math.max(0, x.min.z - y.max.z, y.min.z - x.max.z))); return g; }
  // 1000 = the target itself, 500 = touching it, 250 = within 10 cm, 100 = within 25 cm
  function points(pick, target) { if (!pick) return 0; if (pick === target) return 1000; const d = gap(pick, target); return d <= 0.5 ? 500 : d <= 10 ? 250 : d <= 25 ? 100 : 0; }
  const why = s => s >= 1000 ? 'Perfect' : s >= 500 ? 'Touching' : s >= 250 ? 'Within 10 cm' : s >= 100 ? 'Within 25 cm' : s === 0 ? 'Missed' : '';
  function pickTargets() { const all = Q().KEYS().filter(k => k.layer === 'bone').map(k => k.key), easy = all.filter(k => EASY.test(k)), t = []; while (t.length < ROUNDS) t.push(rnd((t.length < 2 && easy.length > 3 ? easy : all).filter(k => !t.includes(k)))); return t; }
  function botPick(t, skill) { if (Math.random() < .25 + .5 * skill) return t; const near = Q().KEYS().filter(k => k.layer === 'bone' && k.key !== t).map(k => [gap(k.key, t), k.key]).sort((a, b) => a[0] - b[0]).slice(0, 8); return rnd(near)[1]; }

  const MCSS = `@keyframes mpp{from{opacity:.7}to{opacity:1}}.mpt .hp:first-child{border-left:5px solid #3b82f6}.mpt .hp:last-child{border-left:5px solid #f97316}#hp1{background:#3b82f6!important}#hp2{background:#f97316!important}.al{display:none;margin-top:6px;padding:6px 10px;border-radius:10px;font-weight:800;font-size:14px;color:#fff;background:#f97316}.al.show{display:block}.al.me{background:#3b82f6}.al.warn{animation:mpp .9s infinite alternate}.al.hot{font-size:19px;background:#ea580c;animation:mpp .45s infinite alternate}.al .alb{height:5px;background:#fff4;border-radius:5px;margin-top:4px;overflow:hidden}.al .alb i{display:block;height:100%;background:#fff}#mpg.urgent::after{content:'';position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 44px 8px rgba(249,115,22,.55);animation:mpp .7s infinite alternate}@media(prefers-reduced-motion:reduce){.al,#mpg::after{animation:none!important}}.mp-on .hud,.mp-on .answers,.mp-on #wi,.mp-on #focusbtn,.mp-on .top,.mp-on .side,.mp-on .footer{display:none!important}.mp-on .layout{grid-template-columns:1fr!important}
#mpg{position:absolute;inset:0;pointer-events:none;font-family:inherit}#mpg .mpt,#mpg .mpb,#mpg .sel{pointer-events:none}#mpg button,#mpg .mpres,#mpg .mpres *{pointer-events:auto}.mpt{position:absolute;top:8px;left:8px;right:54px;display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start}
.mpt .hp,.mpt .mc{background:var(--glass);border:1px solid var(--line);border-radius:14px;padding:7px 10px;font-size:13px;font-weight:800}.mpt .hp{flex:1;min-width:120px}.mpt .mc{flex:2;min-width:170px;text-align:center}.mpt .bar{height:9px;background:var(--btn);border-radius:9px;overflow:hidden;margin:4px 0}.mpt .bar i{display:block;height:100%;background:var(--ok);transition:width .5s}
.mpb{position:absolute;left:0;right:0;bottom:14px;display:flex;flex-direction:column;align-items:center;gap:8px}.mpb .sel{background:var(--glass);border-radius:12px;padding:6px 12px;font-weight:800;font-size:14px;max-width:90%;text-align:center}.mpb .button.primary{width:min(320px,80%);margin:0;padding:14px}
.mpres{position:absolute;inset:0;background:#0009;display:grid;place-items:center;padding:16px}.mpres .card{width:min(360px,100%);text-align:center}#mpx{position:absolute;top:54px;right:8px;padding:6px 10px;font-size:12px}`;

  const ME = '#3b82f6', OPP = '#f97316', BOTH = '#a855f7', GOLD = '#facc15';
  function tint(key, hex, ei = .4) { Q().meshes().filter(m => m.userData.key === key).forEach(m => { m.material.color.set(hex); m.material.emissive.set(hex); m.material.emissiveIntensity = ei; }); }
  let halos = [];
  function clearHalos() { halos.forEach(([p, h]) => { p.remove(h); h.material.dispose(); }); halos = []; }
  function halo(key) { // yellow glow around the right bone: a slightly larger shell drawn behind it
    const T3 = Q().THREE;
    Q().meshes().filter(m => m.userData.key === key).forEach(m => {
      m.geometry.computeBoundingSphere(); const c = m.geometry.boundingSphere.center, s = 1.12;
      const h = new T3.Mesh(m.geometry, new T3.MeshBasicMaterial({ color: GOLD, side: T3.BackSide, transparent: true, opacity: .75, depthWrite: false }));
      h.scale.setScalar(s); h.position.copy(c).multiplyScalar(1 - s); m.add(h); halos.push([m, h]);
    });
  }
  const H = (id, h) => { const e = ui && ui.querySelector(id); if (e) e.innerHTML = h; };
  async function begin(o) {
    if (!Q() || !Q().ready()) { alert('The 3D model is still loading. Try again in a moment.'); return; }
    if (ui) ui.remove(); clearInterval(G && G.iv);
    G = Object.assign({ r: 0, myHp: 100, oppHp: 100, targets: pickTargets() }, o);
    if (!document.getElementById('mpcss')) { const s = document.createElement('style'); s.id = 'mpcss'; s.textContent = MCSS; document.head.appendChild(s); }
    document.body.classList.add('mp-on'); Q().mpActive = true; Q().setLayer('bone'); Q().showApp(); screen.style.display = 'none';
    ui = document.createElement('div'); ui.id = 'mpg';
    ui.innerHTML = `<div class="mpt"><div class="hp"><span>🔵 ${esc(nick)}</span> <span id="ht1">100</span><div class="bar"><i id="hp1" style="width:100%"></i></div></div><div class="mc"><div id="mpr"></div><div id="mpq" style="font-size:18px"></div><div id="mpk" class="muted"></div><div id="mpal" class="al"></div></div><div class="hp"><span>🟠 ${esc(G.oppName)}</span> <span id="ht2">100</span><div class="bar"><i id="hp2" style="width:100%"></i></div></div></div><button class="button" id="mpx">✕ Leave</button><div class="mpb"><div class="sel" id="mpsel">Tap a bone</div><button class="button primary" id="mplock" disabled>Lock in</button></div>`;
    document.querySelector('.viewer').appendChild(ui);
    ui.querySelector('#mplock').onclick = () => lock(); ui.querySelector('#mpx').onclick = leave; round();
  }
  const T = (id, t) => { const e = ui && ui.querySelector(id); if (e) e.textContent = t; };
  function round() {
    Object.assign(G, { target: G.targets[G.r], sel: null, locked: false, myS: null, oppS: null, oppAt: null, oppPick: null, busy: false, t0: performance.now() });
    clearHalos(); ui.classList.remove('urgent'); ui.querySelector('#mpal').className = 'al'; Q().clearMarks(); Q().resetCam(); T('#mpr', `Round ${G.r + 1} / ${ROUNDS}`); T('#mpq', 'Find the ' + G.target); T('#mpsel', 'Tap a bone'); T('#mpk', '');
    const l = ui.querySelector('#mplock'); l.disabled = true; l.textContent = 'Lock in';
    if (G.bot) { G.botAt = G.t0 + (4 + Math.random() * 14 * (1 - .4 * G.skill)) * 1000; G.botPick = botPick(G.target, G.skill); }
    clearInterval(G.iv); G.iv = setInterval(tick, 200);
  }
  function tick() {
    if (!G) return; const now = performance.now(); let left = 30 - (now - G.t0) / 1000;
    if (G.bot && G.oppS == null && now >= G.botAt) { G.oppPick = G.botPick; G.oppS = points(G.botPick, G.target); G.oppAt = now; }
    if (G.oppAt && !G.locked) left = Math.min(left, 10 - (now - G.oppAt) / 1000);
    T('#mpk', '⏱ ' + Math.max(0, Math.ceil(left)) + 's left in the round');
    const al = ui.querySelector('#mpal'); let l = null, cls = 'al show';
    if (!G.locked && G.oppAt) { l = Math.max(0, 10 - (now - G.oppAt) / 1000); cls += l <= 3 ? ' hot' : l <= 5 ? ' warn' : ''; al.innerHTML = `🟠 ${esc(G.oppName)} locked in! <b>${Math.ceil(l)}s</b> to lock yours<div class="alb"><i style="width:${l * 10}%"></i></div>`; ui.classList.toggle('urgent', l <= 5); }
    else if (G.locked && G.oppS == null) { l = Math.max(0, Math.min(10 - (now - G.lockedAt) / 1000, 30 - (now - G.t0) / 1000)); cls += ' me'; al.innerHTML = `🔵 You locked in. ${esc(G.oppName)} has <b>${Math.ceil(l)}s</b><div class="alb"><i style="width:${l * 10}%"></i></div>`; ui.classList.remove('urgent'); }
    else { cls = 'al'; ui.classList.remove('urgent'); }
    al.className = cls;
    if (left <= 0 && !G.locked) lock();
    if (G.locked && G.oppS == null && (now - G.t0) / 1000 >= 30 && G.bot) { G.oppS = 0; G.oppAt = now; }
    if (G.locked && G.oppS == null && !G.bot && now - Math.max(G.t0 + 30000, G.lockedAt + 10000) > 5000) G.oppS = 0;
    if (G.locked && G.oppS != null && !G.busy) reveal();
  }
  function lock() {
    if (!G || G.locked) return; G.locked = true; G.lockedAt = performance.now(); G.myS = points(G.sel, G.target);
    if (G.bot) G.botAt = Math.min(G.botAt, G.lockedAt + 10000);
    if (G.ch) ch.send({ type: 'broadcast', event: 'm', payload: { t: 'lock', r: G.r, pick: G.sel, s: G.myS } });
    const l = ui.querySelector('#mplock'); l.disabled = true; l.textContent = 'Locked ✓';
  }
  function reveal() {
    G.busy = true; clearInterval(G.iv); const a = G.myS, b = G.oppS, dmg = Math.round(Math.abs(a - b) / 10 * MULT[G.r]);
    if (a > b) G.oppHp = Math.max(0, G.oppHp - dmg); else if (b > a) G.myHp = Math.max(0, G.myHp - dmg);
    ui.querySelector('#mpal').className = 'al'; ui.classList.remove('urgent'); Q().clearMarks(); clearHalos();
    if (!(G.sel === G.target || G.oppPick === G.target)) tint(G.target, GOLD, .55);
    if (G.oppPick) tint(G.oppPick, OPP); if (G.sel) tint(G.sel, G.sel === G.oppPick ? BOTH : ME); halo(G.target); Q().fit(G.target);
    T('#mpq', 'It was the ' + G.target); T('#mpk', '');
    H('#mpsel', `<div>🔵 You: <b>${esc(G.sel || 'no pick')}</b> · ${why(a)} +${a}</div><div>🟠 ${esc(G.oppName)}: <b>${esc(G.oppPick || 'no pick')}</b> · ${why(b)} +${b}</div><div>🟡 Answer: <b>${esc(G.target)}</b></div>${dmg ? '<div>' + (a > b ? esc(G.oppName) : 'You') + ' −' + dmg + ' HP</div>' : ''}`);
    [[1, G.myHp], [2, G.oppHp]].forEach(([i, v]) => { T('#ht' + i, v); ui.querySelector('#hp' + i).style.width = v + '%'; });
    const over = G.myHp <= 0 || G.oppHp <= 0 || G.r >= ROUNDS - 1, g = G;
    setTimeout(() => { if (G !== g) return; if (over) finish(); else { G.r++; round(); } }, 4500);
  }
  async function finish() {
    clearInterval(G.iv); const win = G.myHp > G.oppHp ? 1 : G.myHp < G.oppHp ? -1 : 0; let d = null;
    if (G.rated && G.matchId && !G.reported) { G.reported = true; const { data } = await Arcade.sb.rpc('finish_match', { p_match: G.matchId, in_p1_hp: G.myHp, in_p2_hp: G.oppHp }); if (data) d = data.p1_delta; }
    if (!ui) return; const r = document.createElement('div'); r.className = 'mpres';
    r.innerHTML = `<div class="card"><div class="big">${win > 0 ? '🏆 Victory!' : win < 0 ? 'Defeat' : 'Draw'}</div><div class="muted">${esc(nick)} ${G.myHp} HP · ${esc(G.oppName)} ${G.oppHp} HP</div><div style="font-size:20px;font-weight:800;margin:10px 0">${d != null ? 'Rating ' + (d >= 0 ? '+' : '') + d : G.rated ? '' : 'Friendly match · not ranked'}</div><button class="button primary" id="mpre">Rematch</button><button class="button" id="mpmenu" style="width:100%;margin-top:8px">Back to menu</button></div>`;
    ui.appendChild(r); G.done = true; r.querySelector('#mpmenu').onclick = exit;
    r.querySelector('#mpre').onclick = () => { if (G.bot) startBot(true); else { G.me = true; ch.send({ type: 'broadcast', event: 'm', payload: { t: 'rematch' } }); r.querySelector('#mpre').textContent = 'Waiting for friend…'; maybeRematch(); } };
  }
  function maybeRematch() { if (G && G.ch && G.me && G.opp && G.host) { const t = pickTargets(); ch.send({ type: 'broadcast', event: 'm', payload: { t: 'start', targets: t, host: nick } }); begin({ ch: 1, host: 1, oppName: G.oppName, targets: t }); } }
  async function leave() {
    if (!G || !confirm('Leave the match? It counts as a loss.')) return;
    if (G.rated && G.matchId && !G.reported && G.r > 0) { G.reported = true; await Arcade.sb.rpc('finish_match', { p_match: G.matchId, in_p1_hp: 0, in_p2_hp: G.oppHp }); }
    if (G.ch) ch.send({ type: 'broadcast', event: 'm', payload: { t: 'leave' } }); exit();
  }
  function exit() {
    clearInterval(G && G.iv); clearTimeout(leaveT); clearHalos(); document.body.classList.remove('mp-on'); Q().mpActive = false; if (ui) ui.remove(); ui = null;
    Q().clearMarks(); Q().resetCam(); if (ch) { ch.unsubscribe(); ch = null; } G = null; Q().showHome(); open();
  }
  function forfeitWin() { if (G && !G.done) { G.oppHp = 0; G.busy = true; finish(); } }

  async function startBot(quick) {
    if (!quick) { screen.innerHTML = '<div class="wrap"><div class="card" style="text-align:center"><div class="big">🔎</div><b>Searching for an opponent…</b></div></div>'; await sleep(2500); }
    const br = rating.rating + Math.round((Math.random() - .5) * 120), skill = Math.max(.1, Math.min(.9, (br - 800) / 800)); let id = null;
    const { data } = await Arcade.sb.from('matches').insert({ mode_key: ACTIVE, p1: Arcade.user.id, p2_is_bot: true, rated: true, status: 'playing' }).select('id').single(); if (data) id = data.id;
    begin({ bot: true, skill, rated: !!id, matchId: id, oppName: '🤖 Bot' });
  }

  // ----- friend rooms (Supabase Realtime) -----
  function showRoom(c, host) {
    const link = location.origin + location.pathname + '?room=' + c;
    screen.innerHTML = `<div class="wrap"><div class="card" style="text-align:center"><b>${host ? 'Invite a friend' : 'Joining room'}</b><div class="big" style="letter-spacing:8px;margin:8px 0">${c}</div><div class="muted">${host ? 'Send the code or link. The match starts when your friend joins.' : 'Waiting for the host…'}</div>${host ? `<input readonly value="${link}" style="margin-top:10px"><button class="button primary" id="mpcopy">Copy link</button>` : ''}<div class="msg" id="mpvm"></div><button class="button" id="mpcancel" style="width:100%;margin-top:8px">Cancel</button></div></div>`;
    const cp = $('#mpcopy'); if (cp) cp.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(link); cp.textContent = 'Copied ✓'; };
    $('#mpcancel').onclick = () => { if (ch) { ch.unsubscribe(); ch = null; } open(); };
  }
  function room(code) {
    const host = !code, c = code || Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.random() * 32 | 0]).join(''), uid = Arcade.user.id;
    if (ch) ch.unsubscribe(); showRoom(c, host);
    ch = Arcade.sb.channel('aq-' + c, { config: { broadcast: { self: false }, presence: { key: uid } } });
    const players = () => Object.values(ch.presenceState()).flat();
    ch.on('broadcast', { event: 'm' }, ({ payload: p }) => {
      if (p.t === 'start') begin({ ch: 1, host: 0, oppName: G && G.oppName || p.host, targets: p.targets });
      else if (!G) return;
      else if (p.t === 'lock' && p.r === G.r && G.oppS == null) { G.oppS = p.s; G.oppPick = p.pick; G.oppAt = performance.now(); }
      else if (p.t === 'rematch') { G.opp = true; maybeRematch(); }
      else if (p.t === 'leave') forfeitWin();
    });
    ch.on('presence', { event: 'sync' }, () => {
      const ps = players(); if (ps.length > 2 && !G) { alert('That room is full.'); ch.unsubscribe(); ch = null; open(); return; }
      if (ps.length === 2) { const o0 = ps.find(p => p.uid !== uid); if (o0 && o0.v !== MP_VER) { const e = $('#mpvm'); if (e) e.textContent = '⚠ One of you has an older version of the game. Both press Ctrl+Shift+R, then join again.'; return; } clearTimeout(leaveT); if (host && !G) { const o = ps.find(p => p.uid !== uid), t = pickTargets(); ch.send({ type: 'broadcast', event: 'm', payload: { t: 'start', targets: t, host: nick } }); begin({ ch: 1, host: 1, oppName: o.nick, targets: t }); } }
    });
    ch.on('presence', { event: 'leave' }, () => { if (G && G.ch && !G.done) { clearTimeout(leaveT); leaveT = setTimeout(() => { if (players().length < 2) forfeitWin(); }, 20000); } });
    ch.subscribe(async st => { if (st === 'SUBSCRIBED') await ch.track({ nick, uid, v: MP_VER }); });
  }
  // tap a bone -> it turns green (same feel as the normal Find it mode); Lock in makes it final
  (function () {
    const cv = document.getElementById('scene'); if (!cv) return; let dn = null;
    cv.addEventListener('pointerdown', e => { dn = { x: e.clientX, y: e.clientY }; });
    cv.addEventListener('pointerup', e => {
      const d = dn; dn = null; if (!G || G.locked || G.busy || G.done || !d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return;
      const A = Q(), r = cv.getBoundingClientRect(), rc = new A.THREE.Raycaster();
      rc.setFromCamera(new A.THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), A.camera);
      const h = rc.intersectObjects(A.meshes().filter(x => x.visible && x.userData.layer === 'bone'), false); if (!h.length) return;
      G.sel = h[0].object.userData.key; A.clearMarks(); tint(G.sel, ME); T('#mpsel', '🔵 ' + G.sel);
      const l = ui.querySelector('#mplock'); l.disabled = false;
    });
  })();
  if (pendingRoom) setTimeout(() => open(), 800);

  if (window.Arcade) Arcade.onChange(() => { if (screen && screen.style.display === 'block') open(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
