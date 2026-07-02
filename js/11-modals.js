'use strict';
function openWidgetMenu() {
  const existing = document.getElementById('widget-menu');
  if (existing) { existing.remove(); return; }
  const menu = el('div'); menu.id = 'widget-menu';

  WIDGET_CATS.forEach(cat => {
    const label = el('div','wm-cat'); label.textContent = cat.label;
    menu.appendChild(label);
    const grid = el('div','wm-grid');
    cat.types.forEach(type => {
      const def = REGISTRY[type];
      const btn = el('button','wm-item');
      const icon = el('span','wm-emoji'); icon.textContent = def.emoji;
      const lbl = el('span','wm-label'); lbl.textContent = def.label;
      btn.append(icon, lbl);
      btn.addEventListener('click', () => { addWidget(type); menu.remove(); });
      grid.appendChild(btn);
    });
    menu.appendChild(grid);
  });

  // position near button
  const btnRect = document.getElementById('btn-add-widget').getBoundingClientRect();
  menu.style.cssText = `top:${btnRect.bottom+6}px;right:${window.innerWidth-btnRect.right}px`;
  document.body.appendChild(menu);

  setTimeout(() => {
    document.addEventListener('pointerdown', function closeMenu(e) {
      if (!menu.contains(e.target) && e.target.id !== 'btn-add-widget' && !e.target.closest('#btn-add-widget')) {
        menu.remove(); document.removeEventListener('pointerdown', closeMenu);
      }
    });
  }, 0);
}

function openTemplateModal() {
  const { overlay, close } = openModal(`
    <div class="modal modal-lg">
      <button class="modal-close" data-close>✕</button>
      <h2>📋 Vorlage laden</h2>
      <p style="font-size:13px;color:rgba(255,255,255,0.4);margin-bottom:16px">Wähle eine Vorlage. Die aktuelle Tafel wird ersetzt.</p>
      <div class="template-grid" id="tpl-grid"></div>
    </div>
  `);
  const grid = overlay.querySelector('#tpl-grid');
  BUILT_IN_TEMPLATES.forEach(tpl => {
    const card = el('div','tpl-card');
    const emoji = el('div','tpl-emoji'); emoji.textContent = tpl.emoji;
    const name = el('div','tpl-name'); name.textContent = tpl.name;
    const desc = el('div','tpl-desc'); desc.textContent = tpl.desc;
    card.append(emoji, name, desc);
    card.addEventListener('click', () => {
      APP.snapshotUndo();
      const board = APP.activeBoard();
      if (board) {
        board.background = tpl.bg;
        board.widgets = tpl.widgets.map(w => ({...w, id:uid(), createdAt:new Date().toISOString()}));
      }
      APP.save();
      renderAll();
      close();
      toast('✅ Vorlage "' + tpl.name + '" geladen');
    });
    grid.appendChild(card);
  });
}

function openBgModal() {
  const PRESETS = [
    {label:'Indigo',    v:'linear-gradient(135deg,#667eea,#764ba2)'},
    {label:'Ozean',     v:'linear-gradient(135deg,#0093E9,#80D0C7)'},
    {label:'Sonnenuntergang', v:'linear-gradient(135deg,#f093fb,#f5576c)'},
    {label:'Wald',      v:'linear-gradient(135deg,#43e97b,#38f9d7)'},
    {label:'Mitternacht', v:'linear-gradient(135deg,#0f0c29,#302b63,#24243e)'},
    {label:'Schiefer',  v:'#1e293b'},
    {label:'Dunkelblau', v:'#1a1a2e'},
    {label:'Nacht',     v:'#0f172a'},
  ];
  const board = APP.activeBoard();
  const { overlay, close } = openModal(`
    <div class="modal">
      <button class="modal-close" data-close>✕</button>
      <h2>🎨 Hintergrund</h2>
      <div class="bg-grid" id="bg-grid"></div>
      <div class="form-group" style="margin-top:8px">
        <label>Eigene Farbe</label>
        <div style="display:flex;gap:8px;align-items:center">
          <input type="color" id="bg-color" value="#1e293b" style="width:48px;height:36px;padding:2px;border-radius:8px;cursor:pointer;border:1px solid rgba(255,255,255,0.2);background:transparent">
          <button class="btn-secondary" id="bg-apply-color">Anwenden</button>
        </div>
      </div>
      <div class="form-group">
        <label>Bild-URL</label>
        <div style="display:flex;gap:8px">
          <input type="url" id="bg-img-url" placeholder="https://…" style="flex:1">
          <button class="btn-secondary" id="bg-apply-img">Anwenden</button>
        </div>
      </div>
    </div>
  `);
  const grid = overlay.querySelector('#bg-grid');
  PRESETS.forEach(p => {
    const sw = el('div','bg-swatch'); sw.title=p.label; sw.style.background=p.v;
    sw.addEventListener('click', () => {
      if (board) { board.background={type: p.v.startsWith('linear') ? 'gradient':'color', value:p.v}; APP.save(); renderBoardBg(); }
      close();
    });
    grid.appendChild(sw);
  });
  overlay.querySelector('#bg-apply-color').addEventListener('click', () => {
    const v = overlay.querySelector('#bg-color').value;
    if (board) { board.background={type:'color',value:v}; APP.save(); renderBoardBg(); }
    close();
  });
  overlay.querySelector('#bg-apply-img').addEventListener('click', () => {
    const v = overlay.querySelector('#bg-img-url').value.trim();
    if (!v) return;
    if (board) { board.background={type:'image',value:v}; APP.save(); renderBoardBg(); }
    close();
  });
}

