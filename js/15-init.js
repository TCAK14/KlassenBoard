'use strict';
function migrateLocalStorage() {
  const migrations = [
    ['klassenboard_classes', 'classpuls_classes'],
    ['klassenboard_current_class', 'classpuls_current_class'],
    ['klassenboard_visited', 'classpuls_visited'],
    ['kb_toolbar_prefs', 'kb_toolbar_prefs'],
  ];
  migrations.forEach(([oldKey, newKey]) => {
    if (oldKey === newKey) return;
    if (!localStorage.getItem(newKey) && localStorage.getItem(oldKey)) {
      localStorage.setItem(newKey, localStorage.getItem(oldKey));
      localStorage.removeItem(oldKey);
    }
  });
}

function init() {
  migrateLocalStorage();
  const loaded = APP.load();
  const isFirstVisit = !loaded && !localStorage.getItem('classpuls_visited');

  if (!loaded || APP.state.boards.length === 0) {
    const tpl = BUILT_IN_TEMPLATES[0];
    createBoard('Tafel 1', tpl.bg, tpl.widgets, true);
  } else {
    if (!APP.state.activeBoardId) APP.state.activeBoardId = APP.state.boards[0].id;
    renderAll();
  }
  // update edit mode button
  const btn = document.getElementById('edit-mode-btn');
  btn.textContent = APP.state.editMode ? '✏️ Edit' : '👁 Ansicht';
  btn.classList.toggle('active', APP.state.editMode);
  CLASSES.initUI();

  if (isFirstVisit) {
    localStorage.setItem('classpuls_visited', '1');
    setupDemo();
  }
}

function setupDemo() {
  CLASSES.create('Demo-Klasse 3a', true);

  APP.state.boards = [];
  APP.state.activeBoardId = null;

  // Tafel 1: Morgenstart
  createBoard('Morgenstart',
    { type:'gradient', value:'linear-gradient(135deg,#667eea,#764ba2)' },
    [
      { type:'clock',    x:30,  y:20,  w:240, h:140, config:{} },
      { type:'goal',     x:290, y:20,  w:340, h:120, config:{ text:'Die Schüler kennen die Planeten unseres Sonnensystems.' } },
      { type:'traffic',  x:650, y:20,  w:160, h:140, config:{ state:'green' } },
      { type:'agenda',   x:30,  y:180, w:300, h:260, config:{ items:[
        {time:'08:00', text:'Begrüßung & Morgenkreis'},
        {time:'08:15', text:'Sachunterricht: Planeten'},
        {time:'09:00', text:'Frühstückspause'},
        {time:'09:20', text:'Mathe: Einmaleins üben'},
        {time:'10:05', text:'Hofpause'},
        {time:'10:25', text:'Deutsch: Lesezeit'}
      ]}},
      { type:'homework', x:350, y:180, w:300, h:260, config:{ subject:'Hausaufgaben', items:[
        {text:'Sachbuch S. 34 lesen', done:false},
        {text:'Einmaleins-Blatt fertig', done:false},
        {text:'Lesebuch: Geschichte zu Ende lesen', done:false}
      ]}},
    ], true);

  // Tafel 2: Gruppenarbeit
  createBoard('Gruppenarbeit',
    { type:'gradient', value:'linear-gradient(135deg,#1a5c3a,#0f3d2e)' },
    [
      { type:'timer',   x:30,  y:20,  w:260, h:170, config:{ minutes:15 } },
      { type:'groups',  x:310, y:20,  w:340, h:240, config:{ names:'Emma\nLeon\nMia\nNoah\nSophie\nBen\nHanna\nLuca\nLina\nFinn\nEmilia\nPaul', size:3 } },
      { type:'phases',  x:30,  y:210, w:260, h:220, config:{ phases:[
        {name:'Aufgabe lesen', color:'#6366f1', minutes:3},
        {name:'Gruppenarbeit', color:'#22c55e', minutes:15},
        {name:'Ergebnisse vorstellen', color:'#f59e0b', minutes:10},
        {name:'Feedback', color:'#ec4899', minutes:5}
      ]}},
      { type:'text', x:310, y:280, w:340, h:100, config:{ text:'Arbeitet leise zusammen und notiert eure Ergebnisse auf dem Plakat.' } },
    ], true);

  // Tafel 3: Wochenplan
  createBoard('Wochenplan',
    { type:'gradient', value:'linear-gradient(135deg,#0093E9,#80D0C7)' },
    [
      { type:'clock',     x:30,  y:20,  w:200, h:120, config:{} },
      { type:'checklist', x:250, y:20,  w:320, h:300, config:{ items:[
        {text:'Mathe-Arbeitsblatt S. 12', done:true},
        {text:'Diktat üben (10 Wörter)', done:true},
        {text:'Sachunterricht: Steckbrief Tier', done:false},
        {text:'Lesetagebuch: 2 Seiten', done:false},
        {text:'Kunst: Bild fertigmalen', done:false}
      ]}},
      { type:'text', x:30, y:160, w:200, h:160, config:{ text:'Wochenplan KW 26\n\nArbeite die Aufgaben in deinem Tempo ab. Hake fertige Aufgaben ab.' } },
    ], true);

  APP.state.activeBoardId = APP.state.boards[0].id;
  APP.save();
  renderAll();
  toast('👋 Willkommen! Das ist eine Demo-Klasse zum Ausprobieren.');
}

// ══════════════════════════════════════════════════════════════
// STUDENT VOTING PAGE
// ══════════════════════════════════════════════════════════════
