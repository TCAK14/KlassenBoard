'use strict';
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

function toast(msg, dur=2500) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), dur);
}

function safeText(str) {
  const el = document.createElement('span');
  el.textContent = str || '';
  return el.innerHTML;
}

function el(tag, cls, attrs={}) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const [k,v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function openModal(html, onClose) {
  const overlay = el('div','modal-overlay');
  overlay.innerHTML = html;
  document.body.appendChild(overlay);
  const close = () => { overlay.remove(); onClose && onClose(); };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  const closeBtns = overlay.querySelectorAll('[data-close]');
  closeBtns.forEach(b => b.addEventListener('click', close));
  return { overlay, close };
}

// ══════════════════════════════════════════════════════════════
// BOARD CRUD
// ══════════════════════════════════════════════════════════════
function createBoard(name, bg, widgets=[], skipLimit=false) {
  if (!skipLimit && !checkBoardLimit()) return null;
  const board = {
    id: uid(),
    name: name || 'Neue Tafel',
    background: bg || { type:'gradient', value:'linear-gradient(135deg,#667eea,#764ba2)' },
    widgets: widgets.map(w => ({ ...w, id: uid(), createdAt: new Date().toISOString() })),
    createdAt: new Date().toISOString(),
  };
  APP.state.boards.push(board);
  APP.state.activeBoardId = board.id;
  APP.save();
  renderAll();
  return board;
}

function switchBoard(id) {
  // Save drawing of current board before switching
  DRAW.saveBoard(APP.state.activeBoardId);
  APP.state.activeBoardId = id;
  APP.selectedId = null;
  stopAllIntervals();
  APP.save();
  renderBoardTabs();
  renderBoardBg();
  renderWidgets();
  // Load drawing of new board
  DRAW.loadBoard(id);
}

function deleteBoard(id) {
  if (APP.state.boards.length <= 1) { toast('Mindestens eine Tafel erforderlich'); return; }
  APP.snapshotUndo();
  // Find index and name of deleted board
  const delIdx = APP.state.boards.findIndex(b => b.id === id);
  const delName = APP.state.boards[delIdx]?.name || '';
  // Check if deleted board had default name "Tafel N"
  const defaultMatch = delName.match(/^Tafel (\d+)$/);
  const delNum = defaultMatch ? parseInt(defaultMatch[1]) : null;

  APP.state.boards = APP.state.boards.filter(b => b.id !== id);

  // Auto-renumber: boards with default name "Tafel M" where M > delNum → "Tafel M-1"
  if (delNum !== null) {
    APP.state.boards.forEach(b => {
      const m = b.name.match(/^Tafel (\d+)$/);
      if (m && parseInt(m[1]) > delNum) {
        b.name = 'Tafel ' + (parseInt(m[1]) - 1);
      }
    });
  }

  if (APP.state.activeBoardId === id) {
    const newIdx = Math.min(delIdx, APP.state.boards.length - 1);
    APP.state.activeBoardId = APP.state.boards[newIdx].id;
  }
  APP.save();
  renderAll();
}

function renameBoard(id, name) {
  const b = APP.state.boards.find(b => b.id === id);
  if (b) { b.name = name; APP.save(); renderBoardTabs(); }
}

// ══════════════════════════════════════════════════════════════
// WIDGET CRUD
// ══════════════════════════════════════════════════════════════
function addWidget(type, extraConfig={}) {
  const board = APP.activeBoard();
  if (!board) return;
  APP.snapshotUndo();
  const def = REGISTRY[type];
  const widget = {
    id: uid(),
    type,
    x: 40 + Math.random() * 80 | 0,
    y: 40 + Math.random() * 60 | 0,
    w: def.w,
    h: def.h,
    zIndex: nextZ(board),
    locked: false,
    config: { ...getDefaultConfig(type), ...extraConfig },
    createdAt: new Date().toISOString(),
  };
  board.widgets.push(widget);
  APP.save();
  renderWidgets();
  // select new widget
  APP.selectedId = widget.id;
  const wEl = document.querySelector('[data-wid="'+widget.id+'"]');
  if (wEl) wEl.classList.add('selected');
  return widget;
}

function removeWidget(id) {
  const board = APP.activeBoard();
  if (!board) return;
  APP.snapshotUndo();
  board.widgets = board.widgets.filter(w => w.id !== id);
  stopInterval(id);
  APP.selectedId = null;
  APP.save();
  renderWidgets();
}

function updateWidget(id, patch) {
  const board = APP.activeBoard();
  if (!board) return;
  const w = board.widgets.find(w => w.id === id);
  if (!w) return;
  Object.assign(w, patch);
  APP.save();
}

function nextZ(board) {
  return (board.widgets.reduce((m, w) => Math.max(m, w.zIndex || 0), 0)) + 1;
}

function getDefaultConfig(type) {
  const defaults = {
    clock:     {},
    timer:     { minutes: 5, seconds: 0, running: false, endAt: null },
    stopwatch: { running: false, elapsed: 0, laps: [] },
    text:      { text: 'Doppelklick zum Bearbeiten' },
    traffic:   { state: 'red' },
    qr:        { url: 'https://classpuls.de', label: '' },
    names:     { names: 'Anna\nBen\nClara\nDavid\nEva\nFinn\nGreta\nHannes', highlighted: -1 },
    homework:  { subject: 'Fach', items: [] },
    goal:      { text: 'Heutiges Lernziel' },
    timetable: { icalUrl: '', entries: [] },
    image:     { src: '', alt: '' },
    youtube:   { videoId: '', autoplay: false },
    dice:      { value: 1 },
    randomnum: { min: 1, max: 30, value: null },
    groups:    { names: 'Anna\nBen\nClara\nDavid\nEva\nFinn', size: 3 },
    agenda:    { items: [] },
    checklist: { items: [] },
    phases:    { phases: [
      {name:'Einführung', color:'#6366f1', minutes:5},
      {name:'Erarbeitung', color:'#22c55e', minutes:20},
      {name:'Sicherung', color:'#f59e0b', minutes:10},
      {name:'Reflexion', color:'#ec4899', minutes:5},
    ], activeIdx: -1 },
    status:    { statusIdx: 2 },
  };
  return defaults[type] || {};
}

// ══════════════════════════════════════════════════════════════
// INTERVAL MANAGEMENT
// ══════════════════════════════════════════════════════════════
function startInterval(wid, fn, ms) {
  stopInterval(wid);
  APP.intervals[wid] = setInterval(fn, ms);
}
function stopInterval(wid) {
  clearInterval(APP.intervals[wid]);
  delete APP.intervals[wid];
}
function stopAllIntervals() {
  Object.keys(APP.intervals).forEach(stopInterval);
}

// ── Audio streams (Geräuschpegel-Widget) ──
const AUDIO_STREAMS = {};
// ── Supabase Realtime channels (Poll-Widget) ──
const POLL_CHANNELS = {}; // widgetId -> { stream, ctx, raf }
function stopAudioStream(wid) {
  const a = AUDIO_STREAMS[wid];
  if (!a) return;
  cancelAnimationFrame(a.raf);
  a.stream?.getTracks().forEach(t => t.stop());
  a.ctx?.close().catch(()=>{});
  delete AUDIO_STREAMS[wid];
}
function stopAllAudioStreams() {
  Object.keys(AUDIO_STREAMS).forEach(stopAudioStream);
}

// ══════════════════════════════════════════════════════════════
// RENDER – BOARD
// ══════════════════════════════════════════════════════════════
