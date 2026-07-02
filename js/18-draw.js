'use strict';
const DRAW = {
  canvas: null, ctx: null,
  active: false,
  tool: 'pen',   // pen | marker | eraser
  color: '#facc15',
  size: 4,
  drawing: false,
  lastX: 0, lastY: 0,
  history: [], // array of ImageData snapshots for undo
  boardDrawings: {}, // { boardId: dataURL } — per-board drawings

  init() {
    this.canvas = document.getElementById('draw-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this._resize();
    window.addEventListener('resize', () => this._resize());

    // ── Pointer events (mouse + touch + stylus) ──
    this.canvas.addEventListener('pointerdown', e => this._start(e));
    this.canvas.addEventListener('pointermove', e => this._move(e));
    this.canvas.addEventListener('pointerup',   e => this._end(e));
    this.canvas.addEventListener('pointerout',  e => this._end(e));
    this.canvas.setPointerCapture; // allow capture

    // ── Toolbar buttons ──
    const btn = id => document.getElementById(id);

    // Toolbar toggle (draw button in main toolbar)
    btn('btn-draw')?.addEventListener('click', () => this.toggle());

    // Tools
    btn('dt-pen')?.addEventListener('click',       () => this._setTool('pen'));
    btn('dt-pen-thick')?.addEventListener('click', () => this._setTool('pen-thick'));
    btn('dt-marker')?.addEventListener('click',    () => this._setTool('marker'));
    btn('dt-brush')?.addEventListener('click',     () => this._setTool('brush'));
    btn('dt-text')?.addEventListener('click',      () => this._setTool('text'));
    btn('dt-eraser')?.addEventListener('click',    () => this._setTool('eraser'));

    // Colors
    document.querySelectorAll('.draw-color-btn').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('.draw-color-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        this.color = b.dataset.color;
        if (this.tool === 'eraser') this._setTool('pen');
      });
    });

    // Custom color picker
    const customColor = document.getElementById('draw-custom-color');
    customColor?.addEventListener('input', () => {
      this.color = customColor.value;
      document.querySelectorAll('.draw-color-btn').forEach(x => x.classList.remove('active'));
      if (this.tool === 'eraser') this._setTool('pen');
    });

    // Size slider
    const slider = document.getElementById('draw-size-slider');
    slider?.addEventListener('input', () => { this.size = +slider.value; });

    // Undo
    btn('dt-undo')?.addEventListener('click', () => this._undo());
    document.addEventListener('keydown', e => {
      if (this.active && (e.ctrlKey||e.metaKey) && e.key==='z') { e.preventDefault(); this._undo(); }
    });

    // Clear
    btn('dt-clear')?.addEventListener('click', () => {
      if (confirm('Zeichnung löschen?')) {
        this.history = [];
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        // Also clear saved data for this board
        delete this.boardDrawings[APP.state.activeBoardId];
      }
    });

    // Exit
    btn('dt-exit')?.addEventListener('click', () => {
      const self = this;
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = '<div class="modal" style="max-width:340px;text-align:center">'
        + '<h2 style="margin-bottom:8px">Zeichnungen beibehalten?</h2>'
        + '<p style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:18px">Der Zeichenmodus wird beendet.</p>'
        + '<div style="display:flex;gap:10px">'
        + '<button id="draw-exit-no" class="btn-secondary" style="flex:1;padding:10px;font-size:14px;font-weight:600">Nein, löschen</button>'
        + '<button id="draw-exit-yes" class="btn-primary" style="flex:1;padding:10px;font-size:14px">Ja, behalten</button>'
        + '</div></div>';
      document.body.appendChild(overlay);
      overlay.querySelector('#draw-exit-yes').addEventListener('click', function() { overlay.remove(); self.toggle(); });
      overlay.querySelector('#draw-exit-no').addEventListener('click', function() {
        self.history = [];
        self.ctx.clearRect(0, 0, self.canvas.width, self.canvas.height);
        delete self.boardDrawings[APP.state.activeBoardId];
        overlay.remove();
        self.toggle();
      });
      overlay.addEventListener('click', function(e) { if (e.target === overlay) { overlay.remove(); self.toggle(); } });
    });

    // ── Text tool: double-click on canvas ──
    this._initTextTool();
  },

  toggle() {
    if (this.active) {
      // Turning OFF — snapshot current board drawing before hiding
      this.saveBoard(APP.state.activeBoardId);
    }
    this.active = !this.active;
    document.body.classList.toggle('draw-mode', this.active);
    const toolbar = document.getElementById('draw-toolbar');
    toolbar?.classList.toggle('visible', this.active);
    const drawBtn = document.getElementById('btn-draw');
    if (drawBtn) {
      drawBtn.classList.toggle('active', this.active);
      drawBtn.style.background = this.active ? 'rgba(251,191,36,0.3)' : '';
      drawBtn.style.color = this.active ? '#fbbf24' : '';
    }
    if (this.active) {
      // Turning ON — restore drawing for this board
      this.loadBoard(APP.state.activeBoardId);
    }
  },

  _setTool(tool) {
    this.tool = tool;
    document.querySelectorAll('#draw-toolbar .draw-tool-btn').forEach(b => b.classList.remove('active'));
    const map = { pen:'dt-pen', 'pen-thick':'dt-pen-thick', marker:'dt-marker', brush:'dt-brush', text:'dt-text', eraser:'dt-eraser' };
    document.getElementById(map[tool])?.classList.add('active');
    this.canvas.style.cursor = tool === 'eraser' ? 'cell' : tool === 'text' ? 'text' : 'crosshair';
  },

  _showTextInput(x, y) {
    // Remove any existing text input
    document.getElementById('draw-text-input')?.remove();

    const fs = Math.max(16, this.size * 3);
    const inp = document.createElement('input');
    inp.id = 'draw-text-input';
    inp.type = 'text';
    inp.placeholder = 'Text eingeben…';
    inp.style.cssText = [
      'position:fixed',
      'z-index:9999',
      'background:rgba(0,0,0,0.85)',
      'color:' + this.color,
      'border:2px solid #facc15',
      'border-radius:8px',
      'padding:6px 12px',
      'font-size:' + fs + 'px',
      'outline:none',
      'backdrop-filter:blur(6px)',
      'min-width:120px',
      'max-width:400px',
      'width:auto',
    ].join(';');

    // Position near click, keep inside viewport
    const vpW = window.innerWidth, vpH = window.innerHeight;
    inp.style.left = Math.min(x, vpW - 180) + 'px';
    inp.style.top  = Math.min(y - fs/2, vpH - 60) + 'px';

    document.body.appendChild(inp);
    requestAnimationFrame(() => { inp.focus(); });

    const self = this;
    const commit = () => {
      const txt = inp.value.trim();
      inp.remove();
      if (!txt) return;
      const px = parseInt(inp.style.left);
      const py = parseInt(inp.style.top) + fs;
      self.history.push(self.ctx.getImageData(0, 0, self.canvas.width, self.canvas.height));
      if (self.history.length > 30) self.history.shift();
      self.ctx.globalCompositeOperation = 'source-over';
      self.ctx.fillStyle = self.color;
      self.ctx.font = `bold ${fs}px sans-serif`;
      self.ctx.shadowBlur = 0;
      self.ctx.fillText(txt, px, py);
      clearTimeout(self._saveTimer);
      self._saveTimer = setTimeout(() => self.saveBoard(APP.state.activeBoardId), 400);
    };

    inp.addEventListener('keydown', ev => {
      ev.stopPropagation();
      if (ev.key === 'Escape') { inp.remove(); return; }
      if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
    });
    inp.addEventListener('blur', () => setTimeout(commit, 120));
  },

  _initTextTool() { /* text handled in _showTextInput, called from _start */ },

  _resize() {
    if (!this.canvas) return;
    const W = window.innerWidth, H = window.innerHeight;
    if (this.canvas.width === W && this.canvas.height === H) return; // no change — don't clear
    const dataURL = this.canvas.width > 0 ? this.canvas.toDataURL() : null;
    this.canvas.width  = W;
    this.canvas.height = H;
    if (dataURL) {
      const img = new Image();
      img.onload = () => this.ctx.drawImage(img, 0, 0);
      img.src = dataURL;
    }
  },

  _getPos(e) {
    return { x: e.clientX, y: e.clientY };
  },

  _start(e) {
    if (!this.active) return;
    if (this.tool === 'text') {
      this._showTextInput(e.clientX, e.clientY);
      return;
    }
    e.preventDefault();
    // Capture pointer so drawing works even outside window
    try { this.canvas.setPointerCapture(e.pointerId); } catch(_) {}

    // Undo snapshot
    this.history.push(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height));
    if (this.history.length > 30) this.history.shift();

    this.drawing = true;
    this._pts = [{ x: e.clientX, y: e.clientY }];
    this._rafPending = false;

    // Draw initial dot
    this._applyStyle();
    const lw = this._lineWidth();
    this.ctx.beginPath();
    this.ctx.arc(e.clientX, e.clientY, lw / 2, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.shadowBlur = 0;
  },

  _move(e) {
    if (!this.active || !this.drawing) return;
    e.preventDefault();

    // Collect all coalesced points for stylus/high-freq input
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of events) {
      this._pts.push({ x: ev.clientX, y: ev.clientY });
    }

    if (!this._rafPending) {
      this._rafPending = true;
      requestAnimationFrame(() => {
        this._rafPending = false;
        this._flushPoints();
      });
    }
  },

  _flushPoints() {
    const pts = this._pts;
    if (pts.length < 2) return;
    this._applyStyle();
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);

    // Quadratic bezier through midpoints — smooth, precise
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i+1].x) / 2;
      const my = (pts[i].y + pts[i+1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    // Last segment to current point
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Keep only the last point as the new start
    this._pts = [last];
  },

  _end(e) {
    if (!this.drawing) return;
    this.drawing = false;
    // Flush remaining points
    if (this._pts && this._pts.length > 1) this._flushPoints();
    try { this.canvas.releasePointerCapture(e.pointerId); } catch(_) {}
    // Debounced save — don't call toDataURL on every stroke end
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.saveBoard(APP.state.activeBoardId), 800);
  },

  _applyStyle() {
    const ctx = this.ctx;
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'source-over';
    if (this.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.fillStyle   = 'rgba(0,0,0,1)';
      ctx.lineWidth   = this.size * 5;
    } else if (this.tool === 'marker') {
      // Highlighter: thick + semi-transparent
      ctx.strokeStyle = this.color + 'aa';
      ctx.fillStyle   = this.color + 'aa';
      ctx.lineWidth   = this.size * 4;
      ctx.lineCap     = 'square';
    } else if (this.tool === 'pen-thick') {
      ctx.strokeStyle = this.color;
      ctx.fillStyle   = this.color;
      ctx.lineWidth   = this.size * 2.5;
    } else if (this.tool === 'brush') {
      ctx.strokeStyle = this.color + 'cc';
      ctx.fillStyle   = this.color + 'cc';
      ctx.lineWidth   = this.size * 3;
      ctx.lineCap     = 'round';
      ctx.shadowColor = this.color;
      ctx.shadowBlur  = this.size * 2;
    } else {
      // pen (default)
      ctx.strokeStyle = this.color;
      ctx.fillStyle   = this.color;
      ctx.lineWidth   = this.size;
      ctx.shadowBlur  = 0;
    }
  },

  _lineWidth() {
    if (this.tool === 'eraser')   return this.size * 5;
    if (this.tool === 'marker')   return this.size * 4;
    if (this.tool === 'pen-thick') return this.size * 2.5;
    if (this.tool === 'brush')    return this.size * 3;
    return this.size;
  },

  _undo() {
    if (this.history.length === 0) return;
    const snap = this.history.pop();
    this.ctx.putImageData(snap, 0, 0);
  },

  // Save drawing of current board before switching
  saveBoard(boardId) {
    if (!this.canvas || !boardId) return;
    this.boardDrawings[boardId] = this.canvas.toDataURL();
  },

  // Load drawing for new board (clear canvas if none)
  loadBoard(boardId) {
    if (!this.canvas || !boardId) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.history = [];
    const dataURL = this.boardDrawings[boardId];
    if (dataURL) {
      const img = new Image();
      img.onload = () => this.ctx.drawImage(img, 0, 0);
      img.src = dataURL;
    }
  }
};



