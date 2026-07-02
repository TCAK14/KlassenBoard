'use strict';
function renderAll() {
  renderBoardTabs();
  renderBoardBg();
  renderWidgets();
}

function renderBoardTabs() {
  const container = document.getElementById('board-tabs');
  container.innerHTML = '';
  APP.state.boards.forEach(board => {
    const btn = el('button','tab-btn' + (board.id === APP.state.activeBoardId ? ' active' : ''));
    btn.dataset.bid = board.id;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'tab-name-span';
    nameSpan.textContent = board.name;

    const editBtn = document.createElement('span');
    editBtn.className = 'tab-action tab-edit';
    editBtn.textContent = '✏️';
    editBtn.title = 'Umbenennen';

    const closeX = document.createElement('span');
    closeX.className = 'tab-action tab-close';
    closeX.textContent = '✕';
    closeX.title = 'Tafel löschen';

    editBtn.addEventListener('click', e => {
      e.stopPropagation();
      openRenameModal(board);
    });
    closeX.addEventListener('click', e => {
      e.stopPropagation();
      if (APP.state.boards.length <= 1) { toast('❌ Mindestens eine Tafel muss vorhanden sein'); return; }
      if (confirm('Tafel "' + board.name + '" wirklich löschen?')) deleteBoard(board.id);
    });

    btn.append(nameSpan, editBtn, closeX);
    btn.addEventListener('click', () => switchBoard(board.id));
    container.appendChild(btn);
  });
}

function openRenameModal(board) {
  // Remove existing modal if any
  document.getElementById('rename-modal-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'rename-modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px)';

  const box = document.createElement('div');
  box.style.cssText = 'background:#1e293b;border:1px solid rgba(255,255,255,0.15);border-radius:14px;padding:20px;min-width:280px;box-shadow:0 20px 60px rgba(0,0,0,0.7)';
  box.innerHTML = '<div style="font-size:14px;font-weight:700;margin-bottom:12px">✏️ Tafel umbenennen</div>';

  const inp = document.createElement('input');
  inp.type = 'text';
  inp.value = board.name;
  inp.style.cssText = 'width:100%;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:#fff;font-size:14px;padding:9px 12px;margin-bottom:12px;box-sizing:border-box;touch-action:auto;outline:none';
  inp.addEventListener('click', e => e.stopPropagation());

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Abbrechen';
  cancelBtn.style.cssText = 'padding:8px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:transparent;color:rgba(255,255,255,0.7);cursor:pointer;font-size:13px';

  const okBtn = document.createElement('button');
  okBtn.textContent = 'Speichern';
  okBtn.style.cssText = 'padding:8px 16px;border-radius:8px;border:none;background:#6366f1;color:#fff;cursor:pointer;font-size:13px;font-weight:600';

  const close = () => overlay.remove();
  const confirm_rename = () => {
    const name = inp.value.trim();
    if (name) renameBoard(board.id, name);
    close();
  };

  cancelBtn.addEventListener('click', close);
  okBtn.addEventListener('click', confirm_rename);
  inp.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') confirm_rename();
    if (e.key === 'Escape') close();
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  row.append(cancelBtn, okBtn);
  box.append(inp, row);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => { inp.focus(); inp.select(); });
}

function renderBoardBg() {
  const board = APP.activeBoard();
  const bgEl = document.getElementById('board-bg');
  if (!board) return;
  const bg = board.background;
  if (bg.type === 'gradient') bgEl.style.background = bg.value;
  else if (bg.type === 'color') bgEl.style.background = bg.value;
  else if (bg.type === 'image') bgEl.style.cssText = `background:url(${bg.value}) center/cover no-repeat;`;
}

// ══════════════════════════════════════════════════════════════
// RENDER – WIDGETS
// ══════════════════════════════════════════════════════════════
function renderWidgets() {
  stopAllIntervals();
  stopAllAudioStreams();
  const layer = document.getElementById('widgets-layer');
  layer.innerHTML = '';
  const board = APP.activeBoard();
  if (!board) return;
  board.widgets.forEach(w => layer.appendChild(buildWidgetEl(w)));
  // Size layer to encompass all widgets (for mobile scrolling)
  let maxR = 900, maxB = 600;
  board.widgets.forEach(w => {
    maxR = Math.max(maxR, (w.x || 0) + (w.w || 200) + 20);
    maxB = Math.max(maxB, (w.y || 0) + (w.h || 100) + 20);
  });
  layer.style.minWidth = maxR + 'px';
  layer.style.minHeight = maxB + 'px';
  // restart timetable refresh
  board.widgets.filter(w=>w.type==='timetable').forEach(w => startTimetableRefresh(w));
}

