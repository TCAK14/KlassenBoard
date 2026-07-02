'use strict';
const TOOLBAR_ITEMS = [
  { id:'template',  label:'📋 Vorlage',      default:true },
  { id:'bg',        label:'🎨 Hintergrund',   default:true },
  { id:'ical',      label:'📅 Stundenplan',   default:true },
  { id:'export',    label:'💾 Export',        default:true },
  { id:'voice',     label:'🎙️ Sprache',       default:true },
  { id:'draw',      label:'🖊 Zeichnen',      default:true },
  { id:'editmode',  label:'✏️ Edit-Modus',    default:true },
  { id:'fullscreen',label:'⤢ Vollbild',       default:true },
  ...Object.entries(REGISTRY).map(([type, reg]) => ({
    id: 'qadd-' + type,
    label: reg.emoji + ' + ' + reg.label,
    default: false,
    widgetType: type,
  })),
];

// Create quick-add widget buttons in toolbar
(function initWidgetToolbarButtons() {
  const sep = document.getElementById('btn-add-widget');
  Object.entries(REGISTRY).forEach(([type, reg]) => {
    const btn = document.createElement('button');
    btn.className = 'tb-icon-btn tb-item';
    btn.dataset.tbid = 'qadd-' + type;
    btn.title = reg.label + ' hinzufügen';
    btn.textContent = reg.emoji;
    btn.style.display = 'none';
    btn.addEventListener('click', () => {
      const board = APP.activeBoard();
      if (!board) return;
      APP.snapshotUndo();
      board.widgets.push({
        id: 'w_' + Date.now(), type,
        x: 40 + Math.random()*200, y: 80 + Math.random()*150,
        w: reg.w, h: reg.h, config: {}, createdAt: new Date().toISOString()
      });
      APP.save(); renderWidgets();
      toast('✅ ' + reg.label + ' hinzugefügt');
    });
    sep.parentNode.insertBefore(btn, sep);
  });
})();

