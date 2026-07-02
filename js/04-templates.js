'use strict';
const BUILT_IN_TEMPLATES = [
  {
    id:'tpl-morgen', name:'Morgenstart', emoji:'🌅',
    desc:'Uhr, Tagesplan, Stundenziel',
    bg:{ type:'gradient', value:'linear-gradient(135deg,#667eea,#764ba2)' },
    widgets:[
      { type:'clock',    x:20,  y:20,  w:220, h:130, config:{} },
      { type:'goal',     x:260, y:20,  w:320, h:110, config:{ text:'Heutiges Lernziel…' } },
      { type:'agenda',   x:20,  y:170, w:280, h:240, config:{ items:[{time:'08:00',text:'Begrüßung'},{time:'08:15',text:'Wiederholung'},{time:'08:30',text:'Neues Thema'}] } },
      { type:'homework', x:320, y:150, w:280, h:200, config:{ subject:'Hausaufgaben', items:[] } },
    ]
  },
  {
    id:'tpl-still', name:'Stillarbeit', emoji:'🤫',
    desc:'Timer, Ampel, Aufgabentext',
    bg:{ type:'gradient', value:'linear-gradient(135deg,#0f0c29,#302b63,#24243e)' },
    widgets:[
      { type:'timer',    x:20,  y:20,  w:260, h:180, config:{ minutes:20 } },
      { type:'traffic',  x:300, y:20,  w:180, h:120, config:{ state:'red' } },
      { type:'text',     x:20,  y:220, w:460, h:160, config:{ text:'Bearbeite die Aufgaben still und selbstständig.' } },
    ]
  },
  {
    id:'tpl-gruppe', name:'Gruppenarbeit', emoji:'👥',
    desc:'Timer, Gruppen, Phasen',
    bg:{ type:'gradient', value:'linear-gradient(135deg,#1a5c3a,#0f3d2e)' },
    widgets:[
      { type:'timer',   x:20,  y:20,  w:240, h:160, config:{ minutes:15 } },
      { type:'groups',  x:280, y:20,  w:300, h:220, config:{ names:'Anna\nBen\nClara\nDavid\nEva\nFinn', size:3 } },
      { type:'phases',  x:20,  y:200, w:240, h:200, config:{ phases:[{name:'Einführung',color:'#6366f1',minutes:5},{name:'Gruppenarbeit',color:'#22c55e',minutes:15},{name:'Präsentation',color:'#f59e0b',minutes:10},{name:'Reflexion',color:'#ec4899',minutes:5}] } },
    ]
  },
  {
    id:'tpl-klausur', name:'Klassenarbeit', emoji:'✍️',
    desc:'Timer, Stoppuhr, Ampel',
    bg:{ type:'color', value:'#0f172a' },
    widgets:[
      { type:'timer',     x:20,  y:20,  w:280, h:180, config:{ minutes:45 } },
      { type:'traffic',   x:320, y:20,  w:180, h:120, config:{ state:'red' } },
      { type:'stopwatch', x:320, y:160, w:220, h:160, config:{} },
      { type:'text',      x:20,  y:220, w:280, h:120, config:{ text:'Klassenarbeit – Bitte keine Hilfsmittel.' } },
    ]
  },
  {
    id:'tpl-vertretung', name:'Vertretungsstunde', emoji:'👋',
    desc:'Aufgabe, Namensrad, Würfel',
    bg:{ type:'gradient', value:'linear-gradient(135deg,#f093fb,#f5576c)' },
    widgets:[
      { type:'text',      x:20,  y:20,  w:400, h:140, config:{ text:'Bearbeite die Aufgaben auf dem Arbeitsblatt.\nBei Fragen meldet euch ruhig.' } },
      { type:'names',     x:440, y:20,  w:220, h:260, config:{ names:'Schüler 1\nSchüler 2\nSchüler 3\nSchüler 4\nSchüler 5' } },
      { type:'dice',      x:20,  y:180, w:160, h:140, config:{} },
    ]
  },
  {
    id:'tpl-tagesplan', name:'Tagesplan', emoji:'📅',
    desc:'Stundenplan, Uhr, Agenda',
    bg:{ type:'gradient', value:'linear-gradient(135deg,#0093E9,#80D0C7)' },
    widgets:[
      { type:'timetable', x:20,  y:20,  w:320, h:320, config:{ icalUrl:'', entries:[] } },
      { type:'clock',     x:360, y:20,  w:220, h:130, config:{} },
      { type:'agenda',    x:360, y:170, w:280, h:200, config:{ items:[] } },
    ]
  },
  {
    id:'tpl-hausaufgaben', name:'Hausaufgaben', emoji:'📚',
    desc:'Hausaufgaben, Checkliste',
    bg:{ type:'color', value:'#1e293b' },
    widgets:[
      { type:'homework',  x:20,  y:20,  w:300, h:280, config:{ subject:'Hausaufgaben', items:[] } },
      { type:'checklist', x:340, y:20,  w:280, h:240, config:{ items:[] } },
      { type:'text',      x:340, y:280, w:280, h:100, config:{ text:'Denk an dein Heft und die Materialien!' } },
    ]
  },
  {
    id:'tpl-reflexion', name:'Reflexion', emoji:'💬',
    desc:'Klassenstatus, Checkliste, Text',
    bg:{ type:'gradient', value:'linear-gradient(135deg,#a18cd1,#fbc2eb)' },
    widgets:[
      { type:'status',    x:20,  y:20,  w:220, h:180, config:{ statusIdx:2 } },
      { type:'checklist', x:260, y:20,  w:280, h:200, config:{ items:[{text:'Lernziel erreicht?',done:false},{text:'Aufgaben fertig?',done:false},{text:'Fragen beantwortet?',done:false}] } },
      { type:'text',      x:20,  y:220, w:520, h:120, config:{ text:'Was habe ich heute gelernt?' } },
    ]
  },
];

// ══════════════════════════════════════════════════════════════
// APP STATE
// ══════════════════════════════════════════════════════════════
