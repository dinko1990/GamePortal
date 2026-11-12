/* arcade.js - shared login (email + 6-digit code) and score saving for every game.
   Load AFTER the supabase-js script. Portal: Arcade.corner(); Arcade.gate();   Games: Arcade.gate();  */
(function () {
  const SB_URL = 'https://nltmttfkfwmuvelsuoeh.supabase.co';
  const SB_KEY = 'sb_publishable_uWaDHrNqVP_w4F5BWlODLA_Z8ar8Oge'; // public key: safe in front-end code
  const LEN = 6; // must match "Email OTP length" in Supabase
  const sb = window.supabase.createClient(SB_URL, SB_KEY);
  const esc = t => String(t).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
  const A = { sb, user: null, listeners: [] };
  let ov = null, pill = null, required = false, view = 'email', pending = '';

  A.name = () => (A.user ? (A.user.email || '').split('@')[0] : null);
  A.onChange = fn => { A.listeners.push(fn); fn(A.user); };
  sb.auth.onAuthStateChange((ev, s) => {
    A.user = (s && s.user) || null;
    if (ev === 'SIGNED_IN' && A.user) setTimeout(() => sb.from('profiles').upsert({ id: A.user.id, display_name: A.name() }, { onConflict: 'id', ignoreDuplicates: true }).then(() => {}), 0);
    A.listeners.forEach(f => f(A.user)); sync();
  });
  A.ready = sb.auth.getSession().then(r => { A.user = (r.data.session && r.data.session.user) || null; });
  A.logout = () => sb.auth.signOut();

  // ---- email + code ----
  const nice = m => /rate|seconds|too many/i.test(m) ? 'Please wait a minute before asking for another code.' : m;
  A.sendCode = async email => { const r = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } }); return r.error ? nice(r.error.message) : ''; };
  A.verifyCode = async (email, code) => { const r = await sb.auth.verifyOtp({ email, token: code, type: 'email' }); return r.error ? 'Wrong or expired code. Try again.' : ''; };
  // ---- username + password (older accounts) ----
  const fake = u => u.trim().toLowerCase() + '@arcade.local';
  A.login = async (u, p) => { const r = await sb.auth.signInWithPassword({ email: fake(u), password: p }); return r.error ? (/invalid login/i.test(r.error.message) ? 'Wrong username or password' : r.error.message) : ''; };
  A.signup = async (u, p) => {
    if (!/^[a-z0-9_]{3,20}$/.test(u.trim().toLowerCase())) return 'Username: 3-20 letters, numbers or _';
    if (p.length < 6) return 'Password: at least 6 characters';
    const r = await sb.auth.signUp({ email: fake(u), password: p });
    if (r.error) return /registered|already/i.test(r.error.message) ? 'That username is taken' : r.error.message;
    return r.data.session ? '' : 'Account created. Now log in.';
  };

  // ---- scores ----
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

  // ---- UI (dark, matches the portal) ----
  const CSS = `.ar-pill{position:fixed;top:12px;right:12px;z-index:2147483646;display:flex;gap:8px;align-items:center;background:#1c1d2bee;color:#eef;border:1px solid #33354d;border-radius:999px;padding:5px 6px 5px 14px;font:600 13px system-ui,sans-serif;backdrop-filter:blur(6px)}
.ar-pill button{background:#2a2c44;color:#eef;border:0;border-radius:999px;padding:7px 13px;font:700 13px system-ui,sans-serif;cursor:pointer}.ar-pill button:first-child:last-child{margin-left:-8px}
.ar-ov{position:fixed;inset:0;z-index:2147483647;background:#0c0d14f0;display:none;place-items:center;padding:16px;font-family:system-ui,sans-serif}
.ar-card{width:min(380px,100%);background:#1c1d2b;border:1px solid #33354d;border-radius:22px;padding:24px;color:#eef;box-shadow:0 20px 60px #0008}.ar-card h2{margin:0 0 4px;font-size:22px}.ar-card p{margin:0 0 16px;color:#9a9db8;font-size:13px;line-height:1.45}
.ar-card input{width:100%;margin-bottom:8px;padding:12px 14px;border-radius:12px;border:1px solid #33354d;background:#12131c;color:#eef;font-size:16px;box-sizing:border-box}.ar-card input:focus{outline:2px solid #6f7cf5;border-color:transparent}
.ar-btn{width:100%;padding:12px;border-radius:12px;border:0;font-weight:800;font-size:15px;cursor:pointer}.ar-primary{background:#6f7cf5;color:#fff}.ar-ghost{background:transparent;color:#cfd2ee;border:1px solid #33354d;margin-top:8px}
.ar-msg{min-height:18px;font-size:13px;margin-top:8px}.ar-link{background:none;border:0;color:#9aa3ff;font-size:13px;cursor:pointer;margin-top:10px;padding:4px;width:100%}`;
  function css() { if (document.getElementById('ar-css')) return; const s = document.createElement('style'); s.id = 'ar-css'; s.textContent = CSS; document.documentElement.appendChild(s); }
  function modal() {
    css(); if (ov) return ov;
    ov = document.createElement('div'); ov.className = 'ar-ov'; ov.innerHTML = '<div class="ar-card"></div>';
    document.documentElement.appendChild(ov); render(); return ov;
  }
  function render(msg = '', good = false) {
    const c = ov.querySelector('.ar-card'), q = s => c.querySelector(s);
    const m = `<div class="ar-msg" style="color:${good ? '#7ee0a0' : '#ff8a8a'}">${esc(msg)}</div>`;
    const x = required ? '' : '<button class="ar-btn ar-ghost" id="ar-x">Not now</button>';
    if (view === 'email') {
      c.innerHTML = `<h2>🎮 Log in to play</h2><p>Enter your email. We'll send you a ${LEN}-digit code. No password needed.</p><input id="ar-e" type="email" placeholder="you@example.com" autocomplete="email" autocapitalize="none" spellcheck="false"><button class="ar-btn ar-primary" id="ar-send">Send code</button>${m}<button class="ar-link" id="ar-pw">Use a username and password instead</button>${x}`;
      const send = async () => { const e = q('#ar-e').value.trim().toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(e)) return render('Please enter a valid email.'); q('#ar-send').textContent = 'Sending…'; const r = await A.sendCode(e); if (r) return render(r); pending = e; view = 'code'; render('Code sent!', true); };
      q('#ar-send').onclick = send; q('#ar-e').onkeydown = ev => { if (ev.key === 'Enter') send(); };
      q('#ar-pw').onclick = () => { view = 'pw'; render(); };
    } else if (view === 'code') {
      c.innerHTML = `<h2>Check your email</h2><p>We sent a ${LEN}-digit code to <b>${esc(pending)}</b>. It can take a minute. Check your spam folder too.</p><input id="ar-c" inputmode="numeric" autocomplete="one-time-code" maxlength="${LEN}" placeholder="${'0'.repeat(LEN)}" style="text-align:center;letter-spacing:8px;font-size:24px"><button class="ar-btn ar-primary" id="ar-ver">Log in</button>${m}<button class="ar-link" id="ar-back">Use a different email</button>`;
      const ver = async () => { const code = q('#ar-c').value.replace(/\D/g, ''); if (code.length !== LEN) return render(`Enter all ${LEN} digits.`); q('#ar-ver').textContent = 'Checking…'; const r = await A.verifyCode(pending, code); if (r) return render(r); };
      q('#ar-ver').onclick = ver; q('#ar-c').oninput = ev => { ev.target.value = ev.target.value.replace(/\D/g, ''); if (ev.target.value.length === LEN) ver(); };
      q('#ar-c').onkeydown = ev => { if (ev.key === 'Enter') ver(); }; q('#ar-c').focus();
      q('#ar-back').onclick = () => { view = 'email'; render(); };
    } else {
      c.innerHTML = `<h2>Log in</h2><p>Use your username and password.</p><input id="ar-u" placeholder="Username" autocapitalize="none" autocomplete="username" spellcheck="false"><input id="ar-p" type="password" placeholder="Password" autocomplete="current-password"><button class="ar-btn ar-primary" id="ar-in">Log in</button><button class="ar-btn ar-ghost" id="ar-up">Create account</button>${m}<button class="ar-link" id="ar-em">Use email code instead</button>${x}`;
      const go = async fn => { const r = await fn(q('#ar-u').value, q('#ar-p').value); if (r) render(r); };
      q('#ar-in').onclick = () => go(A.login); q('#ar-up').onclick = () => go(A.signup); q('#ar-p').onkeydown = ev => { if (ev.key === 'Enter') go(A.login); };
      q('#ar-em').onclick = () => { view = 'email'; render(); };
    }
    const xb = q('#ar-x'); if (xb) xb.onclick = () => { ov.dataset.open = '0'; sync(); };
  }
  function drawPill() {
    if (!pill) return;
    pill.innerHTML = A.user ? `<span>👤 ${esc(A.name())}</span><button id="ar-out">Log out</button>` : '<button id="ar-open">🔒 Log in</button>';
    const o = pill.querySelector('#ar-out'), i = pill.querySelector('#ar-open');
    if (o) o.onclick = A.logout; if (i) i.onclick = () => { modal().dataset.open = '1'; sync(); };
  }
  function sync() {
    if (ov) { const show = !A.user && (required || ov.dataset.open === '1'); ov.style.display = show ? 'grid' : 'none'; if (A.user) { view = 'email'; render(); } }
    drawPill();
  }
  A.corner = () => { css(); pill = document.createElement('div'); pill.className = 'ar-pill'; document.documentElement.appendChild(pill); modal(); A.ready.then(sync); };
  A.gate = () => { required = true; modal(); render(); A.ready.then(sync); };
  A.mount = () => A.corner(); // old name, kept so existing pages keep working

  window.Arcade = A;
})();
