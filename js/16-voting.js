'use strict';
async function showVotingPage(pollId) {
  // Supabase-Client ohne Auth initialisieren
  if (!AUTH.client && !SUPABASE_URL.includes('DEINE')) {
    AUTH.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  const page = document.createElement('div'); page.id = 'voting-page';
  const logo = document.createElement('div');
  logo.style.cssText = 'font-size:22px;font-weight:800;color:#fff;margin-bottom:28px;letter-spacing:-0.5px;';
  logo.innerHTML = '<span style="color:#818cf8">Class</span>Puls';
  const card = document.createElement('div'); card.className = 'voting-card';
  card.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,0.4);padding:20px;">Lade Umfrage…</div>';
  page.append(logo, card);
  document.body.appendChild(page);

  // Bereits abgestimmt?
  if (sessionStorage.getItem('voted_'+pollId)) {
    card.innerHTML = '<div style="text-align:center;padding:10px;"><div style="font-size:52px;margin-bottom:14px">✅</div><div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:8px">Danke für deine Stimme!</div><div style="font-size:13px;color:rgba(255,255,255,0.4)">Du hast bereits abgestimmt.</div></div>';
    return;
  }
  if (!AUTH.client) {
    card.innerHTML = '<div style="color:#f87171;text-align:center;padding:20px;">Umfrage nicht verfügbar.</div>';
    return;
  }

  const { data: poll } = await AUTH.client.from('polls').select('*').eq('id', pollId).maybeSingle();
  if (!poll) {
    card.innerHTML = '<div style="color:#f87171;text-align:center;padding:20px;">Umfrage nicht gefunden oder bereits beendet.</div>';
    return;
  }

  const COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444'];
  const options = poll.options.filter(o => o.trim());
  card.innerHTML = `<div class="voting-q">${safeText(poll.question)}</div><div id="v-opts"></div>`;
  const optsEl = card.querySelector('#v-opts');

  options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'voting-opt';
    btn.style.borderColor = COLORS[i%4]+'55';
    btn.style.background  = COLORS[i%4]+'18';
    btn.textContent = opt;
    btn.addEventListener('mouseover', () => { btn.style.background = COLORS[i%4]+'35'; });
    btn.addEventListener('mouseout',  () => { btn.style.background = COLORS[i%4]+'18'; });
    btn.addEventListener('click', async () => {
      optsEl.querySelectorAll('button').forEach(b => b.disabled = true);
      btn.style.borderColor = COLORS[i%4];
      btn.style.background  = COLORS[i%4]+'40';
      const { error } = await AUTH.client.from('poll_votes').insert({ poll_id: pollId, option_index: i });
      if (error) {
        card.innerHTML = '<div style="color:#f87171;text-align:center;padding:20px;">Fehler beim Abstimmen. Bitte Seite neu laden.</div>';
        return;
      }
      sessionStorage.setItem('voted_'+pollId, '1');
      card.innerHTML = `
        <div style="text-align:center;padding:16px;">
          <div style="font-size:56px;margin-bottom:14px">✅</div>
          <div style="font-size:20px;font-weight:700;color:#fff;margin-bottom:8px">Danke!</div>
          <div style="font-size:13px;color:rgba(255,255,255,0.45);margin-bottom:16px">Deine Stimme wurde gezählt.</div>
          <div style="display:inline-block;padding:8px 18px;background:${COLORS[i%4]}25;border:1px solid ${COLORS[i%4]}55;border-radius:10px;color:${COLORS[i%4]};font-weight:600;">${safeText(opt)}</div>
        </div>`;
    });
    optsEl.appendChild(btn);
  });
}

// ══════════════════════════════════════════════════════════════
// KLASSEN-VERWALTUNG
// ══════════════════════════════════════════════════════════════
