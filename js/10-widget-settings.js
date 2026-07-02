'use strict';
function openWidgetSettings(wid) {
  const board = APP.activeBoard();
  const w = board?.widgets.find(w=>w.id===wid);
  if (!w) return;

  const settingsFns = {
    timer:   openTimerSettings,
    text:    openTextEdit,
    qr:      openQrSettings,
    names:   openNamesEdit,
    homework:openHomeworkEdit,
    goal:    openGoalEdit,
    timetable:openTimetableSettings,
    image:   openImageSettings,
    youtube: openYoutubeSettings,
    noise:   openNoiseSettings,
    poll:    openPollSettings,
    randomnum:openRandNumSettings,
    groups:  openGroupsSettings,
    agenda:  openAgendaEdit,
    checklist:openChecklistEdit,
    phases:  openPhasesEdit,
  };

  const fn = settingsFns[w.type];
  if (fn) fn(w);
  else toast('Keine Einstellungen für dieses Widget');
}

function openPollSettings(w) {
  const opts = w.config.options?.length ? w.config.options : ['','','',''];
  const { overlay, close } = openModal(`
    <div class="modal">
      <button class="modal-close" data-close>✕</button>
      <h2>📊 Live-Umfrage</h2>
      <div class="form-group">
        <label>Frage</label>
        <input type="text" id="ps-q" placeholder="z.B. Was soll zuerst besprochen werden?" value="${safeText(w.config.question||'')}">
      </div>
      <div class="form-group">
        <label>Antwortmöglichkeiten (min. 2, max. 4)</label>
        ${opts.slice(0,4).map((o,i)=>`<input type="text" id="ps-o${i}" placeholder="Option ${i+1}" value="${safeText(o)}" style="margin-bottom:8px;">`).join('')}
      </div>
      <p style="font-size:11px;color:rgba(255,255,255,0.3);margin-bottom:14px;">Schüler scannen den QR-Code und stimmen auf ihrem Gerät ab. Ergebnisse erscheinen live.</p>
      <button class="btn-primary" id="ps-save">▶ Umfrage starten</button>
    </div>
  `);
  overlay.querySelector('#ps-save').addEventListener('click', async () => {
    const question = overlay.querySelector('#ps-q').value.trim();
    const options = [0,1,2,3].map(i=>(overlay.querySelector('#ps-o'+i)?.value||'').trim()).filter(o=>o);
    if (!question) { toast('Bitte Frage eingeben'); return; }
    if (options.length < 2) { toast('Bitte mindestens 2 Optionen'); return; }

    // Prüfen ob Supabase verfügbar
    if (!AUTH.client) {
      toast('⚠️ Bitte zuerst anmelden (🔑 Anmelden oben rechts) um Umfragen zu nutzen');
      return;
    }
    if (!AUTH.user) {
      toast('⚠️ Bitte zuerst anmelden (🔑 Anmelden oben rechts)');
      return;
    }

    const btn = overlay.querySelector('#ps-save');
    btn.textContent = '…'; btn.disabled = true;

    const pollId = w.config.pollId || uid();
    w.config.question     = question;
    w.config.options      = options;
    w.config.pollId       = pollId;
    w.config.showResults  = false; // standardmäßig versteckt

    const { error } = await AUTH.client.from('polls').upsert({
      id: pollId, user_id: AUTH.user.id, question, options, active: true
    });

    if (error) {
      toast('❌ Fehler: ' + error.message);
      btn.textContent = '▶ Umfrage starten'; btn.disabled = false;
      return;
    }

    APP.save();
    const shell = document.querySelector('[data-wid="'+w.id+'"]');
    if (shell) renderWidgetContent(w, shell.querySelector('.widget-body'));
    close();
    toast('✅ Umfrage gestartet!');
  });
}

