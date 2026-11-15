/* =====================================================================
   arcade.js - the ONE file that handles login, the login header and scores
   for every game in the arcade.

   Add to any game (this single line is all it needs):
       <script src="../arcade.js"></script>          (inside games/)
       <script src="arcade.js"></script>             (portal)

   Optional attributes on that tag:
       data-require-login="false"   -> no login wall (header + save still work)
       data-header="off"            -> no login header
   Optional: put <span id="arcade-header"></span> where the header should sit;
             without it the header floats in the top-right corner.

   Public API (all safe to call before login is ready):
       Arcade.save('game-name', { score, mode, category, level, correct, total })
       Arcade.myScores('game-name')   -> Promise of this student's rows
       Arcade.user / Arcade.name()    -> current user (null if logged out)
       Arcade.onChange(fn)            -> fn(user) now and on every login/logout
       Arcade.open()  Arcade.logout()
   ===================================================================== */
(function () {
  'use strict';
  if (window.Arcade) return;

  /* ============ 1. CONFIG - change things here only ============ */
  const CONFIG = {
    supabaseUrl: 'https://nltmttfkfwmuvelsuoeh.supabase.co',
    supabaseKey: 'sb_publishable_uWaDHrNqVP_w4F5BWlODLA_Z8ar8Oge', // public key: safe in front-end code
    supabaseCdn: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/dist/umd/supabase.min.js',
    portalUrl: 'https://dinko1990.github.io/GamePortal/index.html',
    otpLength: 6, // must match "Email OTP length" in Supabase
    text: {
      title: '🎮 Log in to play',
      emailHint: "Enter your email. We'll send you a code. No password needed.",
      portalLabel: '← Portal',
    },
  };
  const tag = document.currentScript;
  const flag = (name, dflt) => { const v = tag && tag.dataset[name]; return v === undefined ? dflt : v !== 'false' && v !== 'off'; };
  const REQUIRE_LOGIN = flag('requireLogin', true), SHOW_HEADER = flag('header', true);

  /* ============ 2. STATE ============ */
  const A = { user: null, sb: null, config: CONFIG };
  const listeners = []; let ready = false;
  const esc = t => String(t).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
  A.name = () => (A.user ? (A.user.email || '').split('@')[0] : null);
  A.onChange = fn => { listeners.push(fn); fn(A.user); };
  const setUser = u => { A.user = u; listeners.forEach(f => f(u)); ui.sync(); if (u) checkAccess(); else wall(null); };

  /* ============ 3. AUTH (email + one-time code) ============ */
  const loadLib = () => window.supabase ? Promise.resolve() : new Promise((ok, no) => {
    const s = document.createElement('script'); s.src = CONFIG.supabaseCdn; s.onload = ok;
    s.onerror = () => no(new Error('Could not load supabase-js')); document.head.appendChild(s);
  });
  const ensureProfile = u => A.sb.from('profiles').upsert({ id: u.id, display_name: (u.email || '').split('@')[0] }, { onConflict: 'id', ignoreDuplicates: true }).then(() => {});
  A.ready = loadLib().then(async () => {
    const sb = A.sb = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
    sb.auth.onAuthStateChange((ev, s) => { const u = (s && s.user) || null; if (ev === 'SIGNED_IN' && u) setTimeout(() => ensureProfile(u), 0); if (ready) setUser(u); });
    const r = await sb.auth.getSession(); A.user = (r.data.session && r.data.session.user) || null;
    ready = true; setUser(A.user);
  }).catch(e => console.warn('Arcade:', e));

  const friendly = m => /rate|seconds|too many/i.test(m) ? 'Please wait a minute before asking for another code.' : m;
  A.sendCode = async email => { await A.ready; if (!A.sb) return 'Login is unavailable right now.'; const r = await A.sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } }); return r.error ? friendly(r.error.message) : ''; };
  A.verifyCode = async (email, code) => { await A.ready; if (!A.sb) return 'Login is unavailable right now.'; const r = await A.sb.auth.verifyOtp({ email, token: code, type: 'email' }); return r.error ? 'Wrong or expired code. Try again.' : ''; };
  A.logout = async () => { await A.ready; return A.sb && A.sb.auth.signOut(); };

  /* ============ 4. SCORES ============ */
  A.save = async (game, data) => {
    await A.ready; if (!A.sb || !A.user || !data || !data.score) return false;
    const { error } = await A.sb.from('scores').insert(Object.assign({ game }, data));
    if (error) console.warn('Arcade save failed', error); return !error;
  };
  A.myScores = async game => {
    await A.ready; if (!A.sb || !A.user) return [];
    const { data } = await A.sb.from('scores').select('*').eq('game', game).order('created_at', { ascending: false }).limit(2000);
    return data || [];
  };

  /* ============ 5. UI (login card + header) - dark, matches the portal ============ */
  const CSS = `.ar-pill{position:fixed;top:12px;right:12px;z-index:2147483646;display:flex;gap:6px;align-items:center;background:#1c1d2bee;color:#eef;border:1px solid #33354d;border-radius:999px;padding:4px;font:600 13px system-ui,sans-serif;backdrop-filter:blur(6px)}
.ar-pill.ar-inline{position:static;display:inline-flex}.ar-pill span{padding:0 6px}
.ar-pill a,.ar-pill button{background:#2a2c44;color:#eef;border:0;border-radius:999px;padding:7px 12px;font:700 13px system-ui,sans-serif;cursor:pointer;text-decoration:none}
.ar-ov{position:fixed;inset:0;z-index:2147483647;background:#0c0d14f0;display:none;place-items:center;padding:16px;font-family:system-ui,sans-serif}
.ar-card{width:min(380px,100%);background:#1c1d2b;border:1px solid #33354d;border-radius:22px;padding:24px;color:#eef;box-shadow:0 20px 60px #0008}.ar-card h2{margin:0 0 4px;font-size:22px}.ar-card p{margin:0 0 16px;color:#9a9db8;font-size:13px;line-height:1.45}
.ar-card input{width:100%;margin-bottom:8px;padding:12px 14px;border-radius:12px;border:1px solid #33354d;background:#12131c;color:#eef;font-size:16px;box-sizing:border-box}.ar-card input:focus{outline:2px solid #6f7cf5;border-color:transparent}
.ar-btn{width:100%;padding:12px;border-radius:12px;border:0;font-weight:800;font-size:15px;cursor:pointer}.ar-primary{background:#6f7cf5;color:#fff}.ar-ghost{background:transparent;color:#cfd2ee;border:1px solid #33354d;margin-top:8px}
.ar-msg{min-height:18px;font-size:13px;margin-top:8px}.ar-link{background:none;border:0;color:#9aa3ff;font-size:13px;cursor:pointer;margin-top:10px;padding:4px;width:100%}`;
  const ui = { ov: null, pill: null, view: 'email', pending: '', wanted: false };
  const root = document.documentElement, L = CONFIG.otpLength;

  ui.card = (msg = '', good = false) => {
    const c = ui.ov.querySelector('.ar-card'), q = s => c.querySelector(s);
    const m = `<div class="ar-msg" style="color:${good ? '#7ee0a0' : '#ff8a8a'}">${esc(msg)}</div>`;
    const x = REQUIRE_LOGIN ? '' : '<button class="ar-btn ar-ghost" id="ar-x">Not now</button>';
    if (ui.view === 'email') {
      c.innerHTML = `<h2>${CONFIG.text.title}</h2><p>${esc(CONFIG.text.emailHint)}</p><input id="ar-e" type="email" placeholder="you@example.com" autocomplete="email" autocapitalize="none" spellcheck="false"><button class="ar-btn ar-primary" id="ar-send">Send code</button>${m}${x}`;
      const send = async () => {
        const e = q('#ar-e').value.trim().toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(e)) return ui.card('Please enter a valid email.');
        q('#ar-send').textContent = 'Sending…'; const r = await A.sendCode(e); if (r) return ui.card(r);
        ui.pending = e; ui.view = 'code'; ui.card('Code sent!', true);
      };
      q('#ar-send').onclick = send; q('#ar-e').onkeydown = ev => { if (ev.key === 'Enter') send(); };
    } else {
      c.innerHTML = `<h2>Check your email</h2><p>We sent a ${L}-digit code to <b>${esc(ui.pending)}</b>. It can take a minute. Check your spam folder too.</p><input id="ar-c" inputmode="numeric" autocomplete="one-time-code" maxlength="${L}" placeholder="${'0'.repeat(L)}" style="text-align:center;letter-spacing:8px;font-size:24px"><button class="ar-btn ar-primary" id="ar-ver">Log in</button>${m}<button class="ar-link" id="ar-back">Use a different email</button>`;
      const ver = async () => {
        const code = q('#ar-c').value.replace(/\D/g, ''); if (code.length !== L) return ui.card(`Enter all ${L} digits.`);
        q('#ar-ver').textContent = 'Checking…'; const r = await A.verifyCode(ui.pending, code); if (r) ui.card(r);
      };
      q('#ar-ver').onclick = ver; q('#ar-c').onkeydown = ev => { if (ev.key === 'Enter') ver(); };
      q('#ar-c').oninput = ev => { ev.target.value = ev.target.value.replace(/\D/g, ''); if (ev.target.value.length === L) ver(); };
      q('#ar-back').onclick = () => { ui.view = 'email'; ui.card(); }; q('#ar-c').focus();
    }
    const xb = q('#ar-x'); if (xb) xb.onclick = () => { ui.wanted = false; ui.sync(); };
  };

  ui.pillDraw = () => {
    if (!ui.pill) return;
    const here = location.pathname.replace(/index\.html$/, ''), home = new URL(CONFIG.portalUrl).pathname.replace(/index\.html$/, '');
    const portal = here === home ? '' : `<a href="${CONFIG.portalUrl}">${esc(CONFIG.text.portalLabel)}</a>`;
    ui.pill.innerHTML = portal + (!ready ? '' : A.user ? `<span>👤 ${esc(A.name())}</span><button id="ar-out">Log out</button>` : '<button id="ar-open">🔒 Log in</button>');
    const o = ui.pill.querySelector('#ar-out'), i = ui.pill.querySelector('#ar-open');
    if (o) o.onclick = A.logout; if (i) i.onclick = A.open;
  };

  ui.sync = () => {
    if (!ui.ov) return;
    const show = ready && !A.user && (REQUIRE_LOGIN || ui.wanted);
    ui.ov.style.display = show ? 'grid' : 'none';
    if (A.user && ui.view !== 'email') { ui.view = 'email'; ui.card(); }
    ui.pillDraw();
  };

  ui.mount = () => {
    const s = document.createElement('style'); s.textContent = CSS; root.appendChild(s);
    ui.ov = document.createElement('div'); ui.ov.className = 'ar-ov'; ui.ov.innerHTML = '<div class="ar-card"></div>'; root.appendChild(ui.ov); ui.card();
    if (SHOW_HEADER) {
      ui.pill = document.createElement('div'); const host = document.getElementById('arcade-header');
      ui.pill.className = 'ar-pill' + (host ? ' ar-inline' : ''); (host || root).appendChild(ui.pill);
    }
    ui.sync();
  };
  A.open = () => { ui.wanted = true; ui.sync(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ui.mount); else ui.mount();

  /* ============ 7. GAME ACCESS (status comes from the admin page) ============ */
  // The game id is the page's file name (brainsplit.html -> "brainsplit"). Override with data-game="..." on the script tag.
  const GAME_ID = (tag && tag.dataset.game) || location.pathname.split('/').pop().replace(/\.html?$/i, '').toLowerCase();
  const money = (c, cur) => { try { return (c / 100).toLocaleString(undefined, { style: 'currency', currency: cur || 'USD' }); } catch (e) { return (c / 100).toFixed(2) + ' ' + cur; } };
  const back = `<a class="ar-btn ar-ghost" style="display:block;text-decoration:none;text-align:center;box-sizing:border-box" href="${CONFIG.portalUrl}">← Back to portal</a>`;
  function wall(html) {
    if (!ui.wall) { ui.wall = document.createElement('div'); ui.wall.className = 'ar-ov'; ui.wall.style.zIndex = 2147483645; root.appendChild(ui.wall); }
    if (!html) { ui.wall.style.display = 'none'; return; }
    ui.wall.innerHTML = '<div class="ar-card" style="text-align:center">' + html + '</div>'; ui.wall.style.display = 'grid';
    const b = ui.wall.querySelector('#ar-recheck'); if (b) b.onclick = () => { b.textContent = 'Checking…'; checkAccess(); };
  }
  async function checkAccess() {
    if (!A.sb || !A.user || SKIP.includes(GAME_ID)) return;
    try {
      const [g, r] = await Promise.all([A.sb.from('games').select('id,title,status,price_cents,currency,pay_url').eq('id', GAME_ID).maybeSingle(), A.sb.rpc('my_roles')]);
      const roles = r.data || {}, row = g.data;
      if (roles.blocked) return wall('<h2>Account suspended</h2><p>Please contact the admin.</p>');
      if (!row) return wall(null); // not managed in the admin page: always playable
      const admin = roles.god || (roles.games || []).includes(GAME_ID); let own = false;
      if (row.status === 'paid') { const p = await A.sb.from('purchases').select('game_id').eq('game_id', GAME_ID).maybeSingle(); own = !!p.data; }
      const ok = admin || row.status === 'on' || (row.status === 'paid' && own); A.access = { game: row, ok, admin, own };
      if (ok) return wall(null);
      const t = esc(row.title || GAME_ID);
      if (row.status === 'off') return wall(`<h2>${t}</h2><p>This game is not available right now.</p>${back}`);
      if (row.status === 'locked') return wall(`<h2>🔒 ${t}</h2><p>Coming soon!</p>${back}`);
      const buy = row.pay_url ? row.pay_url + (row.pay_url.includes('?') ? '&' : '?') + 'client_reference_id=' + encodeURIComponent(A.user.id) + '&prefilled_email=' + encodeURIComponent(A.user.email || '') : '';
      wall(`<h2>🛒 ${t}</h2><p>This is a paid game · <b>${esc(money(row.price_cents, row.currency))}</b></p>`
        + (buy ? `<a class="ar-btn ar-primary" style="display:block;text-decoration:none;box-sizing:border-box" href="${esc(buy)}" target="_blank" rel="noopener">Buy now</a>` : '<p>Payment is not set up yet. Please contact the admin.</p>')
        + `<button class="ar-btn ar-ghost" id="ar-recheck">I've paid · check again</button><p>After you pay, the admin unlocks the game. Come back and tap “check again”.</p>${back}`);
    } catch (e) { console.warn('Arcade access check failed', e); }
  }
  const SKIP = ['', 'index', 'admin'];

  /* ============ 6. Old calls from earlier pages (kept so nothing breaks) ============ */
  A.gate = A.corner = A.mount = () => {};

  window.Arcade = A;
})();
