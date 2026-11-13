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
      h += `<div class="card"><div class="row"><b>🎯 Find it · Bones</b><span class="muted">Ranked</span></div><div class="muted" style="margin:6px 0">Find the named bone before your opponent. First to lock in starts a 10-second timer for the other player.</div><div class="row"><button class="button primary" disabled style="margin:0">Play vs random · next step</button><button class="button" disabled>Invite a friend · soon</button></div></div>`;
      h += '<div class="card"><b>Coming soon</b><div class="muted" style="margin-bottom:8px">Tap "I want this" to tell us which mode to build next.</div>';
      LOCKED.forEach(([k, t2]) => { h += `<div class="row lock" style="padding:6px 0"><span>🔒 ${t2}</span><span class="row" style="gap:8px"><span class="muted">${votes[k] || 0} votes</span><button class="button" data-vote="${k}" ${mine.has(k) ? 'disabled' : ''}>${mine.has(k) ? '✓ Voted' : 'I want this'}</button></span></div>`; });
      h += '</div>';
      h += '<div class="card"><b>🏆 Leaderboard · Find it · Bones</b>';
      h += board.length ? '<table><tr><th>#</th><th>Player</th><th>Rank</th><th>Rating</th><th>W/M</th></tr>' + board.map((x, i) => `<tr class="${x.nickname === nick ? 'me' : ''}"><td>${i + 1}</td><td>${esc(x.nickname)}</td><td>${RANKS[tier(x.rating)][2]}</td><td>${x.rating}</td><td>${x.wins}/${x.matches}</td></tr>`).join('') + '</table>' : '<div class="muted">No ranked players yet. Be the first!</div>';
      h += '</div>';
    }
    screen.innerHTML = h + '</div>';
    $('#mpback').onclick = () => { screen.style.display = 'none'; };
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
    await load(); render();
  }

  if (window.Arcade) Arcade.onChange(() => { if (screen && screen.style.display === 'block') open(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