function openNoiseSettings(w) {
  const cfg = w.config;
  const sens    = cfg.sensitivity    ?? 3;
  const lowThr  = cfg.lowThreshold   ?? 25;
  const highThr = cfg.highThreshold  ?? 55;

  const { overlay, close } = openModal(`
    <div class="modal">
      <button class="modal-close" data-close>✕</button>
      <h2>🎤 Lautstärke-Einstellungen</h2>
      <div class="form-group">
        <label>Empfindlichkeit des Mikrofons</label>
        <div style="display:flex;align-items:center;gap:12px;margin-top:6px;">
          <span style="font-size:12px;color:rgba(255,255,255,0.4);">Niedrig</span>
          <input type="range" id="ns-sens" min="1" max="5" step="0.5" value="${sens}" style="flex:1">
          <span style="font-size:12px;color:rgba(255,255,255,0.4);">Hoch</span>
        </div>
        <div style="text-align:center;font-size:12px;color:#a5b4fc;margin-top:4px;" id="ns-sens-val">${sens}x</div>
      </div>
      <div class="form-group">
        <label>Grenze Leise → Mittel (%)</label>
        <input type="range" id="ns-low" min="5" max="50" value="${lowThr}">
        <div style="text-align:center;font-size:12px;color:#4ade80;margin-top:2px;" id="ns-low-val">${lowThr}%</div>
      </div>
      <div class="form-group">
        <label>Grenze Mittel → Laut (%)</label>
        <input type="range" id="ns-high" min="20" max="90" value="${highThr}">
        <div style="text-align:center;font-size:12px;color:#f87171;margin-top:2px;" id="ns-high-val">${highThr}%</div>
      </div>
      <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-bottom:12px;">
        💡 Tipp: Bei ruhiger Klasse Empfindlichkeit erhöhen. Bei lautem Umfeld reduzieren.
      </div>
      <button class="btn-primary" id="ns-save">Speichern</button>
    </div>
  `);

  const sensInput = overlay.querySelector('#ns-sens');
  const lowInput  = overlay.querySelector('#ns-low');
  const highInput = overlay.querySelector('#ns-high');
  sensInput.addEventListener('input', () => { overlay.querySelector('#ns-sens-val').textContent = sensInput.value + 'x'; });
  lowInput.addEventListener('input',  () => { overlay.querySelector('#ns-low-val').textContent  = lowInput.value  + '%'; });
  highInput.addEventListener('input', () => { overlay.querySelector('#ns-high-val').textContent = highInput.value + '%'; });

  overlay.querySelector('#ns-save').addEventListener('click', () => {
    cfg.sensitivity   = parseFloat(sensInput.value);
    cfg.lowThreshold  = parseInt(lowInput.value);
    cfg.highThreshold = parseInt(highInput.value);
    APP.save();
    // Widget neu rendern damit Einstellungen sofort wirken
    const shell = document.querySelector('[data-wid="'+w.id+'"]');
    if (shell) { const body = shell.querySelector('.widget-body'); renderWidgetContent(w, body); }
    close();
    toast('✅ Einstellungen gespeichert');
  });
}

function openTextEdit(w) {
  const { overlay, close } = openModal(`
    <div class="modal">
      <button class="modal-close" data-close>✕</button>
      <h2>📝 Text bearbeiten</h2>
      <div class="form-group">
        <label>Text (Markdown nicht unterstützt)</label>
        <textarea id="te-text" rows="5" style="resize:vertical">${safeText(w.config.text||'')}</textarea>
      </div>
      <div class="form-group">
        <label>Schriftgröße (px)</label>
        <input type="number" id="te-size" value="${w.config.fontSize||16}" min="10" max="80">
      </div>
      <button class="btn-primary" id="te-save">Speichern</button>
    </div>
  `);
  overlay.querySelector('#te-save').addEventListener('click', () => {
    w.config.text = overlay.querySelector('#te-text').value;
    w.config.fontSize = parseInt(overlay.querySelector('#te-size').value)||16;
    APP.save();
    const shell = document.querySelector('[data-wid="'+w.id+'"]');
    if (shell) renderWidgetContent(w, shell.querySelector('.widget-body'));
    close();
  });
}

