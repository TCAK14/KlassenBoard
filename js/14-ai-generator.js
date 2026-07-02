'use strict';
function openAiBoardGenerator() {
  if (!AUTH.user) {
    toast('⚠️ Bitte zuerst anmelden um den KI-Board-Generator zu nutzen');
    return;
  }

  const { overlay, close } = openModal(`
    <div class="modal ai-board-modal">
      <button class="modal-close" data-close>✕</button>
      <h2>🪄 KI-Board-Generator</h2>
      <p class="subtitle">Beschreibe deine Stunde — die KI erstellt automatisch ein passendes Board.</p>
      <div class="form-group">
        <label>Thema / Unterrichtsinhalt</label>
        <input type="text" id="abg-topic" placeholder="z.B. Photosynthese, Bruchrechnen, Französische Revolution…">
      </div>
      <div class="ai-board-row">
        <div class="form-group">
          <label>Klasse</label>
          <select id="abg-grade">
            ${['1','2','3','4','5','6','7','8','9','10','11','12','13'].map(g=>`<option value="${g}"${g==='7'?' selected':''}>Klasse ${g}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Dauer</label>
          <select id="abg-duration">
            <option value="45" selected>45 Min</option>
            <option value="50">50 Min</option>
            <option value="60">60 Min</option>
            <option value="90">90 Min</option>
            <option value="30">30 Min</option>
          </select>
        </div>
        <div class="form-group">
          <label>Unterrichtsart</label>
          <select id="abg-type">
            <option value="Einführung">Einführung</option>
            <option value="Übung" selected>Übung</option>
            <option value="Wiederholung">Wiederholung</option>
            <option value="Test/Prüfung">Test/Prüfung</option>
            <option value="Projekt">Projekt</option>
            <option value="Diskussion">Diskussion</option>
          </select>
        </div>
      </div>
      <button class="ai-board-gen-btn" id="abg-btn">🪄 Board generieren</button>
      <div class="ai-board-progress" id="abg-progress">⏳ KI plant deine Stunde…</div>
    </div>
  `);

  overlay.querySelector('#abg-topic').focus();

  overlay.querySelector('#abg-btn').addEventListener('click', async () => {
    const topic    = overlay.querySelector('#abg-topic').value.trim();
    const grade    = overlay.querySelector('#abg-grade').value;
    const duration = overlay.querySelector('#abg-duration').value;
    const lessonType = overlay.querySelector('#abg-type').value;

    if (!topic) { toast('⚠️ Bitte ein Thema eingeben'); overlay.querySelector('#abg-topic').focus(); return; }

    const btn = overlay.querySelector('#abg-btn');
    const progress = overlay.querySelector('#abg-progress');
    btn.disabled = true;
    btn.textContent = '⏳ Generiere…';
    progress.classList.add('visible');
    progress.textContent = '⏳ KI plant deine Stunde…';

    try {
      const { data, error } = await AUTH.client.functions.invoke('ai-generate', {
        body: { type: 'board-generate', topic, grade, duration, lessonType }
      });
      if (error) throw new Error(error.message || String(error));

      let parsed;
      try {
        // data.text contains the JSON string
        const raw = typeof data.text === 'string' ? data.text : JSON.stringify(data.text);
        // extract JSON from response (AI might add preamble)
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('Kein JSON gefunden');
        parsed = JSON.parse(match[0]);
      } catch(e) {
        throw new Error('KI-Antwort konnte nicht verarbeitet werden: ' + e.message);
      }

      progress.textContent = '✅ Board wird erstellt…';

      // Create new board
      const boardName = parsed.boardName || `${topic} – Klasse ${grade}`;
      createBoard(boardName);
      const board = APP.activeBoard();

      // Use gradient background (no AI image)
      board.background = { type: 'gradient', value: 'linear-gradient(135deg,#667eea,#764ba2)' };
      progress.textContent = '🎨 KI generiert Hintergrundbild… (kann 15–30 Sek. dauern)';

      // ── Smart layout: clock top-right, title top-center, rest in flow ──
      const widgets = (parsed.widgets || []).filter(d => REGISTRY[d.type]);
      const margin = 12, gap = 12, startY = 72;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Separate special widgets
      const clockDef   = widgets.find(d => d.type === 'clock');
      const goalDef    = widgets.find(d => d.type === 'goal');
      const rest       = widgets.filter(d => d.type !== 'clock' && d.type !== 'goal');

      let zIdx = 1;
      function placeWidget(def, x, y, wOverride, hOverride) {
        const reg = REGISTRY[def.type];
        const ww = wOverride || reg.w, hh = hOverride || reg.h;
        board.widgets.push({
          id: uid(), type: def.type,
          x: Math.round(x), y: Math.round(y),
          w: ww, h: hh,
          config: def.config || {},
          zIndex: zIdx++, locked: false,
          createdAt: new Date().toISOString(),
        });
      }

      // Clock: top-right
      const clockW = 220, clockH = 100;
      if (clockDef) placeWidget(clockDef, vw - clockW - margin, startY, clockW, clockH);

      // Goal: top-center, prominent
      const goalW = Math.min(560, vw - clockW - margin * 3), goalH = 90;
      if (goalDef) placeWidget(goalDef, margin, startY, goalW, goalH);

      // Rest: flow layout below
      const flowStartY = startY + (goalDef ? goalH + gap : 0);
      let cx = margin, cy = flowStartY, rowH = 0;
      rest.forEach(def => {
        const reg = REGISTRY[def.type];
        const ww = reg.w, hh = reg.h;
        if (cx + ww + margin > vw - (clockDef ? clockW + margin : 0) && cx > margin) {
          cx = margin; cy += rowH + gap; rowH = 0;
        }
        placeWidget(def, cx, cy, ww, hh);
        cx += ww + gap;
        rowH = Math.max(rowH, hh);
      });

      APP._persist();
      renderAll();
      toast(`🪄 Board "${boardName}" mit ${widgets.length} Widgets erstellt!`);
      close();

    } catch(err) {
      progress.textContent = '❌ Fehler: ' + err.message;
      progress.style.background = 'rgba(239,68,68,0.1)';
      progress.style.borderColor = 'rgba(239,68,68,0.3)';
      progress.style.color = '#fca5a5';
      btn.disabled = false;
      btn.textContent = '🪄 Nochmal versuchen';
    }
  });
}

// ══════════════════════════════════════════════════════════════
// TOOLBAR WIRING
// ══════════════════════════════════════════════════════════════
document.getElementById('btn-voice').addEventListener('click', () => VOICE.toggle());

document.getElementById('btn-add-widget').addEventListener('click', openWidgetMenu);
document.getElementById('btn-template').addEventListener('click', openTemplateModal);
document.getElementById('btn-bg').addEventListener('click', openBgModal);
document.getElementById('btn-ical').addEventListener('click', () => {
  const board = APP.activeBoard();
  const w = board?.widgets.find(w=>w.type==='timetable');
  if (w) openTimetableSettings(w);
  else { toast('Füge zuerst ein Stundenplan-Widget hinzu'); }
});
document.getElementById('btn-export').addEventListener('click', openExportModal);
document.getElementById('add-board-btn').addEventListener('click', () => {
  createBoard('Tafel ' + (APP.state.boards.length + 1));
  toast('✅ Neue Tafel erstellt');
});
document.getElementById('edit-mode-btn').addEventListener('click', toggleEditMode);
document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
document.getElementById('btn-customize-toolbar').addEventListener('click', e => { e.stopPropagation(); openToolbarCustomizer(); });
document.getElementById('auth-login-btn').addEventListener('click', openLoginModal);
document.getElementById('auth-logout-btn').addEventListener('click', () => AUTH.logout());

// Deselect on board click
document.getElementById('board').addEventListener('pointerdown', e => {
  if (e.target === document.getElementById('board') || e.target === document.getElementById('board-bg') || e.target === document.getElementById('widgets-layer')) {
    APP.selectedId = null;
    document.querySelectorAll('.widget').forEach(w=>w.classList.remove('selected'));
  }
});

// Doppelklick auf leere Fläche → Schnell-Text eingeben (im Nicht-Zeichen-Modus)
document.getElementById('board').addEventListener('dblclick', e => {
  if (DRAW.active) return; // Zeichenmodus hat eigenen Handler
  if (!APP.state.editMode) return; // nur im Edit-Modus
  const tgt = e.target;
  const boardEl = document.getElementById('board');
  const bgEl    = document.getElementById('board-bg');
  const wlEl    = document.getElementById('widgets-layer');
  if (tgt !== boardEl && tgt !== bgEl && tgt !== wlEl) return;
  // Quick text input overlay
  const ta = document.createElement('textarea');
  ta.placeholder = 'Text eingeben…';
  ta.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;z-index:9998;
    background:rgba(20,20,40,0.92);color:#fff;border:2px solid rgba(129,140,248,0.6);
    border-radius:10px;padding:10px 14px;font-size:16px;resize:none;min-width:180px;
    min-height:44px;outline:none;backdrop-filter:blur(8px);box-shadow:0 8px 32px rgba(0,0,0,0.4);`;
  document.body.appendChild(ta);
  ta.focus();
  const commit = () => {
    const txt = ta.value.trim();
    ta.remove();
    if (!txt) return;
    APP.snapshotUndo();
    const board = APP.state.boards.find(b => b.id === APP.state.activeBoardId);
    if (!board) return;
    const def = REGISTRY.text;
    board.widgets.push({
      id: 'w_' + Date.now(),
      type: 'text',
      x: e.clientX - 160, y: e.clientY - 20,
      w: def.w, h: def.h,
      config: { text: txt, fontSize: 18, bold: false, align: 'left' }
    });
    APP.save(); renderWidgets();
  };
  ta.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') { ta.remove(); return; }
    if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); commit(); }
  });
  ta.addEventListener('blur', () => setTimeout(commit, 150));
});

// ══════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════
