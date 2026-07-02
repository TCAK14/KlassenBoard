'use strict';
const WIDGET_RENDERERS = {

  // ── Clock ──
  clock(w, body) {
    body.style.flexDirection = 'column';
    const time = el('div','w-clock');
    const date = el('div','w-date');
    // HH:MM:SS = 8 chars, each ~0.62em wide with tabular-nums
    const maxByWidth = (w.w - 16) / 4.96;
    const maxByHeight = w.h * 0.42;
    const clockFs = Math.max(18, Math.min(maxByWidth, maxByHeight));
    time.style.fontSize = clockFs + 'px';
    time.style.whiteSpace = 'nowrap';
    time.style.letterSpacing = '-0.02em';
    date.style.fontSize = Math.max(11, clockFs * 0.28) + 'px';
    body.append(time, date);
    function update() {
      const now = new Date();
      time.textContent = now.toLocaleTimeString('de-DE');
      date.textContent = now.toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'});
    }
    update();
    startInterval(w.id, update, 1000);
  },

  // ── Timer ──
  timer(w, body) {
    body.style.flexDirection = 'column';
    const display = el('div','w-timer-display');
    // MM:SS = 5 chars
    const timerFs = Math.max(28, Math.min((w.w - 16) / 3.1, w.h * 0.40));
    display.style.fontSize = timerFs + 'px';
    const row = el('div','w-btn-row');
    const startBtn = el('button','w-action-btn');
    const resetBtn = el('button','w-action-btn');
    resetBtn.textContent = '↺';
    row.append(startBtn, resetBtn);
    body.append(display, row);

    let remaining = (w.config.minutes||5)*60 + (w.config.seconds||0);
    let running = false;
    let endAt = null;

    function fmt(s) {
      const m = Math.floor(s/60), sec = s%60;
      return String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');
    }
    function updateDisplay() {
      display.textContent = fmt(Math.max(0,remaining));
      display.classList.toggle('urgent', remaining <= 30 && running);
      startBtn.textContent = running ? '⏸ Pause' : (remaining < (w.config.minutes||5)*60+(w.config.seconds||0) ? '▶ Weiter' : '▶ Start');
    }
    function tick() {
      if (!running) return;
      remaining = Math.max(0, Math.round((endAt - Date.now())/1000));
      updateDisplay();
      if (remaining <= 0) {
        running = false;
        startInterval(w.id+'_', ()=>{}, 99999);
        stopInterval(w.id);
        toast('⏰ Zeit abgelaufen!', 5000);
      }
    }
    startBtn.addEventListener('click', () => {
      if (remaining <= 0) return;
      running = !running;
      if (running) {
        endAt = Date.now() + remaining*1000;
        startInterval(w.id, tick, 250);
      } else {
        stopInterval(w.id);
      }
      updateDisplay();
    });
    resetBtn.addEventListener('click', () => {
      running = false; stopInterval(w.id);
      remaining = (w.config.minutes||5)*60 + (w.config.seconds||0);
      updateDisplay();
    });
    updateDisplay();
  },

  // ── Stopwatch ──
  stopwatch(w, body) {
    body.style.flexDirection = 'column';
    const display = el('div','w-timer-display');
    // MM:SS = 5 chars
    const timerFs = Math.max(28, Math.min((w.w - 16) / 3.1, w.h * 0.40));
    display.style.fontSize = timerFs + 'px';
    const row = el('div','w-btn-row');
    const startBtn = el('button','w-action-btn');
    const lapBtn = el('button','w-action-btn'); lapBtn.textContent = '⚑ Runde';
    const resetBtn = el('button','w-action-btn'); resetBtn.textContent = '↺';
    row.append(startBtn, lapBtn, resetBtn);
    const lapsDiv = el('div'); lapsDiv.style.cssText='width:100%;overflow-y:auto;max-height:70px;margin-top:6px;font-size:11px;font-family:monospace;color:rgba(255,255,255,0.5)';
    body.append(display, row, lapsDiv);

    let elapsed = 0, running = false, startedAt = null, laps = [];
    function fmt(ms) {
      const m=Math.floor(ms/60000), s=Math.floor((ms%60000)/1000), cs=Math.floor((ms%1000)/10);
      return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
    }
    function update() {
      if (running) elapsed = Date.now() - startedAt + (elapsed);
      // handled via tick
      display.textContent = fmt(elapsed);
      startBtn.textContent = running ? '⏸ Pause' : '▶ Start';
    }
    startBtn.addEventListener('click', () => {
      if (!running) {
        const base = elapsed;
        startedAt = Date.now() - base;
        running = true;
        startInterval(w.id, () => { elapsed = Date.now() - startedAt; display.textContent = fmt(elapsed); }, 50);
      } else {
        running = false; stopInterval(w.id);
      }
      startBtn.textContent = running ? '⏸ Pause' : '▶ Start';
    });
    lapBtn.addEventListener('click', () => {
      if (!running) return;
      laps.push(elapsed);
      const d = el('div');
      d.textContent = `Runde ${laps.length}: ${fmt(laps[laps.length-1])}`;
      lapsDiv.prepend(d);
    });
    resetBtn.addEventListener('click', () => {
      running = false; stopInterval(w.id);
      elapsed = 0; laps = [];
      display.textContent = fmt(0);
      lapsDiv.innerHTML = '';
      startBtn.textContent = '▶ Start';
    });
    display.textContent = fmt(0);
  },

  // ── Text ──
  text(w, body) {
    const div = el('div','w-text-display');
    div.style.color = w.config.color || '#fff';
    const text = w.config.text || '';
    const charCount = Math.max(text.length, 1);
    const autoFs = Math.min(w.w * 0.07, w.h * 0.25) * Math.min(1, Math.pow(40 / charCount, 0.35));
    div.style.fontSize = (w.config.fontSize || Math.max(14, Math.min(autoFs, 72))) + 'px';
    div.textContent = text;
    if (APP.state.editMode) {
      div.addEventListener('dblclick', e => {
        e.stopPropagation();
        div.contentEditable = 'true';
        div.style.cursor = 'text';
        div.style.outline = '2px solid rgba(99,102,241,0.6)';
        div.style.borderRadius = '6px';
        div.focus();
        const sel = window.getSelection();
        sel.selectAllChildren(div);
        sel.collapseToEnd();
        const finish = () => {
          div.contentEditable = 'false';
          div.style.cursor = '';
          div.style.outline = '';
          w.config.text = div.textContent;
          APP.save();
          div.removeEventListener('blur', finish);
        };
        div.addEventListener('blur', finish);
        div.addEventListener('keydown', ev => {
          ev.stopPropagation();
          if (ev.key === 'Escape') { div.blur(); }
          if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); div.blur(); }
        });
      });
    }
    body.appendChild(div);
  },

  // ── Traffic Light ──
  traffic(w, body) {
    const states = ['red','yellow','green'];
    const labels = ['🔴 Ruhe','🟡 Flüstern','🟢 Sprechen'];
    body.style.flexDirection = 'column'; body.style.gap = '10px';
    const circles = [];
    const circleSize = Math.max(40, Math.min(w.w * 0.26, w.h * 0.32)) + 'px';
    const labelFs = Math.max(12, Math.min(w.w * 0.07, 22)) + 'px';
    const labelEl = el('div'); labelEl.style.cssText=`font-size:${labelFs};font-weight:600;color:rgba(255,255,255,0.9)`;

    states.forEach((s,i) => {
      const c = el('div','w-traffic-circle');
      c.dataset.state = s;
      c.style.width = circleSize; c.style.height = circleSize;
      circles.push(c);
      c.addEventListener('click', () => {
        w.config.state = s;
        updateCircles();
        APP.save();
      });
    });

    function updateCircles() {
      circles.forEach((c,i) => {
        c.className = 'w-traffic-circle';
        if (states[i] === w.config.state) {
          c.classList.add('active-' + states[i].charAt(0));
        } else {
          c.classList.add('dim');
        }
      });
      const idx = states.indexOf(w.config.state);
      labelEl.textContent = labels[idx] || '';
    }
    const circleRow = el('div'); circleRow.style.cssText='display:flex;gap:12px;align-items:center';
    circleRow.append(...circles);
    body.append(circleRow, labelEl);
    updateCircles();
  },

  // ── QR Code ──
  qr(w, body) {
    const container = el('div','w-qr-container');
    const qrDiv = el('div');
    qrDiv.style.cssText='background:#fff;padding:6px;border-radius:8px;display:inline-flex';
    const label = el('div','w-qr-label');
    label.textContent = w.config.label || w.config.url || '';
    container.append(qrDiv, label);
    body.appendChild(container);
    const url = w.config.url || 'https://classpuls.netlify.app';
    const size = Math.min(w.w - 40, w.h - 60, 160);
    try {
      new QRCode(qrDiv, { text: url, width: size, height: size, correctLevel: QRCode.CorrectLevel.M });
    } catch(e) { qrDiv.textContent = 'QR-Fehler'; }
  },

  // ── Random Name ──
  names(w, body) {
    body.style.flexDirection = 'column';
    const names = (w.config.names || '').split('\n').map(s=>s.trim()).filter(Boolean);
    let highlighted = w.config.highlighted ?? -1;
    const list = el('ul','w-names-list');
    const btn = el('button','w-action-btn'); btn.style.margin='0 auto 8px'; btn.textContent = '🎲 Zufällig';

    // Scale font: bigger when fewer names, smaller when many
    const itemCount = Math.max(names.length, 1);
    const itemFs = Math.max(13, Math.min(32, (w.h - 60) / itemCount * 0.7));
    const highlightFs = Math.min(itemFs * 1.5, 42);

    function render() {
      list.innerHTML = '';
      names.forEach((n,i) => {
        const li = document.createElement('li');
        li.textContent = n;
        li.style.fontSize = (i === highlighted ? highlightFs : itemFs) + 'px';
        if (i === highlighted) li.classList.add('highlighted');
        list.appendChild(li);
      });
    }
    btn.addEventListener('click', () => {
      if (!names.length) return;
      highlighted = Math.floor(Math.random() * names.length);
      w.config.highlighted = highlighted;
      APP.save();
      render();
    });
    body.append(btn, list);
    render();
  },

  // ── Homework ──
  homework(w, body) {
    const div = el('div','w-homework');
    const items = w.config.items || [];
    const itemFs = Math.max(13, Math.min(28, (w.h - 60) / Math.max(items.length, 1) * 0.65));
    const h3 = document.createElement('h3');
    h3.style.fontSize = Math.max(11, itemFs * 0.6) + 'px';
    h3.textContent = w.config.subject || 'Hausaufgaben';
    const ul = document.createElement('ul');
    if (items.length === 0) {
      const li = document.createElement('li');
      li.style.cssText = `font-size:${itemFs}px;color:rgba(255,255,255,0.3);font-style:italic;`;
      li.textContent = 'Doppelklick zum Bearbeiten';
      ul.appendChild(li);
      div.append(h3, ul);
      body.appendChild(div);
      if (APP.state.editMode) div.addEventListener('dblclick', () => openHomeworkEdit(w));
      return;
    }
    items.forEach(item => {
      const li = document.createElement('li');
      li.style.fontSize = itemFs + 'px';
      li.style.paddingTop = Math.max(3, itemFs * 0.2) + 'px';
      li.style.paddingBottom = Math.max(3, itemFs * 0.2) + 'px';
      li.textContent = item;
      ul.appendChild(li);
    });
    div.append(h3, ul);
    if (APP.state.editMode) div.addEventListener('dblclick', () => openHomeworkEdit(w));
    body.appendChild(div);
  },

  // ── Goal ──
  goal(w, body) {
    const div = el('div','w-goal-text');
    const text = w.config.text || '';
    const charCount = Math.max(text.length, 1);
    const baseFontSize = Math.min(w.w * 0.085, w.h * 0.38);
    const scaledFs = baseFontSize * Math.min(1, Math.pow(30 / charCount, 0.4));
    div.style.fontSize = Math.max(14, Math.min(scaledFs, 64)) + 'px';
    const isEmpty = !text;
    div.style.color = isEmpty ? 'rgba(255,255,255,0.45)' : '#fff';
    div.textContent = text || 'Doppelklick: Lernziel eintragen';
    if (APP.state.editMode) {
      div.addEventListener('dblclick', e => {
        e.stopPropagation();
        div.contentEditable = 'true';
        div.style.cursor = 'text';
        div.style.outline = '2px solid rgba(99,102,241,0.6)';
        div.style.borderRadius = '6px';
        div.style.color = '#fff';
        if (isEmpty) div.textContent = '';
        div.focus();
        const sel = window.getSelection();
        sel.selectAllChildren(div);
        sel.collapseToEnd();
        const finish = () => {
          div.contentEditable = 'false';
          div.style.cursor = '';
          div.style.outline = '';
          w.config.text = div.textContent.trim();
          APP.save();
          const shell = div.closest('.widget');
          if (shell) renderWidgetContent(w, shell.querySelector('.widget-body'));
          div.removeEventListener('blur', finish);
        };
        div.addEventListener('blur', finish);
        div.addEventListener('keydown', ev => {
          ev.stopPropagation();
          if (ev.key === 'Escape') { div.blur(); }
          if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); div.blur(); }
        });
      });
    }
    body.appendChild(div);
  },

  // ── Timetable ──
  timetable(w, body) {
    const inner = el('div','timetable-inner');
    const board = APP.activeBoard();
    const cache = APP.icalCache[board?.id] || {};
    const entries = cache.entries || [];

    if (!cache.url && !w.config.icalUrl) {
      const hint = el('div','tt-no-data');
      hint.textContent = '📅 iCal-URL eintragen (⚙ Einstellungen)';
      inner.appendChild(hint);
    } else {
      renderTimetableEntries(inner, entries);
    }
    body.appendChild(inner);
  },

  // ── Image ──
  image(w, body) {
    if (!w.config.src) {
      // Clickable upload area — like YouTube widget
      const wrap = el('div');
      wrap.style.cssText = 'width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;cursor:pointer;border:2px dashed rgba(255,255,255,0.2);border-radius:12px;transition:all .2s;box-sizing:border-box;';
      wrap.innerHTML = '<div style="font-size:36px">🖼</div><div style="font-size:14px;color:rgba(255,255,255,0.5)">Klicken zum Bild hochladen</div><div style="font-size:11px;color:rgba(255,255,255,0.3)">oder URL über ⚙ eingeben</div>';
      wrap.addEventListener('mouseenter', () => { wrap.style.borderColor='rgba(255,255,255,0.5)'; wrap.style.background='rgba(255,255,255,0.05)'; });
      wrap.addEventListener('mouseleave', () => { wrap.style.borderColor='rgba(255,255,255,0.2)'; wrap.style.background=''; });
      wrap.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = () => {
          const file = input.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = e => {
            w.config.src = e.target.result;
            w.config.alt = file.name;
            APP.save();
            renderWidgets();
          };
          reader.readAsDataURL(file);
        };
        input.click();
      });
      body.appendChild(wrap);
    } else {
      const img = el('img','w-image-inner');
      img.alt = w.config.alt || '';
      img.src = w.config.src;
      body.appendChild(img);
    }
  },

  // ── YouTube ──
  youtube(w, body) {
    if (!w.config.videoId) {
      // Leerer Zustand: gesamte Fläche anklickbar
      const wrap = el('div');
      wrap.style.cssText = 'width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;cursor:pointer;border:2px dashed rgba(255,255,255,0.2);border-radius:12px;transition:all .2s;';
      const icon = el('div'); icon.style.cssText='font-size:40px;'; icon.textContent='▶️';
      const txt = el('div');
      txt.style.cssText='font-size:14px;color:rgba(255,255,255,0.6);text-align:center;padding:0 16px;line-height:1.6;font-weight:500;';
      txt.textContent='YouTube-Link einfügen';
      const sub = el('div');
      sub.style.cssText='font-size:11px;color:rgba(255,255,255,0.35);text-align:center;';
      sub.textContent='Hier klicken oder ⚙ oben rechts';
      wrap.append(icon, txt, sub);
      wrap.addEventListener('mouseenter', () => {
        wrap.style.borderColor='rgba(255,255,255,0.45)';
        wrap.style.background='rgba(255,255,255,0.06)';
      });
      wrap.addEventListener('mouseleave', () => {
        wrap.style.borderColor='rgba(255,255,255,0.2)';
        wrap.style.background='';
      });
      wrap.addEventListener('click', e => { e.stopPropagation(); openYoutubeSettings(w); });
      body.appendChild(wrap);
      return;
    }

    const vid = w.config.videoId;
    const wrap = el('div');
    wrap.style.cssText = 'width:100%;height:100%;position:relative;cursor:pointer;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden;';

    const thumb = el('img');
    thumb.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0;opacity:0.85;transition:opacity .2s;';
    thumb.src = `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
    thumb.onerror = () => { thumb.style.display='none'; };

    const play = el('div');
    play.style.cssText = 'position:relative;z-index:1;width:64px;height:64px;background:rgba(255,0,0,0.92);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,0,0,0.5);transition:transform .15s;flex-shrink:0;';
    play.innerHTML = '<span style="color:#fff;font-size:26px;margin-left:5px">▶</span>';

    // "URL ändern"-Button erscheint beim Hover oben rechts
    const editBtn = el('div');
    editBtn.style.cssText = 'position:absolute;top:8px;right:8px;z-index:3;font-size:11px;color:#fff;background:rgba(0,0,0,0.65);padding:4px 10px;border-radius:20px;opacity:0;transition:opacity .2s;cursor:pointer;';
    editBtn.textContent = '✏️ URL ändern';
    editBtn.addEventListener('click', e => { e.stopPropagation(); openYoutubeSettings(w); });

    wrap.append(thumb, play, editBtn);
    wrap.addEventListener('mouseenter', () => { play.style.transform='scale(1.1)'; thumb.style.opacity='0.7'; editBtn.style.opacity='1'; });
    wrap.addEventListener('mouseleave', () => { play.style.transform='scale(1)'; thumb.style.opacity='0.85'; editBtn.style.opacity='0'; });
    wrap.addEventListener('click', () => openYoutubeOverlay(vid));
    body.appendChild(wrap);
  },

  // ── Lautstärke / Noise Meter ──
  noise(w, body) {
    stopAudioStream(w.id);
    body.style.cssText += 'flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:12px;';

    // Emoji + Label
    const emojiEl = el('div');
    emojiEl.style.cssText = 'font-size:42px;line-height:1;transition:all .2s;';
    emojiEl.textContent = '😴';

    const labelEl = el('div');
    labelEl.style.cssText = 'font-size:13px;font-weight:700;letter-spacing:.5px;color:#fff;transition:color .3s;';
    labelEl.textContent = 'LEISE';

    // Balken-Meter (5 Balken)
    const bars = el('div');
    bars.style.cssText = 'display:flex;align-items:flex-end;gap:4px;height:48px;';
    const barEls = [];
    const barHeights = [20, 30, 45, 35, 25];
    barHeights.forEach((h, i) => {
      const b = el('div');
      b.style.cssText = `width:10px;border-radius:4px;background:rgba(255,255,255,0.15);height:${h}%;transition:height .1s,background .3s;`;
      bars.appendChild(b);
      barEls.push(b);
    });

    // Mikrofon-Button
    const micBtn = el('button');
    micBtn.style.cssText = 'margin-top:4px;padding:6px 14px;border-radius:20px;border:none;background:rgba(99,102,241,0.3);color:#a5b4fc;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;';
    micBtn.textContent = '🎤 Mikrofon starten';

    body.append(emojiEl, bars, labelEl, micBtn);

    let running = false;

    function getColor(level) {
      const low  = (w.config.lowThreshold  ?? 25) / 100;
      const high = (w.config.highThreshold ?? 55) / 100;
      if (level < low)  return { bg:'#22c55e', label:'LEISE',  emoji:'😴' };
      if (level < high) return { bg:'#f59e0b', label:'MITTEL', emoji:'🤫' };
      return                   { bg:'#ef4444', label:'LAUT',   emoji:'🔊' };
    }

    function startMic() {
      if (running) return;
      running = true;
      micBtn.textContent = '⏹ Stoppen';
      micBtn.style.background = 'rgba(239,68,68,0.25)';
      micBtn.style.color = '#fca5a5';

      navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(stream => {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 128;
          analyser.smoothingTimeConstant = 0.6;
          source.connect(analyser);
          const data = new Uint8Array(analyser.frequencyBinCount);

          function tick() {
            analyser.getByteFrequencyData(data);
            const avg = data.reduce((a,b) => a+b, 0) / data.length / 128;
            const multiplier = (w.config.sensitivity ?? 3) / 3 * 2.5;
            const level = Math.min(avg * multiplier, 1);

            // Update bars
            barEls.forEach((b, i) => {
              const threshold = (i + 1) / barEls.length;
              const active = level >= threshold * 0.8;
              const col = getColor(level);
              b.style.height = active ? `${barHeights[i] + level * 40}%` : `${barHeights[i]}%`;
              b.style.background = active ? col.bg : 'rgba(255,255,255,0.12)';
            });

            const col = getColor(level);
            emojiEl.textContent = col.emoji;
            labelEl.textContent = col.label;
            labelEl.style.color = col.bg;

            const raf = requestAnimationFrame(tick);
            AUDIO_STREAMS[w.id] = { stream, ctx, raf };
          }
          tick();
        })
        .catch(err => {
          running = false;
          micBtn.textContent = '🎤 Mikrofon starten';
          micBtn.style.background = 'rgba(99,102,241,0.3)';
          micBtn.style.color = '#a5b4fc';
          emojiEl.textContent = '❌';
          labelEl.textContent = 'Kein Zugriff';
          labelEl.style.color = '#f87171';
        });
    }

    function stopMic() {
      running = false;
      stopAudioStream(w.id);
      micBtn.textContent = '🎤 Mikrofon starten';
      micBtn.style.background = 'rgba(99,102,241,0.3)';
      micBtn.style.color = '#a5b4fc';
      emojiEl.textContent = '😴';
      labelEl.textContent = 'LEISE';
      labelEl.style.color = '#fff';
      barEls.forEach((b,i) => { b.style.height = `${barHeights[i]}%`; b.style.background = 'rgba(255,255,255,0.12)'; });
    }

    micBtn.addEventListener('click', () => running ? stopMic() : startMic());
  },

  // ── Live-Umfrage ──
  poll(w, body) {
    // Cleanup old subscription
    if (POLL_CHANNELS[w.id]) {
      try { AUTH.client?.removeChannel(POLL_CHANNELS[w.id]); } catch(e) {}
      delete POLL_CHANNELS[w.id];
    }

    if (!w.config.question) {
      // Leerer Zustand
      const wrap = el('div');
      wrap.style.cssText = 'width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;cursor:pointer;border:2px dashed rgba(255,255,255,0.2);border-radius:12px;transition:all .2s;';
      const icon = el('div'); icon.style.fontSize = '36px'; icon.textContent = '📊';
      const txt = el('div'); txt.style.cssText = 'font-size:13px;color:rgba(255,255,255,0.55);text-align:center;font-weight:500;';
      txt.textContent = 'Live-Umfrage erstellen';
      const sub = el('div'); sub.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.3);';
      sub.textContent = 'Hier klicken oder ⚙ oben rechts';
      wrap.append(icon, txt, sub);
      wrap.addEventListener('mouseenter', () => { wrap.style.borderColor='rgba(255,255,255,0.4)'; wrap.style.background='rgba(255,255,255,0.05)'; });
      wrap.addEventListener('mouseleave', () => { wrap.style.borderColor='rgba(255,255,255,0.2)'; wrap.style.background=''; });
      wrap.addEventListener('click', e => { e.stopPropagation(); openPollSettings(w); });
      body.appendChild(wrap);
      return;
    }

    const COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444'];
    const options = (w.config.options || []).filter(o => o.trim());
    const voteCounts = new Array(options.length).fill(0);
    const pollId = w.config.pollId;
    const votingUrl = window.location.origin + window.location.pathname + '?poll=' + pollId;

    // Layout
    const wrap = el('div');
    wrap.style.cssText = 'width:100%;height:100%;display:flex;flex-direction:column;padding:10px;gap:6px;overflow:hidden;';

    // Top row: question + QR
    const topRow = el('div');
    topRow.style.cssText = 'display:flex;gap:10px;align-items:flex-start;flex-shrink:0;';
    const qEl = el('div','poll-question'); qEl.textContent = w.config.question;
    qEl.style.flex = '1';
    const qrWrap = el('div'); qrWrap.id = 'poll-qr-'+w.id;
    qrWrap.style.cssText = 'width:72px;height:72px;flex-shrink:0;background:#fff;border-radius:8px;padding:3px;cursor:pointer;';
    qrWrap.title = 'Link kopieren';
    qrWrap.addEventListener('click', e => { e.stopPropagation(); navigator.clipboard.writeText(votingUrl).then(()=>toast('📋 Link kopiert!')); });
    topRow.append(qEl, qrWrap);

    // Bars
    const barsWrap = el('div'); barsWrap.style.cssText = 'flex:1;display:flex;flex-direction:column;justify-content:center;';
    const barFills = [], countEls = [];
    options.forEach((opt, i) => {
      const row = el('div','poll-bar-row');
      const lbl = el('div','poll-bar-label'); lbl.textContent = opt;
      const bg  = el('div','poll-bar-bg');
      const fill= el('div','poll-bar-fill'); fill.style.cssText = `width:0%;background:${COLORS[i%4]};`;
      const cnt = el('div','poll-bar-count'); cnt.textContent = '0';
      bg.appendChild(fill); row.append(lbl, bg, cnt);
      barsWrap.appendChild(row);
      barFills.push(fill); countEls.push(cnt);
    });

    const totalEl = el('div','poll-total'); totalEl.textContent = '0 Stimmen';

    // Controls
    const ctrl = el('div','poll-ctrl');
    const revealBtn = el('button');
    const revealed = w.config.showResults !== false; // default: sichtbar
    revealBtn.style.cssText = revealed
      ? 'background:rgba(34,197,94,0.2);color:#86efac;'
      : 'background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);';
    revealBtn.textContent = revealed ? '👁 Ergebnis sichtbar' : '🙈 Ergebnis versteckt';
    const resetBtn = el('button');
    resetBtn.style.cssText = 'background:rgba(239,68,68,0.2);color:#fca5a5;';
    resetBtn.textContent = '🗑 Reset';
    const copyBtn = el('button');
    copyBtn.style.cssText = 'background:rgba(99,102,241,0.2);color:#a5b4fc;';
    copyBtn.textContent = '📋 Link';
    const editBtn2 = el('button');
    editBtn2.style.cssText = 'background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.6);';
    editBtn2.textContent = '✏️';
    ctrl.append(revealBtn, resetBtn, copyBtn, editBtn2);

    // Ergebnis-Sichtbarkeit anwenden
    function applyVisibility() {
      const show = w.config.showResults !== false;
      barsWrap.style.filter  = show ? '' : 'blur(6px)';
      barsWrap.style.opacity = show ? '1' : '0.25';
      totalEl.style.filter   = show ? '' : 'blur(4px)';
      totalEl.style.opacity  = show ? '1' : '0.25';
      revealBtn.textContent  = show ? '👁 Ergebnis sichtbar' : '🙈 Ergebnis versteckt';
      revealBtn.style.cssText = show
        ? 'background:rgba(34,197,94,0.2);color:#86efac;'
        : 'background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);';
    }
    applyVisibility();

    revealBtn.addEventListener('click', e => {
      e.stopPropagation();
      w.config.showResults = w.config.showResults === false ? true : false;
      applyVisibility();
      APP.save();
    });

    wrap.append(topRow, barsWrap, totalEl, ctrl);
    body.appendChild(wrap);

    // QR Code generieren
    setTimeout(() => {
      const qrEl = document.getElementById('poll-qr-'+w.id);
      if (qrEl && window.QRCode) {
        try { new QRCode(qrEl, { text:votingUrl, width:66, height:66, correctLevel:QRCode.CorrectLevel.M }); }
        catch(e) {}
      }
    }, 80);

    function updateBars() {
      const total = voteCounts.reduce((a,b)=>a+b,0);
      totalEl.textContent = total + (total===1?' Stimme':' Stimmen');
      barFills.forEach((f,i) => {
        const pct = total>0 ? (voteCounts[i]/total*100) : 0;
        f.style.width = pct+'%';
        countEls[i].textContent = voteCounts[i];
      });
    }

    async function loadVotes() {
      if (!AUTH.client || !pollId) return;
      const { data } = await AUTH.client.from('poll_votes').select('option_index').eq('poll_id', pollId);
      if (data) { voteCounts.fill(0); data.forEach(v=>{ if(v.option_index<voteCounts.length) voteCounts[v.option_index]++; }); updateBars(); }
    }

    resetBtn.addEventListener('click', async e => {
      e.stopPropagation();
      if (!AUTH.client) { toast('Supabase nicht verbunden'); return; }
      await AUTH.client.from('poll_votes').delete().eq('poll_id', pollId);
      voteCounts.fill(0); updateBars(); toast('🗑 Stimmen zurückgesetzt');
    });
    copyBtn.addEventListener('click', e => { e.stopPropagation(); navigator.clipboard.writeText(votingUrl).then(()=>toast('📋 Link kopiert!')); });
    editBtn2.addEventListener('click', e => { e.stopPropagation(); openPollSettings(w); });

    if (AUTH.client && pollId) {
      loadVotes();
      const ch = AUTH.client.channel('poll-'+w.id)
        .on('postgres_changes', { event:'INSERT', schema:'public', table:'poll_votes', filter:'poll_id=eq.'+pollId },
          payload => { const i=payload.new.option_index; if(i>=0&&i<voteCounts.length){ voteCounts[i]++; updateBars(); } })
        .on('postgres_changes', { event:'DELETE', schema:'public', table:'poll_votes', filter:'poll_id=eq.'+pollId },
          () => loadVotes())
        .subscribe();
      POLL_CHANNELS[w.id] = ch;
    } else if (!AUTH.client) {
      totalEl.textContent = '⚠️ Anmelden für Live-Ergebnisse';
    }
  },

  // ── KI-Assistent ──
  ai(w, body) {
    body.style.cssText += 'flex-direction:column;gap:6px;padding:10px;overflow:hidden;';

    // ── Not logged in banner ──
    if (!AUTH.user) {
      const banner = el('div');
      banner.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;height:100%;text-align:center;';
      const ico = el('div'); ico.style.cssText = 'font-size:36px;'; ico.textContent = '🤖';
      const msg = el('div'); msg.style.cssText = 'font-size:12.5px;color:rgba(255,255,255,0.6);max-width:220px;line-height:1.5;';
      msg.textContent = 'Bitte zuerst anmelden um den KI-Assistenten zu nutzen.';
      banner.append(ico, msg);
      body.appendChild(banner);
      return;
    }

    // ── Controls row ──
    const ctrlRow = el('div','ai-ctrl-row');
    const topicInput = document.createElement('input');
    topicInput.type = 'text'; topicInput.placeholder = 'Thema eingeben…';
    topicInput.value = w.config.lastTopic || '';
    topicInput.addEventListener('click', e => e.stopPropagation());

    const typeSelect = document.createElement('select');
    [['quiz','🧩 Quiz-Fragen'],['goal','🎯 Stundenziel'],['tasks','📝 Aufgaben'],['summary','📖 Zusammenfassung'],['explain','💡 Erklärung']].forEach(([v,l]) => {
      const o = document.createElement('option'); o.value=v; o.textContent=l;
      if (w.config.lastType===v) o.selected=true;
      typeSelect.appendChild(o);
    });
    typeSelect.addEventListener('click', e => e.stopPropagation());

    const gradeSelect = document.createElement('select');
    ['1','2','3','4','5','6','7','8','9','10','11','12','13'].forEach(g => {
      const o = document.createElement('option'); o.value=g; o.textContent='Kl. '+g;
      if ((w.config.lastGrade||'7')===g) o.selected=true;
      gradeSelect.appendChild(o);
    });
    gradeSelect.addEventListener('click', e => e.stopPropagation());

    const genBtn = el('button','ai-gen-btn'); genBtn.textContent = '✨ Generieren';

    ctrlRow.append(topicInput, typeSelect, gradeSelect, genBtn);

    // ── Output area ──
    const output = el('div','ai-output');
    output.style.cursor = 'text';
    output.addEventListener('click', e => e.stopPropagation());
    if (w.config.lastOutput) {
      output.textContent = w.config.lastOutput;
    } else {
      output.style.color = 'rgba(255,255,255,0.2)';
      output.textContent = 'Hier erscheint der generierte Inhalt…';
    }

    // ── Bottom row ──
    const bottomRow = el('div','ai-bottom-row');
    const copyBtn2 = el('button'); copyBtn2.textContent='📋 Kopieren'; copyBtn2.style.cssText='background:rgba(255,255,255,0.1);color:#fff;';
    const clearBtn = el('button'); clearBtn.textContent='🗑 Löschen'; clearBtn.style.cssText='background:rgba(239,68,68,0.2);color:#fca5a5;';
    copyBtn2.addEventListener('click', e => { e.stopPropagation(); navigator.clipboard.writeText(output.textContent).then(()=>toast('📋 Kopiert!')); });
    clearBtn.addEventListener('click', e => { e.stopPropagation(); output.textContent=''; output.style.color='rgba(255,255,255,0.2)'; w.config.lastOutput=''; APP.save(); });
    bottomRow.append(copyBtn2, clearBtn);

    body.append(ctrlRow, output, bottomRow);

    // ── Generate via Supabase Edge Function ──
    genBtn.addEventListener('click', async e => {
      e.stopPropagation();
      const topic = topicInput.value.trim();
      if (!topic) { toast('⚠️ Bitte ein Thema eingeben'); topicInput.focus(); return; }
      const type = typeSelect.value;
      const grade = gradeSelect.value;

      genBtn.disabled = true; genBtn.textContent = '⏳ Lädt…';
      output.style.color = 'rgba(255,255,255,0.4)';
      output.textContent = '⏳ KI generiert Inhalt…';

      try {
        const { data, error } = await AUTH.client.functions.invoke('ai-generate', {
          body: { topic, type, grade }
        });
        if (error) throw new Error(error.message || String(error));
        const text = data?.text || '(Keine Antwort)';
        output.textContent = text;
        output.style.color = 'rgba(255,255,255,0.85)';
        w.config.lastOutput = text;
        w.config.lastTopic  = topic;
        w.config.lastType   = type;
        w.config.lastGrade  = grade;
        APP.save();
      } catch(err) {
        output.textContent = '❌ Fehler: ' + err.message;
        output.style.color = '#fca5a5';
        toast('❌ KI-Fehler: ' + err.message);
      } finally {
        genBtn.disabled = false; genBtn.textContent = '✨ Generieren';
      }
    });
  },

  // ── Favorites / Schnell-Links Widget ──
  favorites(w, body) {
    body.style.cssText = 'flex-direction:column;gap:0;overflow:hidden;padding:0';
    const cfg = w.config;
    if (!cfg.links) cfg.links = [];

    const render = () => {
      body.innerHTML = '';

      // Header
      const hdr = document.createElement('div');
      hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 10px 4px;flex-shrink:0';
      const title = document.createElement('div');
      title.style.cssText = 'font-size:11px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.8px';
      title.textContent = '⭐ Schnell-Links';
      const addBtn = document.createElement('button');
      addBtn.style.cssText = 'background:rgba(99,102,241,0.3);border:1px solid rgba(99,102,241,0.5);color:#a5b4fc;border-radius:8px;padding:3px 10px;font-size:11px;cursor:pointer;font-weight:600';
      addBtn.textContent = '+ Hinzufügen';
      addBtn.addEventListener('click', e => { e.stopPropagation(); openAddDialog(); });
      hdr.append(title, addBtn);
      body.appendChild(hdr);

      // Grid of tiles
      const grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:8px;padding:6px 8px;overflow-y:auto;flex:1';

      cfg.links.forEach((link, idx) => {
        const tile = document.createElement('div');
        tile.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:5px;padding:8px 4px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:10px;cursor:pointer;transition:all .15s;position:relative;overflow:hidden';
        tile.title = link.url;

        const domain = (() => { try { return new URL(link.url.startsWith('http') ? link.url : 'https://'+link.url).hostname; } catch(e) { return ''; } })();

        const icon = document.createElement('img');
        icon.src = 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(domain) + '&sz=64';
        icon.style.cssText = 'width:36px;height:36px;border-radius:8px;object-fit:contain;background:#fff;padding:3px';
        icon.onerror = () => { icon.style.display='none'; };

        const lbl = document.createElement('div');
        lbl.style.cssText = 'font-size:10px;color:#fff;text-align:center;word-break:break-word;max-width:72px;line-height:1.2';
        lbl.textContent = link.name || domain;

        const del = document.createElement('button');
        del.textContent = '✕';
        del.style.cssText = 'position:absolute;top:2px;right:2px;background:rgba(239,68,68,0.7);border:none;color:#fff;border-radius:50%;width:16px;height:16px;font-size:9px;cursor:pointer;display:none;align-items:center;justify-content:center;padding:0;line-height:16px';
        tile.addEventListener('mouseenter', () => { del.style.display='flex'; tile.style.background='rgba(255,255,255,0.12)'; });
        tile.addEventListener('mouseleave', () => { del.style.display='none'; tile.style.background='rgba(255,255,255,0.06)'; });

        tile.addEventListener('click', e => {
          if (e.target === del || del.contains(e.target)) return;
          const url = link.url.startsWith('http') ? link.url : 'https://' + link.url;
          window.open(url, '_blank');
        });
        del.addEventListener('click', e => {
          e.stopPropagation();
          cfg.links.splice(idx, 1);
          APP.save(); render();
        });

        tile.append(icon, lbl, del);
        grid.appendChild(tile);
      });

      if (cfg.links.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'color:rgba(255,255,255,0.3);font-size:12px;text-align:center;padding:20px;grid-column:1/-1';
        empty.textContent = 'Noch keine Seiten — klicke + Hinzufügen';
        grid.appendChild(empty);
      }
      body.appendChild(grid);
    };

    const openAddDialog = () => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
      const box = document.createElement('div');
      box.style.cssText = 'background:#1e293b;border:1px solid rgba(255,255,255,0.15);border-radius:14px;padding:20px;width:300px;box-shadow:0 20px 60px rgba(0,0,0,0.7)';
      const htitle = document.createElement('div');
      htitle.style.cssText = 'font-weight:700;font-size:14px;margin-bottom:14px;color:#fff';
      htitle.textContent = '🌐 Webseite hinzufügen';

      const urlInp = document.createElement('input');
      urlInp.type = 'url'; urlInp.placeholder = 'https://www.beispiel.de';
      urlInp.style.cssText = 'width:100%;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:#fff;font-size:13px;padding:8px 10px;margin-bottom:8px;box-sizing:border-box;outline:none';

      const nameInp = document.createElement('input');
      nameInp.type = 'text'; nameInp.placeholder = 'Name (optional)';
      nameInp.style.cssText = 'width:100%;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:#fff;font-size:13px;padding:8px 10px;margin-bottom:8px;box-sizing:border-box;outline:none';

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:6px';

      const cancel = document.createElement('button');
      cancel.textContent = 'Abbrechen';
      cancel.style.cssText = 'padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:transparent;color:rgba(255,255,255,0.7);cursor:pointer;font-size:13px';
      cancel.addEventListener('click', () => overlay.remove());

      const ok = document.createElement('button');
      ok.textContent = '✓ Hinzufügen';
      ok.style.cssText = 'padding:8px 14px;border-radius:8px;border:none;background:#6366f1;color:#fff;cursor:pointer;font-size:13px;font-weight:600';
      ok.addEventListener('click', () => {
        let url = urlInp.value.trim();
        if (!url) return;
        if (!url.startsWith('http')) url = 'https://' + url;
        const domain = (() => { try { return new URL(url).hostname; } catch(e) { return url; } })();
        cfg.links.push({ url, name: nameInp.value.trim() || domain });
        APP.save(); render(); overlay.remove();
      });

      overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
      [urlInp, nameInp].forEach(inp => inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key==='Enter') ok.click(); }));
      row.append(cancel, ok);
      box.append(htitle, urlInp, nameInp, row);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      requestAnimationFrame(() => urlInp.focus());
    };

    render();
  },

  // ── Frag die KI ──
  ask(w, body) {
    body.style.cssText += 'flex-direction:column;gap:7px;padding:10px;overflow:hidden;';

    // Note: image generation works without login, text AI needs login

    // ── Chat history ──
    const history = el('div','ask-history');
    const messages = w.config.messages || [];

    function renderMessages() {
      history.innerHTML = '';
      messages.forEach(m => {
        const b = el('div','ask-bubble ' + m.role);
        if (m.type === 'image') {
          const img = document.createElement('img');
          img.src = m.url;
          img.alt = m.text || 'Bild';
          img.style.cssText = 'max-width:100%;border-radius:8px;display:block;margin-top:4px;';
          img.onerror = () => { img.replaceWith(Object.assign(document.createElement('span'), {textContent:'❌ Bild konnte nicht geladen werden'})); };
          const label = document.createElement('div');
          label.style.cssText = 'font-size:11px;opacity:0.55;margin-bottom:3px;';
          label.textContent = '🖼 ' + (m.text || 'Generiertes Bild');
          b.append(label, img);
        } else {
          b.textContent = m.text;
        }
        history.appendChild(b);
      });
      setTimeout(() => { history.scrollTop = history.scrollHeight; }, 30);
    }
    renderMessages();

    // ── Top row (clear button) ──
    const topRow = el('div'); topRow.style.cssText='display:flex;justify-content:flex-end;flex-shrink:0;';
    const clearBtn = el('button','ask-clear-btn'); clearBtn.textContent='🗑 Verlauf löschen';
    clearBtn.addEventListener('click', e => {
      e.stopPropagation();
      w.config.messages = [];
      messages.length = 0;
      renderMessages();
      APP.save();
    });

    // Expand/shrink button
    const expandBtn = el('button','ask-clear-btn');
    expandBtn.textContent = '⛶ Vergrößern';
    expandBtn.style.marginRight = '4px';
    expandBtn.addEventListener('click', e => {
      e.stopPropagation();
      const isLarge = w.w >= 700;
      w.w = isLarge ? 400 : 750;
      w.h = isLarge ? 300 : 520;
      expandBtn.textContent = isLarge ? '⛶ Vergrößern' : '⊡ Verkleinern';
      // re-render widget with new size
      const wEl = document.querySelector('.widget[data-id="' + w.id + '"]');
      if (wEl) {
        wEl.style.width  = w.w + 'px';
        wEl.style.height = w.h + 'px';
      }
      APP.save();
    });

    topRow.append(expandBtn, clearBtn);

    // ── Input row ──
    const inputRow = el('div','ask-input-row');
    const textarea = document.createElement('textarea');
    textarea.placeholder = 'z.B. "Zeige einen Apfel" oder eine Frage stellen…';
    textarea.addEventListener('click', e => e.stopPropagation());
    textarea.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click(); }
    });

    const sendBtn = el('button','ask-send-btn'); sendBtn.textContent = '➤';
    sendBtn.title = 'Frage stellen (Enter)';
    inputRow.append(textarea, sendBtn);

    body.append(topRow, history, inputRow);

    // ── Send ──
    // Detect image request from German keywords
    function isImageRequest(q) {
      return /^(zeig|zeige|mal|male|zeichne|generiere|erstell|bild von|bild:|foto von|zeig mir|zeige mir|show|draw)\b/i.test(q.trim()) ||
             /(als bild|als foto|als zeichnung|als illustration)/i.test(q);
    }

    function extractImagePrompt(q) {
      return q.replace(/^(zeig(e)?(\s*(mir|einen|eine|ein|das|die|den))?|mal(e)?|zeichne|generiere|erstell(e)?|bild von|bild:|foto von|show|draw)\s*/i, '').trim() || q;
    }

    sendBtn.addEventListener('click', async e => {
      e.stopPropagation();
      const q = textarea.value.trim();
      if (!q) return;

      textarea.value = '';
      messages.push({ role:'user', text:q });

      const thinkingBubble = el('div','ask-bubble thinking');
      history.appendChild(thinkingBubble);
      history.scrollTop = history.scrollHeight;
      sendBtn.disabled = true;

      try {
        if (isImageRequest(q)) {
          // ── Image generation via Pollinations.ai (free, no key) ──
          thinkingBubble.textContent = '🎨 Generiere Bild…';
          const subject = extractImagePrompt(q);
          const w_px = Math.min(800, Math.max(400, w.w * 2));
          const h_px = Math.min(600, Math.max(300, w.h * 1.5));
          const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(subject + ', realistic photograph, high quality, educational, clear lighting')}?width=${w_px}&height=${h_px}&nologo=true&seed=${Math.floor(Math.random()*2000000000)}`;
          thinkingBubble.remove();
          messages.push({ role:'ai', type:'image', url, text: subject });
        } else {
          // ── Text answer via Supabase Edge Function ──
          thinkingBubble.textContent = '⏳ Denke nach…';
          if (!AUTH.user) throw new Error('Für Textfragen bitte zuerst anmelden (Konto-Icon oben rechts)');
          const { data, error } = await AUTH.client.functions.invoke('ai-generate', {
            body: { type:'ask', question: q }
          });
          if (error) throw new Error(error.message || String(error));
          const answer = data?.text || '(Keine Antwort)';
          thinkingBubble.remove();
          messages.push({ role:'ai', text:answer });
        }
        if (messages.length > 30) messages.splice(0, messages.length - 30);
        w.config.messages = messages;
        APP.save();
        renderMessages();
      } catch(err) {
        thinkingBubble.textContent = '❌ ' + err.message;
        thinkingBubble.style.color = '#fca5a5';
      } finally {
        sendBtn.disabled = false;
      }
    });
  },

  // ── Browser Widget ──
  browser(w, body) {
    body.style.flexDirection = 'column';
    body.style.alignItems = 'stretch';
    body.style.justifyContent = 'stretch';
    body.style.padding = '0';
    body.style.overflow = 'hidden';

    if (!w.config.bookmarks) {
      w.config.bookmarks = [
        { label:'FragFinn', url:'https://www.fragfinn.de' },
        { label:'ARD', url:'https://www.ard.de' },
        { label:'ZDF', url:'https://www.zdf.de' },
        { label:'Planet Schule', url:'https://www.planet-schule.de' },
      ];
    }
    const bookmarkList = w.config.bookmarks;

    // URL bar
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:4px;padding:6px;background:rgba(0,0,0,0.3);flex-shrink:0;align-items:center';

    const btnStyle = 'border:none;background:rgba(255,255,255,0.1);color:#fff;border-radius:5px;padding:4px 7px;cursor:pointer;font-size:12px;flex-shrink:0';

    const homeBtn = document.createElement('button');
    homeBtn.textContent = '🏠';
    homeBtn.title = 'Startseite';
    homeBtn.style.cssText = btnStyle;
    homeBtn.addEventListener('click', function(e) { e.stopPropagation(); showStartpage(); });

    const urlInp = document.createElement('input');
    urlInp.type = 'text';
    urlInp.placeholder = 'URL eingeben…';
    urlInp.value = '';
    urlInp.style.cssText = 'flex:1;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#fff;font-size:11px;padding:4px 8px;touch-action:auto;min-width:0';
    urlInp.addEventListener('click', e => e.stopPropagation());
    urlInp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') navigate(urlInp.value); });

    const goBtn = document.createElement('button');
    goBtn.textContent = '→';
    goBtn.style.cssText = 'border:none;background:var(--brand);color:#fff;border-radius:5px;padding:4px 9px;cursor:pointer;font-size:13px;flex-shrink:0;font-weight:700';
    goBtn.addEventListener('click', e => { e.stopPropagation(); navigate(urlInp.value); });

    bar.append(homeBtn, urlInp, goBtn);

    // Startpage with tiles
    const startpage = document.createElement('div');
    startpage.style.cssText = 'flex:1;overflow:hidden;background:rgba(0,0,0,0.1);padding:0;display:none;flex-direction:column;width:100%';

    function renderStartpage() {
      startpage.innerHTML = '';
      const totalItems = bookmarkList.length + (APP.state.editMode ? 1 : 0);
      const cols = Math.max(2, Math.ceil(Math.sqrt(totalItems)));
      const rows = Math.ceil(totalItems / cols);
      const grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(' + cols + ',1fr);grid-template-rows:repeat(' + rows + ',1fr);gap:0;flex:1;width:100%;height:100%';
      bookmarkList.forEach((bm, i) => {
        const tile = document.createElement('div');
        tile.style.cssText = 'position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;background:rgba(255,255,255,0.05);border:0.5px solid rgba(255,255,255,0.08);transition:all .15s;overflow:hidden';
        tile.addEventListener('mouseenter', function() { this.style.background='rgba(255,255,255,0.12)'; });
        tile.addEventListener('mouseleave', function() { this.style.background='rgba(255,255,255,0.05)'; });
        const icon = document.createElement('img');
        try { icon.src = 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(new URL(bm.url).hostname) + '&sz=128'; } catch(e) {}
        icon.style.cssText = 'width:100%;height:100%;object-fit:contain;padding:15%;';
        icon.onerror = function() { this.style.display='none'; const fb=document.createElement('div'); fb.textContent='🌐'; fb.style.cssText='font-size:clamp(24px,40%,64px)'; tile.insertBefore(fb,lbl); };
        const lbl = document.createElement('div');
        lbl.style.cssText = 'position:absolute;bottom:0;left:0;right:0;font-size:10px;color:rgba(255,255,255,0.85);text-align:center;padding:3px 4px;background:rgba(0,0,0,0.5);overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
        lbl.textContent = bm.label;
        let clickTimer = null;
        tile.addEventListener('click', function(e) {
          e.stopPropagation();
          if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; return; }
          clickTimer = setTimeout(function() { clickTimer = null; navigate(bm.url); }, 300);
        });
        tile.addEventListener('dblclick', function(e) {
          e.stopPropagation();
          if (!APP.state.editMode) return;
          const newName = prompt('Name umbenennen:', bm.label);
          if (newName && newName.trim()) { bm.label = newName.trim(); APP.save(); renderStartpage(); }
        });
        tile.append(icon, lbl);
        if (APP.state.editMode) {
          const del = document.createElement('button');
          del.textContent = '✕';
          del.style.cssText = 'position:absolute;top:4px;right:4px;background:rgba(239,68,68,0.7);border:none;color:#fff;border-radius:50%;width:20px;height:20px;font-size:11px;cursor:pointer;display:none;line-height:1;z-index:2';
          tile.addEventListener('mouseenter', function() { del.style.display='block'; });
          tile.addEventListener('mouseleave', function() { del.style.display='none'; });
          del.addEventListener('click', function(ev) { ev.stopPropagation(); bookmarkList.splice(i,1); APP.save(); renderStartpage(); });
          tile.appendChild(del);
        }
        grid.appendChild(tile);
      });
      // Add-Tile
      if (APP.state.editMode) {
        const addTile = document.createElement('div');
        addTile.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:12px 4px;cursor:pointer;background:rgba(255,255,255,0.02);border:0.5px dashed rgba(255,255,255,0.15);transition:all .15s';
        addTile.innerHTML = '<div style="font-size:20px;color:rgba(255,255,255,0.3)">+</div><div style="font-size:9px;color:rgba(255,255,255,0.25)">Seite hinzufügen</div>';
        addTile.addEventListener('click', function(e) {
          e.stopPropagation();
          const raw = prompt('Webseite eingeben (z.B. wikipedia.de):');
          if (!raw) return;
          let url = raw.trim();
          if (!url.startsWith('http')) url = 'https://' + (url.startsWith('www.') ? '' : 'www.') + url;
          try {
            const host = new URL(url).hostname.replace('www.','');
            const name = host.split('.')[0];
            const label = name.charAt(0).toUpperCase() + name.slice(1);
            bookmarkList.push({ label: label, url: url });
          } catch(err) {
            bookmarkList.push({ label: url, url: url });
          }
          APP.save();
          renderStartpage();
        });
        grid.appendChild(addTile);
      }
      startpage.appendChild(grid);
    }


    const showStartpage = () => {
      startpage.style.display = 'flex';
      urlInp.value = '';
      renderStartpage();
    };

    const navigate = (url) => {
      let u = url.trim();
      if (!u) { showStartpage(); return; }
      if (!u.startsWith('http')) u = 'https://' + u;
      window.open(u, '_blank');
      urlInp.value = u;
    };

    goBtn.addEventListener('click', e => { e.stopPropagation(); navigate(urlInp.value); });
    body.append(bar, startpage);
    if (w.config.url) {
      navigate(w.config.url);
    } else {
      showStartpage();
    }
  },

  // ── Datei-Anzeige Widget ──
  files(w, body) {
    body.style.flexDirection = 'column';
    body.style.padding = '0';
    body.style.overflow = 'hidden';

    const file = w.config.fileData; // { name, type, data (base64 or text) }

    if (!file) {
      // Drop zone
      const zone = document.createElement('div');
      zone.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;cursor:pointer';
      zone.innerHTML = '<div style="font-size:36px">📂</div><div style="font-size:13px;color:rgba(255,255,255,0.6)">Datei hier ablegen oder klicken</div><div style="font-size:11px;color:rgba(255,255,255,0.3)">Bild · PDF · MP3 · Video · Text · und mehr</div>';

      const fileInp = document.createElement('input');
      fileInp.type = 'file';
      fileInp.accept = '*';
      fileInp.style.display = 'none';

      fileInp.addEventListener('change', () => {
        const f = fileInp.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = e => {
          w.config.fileData = { name: f.name, type: f.type, data: e.target.result };
          APP.save();
          renderWidgetContent(w, body);
        };
        if (f.type.startsWith('text/')) reader.readAsText(f);
        else reader.readAsDataURL(f);
      });

      zone.addEventListener('click', e => { e.stopPropagation(); fileInp.click(); });

      // Drag & Drop
      zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.background = 'rgba(99,102,241,0.2)'; });
      zone.addEventListener('dragleave', () => { zone.style.background = ''; });
      zone.addEventListener('drop', e => {
        e.preventDefault(); e.stopPropagation();
        zone.style.background = '';
        const f = e.dataTransfer.files[0];
        if (!f) return;
        fileInp.files = e.dataTransfer.files;
        fileInp.dispatchEvent(new Event('change'));
      });

      body.append(zone, fileInp);
      return;
    }

    // Header bar
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(0,0,0,0.3);flex-shrink:0;font-size:11.5px;';
    const fileIcon = document.createElement('span');
    fileIcon.style.opacity = '0.6';
    fileIcon.textContent = '📄';
    const fileName = document.createElement('span');
    fileName.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    fileName.textContent = file.name;
    header.append(fileIcon, fileName);
    const changeBtn = document.createElement('button');
    changeBtn.textContent = '↺ Andere Datei';
    changeBtn.style.cssText = 'border:none;background:rgba(255,255,255,0.1);color:#fff;border-radius:5px;padding:3px 8px;cursor:pointer;font-size:10.5px;flex-shrink:0';
    changeBtn.addEventListener('click', e => { e.stopPropagation(); w.config.fileData = null; APP.save(); renderWidgetContent(w, body); });
    header.appendChild(changeBtn);

    const viewer = document.createElement('div');
    viewer.style.cssText = 'flex:1;overflow:auto;display:flex;align-items:center;justify-content:center;background:#000;';

    if (file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = file.data;
      img.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain';
      viewer.appendChild(img);
    } else if (file.type === 'application/pdf') {
      const frame = document.createElement('iframe');
      frame.src = file.data;
      frame.style.cssText = 'width:100%;height:100%;border:none;';
      viewer.appendChild(frame);
    } else if (file.type.startsWith('video/')) {
      const vid = document.createElement('video');
      vid.src = file.data; vid.controls = true;
      vid.style.cssText = 'max-width:100%;max-height:100%';
      viewer.appendChild(vid);
    } else if (file.type.startsWith('audio/')) {
      const aud = document.createElement('audio');
      aud.src = file.data; aud.controls = true;
      aud.style.cssText = 'width:90%;margin:auto';
      viewer.appendChild(aud);
    } else if (file.type.startsWith('audio/') || file.name?.match(/\.(mp3|wav|ogg|aac|flac|m4a)$/i)) {
      const aud = document.createElement('audio');
      aud.src = file.data; aud.controls = true; aud.autoplay = false;
      aud.style.cssText = 'width:90%;margin:20px auto;display:block';
      viewer.style.background = 'linear-gradient(135deg,#1e1b4b,#312e81)';
      const lbl = document.createElement('div');
      lbl.style.cssText = 'color:rgba(255,255,255,0.6);font-size:13px;margin-bottom:8px;text-align:center';
      lbl.textContent = '🎵 ' + (file.name || 'Audio');
      viewer.append(lbl, aud);
    } else {
      // Binärdatei / Excel / Word / etc. → Download-Button
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px;padding:20px';
      const icon = document.createElement('div');
      icon.style.cssText = 'font-size:48px';
      const ext = (file.name||'').split('.').pop().toLowerCase();
      const icons = {xlsx:'📊',xls:'📊',docx:'📄',doc:'📄',pptx:'📋',ppt:'📋',zip:'📦',csv:'📊',pdf:'📕'};
      icon.textContent = icons[ext] || '📎';
      const name = document.createElement('div');
      name.style.cssText = 'color:rgba(255,255,255,0.8);font-size:13px;text-align:center;word-break:break-all';
      name.textContent = file.name || 'Datei';
      const dl = document.createElement('a');
      dl.href = file.data;
      dl.download = file.name || 'datei';
      dl.textContent = '⬇ Herunterladen';
      dl.style.cssText = 'background:rgba(99,102,241,0.8);color:#fff;padding:8px 20px;border-radius:8px;text-decoration:none;font-size:13px';
      wrap.append(icon, name, dl);
      viewer.style.background = '#111';
      viewer.appendChild(wrap);
    }

    body.append(header, viewer);
  },

  // ── Dice ──
  dice(w, body) {
    const FACES = ['','⚀','⚁','⚂','⚃','⚄','⚅'];
    body.style.flexDirection = 'column'; body.style.gap = '8px';
    const d = el('div','w-dice');
    d.style.fontSize = Math.max(40, Math.min(w.w * 0.65, w.h * 0.68)) + 'px';
    d.textContent = FACES[w.config.value || 1];
    d.title = 'Klicken zum Würfeln';
    const hint = el('div'); hint.style.cssText='font-size:11px;color:rgba(255,255,255,0.35)';
    hint.textContent = 'Klicken zum Würfeln';
    d.addEventListener('click', () => {
      let count = 0;
      const roll = setInterval(() => {
        const v = Math.ceil(Math.random()*6);
        d.textContent = FACES[v];
        if (++count >= 10) { clearInterval(roll); w.config.value = v; APP.save(); }
      }, 60);
    });
    body.append(d, hint);
  },

  // ── Random Number ──
  randomnum(w, body) {
    body.style.flexDirection = 'column'; body.style.gap = '8px';
    const display = el('div','w-randnum');
    display.style.fontSize = Math.max(32, Math.min(w.w * 0.52, w.h * 0.58)) + 'px';
    display.textContent = w.config.value ?? '?';
    const info = el('div'); info.style.cssText='font-size:11px;color:rgba(255,255,255,0.35)';
    info.textContent = `${w.config.min||1} – ${w.config.max||30}`;
    display.addEventListener('click', () => {
      const v = Math.floor(Math.random()*(((w.config.max||30)-(w.config.min||1))+1)) + (w.config.min||1);
      display.textContent = v;
      w.config.value = v;
      APP.save();
    });
    body.append(display, info);
  },

  // ── Groups ──
  groups(w, body) {
    const names = (w.config.names||'').split('\n').map(s=>s.trim()).filter(Boolean);
    const size = Math.max(1, w.config.size || 3);
    const shuffled = [...names].sort(()=>Math.random()-0.5);
    const grps = [];
    for (let i=0; i<shuffled.length; i+=size) grps.push(shuffled.slice(i,i+size));

    // Adaptive font: fill available space so names are readable from the back of the class
    const numGroups = Math.max(1, grps.length);
    const maxPerGroup = Math.max(1, Math.max(...grps.map(g => g.length)));
    // Available height: subtract btn (~36px) and header row (~1.4em per group-header)
    const headerPx = Math.max(14, w.h * 0.06);
    const availH = w.h - 44; // subtract shuffle-btn row
    // Each group card: header + names. Fit header + names into availH.
    // nameSz: fill height → availH / (maxPerGroup + 1.2 for header)
    const nameSzByH = availH / (maxPerGroup + 1.2);
    // nameSz: don't overflow width → (w.w / numGroups - 24) / ~5 chars avg
    const nameSzByW = (w.w / numGroups - 24) / 5.5;
    const nameSz = Math.max(16, Math.min(nameSzByH, nameSzByW, 120));
    const headSz = Math.max(12, nameSz * 0.42);

    const inner = el('div','groups-inner');
    const btn = el('button','w-action-btn'); btn.textContent = '🔀 Neu mischen'; btn.style.cssText='margin:0 auto 6px;display:block;flex-shrink:0';
    btn.addEventListener('click', () => renderWidgetContent(w, body));

    grps.forEach((g,i) => {
      const card = el('div','group-card');
      card.style.flex = '1';
      const h4 = document.createElement('h4');
      h4.style.fontSize = headSz + 'px';
      h4.style.marginBottom = Math.max(2, headSz * 0.3) + 'px';
      h4.textContent = 'Gruppe ' + (i+1);
      const ul = document.createElement('ul');
      ul.style.listStyle = 'none';
      ul.style.padding = '0';
      g.forEach(n => {
        const li=document.createElement('li');
        li.style.fontSize = nameSz + 'px';
        li.style.lineHeight = '1.15';
        li.style.fontWeight = '600';
        li.style.padding = '0';
        li.textContent=n;
        ul.appendChild(li);
      });
      card.append(h4, ul);
      inner.appendChild(card);
    });
    body.append(btn, inner);
  },

  // ── Agenda ──
  agenda(w, body) {
    const inner = el('div','agenda-inner');
    (w.config.items || []).forEach(item => {
      const row = el('div','agenda-item');
      const time = el('div','agenda-time'); time.textContent = item.time || '';
      const text = el('div','agenda-text'); text.textContent = item.text || '';
      row.append(time, text);
      inner.appendChild(row);
    });
    if (!(w.config.items||[]).length) {
      const hint = el('div'); hint.style.cssText='font-size:12px;color:rgba(255,255,255,0.3);padding:12px';
      hint.textContent = 'Agenda eintragen (⚙ Einstellungen)';
      inner.appendChild(hint);
    }
    if (APP.state.editMode) inner.addEventListener('dblclick', () => openAgendaEdit(w));
    body.appendChild(inner);
  },

  // ── Checklist ──
  checklist(w, body) {
    const inner = el('div','checklist-inner');
    const items = w.config.items || [];
    function renderItems() {
      inner.innerHTML = '';
      items.forEach((item, i) => {
        const row = el('div','checklist-item' + (item.done?' done':''));
        const cb = el('input'); cb.type='checkbox'; cb.checked=!!item.done;
        cb.addEventListener('change', () => {
          item.done = cb.checked;
          row.classList.toggle('done', item.done);
          APP.save();
        });
        const span = el('span'); span.textContent = item.text || '';
        row.append(cb, span);
        inner.appendChild(row);
      });
    }
    renderItems();
    if (APP.state.editMode) inner.addEventListener('dblclick', e => {
      if (e.target.tagName !== 'INPUT') openChecklistEdit(w, renderItems);
    });
    body.appendChild(inner);
  },

  // ── Phases ──
  phases(w, body) {
    const phases = w.config.phases || [];
    let activeIdx = w.config.activeIdx ?? -1;
    const inner = el('div','phases-inner');
    const items = [];

    phases.forEach((p, i) => {
      const row = el('div','phase-item');
      if (i === activeIdx) row.classList.add('active');
      row.style.background = p.color + '22';
      const dot = el('div','phase-dot'); dot.style.background = p.color;
      const name = el('div','phase-name'); name.textContent = p.name;
      const dur = el('div','phase-dur'); dur.textContent = p.minutes + ' min';
      row.append(dot, name, dur);
      row.addEventListener('click', () => {
        activeIdx = i;
        w.config.activeIdx = i;
        APP.save();
        items.forEach((r,j) => r.classList.toggle('active', j===i));
      });
      inner.appendChild(row);
      items.push(row);
    });
    body.appendChild(inner);
  },

  // ── Status ──
  status(w, body) {
    const STATUSES = [
      { emoji:'😕', label:'Ich brauche Hilfe', color:'#ef4444' },
      { emoji:'🤔', label:'Ich denke nach', color:'#f59e0b' },
      { emoji:'🙂', label:'Alles okay', color:'#22c55e' },
      { emoji:'😄', label:'Ich bin fertig!', color:'#6366f1' },
    ];
    let idx = w.config.statusIdx ?? 2;
    const inner = el('div','status-inner');
    const emojiEl = el('div','status-emoji');
    const labelEl = el('div','status-label');

    function update() {
      const s = STATUSES[idx];
      emojiEl.textContent = s.emoji;
      labelEl.textContent = s.label;
      inner.style.background = s.color + '22';
    }
    emojiEl.addEventListener('click', () => {
      idx = (idx+1) % STATUSES.length;
      w.config.statusIdx = idx;
      APP.save();
      update();
    });
    inner.append(emojiEl, labelEl);
    body.appendChild(inner);
    update();
  },
};

// ══════════════════════════════════════════════════════════════
// TIMETABLE / iCal
// ══════════════════════════════════════════════════════════════