function openTimerSettings(w) {
  const { overlay, close } = openModal(`
    <div class="modal">
      <button class="modal-close" data-close>✕</button>
      <h2>⏱ Timer einstellen</h2>
      <div class="form-group">
        <label>Minuten</label>
        <input type="number" id="ts-min" value="${w.config.minutes||5}" min="0" max="180">
      </div>
      <div class="form-group">
        <label>Sekunden</label>
        <input type="number" id="ts-sec" value="${w.config.seconds||0}" min="0" max="59">
      </div>
      <button class="btn-primary" id="ts-save">Speichern & Zurücksetzen</button>
    </div>
  `);
  overlay.querySelector('#ts-save').addEventListener('click', () => {
    w.config.minutes = parseInt(overlay.querySelector('#ts-min').value)||0;
    w.config.seconds = parseInt(overlay.querySelector('#ts-sec').value)||0;
    APP.save();
    const shell = document.querySelector('[data-wid="'+w.id+'"]');
    if (shell) renderWidgetContent(w, shell.querySelector('.widget-body'));
    close();
  });
}

function openQrSettings(w) {
  const { overlay, close } = openModal(`
    <div class="modal">
      <button class="modal-close" data-close>✕</button>
      <h2>📱 QR-Code</h2>
      <div class="form-group">
        <label>URL oder Text</label>
        <input type="url" id="qr-url" value="${safeText(w.config.url||'')}" placeholder="https://…">
      </div>
      <div class="form-group">
        <label>Beschriftung (optional)</label>
        <input type="text" id="qr-label" value="${safeText(w.config.label||'')}">
      </div>
      <button class="btn-primary" id="qr-save">QR generieren</button>
    </div>
  `);
  overlay.querySelector('#qr-save').addEventListener('click', () => {
    w.config.url = overlay.querySelector('#qr-url').value.trim();
    w.config.label = overlay.querySelector('#qr-label').value.trim();
    APP.save();
    const shell = document.querySelector('[data-wid="'+w.id+'"]');
    if (shell) renderWidgetContent(w, shell.querySelector('.widget-body'));
    close();
  });
}

function openNamesEdit(w) {
  const { overlay, close } = openModal(`
    <div class="modal">
      <button class="modal-close" data-close>✕</button>
      <h2>🎯 Namen bearbeiten</h2>
      <div class="form-group">
        <label>Namen (je eine pro Zeile)</label>
        <textarea id="nm-names" rows="8" style="resize:vertical">${safeText(w.config.names||'')}</textarea>
      </div>
      <button class="btn-primary" id="nm-save">Speichern</button>
    </div>
  `);
  overlay.querySelector('#nm-save').addEventListener('click', () => {
    w.config.names = overlay.querySelector('#nm-names').value;
    w.config.highlighted = -1;
    APP.save();
    const shell = document.querySelector('[data-wid="'+w.id+'"]');
    if (shell) renderWidgetContent(w, shell.querySelector('.widget-body'));
    close();
  });
}

function openHomeworkEdit(w) {
  const items = (w.config.items||[]).join('\n');
  const { overlay, close } = openModal(`
    <div class="modal">
      <button class="modal-close" data-close>✕</button>
      <h2>📚 Hausaufgaben</h2>
      <div class="form-group">
        <label>Fach / Titel</label>
        <input type="text" id="hw-subject" value="${safeText(w.config.subject||'')}">
      </div>
      <div class="form-group">
        <label>Aufgaben (je eine pro Zeile)</label>
        <textarea id="hw-items" rows="6" style="resize:vertical">${safeText(items)}</textarea>
      </div>
      <button class="btn-primary" id="hw-save">Speichern</button>
    </div>
  `);
  overlay.querySelector('#hw-save').addEventListener('click', () => {
    w.config.subject = overlay.querySelector('#hw-subject').value.trim();
    w.config.items = overlay.querySelector('#hw-items').value.split('\n').map(s=>s.trim()).filter(Boolean);
    APP.save();
    const shell = document.querySelector('[data-wid="'+w.id+'"]');
    if (shell) renderWidgetContent(w, shell.querySelector('.widget-body'));
    close();
  });
}

function openGoalEdit(w) {
  const { overlay, close } = openModal(`
    <div class="modal">
      <button class="modal-close" data-close>✕</button>
      <h2>🎯 Stundenziel</h2>
      <div class="form-group">
        <label>Ziel</label>
        <textarea id="goal-text" rows="3">${safeText(w.config.text||'')}</textarea>
      </div>
      <button class="btn-primary" id="goal-save">Speichern</button>
    </div>
  `);
  overlay.querySelector('#goal-save').addEventListener('click', () => {
    w.config.text = overlay.querySelector('#goal-text').value;
    APP.save();
    const shell = document.querySelector('[data-wid="'+w.id+'"]');
    if (shell) renderWidgetContent(w, shell.querySelector('.widget-body'));
    close();
  });
}

