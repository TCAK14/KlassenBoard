'use strict';
const APP = {
  state: {
    boards: [],
    activeBoardId: null,
    editMode: true,
    undo: null,   // previous boards snapshot (1 level)
  },
  intervals: {},   // widgetId -> intervalId
  selectedId: null,
  saveTimer: null,
  icalCache: {},   // boardId -> { url, entries, lastFetched }

  // ── Persistence ──
  save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this._persist(), 500);
  },
  _persist() {
    try {
      const data = {
        boards: this.state.boards,
        activeBoardId: this.state.activeBoardId,
        icalCache: this.icalCache,
      };
      localStorage.setItem('classpuls_v2', JSON.stringify(data));
      AUTH.syncToCloud(); // Cloud-Sync wenn eingeloggt
    } catch(e) { toast('⚠️ Speichern fehlgeschlagen'); }
  },
  load() {
    try {
      let raw = localStorage.getItem('classpuls_v2');
      if (!raw) {
        raw = localStorage.getItem('klassenboard_v2');
        if (raw) {
          localStorage.setItem('classpuls_v2', raw);
          localStorage.removeItem('klassenboard_v2');
        }
      }
      if (!raw) return false;
      const data = JSON.parse(raw);
      this.state.boards = data.boards || [];
      this.state.activeBoardId = data.activeBoardId || null;
      this.icalCache = data.icalCache || {};
      return true;
    } catch(e) { return false; }
  },
  exportAll() {
    const data = {
      version:2,
      exported: new Date().toISOString(),
      boards: this.state.boards,
      icalCache: this.icalCache,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ClassPuls_' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
    toast('✅ Exportiert');
  },
  importAll(json) {
    try {
      const data = JSON.parse(json);
      if (!data.boards) throw new Error('Ungültiges Format');
      this.snapshotUndo();
      this.state.boards = data.boards;
      this.icalCache = data.icalCache || {};
      if (!this.state.boards.find(b => b.id === this.state.activeBoardId)) {
        this.state.activeBoardId = this.state.boards[0]?.id || null;
      }
      this.save();
      renderAll();
      toast('✅ Importiert: ' + data.boards.length + ' Tafel(n)');
    } catch(e) { toast('❌ Import fehlgeschlagen: ' + e.message); }
  },
  deleteAllData() {
    localStorage.removeItem('classpuls_v2');
    this.state.boards = [];
    this.state.activeBoardId = null;
    this.icalCache = {};
    this.intervals = {};
    createBoard('Tafel 1', null, [], true);
  },

  // ── Undo ──
  snapshotUndo() {
    this.state.undo = JSON.stringify(this.state.boards);
  },
  undo() {
    if (!this.state.undo) { toast('Kein Rückgängig verfügbar'); return; }
    const prev = JSON.parse(this.state.undo);
    this.state.undo = null;
    this.state.boards = prev;
    if (!this.state.boards.find(b => b.id === this.state.activeBoardId)) {
      this.state.activeBoardId = this.state.boards[0]?.id || null;
    }
    this.save();
    renderAll();
    toast('↩ Rückgängig');
  },

  // ── Board helpers ──
  activeBoard() { return this.state.boards.find(b => b.id === this.state.activeBoardId); },
};

// ══════════════════════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════════════════════
