'use strict';
const VOICE = {
  recognition: null,
  active: false,
  toastEl: null,

  init() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return false;
    this.recognition = new SR();
    this.recognition.lang = 'de-DE';
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.onresult = (e) => this.handleResult(e);
    this.recognition.onend = () => this.setInactive();
    this.recognition.onerror = (e) => {
      if (e.error !== 'no-speech') toast('🎙️ Fehler: ' + e.error);
      this.setInactive();
    };
    return true;
  },

  toggle() {
    if (!this.recognition && !this.init()) {
      toast('❌ Spracherkennung wird von diesem Browser nicht unterstützt. Bitte Chrome verwenden.');
      return;
    }
    if (this.active) { this.recognition.stop(); return; }
    try { this.recognition.start(); this.setActive(); }
    catch(e) { toast('🎙️ Mikrofon-Fehler: ' + e.message); }
  },

  setActive() {
    this.active = true;
    const btn = document.getElementById('btn-voice');
    btn.classList.add('listening');
    // show listening toast
    if (!this.toastEl) {
      this.toastEl = document.createElement('div');
      this.toastEl.className = 'voice-toast';
      document.body.appendChild(this.toastEl);
    }
    this.toastEl.innerHTML = '🎙️ Höre zu… <span style="color:rgba(255,255,255,0.4);font-size:11px">Sag z.B. "Öffne Stoppuhr" oder "Timer 5 Minuten"</span>';
    this.toastEl.style.display = 'flex';
  },

  setInactive() {
    this.active = false;
    const btn = document.getElementById('btn-voice');
    if (btn) btn.classList.remove('listening');
    if (this.toastEl) this.toastEl.style.display = 'none';
  },

  async handleResult(e) {
    const transcript = e.results[0][0].transcript.trim();
    this.setInactive();
    if (!transcript) return;

    // Show what was heard
    if (this.toastEl) {
      this.toastEl.innerHTML = `🎙️ "<span class="voice-transcript">${safeText(transcript)}</span>" — wird verarbeitet…`;
      this.toastEl.style.display = 'flex';
      setTimeout(() => { if (this.toastEl) this.toastEl.style.display = 'none'; }, 4000);
    }

    if (!AUTH.user || !AUTH.client) {
      toast('⚠️ Bitte anmelden für Sprachsteuerung');
      return;
    }

    try {
      const { data, error } = await AUTH.client.functions.invoke('ai-generate', {
        body: { type: 'voice-command', transcript }
      });
      if (error) throw new Error(error.message || String(error));
      const raw = typeof data?.text === 'string' ? data.text : JSON.stringify(data?.text || '{}');
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Kein Befehl erkannt');
      const action = JSON.parse(match[0]);
      this.executeAction(action, transcript);
    } catch(err) {
      toast('❌ Befehl nicht verstanden: ' + err.message);
    }
  },

  executeAction(action, transcript) {
    const board = APP.activeBoard();
    if (!board) return;
    const act = action.action;

    if (act === 'add-widget' || act === 'add-and-configure') {
      const type = action.widgetType;
      if (!REGISTRY[type]) { toast('❌ Widget "' + type + '" nicht gefunden'); return; }
      const widget = addWidget(type, action.config || {});
      if (action.config && widget) {
        Object.assign(widget.config, action.config);
        APP.save(); renderWidgets();
      }
      toast('✅ ' + REGISTRY[type].emoji + ' ' + REGISTRY[type].label + ' hinzugefügt');

    } else if (act === 'configure-widget') {
      const type = action.widgetType;
      let w = board.widgets.slice().reverse().find(w => w.type === type);
      if (!w) { toast('⚠️ Kein ' + (REGISTRY[type]?.label || type) + '-Widget gefunden — wird hinzugefügt'); addWidget(type, action.config || {}); return; }
      Object.assign(w.config, action.config || {});
      APP.save(); renderWidgets();
      toast('✅ ' + (REGISTRY[type]?.label || type) + ' aktualisiert');

    } else if (act === 'new-board') {
      createBoard(action.name || 'Neue Tafel');
      toast('✅ Neue Tafel: ' + (action.name || 'Neue Tafel'));

    } else if (act === 'ai-board') {
      openAiBoardGenerator();

    } else {
      toast('❓ Befehl nicht erkannt: "' + transcript + '"');
    }
  }
};

// ══════════════════════════════════════════════════════════════
// AUTO-BOARD GENERATOR
// ══════════════════════════════════════════════════════════════