function openTimetableSettings(w) {
  const board = APP.activeBoard();
  const cache = APP.icalCache[board?.id] || {};
  const { overlay, close } = openModal(`
    <div class="modal">
      <button class="modal-close" data-close>✕</button>
      <h2>📅 Stundenplan (iCal)</h2>
      <div class="form-group">
        <label>WebUntis / iCal-URL</label>
        <input type="url" id="ical-url" value="${safeText(cache.url||w.config.icalUrl||'')}" placeholder="https://meine-schule.webuntis.com/…ical">
      </div>
      <p class="ical-info">
        In WebUntis: Mein Untis → Kalender → Mein Kalender → iCal-Link kopieren.<br>
        Der Link wird <strong>nur lokal</strong> in deinem Browser gespeichert.
        ${cache.lastFetched ? '<br>Zuletzt abgerufen: ' + new Date(cache.lastFetched).toLocaleString('de-DE') : ''}
      </p>
      <div class="btn-row">
        <button class="btn-secondary" id="ical-test">Jetzt abrufen</button>
        <button class="btn-primary" id="ical-save">Speichern</button>
      </div>
    </div>
  `);
  overlay.querySelector('#ical-save').addEventListener('click', () => {
    const url = overlay.querySelector('#ical-url').value.trim();
    if (board) {
      APP.icalCache[board.id] = { ...APP.icalCache[board.id], url };
      w.config.icalUrl = url;
    }
    APP.save();
    close();
    if (url) fetchIcal(url, board.id);
  });
  overlay.querySelector('#ical-test').addEventListener('click', () => {
    const url = overlay.querySelector('#ical-url').value.trim();
    if (!url) { toast('Bitte URL eingeben'); return; }
    if (board) { APP.icalCache[board.id] = { ...APP.icalCache[board.id], url }; }
    fetchIcal(url, board?.id);
    close();
  });
}

function openImageSettings(w) {
  const { overlay, close } = openModal(`
    <div class="modal">
      <button class="modal-close" data-close>✕</button>
      <h2>🖼 Bild</h2>
      <div class="form-group">
        <label>Bild-URL</label>
        <input type="url" id="img-url" value="${safeText(w.config.src||'')}" placeholder="https://…">
      </div>
      <div class="form-group">
        <label>Oder Datei hochladen (max. 2 MB)</label>
        <input type="file" id="img-file" accept="image/*" style="color:#fff">
      </div>
      <div class="form-group">
        <label>Alt-Text</label>
        <input type="text" id="img-alt" value="${safeText(w.config.alt||'')}">
      </div>
      <button class="btn-primary" id="img-save">Speichern</button>
    </div>
  `);
  overlay.querySelector('#img-save').addEventListener('click', () => {
    w.config.alt = overlay.querySelector('#img-alt').value.trim();
    const file = overlay.querySelector('#img-file').files[0];
    if (file) {
      if (file.size > 2*1024*1024) { toast('❌ Datei zu groß (max. 2 MB)'); return; }
      if (!file.type.startsWith('image/')) { toast('❌ Nur Bilddateien erlaubt'); return; }
      const reader = new FileReader();
      reader.onload = e => {
        w.config.src = e.target.result;
        APP.save();
        const shell = document.querySelector('[data-wid="'+w.id+'"]');
        if (shell) renderWidgetContent(w, shell.querySelector('.widget-body'));
        close();
      };
      reader.readAsDataURL(file);
    } else {
      w.config.src = overlay.querySelector('#img-url').value.trim();
      APP.save();
      const shell = document.querySelector('[data-wid="'+w.id+'"]');
      if (shell) renderWidgetContent(w, shell.querySelector('.widget-body'));
      close();
    }
  });
}