function buildWidgetEl(w) {
  const shell = el('div','widget' + (w.id === APP.selectedId ? ' selected' : ''));
  shell.dataset.wid = w.id;
  shell.style.cssText = `left:${w.x}px;top:${w.y}px;width:${w.w}px;height:${w.h}px;z-index:${w.zIndex||1}`;

  // Header (only in edit mode)
  if (APP.state.editMode) {
    const hdr = el('div','widget-header');
    const titleEl = el('span','widget-title');
    titleEl.textContent = REGISTRY[w.type]?.label || w.type;
    const actions = el('div','widget-actions');
    const settBtn = el('button','w-btn'); settBtn.textContent = '⚙'; settBtn.title = 'Einstellungen';
    settBtn.addEventListener('click', e => { e.stopPropagation(); openWidgetSettings(w.id); });
    const delBtn = el('button','w-btn del'); delBtn.textContent = '✕'; delBtn.title = 'Löschen';
    delBtn.addEventListener('click', e => { e.stopPropagation(); removeWidget(w.id); });
    actions.append(settBtn, delBtn);
    hdr.append(titleEl, actions);
    shell.appendChild(hdr);
    // Resize handle
    const rh = el('div','resize-handle');
    shell.appendChild(rh);
    initResize(shell, rh, w);
    initDrag(shell, hdr, w);
  }

  // Body
  const body = el('div','widget-body' + (APP.state.editMode ? ' with-header' : ''));
  renderWidgetContent(w, body);
  shell.appendChild(body);

  // Double-tap / dblclick to edit (works on both desktop and mobile)
  if (APP.state.editMode) {
    const hasOwnEdit = new Set(['text','goal','homework','agenda','checklist']);
    if (!hasOwnEdit.has(w.type)) {
      body.addEventListener('dblclick', e => { e.stopPropagation(); openWidgetSettings(w.id); });
    }
    let lastTap = 0;
    body.addEventListener('touchend', e => {
      const now = Date.now();
      if (now - lastTap < 350) {
        e.preventDefault();
        if (hasOwnEdit.has(w.type)) {
          if (w.type === 'text' || w.type === 'goal') {
            const target = e.target.closest('.w-text-display, .w-goal-text');
            if (target) target.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
          } else {
            openWidgetSettings(w.id);
          }
        } else {
          openWidgetSettings(w.id);
        }
      }
      lastTap = now;
    });
  }

  // Click to select
  shell.addEventListener('pointerdown', e => {
    if (!APP.state.editMode) return;
    APP.selectedId = w.id;
    document.querySelectorAll('.widget').forEach(el => el.classList.remove('selected'));
    shell.classList.add('selected');
    // bring to front
    const board = APP.activeBoard();
    if (board) {
      w.zIndex = nextZ(board);
      shell.style.zIndex = w.zIndex;
      APP.save();
    }
  });

  return shell;
}

// ══════════════════════════════════════════════════════════════
// DRAG & RESIZE (Pointer Events)
// ══════════════════════════════════════════════════════════════
function initDrag(shell, handle, w) {
  let startX, startY, startLeft, startTop;
  handle.addEventListener('pointerdown', e => {
    if (!APP.state.editMode) return;
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    startX = e.clientX; startY = e.clientY;
    startLeft = w.x; startTop = w.y;
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp, {once:true});
  });
  function onMove(e) {
    const dx = e.clientX - startX, dy = e.clientY - startY;
    w.x = Math.max(0, startLeft + dx);
    w.y = Math.max(0, startTop + dy);
    shell.style.left = w.x + 'px';
    shell.style.top  = w.y + 'px';
  }
  function onUp() {
    handle.removeEventListener('pointermove', onMove);
    APP.save();
  }
}

function initResize(shell, handle, w) {
  let startX, startY, startW, startH;
  handle.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation();
    handle.setPointerCapture(e.pointerId);
    startX = e.clientX; startY = e.clientY;
    startW = w.w; startH = w.h;
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp, {once:true});
  });
  function onMove(e) {
    const dx = e.clientX - startX, dy = e.clientY - startY;
    w.w = Math.max(120, startW + dx);
    w.h = Math.max(80, startH + dy);
    shell.style.width  = w.w + 'px';
    shell.style.height = w.h + 'px';
  }
  function onUp() {
    handle.removeEventListener('pointermove', onMove);
    APP.save();
    // re-render content so QR etc. resizes
    const body = shell.querySelector('.widget-body');
    if (body) renderWidgetContent(w, body);
  }
}

// ══════════════════════════════════════════════════════════════
// WIDGET CONTENT RENDERERS
// ══════════════════════════════════════════════════════════════
function renderWidgetContent(w, body) {
  body.innerHTML = '';
  const fn = WIDGET_RENDERERS[w.type];
  if (fn) fn(w, body);
}

