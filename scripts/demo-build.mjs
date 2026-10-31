// Samodzielne demo Employee Hub: prawdziwy build (dist) + nagrane odpowiedzi backendu w jednym pliku HTML (bez serwera, bez sieci).
// Użycie: node scripts/demo-build.mjs <katalog dist> <demo-hub.json> <plik wyjściowy .html> [zalogowany|logowanie] [start|grafik|czas|wnioski|wiecej]
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const [dist, dataPath, outPath, tryb = 'zalogowany', startTab = ''] = process.argv.slice(2);
// najnowszy plik każdego typu (katalog dist poza projektem nie jest czyszczony przez vite)
const assets = readdirSync(join(dist, 'assets')).sort((a, b) => statSync(join(dist, 'assets', b)).mtimeMs - statSync(join(dist, 'assets', a)).mtimeMs);
const js = readFileSync(join(dist, 'assets', assets.find((f) => /^index-.*\.js$/.test(f))), 'utf-8');
const css = readFileSync(join(dist, 'assets', assets.find((f) => /^index-.*\.css$/.test(f))), 'utf-8');
const data = JSON.parse(readFileSync(dataPath, 'utf-8'));
const b64 = (p) => 'data:image/svg+xml;base64,' + readFileSync(p).toString('base64');
const brand = {}; for (const f of readdirSync(join(dist, 'brand'))) brand['/brand/' + f] = b64(join(dist, 'brand', f));
const podmien = (s) => Object.entries(brand).reduce((acc, [k, v]) => acc.split(k).join(v), s);
const meta = data.__meta;
const mock = `
window.__ATMOSPHERE_DEMO__ = ${JSON.stringify({ dzis: meta.dzis, teraz: meta.teraz })};
(function () {
  // zegar demo: aplikacja „żyje” w dniu nagrania (${meta.teraz}), ale sekundy płyną normalnie
  const RealDate = Date; const off = new RealDate(${JSON.stringify(meta.teraz)}).getTime() - RealDate.now();
  class DemoDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + off); } static now() { return RealDate.now() + off; } }
  window.Date = DemoDate;
  const NAGRANIA = ${JSON.stringify(Object.fromEntries(Object.entries(data).filter(([k]) => k !== '__meta')))};
  try {
    ${tryb === 'zalogowany' ? `localStorage.setItem('rex_user', JSON.stringify(${JSON.stringify(meta.user)})); localStorage.setItem('rex_token', JSON.stringify(${JSON.stringify(meta.token)}));` : `localStorage.removeItem('rex_user'); localStorage.removeItem('rex_token'); localStorage.setItem('rex_creds', JSON.stringify({ login: ${JSON.stringify(meta.user.login)}, imie: ${JSON.stringify(meta.user.display)} }));`}
  } catch (e) {}
  ${startTab ? `if (!location.hash) location.hash = ${JSON.stringify('#' + startTab)};` : ''}
  const odp = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  // rejestracja czasu działa lokalnie: wejście → przerwa → wyjście (bez zapisu na serwerze)
  let stanHub = NAGRANIA['GET /clock?action=hub-state'] ? JSON.parse(JSON.stringify(NAGRANIA['GET /clock?action=hub-state'].body)) : { success: true, state: 'off', events: [], planned: null };
  const zdarzenie = (b) => { const ev = { cid: 'd' + Date.now(), type: b.action, at: Date.now(), paid: b.breakType === 'paid' }; stanHub.events = [...(stanHub.events || []), ev]; stanHub.state = b.action === 'clock_in' || b.action === 'break_end' ? 'working' : b.action === 'break_start' ? 'break' : 'off'; return { success: true, state: stanHub.state, events: stanHub.events, demo: true }; };
  window.fetch = async function (url, opts) {
    const u = String(url); const i = u.indexOf('/api/'); if (i < 0) return odp(404, { success: false, error: 'demo: brak sieci' });
    const pathq = u.slice(i + 4); const method = (opts && opts.method) || 'GET'; const klucz = method + ' ' + pathq;
    let body = {}; try { body = opts && opts.body ? JSON.parse(opts.body) : {}; } catch (e) {}
    if (klucz === 'GET /clock?action=hub-state') return odp(200, stanHub);
    if (klucz === 'POST /clock?action=hub-event') return odp(200, zdarzenie(body));
    if (NAGRANIA[klucz]) return odp(NAGRANIA[klucz].code, NAGRANIA[klucz].body);
    const kand = Object.keys(NAGRANIA).filter((k) => k.startsWith(method + ' ' + pathq.split('?')[0]));
    if (kand.length) return odp(NAGRANIA[kand[0]].code, NAGRANIA[kand[0]].body);
    if (method !== 'GET') return odp(200, { success: true, demo: true, info: 'Tryb demonstracyjny: zapis nie jest wykonywany.' });
    return odp(200, { success: true });
  };
})();
`;
const html = `<!DOCTYPE html>
<html lang="pl"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" /><title>Atmosphere Employee Hub — demo</title><meta name="theme-color" content="#132B46" />
<style>*{scrollbar-width:thin;scrollbar-color:#DCE3E9 transparent}::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-thumb{background:#DCE3E9;border-radius:8px}
.demo-badge{position:fixed;left:50%;bottom:calc(72px + env(safe-area-inset-bottom));z-index:9999;transform:translateX(-50%);font:600 11px/1 Inter,system-ui,sans-serif;color:#526270;background:rgba(255,255,255,.96);border:1px solid #DCE3E9;border-radius:999px;padding:6px 10px;letter-spacing:.04em;white-space:nowrap;pointer-events:none}
@media (min-width:821px){.demo-badge{left:auto;right:12px;bottom:12px;transform:none}}</style>
<style>${podmien(css)}</style>
<script>${mock}</script>
</head><body><div id="root"></div><div class="demo-badge">DEMO • ${meta.user.display} • ${meta.dzis} • zapis wyłączony</div>
<script type="module">${podmien(js)}</script>
</body></html>`;
writeFileSync(outPath, html);
console.log('demo:', outPath, Math.round(html.length / 1024), 'KB', '•', meta.user.display, '•', tryb);