function openYoutubeSettings(w) {
  const { overlay, close } = openModal(`
    <div class="modal">
      <button class="modal-close" data-close>✕</button>
      <h2>▶️ YouTube</h2>
      <div class="form-group">
        <label>YouTube-URL oder Video-ID</label>
        <input type="text" id="yt-url" value="${safeText(w.config.videoId||'')}" placeholder="https://youtube.com/watch?v=… oder Video-ID">
      </div>
      <button class="btn-primary" id="yt-save">Einbetten</button>
    </div>
  `);
  overlay.querySelector('#yt-save').addEventListener('click', () => {
    let val = overlay.querySelector('#yt-url').value.trim();
    // Extract video ID
    const match = val.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
    w.config.videoId = match ? match[1] : val.slice(-11);
    APP.save();
    const shell = document.querySelector('[data-wid="'+w.id+'"]');
    if (shell) renderWidgetContent(w, shell.querySelector('.widget-body'));
    close();
  });
}

function openRandNumSettings(w) {
  const { overlay, close } = openModal(`
    <div class="modal">
      <button class="modal-close" data-close>✕</button>
      <h2>🔢 Zufallszahl</h2>
      <div class="form-group">
        <label>Minimum</label>
        <input type="number" id="rn-min" value="${w.config.min||1}">
      </div>
      <div class="form-group">
        <label>Maximum</label>
        <input type="number" id="rn-max" value="${w.config.max||30}">
      </div>
      <button class="btn-primary" id="rn-save">Speichern</button>
    </div>
  `);
  overlay.querySelector('#rn-save').addEventListener('click', () => {
    w.config.min = parseInt(overlay.querySelector('#rn-min').value)||1;
    w.config.max = parseInt(overlay.querySelector('#rn-max').value)||30;
    w.config.value = null;
    APP.save();
    const shell = document.querySelector('[data-wid="'+w.id+'"]');
    if (shell) renderWidgetContent(w, shell.querySelector('.widget-body'));
    close();
  });
}

function openGroupsSettings(w) {
  const { overlay, close } = openModal(`
    <div class="modal">
      <button class="modal-close" data-close>✕</button>
      <h2>👥 Gruppen</h2>
      <div class="form-group">
        <label>Namen (je eine pro Zeile)</label>
        <textarea id="gr-names" rows="8" style="resize:vertical">${safeText(w.config.names||'')}</textarea>
      </div>
      <div class="form-group">
        <label>Gruppengröße</label>
        <input type="number" id="gr-size" value="${w.config.size||3}" min="2" max="10">
      </div>
      <button class="btn-primary" id="gr-save">Speichern & Neu mischen</button>
    </div>
  `);
  overlay.querySelector('#gr-save').addEventListener('click', () => {
    w.config.names = overlay.querySelector('#gr-names').value;
    w.config.size = parseInt(overlay.querySelector('#gr-size').value)||3;
    APP.save();
    const shell = document.querySelector('[data-wid="'+w.id+'"]');
    if (shell) renderWidgetContent(w, shell.querySelector('.widget-body'));
    close();
  });
}

function openAgendaEdit(w) {
  const items = (w.config.items||[]).map(i=>`${i.time||''}|${i.text||''}`).join('\n');
  const { overlay, close } = openModal(`
    <div class="modal">
      <button class="modal-close" data-close>✕</button>
      <h2>📋 Agenda</h2>
      <p style="font-size:12px;color:rgba(255,255,255,0.4);margin-bottom:10px">Format: <code>08:00|Begrüßung</code> (Zeit|Text, je Zeile)</p>
      <div class="form-group">
        <textarea id="ag-items" rows="8" style="resize:vertical">${safeText(items)}</textarea>
      </div>
      <button class="btn-primary" id="ag-save">Speichern</button>
    </div>
  `);
  overlay.querySelector('#ag-save').addEventListener('click', () => {
    w.config.items = overlay.querySelector('#ag-items').value
      .split('\n').map(s=>s.trim()).filter(Boolean)
      .map(s=>{ const [time,...rest]=s.split('|'); return {time:time.trim(),text:rest.join('|').trim()}; });
    APP.save();
    const shell = document.querySelector('[data-wid="'+w.id+'"]');
    if (shell) renderWidgetContent(w, shell.querySelector('.widget-body'));
    close();
  });
}

