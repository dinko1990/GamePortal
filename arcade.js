/* arcade.js - shared login + score saving for every game in the arcade.
   Load AFTER the supabase-js script:
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/dist/umd/supabase.min.js"></script>
   <script src="https://dinko1990.github.io/GamePortal/arcade.js"></script>            */
(function () {
  const SB_URL = 'https://nltmttfkfwmuvelsuoeh.supabase.co';
  const SB_KEY = 'sb_publishable_uWaDHrNqVP_w4F5BWlODLA_Z8ar8Oge'; // public key: safe in front-end code
  const sb = window.supabase.createClient(SB_URL, SB_KEY);
  const mail = u => u.trim().toLowerCase() + '@arcade.local';
  const esc = t => String(t).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
  const A = { sb, user: null, listeners: [] };

  A.name = () => (A.user ? (A.user.email || '').split('@')[0] : null);
  A.onChange = fn => { A.listeners.push(fn); fn(A.user); };
  sb.auth.onAuthStateChange((_e, s) => { A.user = (s && s.user) || null; A.listeners.forEach(f => f(A.user)); });

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
  // All of this student's results for one game (newest first)
  A.myScores = async game => {
    if (!A.user) return [];
    const { data } = await sb.from('scores').select('*').eq('game', game).order('created_at', { ascending: false }).limit(2000);
    return data || [];
  };

  // Small login box. Usage: Arcade.mount(document.getElementById('login'))
  A.mount = el => {
    const draw = (msg = '') => {
      const box = 'border:1px solid #8884;border-radius:14px;padding:12px;font:14px system-ui,sans-serif;display:flex;gap:8px;flex-wrap:wrap;align-items:center';
      const inp = 'flex:1;min-width:110px;padding:9px 11px;border:1px solid #8886;border-radius:10px;font-size:16px';
      const btn = 'padding:9px 13px;border-radius:10px;border:1px solid #8886;font-weight:700;cursor:pointer';
      if (A.user) {
        el.innerHTML = `<div style="${box}"><span style="flex:1">👤 <b>${esc(A.name())}</b> · scores are saved</span><button id="ar-out" style="${btn}">Log out</button></div>`;
        el.querySelector('#ar-out').onclick = A.logout; return;
      }
      el.innerHTML = `<div style="${box}"><b style="width:100%">Log in to save your scores</b><input id="ar-u" placeholder="username" autocapitalize="none" autocomplete="username" style="${inp}"><input id="ar-p" type="password" placeholder="password" autocomplete="current-password" style="${inp}"><button id="ar-in" style="${btn}">Log in</button><button id="ar-up" style="${btn}">Create account</button><span id="ar-m" style="width:100%;color:#d33">${esc(msg)}</span></div>`;
      const go = async fn => { const m = await fn(el.querySelector('#ar-u').value, el.querySelector('#ar-p').value); if (m) draw(m); };
      el.querySelector('#ar-in').onclick = () => go(A.login);
      el.querySelector('#ar-up').onclick = () => go(A.signup);
      el.querySelector('#ar-p').onkeydown = e => { if (e.key === 'Enter') go(A.login); };
    };
    A.onChange(() => draw());
  };

  window.Arcade = A;
})();
