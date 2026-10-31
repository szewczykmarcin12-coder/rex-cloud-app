// Nagranie odpowiedzi backendu dla JEDNEGO pracownika (październik 2026) do samodzielnego demo Employee Hub.
// Dane: rex-cloud-admin/scripts/demo-seed.mjs (te same co w demo Studio). Uruchomienie: node scripts/demo-record.mjs > /tmp/demo-hub.json
import { seedDemo } from '../../rex-cloud-admin/scripts/demo-seed.mjs';
const { call, callAs, accounts, WZ, DZIS, signSession } = await seedDemo();

// pracownik demo: CREW z dyspozycjami na listopad (pierwsze 14 kont CREW), ze zmianą dziś zaczynającą się po 11:40 i zmianą jutro
const jutro = new Date(DZIS + 'T12:00:00Z'); jutro.setUTCDate(jutro.getUTCDate() + 1); const JUTRO = jutro.toISOString().slice(0, 10);
const crew = accounts.filter((a) => a.funkcja === 'CREW').slice(0, 14);
const maZmiane = (a, d, od) => WZ.shifts.some((s) => s.name === a.name && s.date === d && (!od || s.start >= od));
const prac = crew.find((a) => maZmiane(a, DZIS, '12:00') && maZmiane(a, JUTRO)) || crew.find((a) => maZmiane(a, DZIS, '12:00')) || crew[0];
const tok = await signSession({ role: 'pracownik', accountId: prac.id, name: prac.name, grafikName: prac.grafikName, login: prac.login });

// wrzesień i październik opublikowane (wzorzec z pliku restauracji ma naruszenia KP → publikacja z uzasadnieniem ASM, jak w praktyce);
// pracownik ma październik jeszcze nie potwierdzony
for (const m of ['2026-09', '2026-10']) { const r = await call('POST', '/schedule?action=publish', { month: m, force: true, reason: 'Demo: grafik z pliku restauracji, naruszenia znane i omówione z zespołem.' }); if (!r.body || !r.body.success) throw new Error(`publikacja ${m}: ${JSON.stringify(r.body).slice(0, 200)}`); }

const out = {};
const rec = async (method, p, body) => { const r = await callAs(tok, method, p, body); out[`${method} ${p}`] = r; return r.body; };
for (const p of [`/schedule?accountId=${encodeURIComponent(prac.id)}`, '/schedule?month=2026-10', '/schedule?month=2026-09', '/schedule?month=2026-11', '/swaps', '/clock?action=hub-state', '/org', '/availability?reqs=1', '/availability?window=1', '/absences']) await rec('GET', p);
// logowanie w demo: dowolne hasło → to konto (prawdziwy backend sprawdza skrót PIN-u)
out['POST /accounts?action=auth'] = { code: 200, body: { success: true, account: { id: prac.id, name: prac.name, grafikName: prac.grafikName, login: prac.login, mustChange: false }, token: tok } };
out.__meta = { dzis: DZIS, teraz: `${DZIS}T11:40:00`, token: tok, user: { id: prac.id, name: prac.grafikName || prac.name, display: prac.name, login: prac.login }, nagrania: Object.keys(out).length };
process.stdout.write(JSON.stringify(out));