function openChecklistEdit(w, onSave) {
  const items = (w.config.items||[]).map(i=>i.text||'').join('\n');
  const { overlay, close } = openModal(`
    <div class="modal">
      <button class="modal-close" data-close>✕</button>
      <h2>✅ Checkliste</h2>
      <div class="form-group">
        <label>Einträge (je einer pro Zeile)</label>
        <textarea id="cl-items" rows="8" style="resize:vertical">${safeText(items)}</textarea>
      </div>
      <button class="btn-primary" id="cl-save">Speichern</button>
    </div>
  `);
  overlay.querySelector('#cl-save').addEventListener('click', () => {
    w.config.items = overlay.querySelector('#cl-items').value
      .split('\n').map(s=>s.trim()).filter(Boolean)
      .map(t=>({text:t,done:false}));
    APP.save();
    const shell = document.querySelector('[data-wid="'+w.id+'"]');
    if (shell) renderWidgetContent(w, shell.querySelector('.widget-body'));
    onSave && onSave();
    close();
  });
}

function openPhasesEdit(w) {
  const lines = (w.config.phases||[]).map(p=>`${p.name}|${p.minutes}|${p.color}`).join('\n');
  const { overlay, close } = openModal(`
    <div class="modal">
      <button class="modal-close" data-close>✕</button>
      <h2>⏳ Arbeitsphasen</h2>
      <p style="font-size:12px;color:rgba(255,255,255,0.4);margin-bottom:10px">Format: <code>Einführung|5|#6366f1</code> (Name|Minuten|Farbe)</p>
      <div class="form-group">
        <textarea id="ph-items" rows="6" style="resize:vertical">${safeText(lines)}</textarea>
      </div>
      <button class="btn-primary" id="ph-save">Speichern</button>
    </div>
  `);
  overlay.querySelector('#ph-save').addEventListener('click', () => {
    w.config.phases = overlay.querySelector('#ph-items').value
      .split('\n').map(s=>s.trim()).filter(Boolean)
      .map(s=>{ const [name,min,color]=s.split('|'); return {name:(name||'Phase').trim(),minutes:parseInt(min)||5,color:(color||'#6366f1').trim()}; });
    w.config.activeIdx = -1;
    APP.save();
    const shell = document.querySelector('[data-wid="'+w.id+'"]');
    if (shell) renderWidgetContent(w, shell.querySelector('.widget-body'));
    close();
  });
}

// ── YouTube Overlay (In-Page Fullscreen Player) ──
// Nutzt blob:-URL als Wrapper, damit YouTube nicht file:// als Herkunft sieht
function openYoutubeOverlay(videoId) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.93);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;animation:fadeIn .2s;';

  const box = document.createElement('div');
  box.style.cssText = 'position:relative;width:min(94vw,1200px);aspect-ratio:16/9;border-radius:12px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,0.8);background:#000;';

  // Direkt-iframe mit origin-Parameter — das ist der entscheidende Fix
  const origin = encodeURIComponent(window.location.origin || 'https://classpuls.de');
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;';
  iframe.src = 'https://www.youtube-nocookie.com/embed/' + videoId
    + '?autoplay=1&rel=0&modestbranding=1&playsinline=1&origin=' + origin;
  iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen');
  iframe.setAttribute('allowfullscreen', '');

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'position:absolute;top:10px;right:10px;z-index:10;background:rgba(0,0,0,0.7);border:none;color:#fff;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:20px;line-height:40px;text-align:center;transition:background .15s;';
  closeBtn.onmouseenter = () => { closeBtn.style.background = 'rgba(220,30,30,0.9)'; };
  closeBtn.onmouseleave = () => { closeBtn.style.background = 'rgba(0,0,0,0.7)'; };

  const hint = document.createElement('div');
  hint.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.35);';
  hint.textContent = 'ESC oder Klick außerhalb zum Schließen';

  const close = () => {
    iframe.src = '';
    overlay.remove();
  };
  closeBtn.addEventListener('click', e => { e.stopPropagation(); close(); });
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); }, { once: true });

  box.append(iframe, closeBtn);
  overlay.append(box, hint);
  document.body.appendChild(overlay);
}

// ══════════════════════════════════════════════════════════════
// TOOLBAR ACTIONS
// ══════════════════════════════════════════════════════════════
