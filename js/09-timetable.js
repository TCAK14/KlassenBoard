'use strict';
function renderTimetableEntries(inner, entries) {
  inner.innerHTML = '';
  const now = new Date();

  let current = null, upcoming = [];
  entries.forEach(e => {
    if (e.start <= now && e.end > now) { current = e; return; }
    if (e.start > now) upcoming.push(e);
  });
  upcoming = upcoming.slice(0,4);

  if (current) {
    const box = el('div','tt-now');
    const lbl = el('div','tt-label'); lbl.textContent = 'Jetzt';
    const subj = el('div','tt-subject');
    subj.classList.toggle('tt-cancelled', !!current.cancelled);
    subj.classList.toggle('tt-changed', !!current.changed);
    subj.textContent = current.subject;
    const meta = el('div','tt-meta');
    meta.textContent = fmtTime(current.start) + '–' + fmtTime(current.end) + (current.room ? ' · ' + current.room : '');
    box.append(lbl, subj, meta);
    if (current.changeNote) { const n=el('div','tt-meta'); n.style.color='#fbbf24'; n.textContent=current.changeNote; box.appendChild(n); }
    inner.appendChild(box);
  }

  if (upcoming.length) {
    const lbl = el('div','tt-label'); lbl.textContent = 'Als nächstes'; lbl.style.padding='4px 0 4px';
    inner.appendChild(lbl);
    const ul = el('ul','tt-next-list');
    upcoming.forEach(e => {
      const li = document.createElement('li');
      const time = el('span','tt-time'); time.textContent = fmtTime(e.start) + ' Uhr';
      const subj = el('span'); subj.textContent = e.subject;
      if (e.cancelled) subj.classList.add('tt-cancelled');
      if (e.changed) subj.classList.add('tt-changed');
      li.append(time, subj);
      ul.appendChild(li);
    });
    inner.appendChild(ul);
  }

  if (!current && !upcoming.length) {
    const d = el('div','tt-no-data'); d.textContent = 'Kein Unterricht gefunden';
    inner.appendChild(d);
  }
}

function fmtTime(dt) {
  return dt.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
}

function startTimetableRefresh(w) {
  const board = APP.activeBoard();
  if (!board) return;
  const cache = APP.icalCache[board.id];
  if (!cache?.url) return;
  // refresh every 5 min
  startInterval('ical_' + w.id, () => {
    fetchIcal(cache.url, board.id);
  }, 5*60*1000);
}

async function fetchIcal(url, boardId) {
  // Use a CORS proxy — for production, replace with your own /api/ical endpoint
  const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
  try {
    const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const text = await resp.text();
    const entries = parseIcal(text);
    APP.icalCache[boardId] = { url, entries, lastFetched: new Date().toISOString() };
    APP.save();
    // re-render timetable widgets on active board
    if (boardId === APP.state.activeBoardId) renderWidgets();
    toast('📅 Stundenplan aktualisiert (' + entries.length + ' Einträge)');
  } catch(e) {
    toast('⚠️ iCal-Fehler: ' + e.message);
  }
}

function parseIcal(text) {
  // Unfold lines (RFC 5545 §3.1)
  const unfolded = text.replace(/\r\n[ \t]/g,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  const lines = unfolded.split('\n');
  const events = [];
  let inEvent = false, props = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === 'BEGIN:VEVENT') { inEvent = true; props = {}; continue; }
    if (line === 'END:VEVENT') {
      inEvent = false;
      const entry = parseEvent(props);
      if (entry) events.push(entry);
      continue;
    }
    if (!inEvent) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).toUpperCase();
    const val = line.slice(colon + 1);
    props[key] = val;
  }

  // Sort by start time
  events.sort((a,b) => a.start - b.start);
  return events;
}

function parseEvent(props) {
  const dtstart = props['DTSTART'] || props['DTSTART;VALUE=DATE'] || findProp(props, 'DTSTART');
  const dtend   = props['DTEND']   || findProp(props, 'DTEND');
  if (!dtstart) return null;

  const start = parseIcalDate(dtstart);
  const end   = dtend ? parseIcalDate(dtend) : new Date(start.getTime() + 3600000);
  if (!start || isNaN(start)) return null;

  const summary = props['SUMMARY'] || '';
  const location = props['LOCATION'] || '';
  const status = props['STATUS'] || '';
  const desc = props['DESCRIPTION'] || '';
  const cancelled = status === 'CANCELLED' || summary.startsWith('CANCELLED:');
  const changed = desc.includes('Vertretung') || desc.includes('Geändert') || desc.includes('changed');

  return {
    uid: props['UID'] || '',
    subject: summary.replace(/^CANCELLED:/,'').replace(/\\n/g,' ').trim(),
    room: location.replace(/\\n/g,' ').trim(),
    start, end,
    cancelled,
    changed,
    changeNote: changed ? (desc.split('\\n')[0] || '').trim() : '',
  };
}

function findProp(props, key) {
  // Find a key that starts with key; e.g. DTSTART;TZID=...
  const found = Object.keys(props).find(k => k.startsWith(key + ';'));
  return found ? props[found] : undefined;
}

function parseIcalDate(str) {
  if (!str) return null;
  // Format: 20240101T080000Z or 20240101T080000 or 20240101
  const s = str.trim();
  if (s.length === 8) {
    return new Date(s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6,8)+'T00:00:00');
  }
  // with time
  const y=s.slice(0,4), mo=s.slice(4,6), d=s.slice(6,8);
  const h=s.slice(9,11), mi=s.slice(11,13), sec=s.slice(13,15);
  const utc = s.endsWith('Z');
  if (utc) return new Date(`${y}-${mo}-${d}T${h}:${mi}:${sec}Z`);
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${sec}`);
}

// ══════════════════════════════════════════════════════════════
// WIDGET SETTINGS MODALS
// ══════════════════════════════════════════════════════════════
