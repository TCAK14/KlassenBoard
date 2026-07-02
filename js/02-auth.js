'use strict';
const AUTH = {
  client: null,
  user: null,
  _syncTimer: null,
  _configured: false,

  init() {
    if (!window.supabase || SUPABASE_URL.includes('DEINE')) {
      console.info('ClassPuls: Supabase nicht konfiguriert — lokaler Modus aktiv.');
      return;
    }
    try {
      this._configured = true;
      this.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      // Bestehende Session wiederherstellen
      this.client.auth.getSession().then(({ data }) => {
        if (data?.session) {
          this.user = data.session.user;
          this._updateUI();
          this.loadFromCloud();
        }
      });
      this.client.auth.onAuthStateChange((event, session) => {
        this.user = session?.user || null;
        this._updateUI();
        if (event === 'SIGNED_IN')  this.loadFromCloud();
        if (event === 'SIGNED_OUT') { APP.load(); renderAll(); toast('👋 Abgemeldet'); }
      });
    } catch(e) { console.warn('Supabase init error:', e); }
  },

  async login(email, password) {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  async register(email, password) {
    const { error } = await this.client.auth.signUp({ email, password });
    if (error) throw error;
  },

  async logout() {
    if (this.client) await this.client.auth.signOut();
  },

  syncToCloud() {
    if (!this.client || !this.user) return;
    clearTimeout(this._syncTimer);
    this._setSyncDot('syncing');
    this._syncTimer = setTimeout(() => this._doSync(), 1500);
  },

  async _doSync() {
    if (!this.client || !this.user) return;
    try {
      const data = {
        boards: APP.state.boards,
        activeBoardId: APP.state.activeBoardId,
        icalCache: APP.icalCache,
      };
      const { error } = await this.client
        .from('boards')
        .upsert({ user_id: this.user.id, data, updated_at: new Date().toISOString() });
      if (error) throw error;
      this._setSyncDot('ok');
    } catch(e) {
      console.warn('Cloud-Sync fehlgeschlagen:', e);
      this._setSyncDot('error');
    }
  },

  async loadFromCloud() {
    if (!this.client || !this.user) return;
    try {
      const { data, error } = await this.client
        .from('boards')
        .select('data')
        .eq('user_id', this.user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return; // Erster Login – localStorage bleibt
      APP.state.boards      = data.data.boards || [];
      APP.state.activeBoardId = data.data.activeBoardId || null;
      APP.icalCache          = data.data.icalCache || {};
      if (!APP.state.boards.find(b => b.id === APP.state.activeBoardId)) {
        APP.state.activeBoardId = APP.state.boards[0]?.id || null;
      }
      if (APP.state.boards.length === 0) createBoard('Meine Tafel');
      else renderAll();
      toast('☁️ Boards aus der Cloud geladen');
    } catch(e) { console.warn('Cloud-Load fehlgeschlagen:', e); }
  },

  _updateUI() {
    const badge    = document.getElementById('user-badge');
    const loginBtn = document.getElementById('auth-login-btn');
    const emailEl  = document.getElementById('user-email');
    const avatarEl = document.getElementById('user-avatar');
    if (this.user) {
      const email = this.user.email || '';
      const meta = this.user.user_metadata || {};
      const displayName = meta.last_name || meta.lastName || meta.name?.split(' ').pop() || email.split('@')[0];
      emailEl.textContent  = displayName;
      avatarEl.textContent = displayName[0]?.toUpperCase() || '?';
      badge.classList.add('visible');
      loginBtn.style.display = 'none';
    } else {
      badge.classList.remove('visible');
      loginBtn.style.display = '';
    }
  },

  _setSyncDot(state) {
    const dot = document.getElementById('sync-dot');
    if (!dot) return;
    dot.classList.toggle('syncing', state === 'syncing');
    if (state !== 'syncing') {
      dot.style.background = state === 'ok' ? '#22c55e' : '#f87171';
    }
  },
};

// ══════════════════════════════════════════════════════════════
// WIDGET REGISTRY
// ══════════════════════════════════════════════════════════════
