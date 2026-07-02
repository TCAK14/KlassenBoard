'use strict';
const _pollParam = new URLSearchParams(window.location.search).get('poll');
if (_pollParam) {
  showVotingPage(_pollParam);
} else {
  AUTH.init();
  DRAW.init();
  applyToolbarPrefs();
  applyToolbarPosition(localStorage.getItem('kb_toolbar_pos') || 'top');
  init();
}