function getToolbarPrefs() {
  try { return JSON.parse(localStorage.getItem('kb_toolbar_prefs') || 'null'); } catch { return null; }
}
function saveToolbarPrefs(prefs) {
  localStorage.setItem('kb_toolbar_prefs', JSON.stringify(prefs));
}
function applyToolbarPosition(pos) {
  const tb = document.getElementById('toolbar');
  const board = document.getElementById('board');
  if (!tb || !board) return;
  tb.removeAttribute('data-pos');
  board.style.top = ''; board.style.bottom = ''; board.style.left = ''; board.style.right = '';
  tb.style.cssText = '';

  // Remove vertical class
  tb.classList.remove('toolbar-vertical');
  document.querySelectorAll('#toolbar .tb-btn').forEach(b => b.style.fontSize = '');
  const logo = document.getElementById('logo');
  const logoText = document.getElementById('logo-text');
  const boardTabs = document.getElementById('board-tabs');
  const classSwitcher = document.getElementById('class-switcher');
  const addBoardBtn = document.getElementById('add-board-btn');
  const authArea = document.getElementById('auth-area');

  if (pos === 'bottom') {
    tb.dataset.pos = 'bottom';
    tb.style.cssText = 'position:fixed;bottom:0;left:0;right:0;top:auto;height:var(--toolbar-h);display:flex;align-items:center;gap:8px;padding:0 12px;z-index:99999;user-select:none;pointer-events:all;background:rgba(0,0,0,0.4);backdrop-filter:blur(16px);border-top:1px solid var(--glass-border);overflow-x:auto;scrollbar-width:none';
    board.style.top = '0';
    board.style.bottom = 'var(--toolbar-h)';
  } else if (pos === 'autohide') {
    tb.dataset.pos = 'autohide';
    const side = localStorage.getItem('kb_toolbar_side') || 'top';
    const isBottom = side === 'bottom';
    board.style.top = '0'; board.style.bottom = '0';
    if (isBottom) {
      tb.style.cssText = 'position:fixed;bottom:0;left:0;right:0;top:auto;height:var(--toolbar-h);display:flex;align-items:center;gap:8px;padding:0 12px;z-index:99999;user-select:none;pointer-events:all;background:rgba(0,0,0,0.6);backdrop-filter:blur(16px);border-top:1px solid var(--glass-border);overflow-x:auto;scrollbar-width:none;transform:translateY(100%);transition:transform .25s ease';
    } else {
      tb.style.cssText = 'position:fixed;top:0;left:0;right:0;height:var(--toolbar-h);display:flex;align-items:center;gap:8px;padding:0 12px;z-index:99999;user-select:none;pointer-events:all;background:rgba(0,0,0,0.6);backdrop-filter:blur(16px);border-bottom:1px solid var(--glass-border);overflow-x:auto;scrollbar-width:none;transform:translateY(-100%);transition:transform .25s ease';
    }
    let pullTab = document.getElementById('tb-pull-tab');
    if (pullTab) pullTab.remove();
    pullTab = document.createElement('div');
    pullTab.id = 'tb-pull-tab';
    if (isBottom) {
      pullTab.style.cssText = 'position:fixed;bottom:0;left:50%;transform:translateX(-50%);z-index:99998;cursor:pointer;background:rgba(99,102,241,0.5);border-radius:10px 10px 0 0;padding:2px 20px;font-size:10px;color:rgba(255,255,255,0.7);transition:all .2s;backdrop-filter:blur(8px)';
      pullTab.textContent = '▲ Leiste';
    } else {
      pullTab.style.cssText = 'position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:99998;cursor:pointer;background:rgba(99,102,241,0.5);border-radius:0 0 10px 10px;padding:2px 20px;font-size:10px;color:rgba(255,255,255,0.7);transition:all .2s;backdrop-filter:blur(8px)';
      pullTab.textContent = '▼ Leiste';
    }
    document.body.appendChild(pullTab);
    let tbVisible = false;
    pullTab.addEventListener('click', function() {
      tbVisible = !tbVisible;
      if (isBottom) {
        tb.style.transform = tbVisible ? 'translateY(0)' : 'translateY(100%)';
        pullTab.textContent = tbVisible ? '▼ Leiste' : '▲ Leiste';
        pullTab.style.bottom = tbVisible ? 'var(--toolbar-h)' : '0';
      } else {
        tb.style.transform = tbVisible ? 'translateY(0)' : 'translateY(-100%)';
        pullTab.textContent = tbVisible ? '▲ Leiste' : '▼ Leiste';
        pullTab.style.top = tbVisible ? 'var(--toolbar-h)' : '0';
      }
    });
    board.addEventListener('click', function hideHandler() {
      if (tb.dataset.pos === 'autohide' && tbVisible) {
        tbVisible = false;
        tb.style.transform = isBottom ? 'translateY(100%)' : 'translateY(-100%)';
        pullTab.textContent = isBottom ? '▲ Leiste' : '▼ Leiste';
        if (isBottom) pullTab.style.bottom = '0'; else pullTab.style.top = '0';
      }
    });
    pullTab.style.display = 'block';
  } else {
    if (logo) logo.style.display = '';
    if (logoText) logoText.style.display = '';
    if (boardTabs) { boardTabs.style.display = ''; boardTabs.style.flexDirection = ''; boardTabs.style.flex = ''; boardTabs.style.overflow = ''; }
    if (classSwitcher) classSwitcher.style.display = '';
    if (addBoardBtn) addBoardBtn.style.display = '';
    if (authArea) authArea.style.display = '';
    document.querySelectorAll('#toolbar .tb-btn').forEach(b => { b.style.fontSize = ''; b.style.padding = ''; b.style.width = ''; });
    document.querySelectorAll('#toolbar .tb-icon-btn').forEach(b => { b.style.width = ''; });
    board.style.top = 'var(--toolbar-h)';
    board.style.transition = '';
    tb.style.transform = '';
    const colBtn = document.getElementById('tb-collapse-btn');
    if (colBtn) colBtn.remove();
    const hoverZone = document.getElementById('tb-hover-zone');
    if (hoverZone) hoverZone.style.display = 'none';
    const pullTab = document.getElementById('tb-pull-tab');
    if (pullTab) pullTab.style.display = 'none';
  }
}

function applyToolbarPrefs() {
  const prefs = getToolbarPrefs();
  TOOLBAR_ITEMS.forEach(item => {
    const el = document.querySelector(`[data-tbid="${item.id}"]`);
    if (!el) return;
    const visible = prefs ? (item.id in prefs ? prefs[item.id] : item.default) : item.default;
    el.style.display = visible ? '' : 'none';
  });
}

