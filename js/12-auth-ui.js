'use strict';
let _authMode = 'login';

function openLoginModal() {
  if (!AUTH._configured) {
    toast('⚙️ Supabase noch nicht konfiguriert (SUPABASE_URL im Code eintragen)');
    return;
  }
  const { overlay } = openModal(`
    <div class="modal auth-modal">
      <button class="modal-close" data-close>✕</button>
      <h2 style="margin-bottom:16px">ClassPuls</h2>
      <div class="auth-tabs">
        <button class="auth-tab active" id="tab-login"     onclick="switchAuthTab('login')">Anmelden</button>
        <button class="auth-tab"        id="tab-register"  onclick="switchAuthTab('register')">Registrieren</button>
      </div>
      <div class="auth-field">
        <label>E-Mail</label>
        <input type="email" id="auth-email" placeholder="lehrer@schule.at" autocomplete="email">
      </div>
      <div class="auth-field">
        <label>Passwort</label>
        <input type="password" id="auth-password" placeholder="••••••••" autocomplete="current-password">
      </div>
      <button class="auth-submit" id="auth-submit-btn" onclick="submitAuth()">Anmelden</button>
      <div class="auth-msg" id="auth-msg"></div>
      <div class="auth-info">Deine Boards werden automatisch in der<br>Cloud gespeichert und überall verfügbar.</div>
    </div>
  `);
  const emailInput = overlay.querySelector('#auth-email');
  const pwInput    = overlay.querySelector('#auth-password');
  emailInput.addEventListener('keydown', e => { if (e.key === 'Enter') pwInput.focus(); });
  pwInput.addEventListener('keydown',    e => { if (e.key === 'Enter') submitAuth(); });
  setTimeout(() => emailInput.focus(), 50);
}

function switchAuthTab(mode) {
  _authMode = mode;
  document.getElementById('tab-login').classList.toggle('active', mode === 'login');
  document.getElementById('tab-register').classList.toggle('active', mode === 'register');
  document.getElementById('auth-submit-btn').textContent = mode === 'login' ? 'Anmelden' : 'Konto erstellen';
  document.getElementById('auth-msg').textContent = '';
  document.getElementById('auth-msg').className = 'auth-msg';
}

async function submitAuth() {
  const email    = document.getElementById('auth-email')?.value.trim();
  const password = document.getElementById('auth-password')?.value;
  const btn      = document.getElementById('auth-submit-btn');
  const msg      = document.getElementById('auth-msg');
  if (!email || !password) {
    msg.textContent = 'Bitte E-Mail und Passwort eingeben.';
    msg.className = 'auth-msg error'; return;
  }
  if (password.length < 6) {
    msg.textContent = 'Passwort muss mindestens 6 Zeichen haben.';
    msg.className = 'auth-msg error'; return;
  }
  btn.disabled = true;
  btn.textContent = '…';
  msg.textContent = '';
  try {
    if (_authMode === 'login') {
      await AUTH.login(email, password);
      document.querySelector('.modal-overlay')?.remove();
      toast('✅ Willkommen zurück!');
    } else {
      await AUTH.register(email, password);
      msg.textContent = '✅ Bestätigungsmail gesendet! Bitte E-Mail prüfen.';
      msg.className = 'auth-msg success';
      btn.disabled = false;
      btn.textContent = 'Konto erstellen';
    }
  } catch(e) {
    const known = {
      'Invalid login credentials': 'E-Mail oder Passwort falsch.',
      'User already registered':   'Diese E-Mail ist bereits registriert.',
      'Email not confirmed':        'Bitte zuerst die Bestätigungsmail bestätigen.',
    };
    msg.textContent = known[e.message] || e.message;
    msg.className = 'auth-msg error';
    btn.disabled = false;
    btn.textContent = _authMode === 'login' ? 'Anmelden' : 'Konto erstellen';
  }
}

// ══════════════════════════════════════════════════════════════
// SPRACHSTEUERUNG
// ══════════════════════════════════════════════════════════════
