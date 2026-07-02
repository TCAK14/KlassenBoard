'use strict';
const REGISTRY = {
  clock:        { label:'Uhr',           emoji:'🕐', w:300, h:150 },
  timer:        { label:'Timer',         emoji:'⏱', w:280, h:200 },
  stopwatch:    { label:'Stoppuhr',      emoji:'⏲', w:280, h:200 },
  text:         { label:'Text',          emoji:'📝', w:320, h:200 },
  traffic:      { label:'Ampel',         emoji:'🚦', w:220, h:160 },
  qr:           { label:'QR-Code',       emoji:'📱', w:220, h:240 },
  names:        { label:'Namensrad',     emoji:'🎯', w:260, h:300 },
  homework:     { label:'Hausaufgaben',  emoji:'📚', w:300, h:240 },
  goal:         { label:'Stundenziel',   emoji:'🎯', w:400, h:140 },
  timetable:    { label:'Stundenplan',   emoji:'📅', w:320, h:300 },
  image:        { label:'Bild',          emoji:'🖼', w:300, h:220 },
  youtube:      { label:'YouTube',       emoji:'▶️', w:360, h:220 },
  dice:         { label:'Würfel',        emoji:'🎲', w:200, h:200 },
  randomnum:    { label:'Zufallszahl',   emoji:'🔢', w:260, h:200 },
  groups:       { label:'Gruppen',       emoji:'👥', w:340, h:280 },
  agenda:       { label:'Agenda',        emoji:'📋', w:300, h:260 },
  checklist:    { label:'Checkliste',    emoji:'✅', w:300, h:260 },
  phases:       { label:'Arbeitsphasen', emoji:'⏳', w:300, h:260 },
  status:       { label:'Klassenstatus', emoji:'😊', w:240, h:200 },
  browser:      { label:'Browser',      emoji:'🌐', w:600, h:450 },
  files:        { label:'Dateien',       emoji:'📂', w:500, h:400 },
  noise:        { label:'Lautstärke',    emoji:'🎤', w:260, h:220 },
  poll:         { label:'Live-Umfrage',  emoji:'📊', w:340, h:280 },
  ai:           { label:'KI-Assistent', emoji:'🤖', w:360, h:300 },
  ask:          { label:'Frag die KI',  emoji:'💬', w:360, h:320 },
  favorites:    { label:'Favoriten',     emoji:'⭐', w:400, h:300 },
};

const WIDGET_CATS = [
  { label:'Zeit',        types:['clock','timer','stopwatch'] },
  { label:'Unterricht',  types:['text','goal','homework','traffic','names'] },
  { label:'Tools',       types:['qr','dice','randomnum','groups','noise','poll'] },
  { label:'Planung',     types:['agenda','checklist','phases','status'] },
  { label:'Medien',      types:['youtube','files','browser','favorites'] },
  { label:'Stundenplan', types:['timetable'] },
];

// ══════════════════════════════════════════════════════════════
// TEMPLATES
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
// FREEMIUM LIMITS
// ══════════════════════════════════════════════════════════════
const FREE_LIMITS = { maxClasses: 1, maxBoards: 3 };

function isPro() {
  return !!AUTH.user;
}

function checkBoardLimit() {
  if (isPro()) return true;
  if (APP.state.boards.length >= FREE_LIMITS.maxBoards) {
    openUpgradeModal('boards');
    return false;
  }
  return true;
}

function checkClassLimit() {
  if (isPro()) return true;
  const count = CLASSES.list().length;
  if (count >= FREE_LIMITS.maxClasses) {
    openUpgradeModal('classes');
    return false;
  }
  return true;
}

function openUpgradeModal(reason) {
  const msgs = {
    boards: 'Im Kostenlos-Plan kannst du maximal ' + FREE_LIMITS.maxBoards + ' Tafeln erstellen.',
    classes: 'Im Kostenlos-Plan kannst du maximal ' + FREE_LIMITS.maxClasses + ' Klasse erstellen.',
  };
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:420px;text-align:center">
      <button class="modal-close" style="position:absolute;top:12px;right:12px">&times;</button>
      <div style="font-size:48px;margin-bottom:14px">🔒</div>
      <h2 style="margin-bottom:8px">Upgrade auf Pro</h2>
      <p style="font-size:14px;color:rgba(255,255,255,0.6);margin-bottom:20px;line-height:1.6">
        ${msgs[reason] || 'Diese Funktion ist nur im Pro-Plan verfügbar.'}<br>
        Mit Pro bekommst du unbegrenzte Klassen, Tafeln, KI-Assistent und mehr.
      </p>
      <div style="display:flex;gap:10px">
        <button class="btn-secondary" style="flex:1" onclick="this.closest('.modal-overlay').remove()">Später</button>
        <a href="landing.html#preise" class="btn-primary" style="flex:1;text-align:center;text-decoration:none;display:flex;align-items:center;justify-content:center">Ab 2,50 €/Monat →</a>
      </div>
    </div>`;
  overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