function openToolbarCustomizer() {
  document.getElementById('tb-customize-panel')?.remove();
  const prefs = getToolbarPrefs() || {};
  const panel = document.createElement('div');
  panel.id = 'tb-customize-panel';
  panel.style.cssText = 'position:fixed;top:56px;right:12px;z-index:9990;background:rgba(18,18,38,0.97);border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:16px 18px;min-width:220px;max-height:calc(100vh - 80px);overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,0.6);backdrop-filter:blur(12px);scrollbar-width:thin;';
  panel.innerHTML = '<div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:12px;letter-spacing:0.3px">⚙ Leiste anpassen</div>';

  // Toolbar position selector
  const posRow = document.createElement('div');
  posRow.style.cssText = 'display:flex;gap:4px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08)';
  const currentPos = localStorage.getItem('kb_toolbar_pos') || 'top';
  [{id:'top',icon:'↑ Oben'},{id:'bottom',icon:'↓ Unten'},{id:'autohide',icon:'👁 Auto-Hide'}].forEach(p => {
    const b = document.createElement('button');
    b.textContent = p.icon;
    b.title = p.icon;
    b.style.cssText = 'flex:1;padding:6px;border-radius:8px;border:1px solid ' + (currentPos === p.id ? '#6366f1' : 'rgba(255,255,255,0.1)') + ';background:' + (currentPos === p.id ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)') + ';color:#fff;font-size:14px;cursor:pointer';
    b.addEventListener('click', function() {
      if (p.id === 'top' || p.id === 'bottom') localStorage.setItem('kb_toolbar_side', p.id);
      localStorage.setItem('kb_toolbar_pos', p.id);
      applyToolbarPosition(p.id);
      panel.remove();
      openToolbarCustomizer();
    });
    posRow.appendChild(b);
  });
  panel.appendChild(posRow);

  TOOLBAR_ITEMS.forEach(item => {
    const visible = prefs[item.id] !== false;
    const row = document.createElement('label');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;cursor:pointer;padding:6px 4px;border-radius:8px;transition:.15s;';
    row.innerHTML = `
      <span style="flex:1;font-size:13px;color:rgba(255,255,255,0.85)">${item.label}</span>
      <span class="tb-cust-toggle ${visible ? 'on' : ''}" data-id="${item.id}" style="
        width:36px;height:20px;border-radius:10px;position:relative;cursor:pointer;
        background:${visible ? '#6366f1' : 'rgba(255,255,255,0.12)'};transition:.2s;flex-shrink:0;display:inline-block">
        <span style="position:absolute;top:2px;left:${visible ? '18px' : '2px'};width:16px;height:16px;border-radius:50%;background:#fff;transition:.2s;"></span>
      </span>`;
    row.querySelector('.tb-cust-toggle').addEventListener('click', e => {
      e.preventDefault();
      const tog = e.currentTarget;
      const id = tog.dataset.id;
      const nowOn = !tog.classList.contains('on');
      tog.classList.toggle('on', nowOn);
      tog.style.background = nowOn ? '#6366f1' : 'rgba(255,255,255,0.12)';
      tog.querySelector('span').style.left = nowOn ? '18px' : '2px';
      const newPrefs = getToolbarPrefs() || {};
      newPrefs[id] = nowOn;
      saveToolbarPrefs(newPrefs);
      applyToolbarPrefs();
    });
    panel.appendChild(row);
  });

  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'Zurücksetzen';
  resetBtn.style.cssText = 'margin-top:12px;width:100%;border:none;background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);border-radius:8px;padding:7px;cursor:pointer;font-size:12px;';
  resetBtn.addEventListener('click', () => {
    localStorage.removeItem('kb_toolbar_prefs');
    applyToolbarPrefs();
    panel.remove();
    openToolbarCustomizer();
  });
  panel.appendChild(resetBtn);

  document.body.appendChild(panel);
  document.addEventListener('pointerdown', function outside(ev) {
    if (!panel.contains(ev.target) && ev.target.id !== 'btn-customize-toolbar') {
      panel.remove();
      document.removeEventListener('pointerdown', outside);
    }
  });
}

// ══════════════════════════════════════════════════════════════
// TOOLBAR GUARDIAN — auto-removes any element blocking the toolbar
// ══════════════════════════════════════════════════════════════
setInterval(() => {
  const safe = new Set(['toolbar','board','board-bg','widgets-layer','toast','ki-fab','ki-panel','draw-canvas','draw-toolbar','draw-text-input']);
  document.querySelectorAll('body > *').forEach(el => {
    if (safe.has(el.id)) return;
    if (el.classList.contains('modal-overlay')) return;
    if (el.closest('.modal-overlay')) return;
    if (el.id === 'rename-modal-overlay') return;
    if (el.id === 'tb-customize-panel') return;
    if (el.id === 'widget-menu') return;
    if (el.id === 'voting-page') return;
    const r = el.getBoundingClientRect();
    const s = window.getComputedStyle(el);
    if (r.top <= 0 && r.height > 40 && r.width > 200 && s.display !== 'none') {
      console.warn('[KB] Blocking element removed:', el.id || el.className);
      el.remove();
    }
  });
}, 500);

// ══════════════════════════════════════════════════════════════
// STARTUP
// ══════════════════════════════════════════════════════════════