function openExportModal() {
  const { overlay, close } = openModal(`
    <div class="modal">
      <button class="modal-close" data-close>✕</button>
      <h2>💾 Export / Import / Datenschutz</h2>
      <div style="display:flex;flex-direction:column;gap:10px">
        <button class="btn-primary" id="exp-export">⬇ Alle Tafeln exportieren (.json)</button>
        <div class="form-group" style="margin:0">
          <label>Import (JSON-Datei)</label>
          <input type="file" id="exp-file" accept=".json" style="color:#fff">
        </div>
        <button class="btn-secondary" id="exp-import">⬆ Importieren</button>
        <hr style="border-color:rgba(255,255,255,0.1);margin:4px 0">
        <button class="btn-secondary" id="exp-delete" style="color:#f87171;border-color:rgba(239,68,68,0.3)">🗑 Alle Daten löschen</button>
      </div>
    </div>
  `);
  overlay.querySelector('#exp-export').addEventListener('click', () => { APP.exportAll(); close(); });
  overlay.querySelector('#exp-import').addEventListener('click', () => {
    const file = overlay.querySelector('#exp-file').files[0];
    if (!file) { toast('Bitte Datei auswählen'); return; }
    const reader = new FileReader();
    reader.onload = e => { APP.importAll(e.target.result); close(); };
    reader.readAsText(file);
  });
  overlay.querySelector('#exp-delete').addEventListener('click', () => {
    if (confirm('Alle Tafeln und Daten wirklich löschen?')) { APP.deleteAllData(); close(); toast('🗑 Alle Daten gelöscht'); }
  });
}

// ══════════════════════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ══════════════════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'f' || e.key === 'F') toggleFullscreen();
  if (e.key === 'e' || e.key === 'E') toggleEditMode();
  if (e.key === 'w' || e.key === 'W') openWidgetMenu();
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); APP.undo(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); APP._persist(); toast('💾 Gespeichert'); }
  if ((e.key === 'Delete' || e.key === 'Backspace') && APP.selectedId && e.target === document.body) {
    removeWidget(APP.selectedId);
  }
  if (e.key === 'Escape') {
    // Remove all overlays / modals
    document.querySelectorAll('.modal-overlay').forEach(m=>m.remove());
    document.getElementById('widget-menu')?.remove();
    document.getElementById('rename-modal-overlay')?.remove();
    document.getElementById('tb-customize-panel')?.remove();
    // Close dropdowns
    document.getElementById('class-dropdown')?.classList.remove('open');
    // Exit draw mode if active
    if (DRAW.active) DRAW.toggle();
    // Clear selection
    APP.selectedId = null;
    document.querySelectorAll('.widget').forEach(w=>w.classList.remove('selected'));
    // Close KI panel if open
    document.getElementById('ki-panel')?.classList.remove('open');
  }
});

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
    document.body.classList.add('fullscreen');
    document.getElementById('btn-fullscreen').textContent = '⤡';
  } else {
    document.exitFullscreen?.();
    document.body.classList.remove('fullscreen');
    document.getElementById('btn-fullscreen').textContent = '⤢';
  }
}

// Listen for ESC key exiting fullscreen (browser-native)
document.addEventListener('fullscreenchange', () => {
  const fs = !!document.fullscreenElement;
  document.body.classList.toggle('fullscreen', fs);
  const btn = document.getElementById('btn-fullscreen');
  if (btn) btn.textContent = fs ? '⤡' : '⤢';
});

function toggleEditMode() {
  APP.state.editMode = !APP.state.editMode;
  const btn = document.getElementById('edit-mode-btn');
  btn.textContent = APP.state.editMode ? '✏️ Edit' : '👁 Ansicht';
  btn.classList.toggle('active', APP.state.editMode);
  APP.selectedId = null;
  renderWidgets();
}

// ══════════════════════════════════════════════════════════════
// AUTH UI
// ══════════════════════════════════════════════════════════════