// ══════════════════════════════════════════════════════════════
// FLOATING KI-CHAT (Groq via Netlify Function)
// ══════════════════════════════════════════════════════════════
(function() {
  const fab = document.getElementById('ki-fab');
  const panel = document.getElementById('ki-panel');
  const historyEl = document.getElementById('ki-history');
  const textarea = document.getElementById('ki-textarea');
  const sendBtn = document.getElementById('ki-send');
  if (!fab) return;

  const TEXT_AI_KEY = 'kb_text_ai_count';
  const MAX_FREE_TEXT = 50;
  let sending = false;
  const chatHistory = [];

  // Resize
  const rh = document.getElementById('ki-resize');
  if (rh) {
    let dragging = false, sx, sy, sw, sh;
    rh.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      dragging = true; sx = e.clientX; sy = e.clientY;
      sw = panel.offsetWidth; sh = panel.offsetHeight;
      rh.setPointerCapture(e.pointerId);
    });
    rh.addEventListener('pointermove', e => {
      if (!dragging) return;
      panel.style.width = Math.max(280, Math.min(sw + (e.clientX - sx), window.innerWidth * 0.9)) + 'px';
      panel.style.height = Math.max(280, Math.min(sh + (sy - e.clientY), window.innerHeight * 0.85)) + 'px';
    });
    rh.addEventListener('pointerup', () => dragging = false);
    rh.addEventListener('lostpointercapture', () => dragging = false);
  }

  let isOpen = false;
  fab.addEventListener('click', () => {
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);
    fab.textContent = isOpen ? '✕' : '🤖';
    if (isOpen) textarea.focus();
  });

  function isImageRequest(q) {
    const t = q.trim().toLowerCase();
    return /^(zeig|zeige|mal|male|zeichne|generiere|erstell|bild von|bild:|foto von|zeig mir|zeige mir|show|draw)\b/.test(t) ||
           /(als bild|als foto|als zeichnung|als illustration)\b/.test(t);
  }
  function isDrawRequest(q) {
    return /^(mal|male|zeichne|draw)\b/i.test(q.trim()) || /(als zeichnung|als illustration)\b/i.test(q);
  }
  function extractSubject(q) {
    return q.replace(/^(zeig(e)?(\s*(mir|uns|einen|eine|ein|das|die|den|ne))?|mal(e)?(\s*(mir|uns))?|zeichne|generiere|erstell(e)?|bild von|bild:|foto von|show(\s*me)?|draw)\s*/i, '').trim() || q;
  }

  function addBubble(cls, text) {
    const b = document.createElement('div');
    b.className = 'ki-bubble ' + cls;
    if (cls === 'ai') { b.style.whiteSpace = 'pre-wrap'; b.style.lineHeight = '1.5'; }
    b.textContent = text;
    historyEl.appendChild(b);
    historyEl.scrollTop = historyEl.scrollHeight;
    return b;
  }

  function addImageBubble(subject, isDraw) {
    const b = document.createElement('div');
    b.className = 'ki-bubble ai';
    b.style.padding = '8px 10px';

    if (isDraw) {
      const lbl = document.createElement('div');
      lbl.style.cssText = 'font-size:10px;opacity:0.5;margin-bottom:4px';
      lbl.textContent = '🎨 ' + subject;
      const img = document.createElement('img');
      img.alt = subject;
      img.src = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(subject + ', illustration, colorful, educational') + '?width=600&height=400&nologo=true&seed=' + Math.floor(Math.random()*2e9);
      img.style.cssText = 'max-width:100%;border-radius:7px;display:block';
      img.onerror = function() { this.style.display='none'; };
      b.append(lbl, img);
    } else {
      const googleUrl = 'https://www.google.com/search?q=' + encodeURIComponent(subject) + '&tbm=isch';
      const text = document.createElement('div');
      text.style.cssText = 'font-size:13px;color:rgba(255,255,255,0.85);margin-bottom:10px;line-height:1.5';
      text.textContent = '🖼 Bilder zu: "' + subject + '"';
      const link = document.createElement('a');
      link.href = googleUrl;
      link.target = '_blank';
      link.rel = 'noopener';
      link.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);color:#a5b4fc;font-size:13px;font-weight:600;text-decoration:none;transition:all .15s';
      link.textContent = '🔍 Google Bilder öffnen';
      link.addEventListener('mouseenter', function() { this.style.background='rgba(99,102,241,0.25)'; });
      link.addEventListener('mouseleave', function() { this.style.background='rgba(99,102,241,0.15)'; });
      b.append(text, link);
    }

    historyEl.appendChild(b);
    historyEl.scrollTop = historyEl.scrollHeight;
    return b;
  }

  async function send() {
    if (sending) return;
    const q = textarea.value.trim();
    if (!q) return;
    textarea.value = '';
    textarea.style.height = '38px';
    addBubble('user', q);

    if (isImageRequest(q)) {
      addImageBubble(extractSubject(q), isDrawRequest(q));
      return;
    }

    const count = parseInt(localStorage.getItem(TEXT_AI_KEY) || '0');
    if (!isPro() && count >= MAX_FREE_TEXT) {
      addBubble('ai', '🔒 ' + MAX_FREE_TEXT + ' kostenlose Anfragen verbraucht.\nUpgrade auf Pro für unbegrenzte KI-Nutzung.');
      return;
    }

    sending = true;
    sendBtn.disabled = true;
    sendBtn.style.opacity = '0.4';
    const thinking = addBubble('thinking', '⏳ Denke nach…');

    try {
      let answer;

      if (isPro() && AUTH.client) {
        const { data, error } = await AUTH.client.functions.invoke('ai-generate', {
          body: { type: 'ask', question: q }
        });
        if (error) throw new Error(error.message);
        answer = data?.text;
      } else {
        const controller = new AbortController();
        const timeout = setTimeout(function() { controller.abort(); }, 30000);
        const res = await fetch('/.netlify/functions/ai-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q, history: chatHistory.slice(-6) }),
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (!res.ok) {
          const err = await res.json().catch(function() { return {}; });
          throw new Error(err.error || 'Serverfehler (' + res.status + ')');
        }
        const data = await res.json();
        answer = data.text;
        if (!isPro()) localStorage.setItem(TEXT_AI_KEY, String(count + 1));
      }

      chatHistory.push({ role: 'user', content: q });
      chatHistory.push({ role: 'assistant', content: answer });

      thinking.remove();
      const bubble = addBubble('ai', answer || '(Keine Antwort)');

      if (!isPro()) {
        const left = MAX_FREE_TEXT - count - 1;
        const c = document.createElement('div');
        c.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.2);margin-top:4px';
        c.textContent = left + '/' + MAX_FREE_TEXT + ' Anfragen übrig';
        bubble.appendChild(c);
      }
    } catch (e) {
      thinking.remove();
      const msg = e.name === 'AbortError' ? 'Zeitüberschreitung - bitte nochmal versuchen.' : e.message;
      addBubble('ai', '❌ ' + msg);
    } finally {
      sending = false;
      sendBtn.disabled = false;
      sendBtn.style.opacity = '';
    }
  }

  sendBtn.addEventListener('click', send);
  textarea.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    e.stopPropagation();
  });
  textarea.addEventListener('input', function() {
    textarea.style.height = '38px';
    textarea.style.height = Math.min(textarea.scrollHeight, 90) + 'px';
  });
})();

// ══════════════════════════════════════════════════════════════
// TOOLBAR ANPASSEN
// ══════════════════════════════════════════════════════════════
