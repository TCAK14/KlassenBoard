// Öffnet eine Testseite in einem unsichtbaren Edge (echte Zeit, echtes Netz), wartet bis document.title === 'fertig'
// und gibt den Text von #out aus. Aufruf: node cdp_run.mjs <url> [Sekunden] [bildschirmfoto.png]
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const [url, secs = '90', shot] = process.argv.slice(2);
const sp = process.env.TEMP || process.env.TMPDIR || '.';
const port = 9300 + Math.floor(Math.random() * 400);
const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--user-data-dir=' + sp + '\\edge-cdp-' + port, '--remote-debugging-port=' + port, '--window-size=1400,900',
  '--use-fake-ui-for-media-stream', 'about:blank',
], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id; pending.set(i, { res, rej });
  ws.send(JSON.stringify({ id: i, method, params }));
});
try {
  let target = null;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(500);
    try {
      const list = await (await fetch('http://127.0.0.1:' + port + '/json')).json();
      target = list.find(t => t.type === 'page');
    } catch (e) {}
  }
  if (!target) throw new Error('Edge nicht erreichbar');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('WebSocket')); });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
  };
  await send('Page.enable');
  await send('Page.navigate', { url });
  const end = Date.now() + Number(secs) * 1000;
  let out = '', title = '';
  while (Date.now() < end) {
    await sleep(1000);
    try {
      const r = await send('Runtime.evaluate', { expression: "document.title + '\\u0001' + ((document.getElementById('out') || {}).textContent || '')", returnByValue: true });
      [title, out] = String(r.result.value || '').split('\u0001');
      if (title === 'fertig') break;
    } catch (e) {}
  }
  if (shot) {
    const s = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(shot, Buffer.from(s.data, 'base64'));
  }
  console.log(title === 'fertig' ? '' : 'ZEIT ABGELAUFEN (Stand: ' + title + ')');
  if (out.startsWith('ERGEBNIS ')) {
    const o = JSON.parse(out.slice(9));
    for (const [k, v] of Object.entries(o)) console.log(k + ' = ' + (typeof v === 'string' ? v : JSON.stringify(v)));
  } else console.log(out);
} catch (e) {
  console.log('FEHLER ' + e.message);
} finally {
  try { ws && ws.close(); } catch (e) {}
  edge.kill();
  spawn('taskkill', ['/F', '/T', '/PID', String(edge.pid)], { stdio: 'ignore' });
}
