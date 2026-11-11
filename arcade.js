/* arcade.js - shared login + score saving for every game in the arcade.
   Load AFTER the supabase-js script. Portal:  Arcade.corner(); Arcade.gate();   Games: Arcade.gate();  */
(function () {
  const SB_URL = 'https://nltmttfkfwmuvelsuoeh.supabase.co';
  const SB_KEY = 'sb_publishable_uWaDHrNqVP_w4F5BWlODLA_Z8ar8Oge'; // public key: safe in front-end code
  const sb = window.supabase.createClient(SB_URL, SB_KEY);
  const mail = u => u.trim().toLowerCase() + '@arcade.local';
  const esc = t => String(t).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
  const A = { sb, user: null, listeners: [] };
  let ov = null, pill = null, required = false;

  A.name = () => (A.user ? (A.user.email || '').split('@')[0] : null);
  A.onChange = fn => { A.listeners.push(fn); fn(A.user); };
  sb.auth.onAuthStateChange((_e, s) => { A.user = (s && s.user) || null; A.listeners.forEach(f => f(A.user)); sync(); });
  A.ready = sb.auth.getSession().then(r => { A.user = (r.data.session && r.data.session.user) || null; });

  A.signup = async (u, p) => {
    if (!/^[a-z0-9_]{3,20}$/.test(u.trim().toLowerCase())) return 'Username: 3-20 letters, numbers or _';
    if (p.length < 6) return 'Password: at least 6 characters';
    const r = await sb.auth.signUp({ email: mail(u), password: p });
    if (r.error) return /registered|already/i.test(r.error.message) ? 'That username is taken' : r.error.message;
    if (!r.data.session) return 'Account created. Now log in.';
    sb.from('profiles').upsert({ id: r.data.user.id, display_name: u.trim().toLowerCase() }).then(() => {});
    return '';
  };
  A.login = async (u, p) => {
    const r = await sb.auth.signInWithPassword({ email: mail(u), password: p });
    return r.error ? (/invalid login/i.test(r.error.message) ? 'Wrong username or password' : r.error.message) : '';
  };
  A.logout = () => sb.auth.signOut();

  // Save one result. data: {score (required), mode, category, level, correct, total}
  A.save = async (game, data) => {
    if (!A.user || !data || !data.score) return false;
    const { error } = await sb.from('scores').insert(Object.assign({ game }, data));
    if (error) console.warn('Arcade save failed', error);
    return !error;
  };
  A.myScores = async game => {
    if (!A.user) return [];
    const { data } = await sb.from('scores').select('*').eq('game', game).order('created_at', { ascending: false }).limit(2000);
    return data || [];
  };

  // ---------- UI (dark, matches the portal) ----------
  const CSS = `.ar-pill{position:fixed;top:12px;right:12px;z-index:9998;display:flex;gap:8px;align-items:center;background:#1c1d2bee;color:#eef;border:1px solid #33354d;border-radius:999px;padding:5px 6px 5px 14px;font:600 13px system-ui,sans-serif;backdrop-filter:blur(6px)}
.ar-pill button{background:#2a2c44;color:#eef;border:0;border-radius:999px;padding:7px 13px;font:700 13px system-ui,sans-serif;cursor:pointer}.ar-pill button:first-child:last-child{margin-left:-8px}
.ar-ov{position:fixed;inset:0;z-index:9999;background:#0c0d14f0;display:none;place-items:center;padding:16px;font-family:system-ui,sans-serif}
.ar-card{width:min(380px,100%);background:#1c1d2b;border:1px solid #33354d;border-radius:22px;padding:24px;color:#eef;box-shadow:0 20px 60px #0008}.ar-card h2{margin:0 0 4px;font-size:22px}.ar-card p{margin:0 0 16px;color:#9a9db8;font-size:13px}
.ar-card input{width:100%;margin-bottom:8px;padding:12px 14px;border-radius:12px;border:1px solid #33354d;background:#12131c;color:#eef;font-size:16px;box-sizing:border-box}.ar-card input:focus{outline:2px solid #6f7cf5;border-color:transparent}
.ar-btn{width:100%;padding:12px;border-radius:12px;border:0;font-weight:800;font-size:15px;cursor:pointer}.ar-primary{background:#6f7cf5;color:#fff}.ar-ghost{background:transparent;color:#cfd2ee;border:1px solid #33354d;margin-top:8px}.ar-msg{min-height:18px;color:#ff8a8a;font-size:13px;margin-top:8px}`;
  function css() { if (document.getElementById('ar-css')) return; const s = document.createElement('style'); s.id = 'ar-css'; s.textContent = CSS; document.head.appendChild(s); }
  function modal() {
    css(); if (ov) return ov;
    ov = document.createElement('div'); ov.className = 'ar-ov';
    ov.innerHTML = '<div class="ar-card"><h2>🎮 Log in to play</h2><p>Pick a username and password. No email needed.</p><input id="ar-u" placeholder="Username" autocapitalize="none" autocomplete="username" spellcheck="false"><input id="ar-p" type="password" placeholder="Password" autocomplete="current-password"><button class="ar-btn ar-primary" id="ar-in">Log in</button><button class="ar-btn ar-ghost" id="ar-up">Create account</button><div class="ar-msg" id="ar-m"></div><button class="ar-btn ar-ghost" id="ar-x" style="margin-top:0">Not now</button></div>';
    document.body.appendChild(ov);
    const q = s => ov.querySelector(s);
    const go = async fn => { q('#ar-m').textContent = '…'; q('#ar-m').textContent = (await fn(q('#ar-u').value, q('#ar-p').value)) || ''; };
    q('#ar-in').onclick = () => go(A.login); q('#ar-up').onclick = () => go(A.signup);
    q('#ar-p').onkeydown = e => { if (e.key === 'Enter') go(A.login); };
    q('#ar-x').onclick = () => { ov.dataset.open = '0'; sync(); };
    return ov;
  }
  function drawPill() {
    if (!pill) return;
    pill.innerHTML = A.user ? `<span>👤 ${esc(A.name())}</span><button id="ar-out">Log out</button>` : '<button id="ar-open">🔒 Log in</button>';
    const o = pill.querySelector('#ar-out'), i = pill.querySelector('#ar-open');
    if (o) o.onclick = A.logout; if (i) i.onclick = () => { modal().dataset.open = '1'; sync(); };
  }
  function sync() {
    if (ov) { ov.style.display = (!A.user && (required || ov.dataset.open === '1')) ? 'grid' : 'none'; ov.querySelector('#ar-x').style.display = required ? 'none' : 'block'; }
    drawPill();
  }
  A.corner = () => { css(); pill = document.createElement('div'); pill.className = 'ar-pill'; document.body.appendChild(pill); modal(); A.ready.then(sync); };
  A.gate = () => { required = true; modal(); A.ready.then(sync); };
  A.mount = () => A.corner(); // old name, kept so existing pages keep working

  window.Arcade = A;
})();
