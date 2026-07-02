'use strict';
const CLASSES = {
  STORAGE_KEY: 'classpuls_classes',
  CURRENT_KEY: 'classpuls_current_class',

  // ── Lokale Daten ──
  _data() {
    try { return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || {}; } catch(e) { return {}; }
  },
  _save(data) { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data)); },
  current() { return localStorage.getItem(this.CURRENT_KEY) || null; },
  _setCurrent(name) { localStorage.setItem(this.CURRENT_KEY, name); },

  list() { return Object.keys(this._data()).sort(); },

  // ── Aktuelle Tafeln in die Klasse speichern ──
  saveCurrentBoards(className) {
    if (!className) return;
    const data = this._data();
    data[className] = {
      boards: APP.state.boards,
      activeBoardId: APP.state.activeBoardId,
      savedAt: new Date().toISOString()
    };
    this._save(data);
    // Auch Supabase sync falls angemeldet
    if (AUTH.user && AUTH.client) {
      AUTH.client.from('class_boards').upsert({
        user_id: AUTH.user.id,
        class_name: className,
        boards: APP.state.boards,
        active_board_id: APP.state.activeBoardId,
        saved_at: new Date().toISOString()
      }, { onConflict: 'user_id,class_name' }).then(({ error }) => {
        if (error) console.warn('Class cloud sync error:', error);
      });
    }
  },

  // ── Klassen-Tafeln laden ──
  async loadClass(className) {
    // 1. Versuche Supabase wenn angemeldet
    if (AUTH.user && AUTH.client) {
      const { data, error } = await AUTH.client.from('class_boards')
        .select('*').eq('user_id', AUTH.user.id).eq('class_name', className).maybeSingle();
      if (!error && data) {
        APP.snapshotUndo();
        APP.state.boards = data.boards || [];
        APP.state.activeBoardId = data.active_board_id || data.boards?.[0]?.id;
        if (APP.state.boards.length === 0) this._createDefaultBoard(className);
        APP.save();
        renderAll();
        return;
      }
    }
    // 2. Fallback: localStorage
    const stored = this._data()[className];
    APP.snapshotUndo();
    APP.state.boards = stored?.boards || [];
    APP.state.activeBoardId = stored?.activeBoardId || stored?.boards?.[0]?.id;
    if (APP.state.boards.length === 0) this._createDefaultBoard(className);
    APP.save();
    renderAll();
  },

  _createDefaultBoard(className) {
    const id = 'b-' + Date.now();
    APP.state.boards = [{ id, name: 'Tafel 1', background: { type:'gradient', value:'linear-gradient(135deg,#667eea,#764ba2)' }, widgets: [] }];
    APP.state.activeBoardId = id;
  },

  // ── Klasse wechseln ──
  async switchTo(className) {
    const current = this.current();
    if (current) {
      this.saveCurrentBoards(current); // auto-save current
    }
    this._setCurrent(className);
    await this.loadClass(className);
    this.renderDropdown();
    document.getElementById('class-btn-name').textContent = className;
    document.getElementById('class-dropdown').classList.remove('open');
    toast('📚 Klasse ' + className + ' geladen');
  },

  // ── Neue Klasse anlegen ──
  create(name, skipLimit=false) {
    if (!name.trim()) return;
    if (!skipLimit && !checkClassLimit()) return;
    const data = this._data();
    if (!data[name]) data[name] = { boards: [], savedAt: new Date().toISOString() };
    this._save(data);
    this.switchTo(name);
  },

  // ── Klasse löschen ──
  delete(name) {
    if (!confirm('Klasse "' + name + '" und alle ihre Tafeln löschen?')) return;
    const data = this._data();
    delete data[name];
    this._save(data);
    if (AUTH.user && AUTH.client) {
      AUTH.client.from('class_boards').delete()
        .eq('user_id', AUTH.user.id).eq('class_name', name).then(() => {});
    }
    if (this.current() === name) {
      localStorage.removeItem(this.CURRENT_KEY); // clear first so switchTo doesn't re-save deleted class
      document.getElementById('class-dropdown')?.classList.remove('open');
      const remaining = this.list();
      if (remaining.length > 0) this.switchTo(remaining[0]);
      else { this.renderDropdown(); }
    } else {
      this.renderDropdown();
    }
  },

  // ── Dropdown rendern ──
  renderDropdown() {
    const listEl = document.getElementById('class-list');
    if (!listEl) return;
    const classes = this.list();
    const current = this.current();
    listEl.innerHTML = '';

    if (classes.length === 0) {
      listEl.innerHTML = '<div style="padding:8px 12px;font-size:11.5px;color:rgba(255,255,255,0.3);font-style:italic">Noch keine Klassen angelegt</div>';
      return;
    }

    classes.forEach(cls => {
      const item = document.createElement('div');
      item.className = 'class-dd-item' + (cls === current ? ' active' : '');
      item.innerHTML = `
        <span style="font-size:16px">${this._emoji(cls)}</span>
        <span class="class-dd-name">${cls}</span>
        <button class="class-dd-del" title="Klasse löschen">✕</button>
      `;
      item.addEventListener('click', e => {
        if (e.target.classList.contains('class-dd-del')) return;
        this.switchTo(cls);
      });
      item.querySelector('.class-dd-del').addEventListener('click', e => {
        e.stopPropagation();
        this.delete(cls);
      });
      listEl.appendChild(item);
    });
  },

  _emoji(name) {
    const n = name.toLowerCase();
    if (n.includes('deutsch') || n.includes('de')) return '📖';
    if (n.includes('mathe') || n.includes('math')) return '🔢';
    if (n.includes('sport')) return '⚽';
    if (n.includes('musik')) return '🎵';
    if (n.includes('kunst')) return '🎨';
    if (n.includes('bio') || n.includes('natur')) return '🌿';
    if (n.includes('physik') || n.includes('chemie')) return '⚗️';
    return '🏷';
  },

  // ── UI initialisieren ──
  initUI() {
    const btn = document.getElementById('class-btn');
    const dropdown = document.getElementById('class-dropdown');
    if (!btn || !dropdown) return;

    btn.addEventListener('click', e => {
      e.stopPropagation();
      const open = dropdown.classList.toggle('open');
      if (open) this.renderDropdown();
    });
    document.addEventListener('click', e => {
      if (!dropdown.contains(e.target) && e.target !== btn) dropdown.classList.remove('open');
    });

    // Add trigger
    document.getElementById('class-add-trigger').addEventListener('click', () => {
      const form = document.getElementById('class-add-form');
      form.classList.toggle('visible');
      if (form.classList.contains('visible')) document.getElementById('class-add-input').focus();
    });

    // Confirm new class
    const confirmAdd = () => {
      const inp = document.getElementById('class-add-input');
      const name = inp.value.trim();
      if (!name) return;
      inp.value = '';
      document.getElementById('class-add-form').classList.remove('visible');
      this.create(name);
    };
    document.getElementById('class-add-confirm').addEventListener('click', confirmAdd);
    document.getElementById('class-add-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') confirmAdd();
      e.stopPropagation();
    });
    document.getElementById('class-add-input').addEventListener('click', e => e.stopPropagation());

    // Restore current class on load
    const current = this.current();
    if (current) {
      document.getElementById('class-btn-name').textContent = current;
    }
    this.renderDropdown();
  }
};

// ══════════════════════════════════════════════════════════════
// ZEICHNEN / SMARTBOARD MODUS
// ══════════════════════════════════════════════════════════════
