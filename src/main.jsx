import './atmosphere-tokens.css';   // Atmosphere: jedyne źródło kolorów — ładowane pierwsze
import './atmosphere-hub.css';      // Employee Hub v16.1 — jeden arkusz na tokenach (Smoky Blue + Apple HIG)
import { stationFamily, stationInk, stationFill, stationAccent } from './stations.js';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { Calendar, Home, Clock3, Menu, X, ChevronLeft, ChevronRight, LogOut, Info, Lock, CalendarCheck2, Timer, MessageSquare, Check, LogIn, Coffee, History, Bell, MapPin, Eye, EyeOff, Users, ShieldCheck, ArrowRight, RefreshCw, Briefcase } from 'lucide-react';

// ===================== KONFIGURACJA =====================
const API_BASE = String(import.meta.env.VITE_API_BASE || 'https://rex-cloud-backend.vercel.app/api').replace(/\/$/, '');
let DEFAULT_LOCATION = 'Popeyes PLK Kraków Galeria Krakowska';   // nadpisywane z /api/org po zalogowaniu

// ── stanowiska: te same rodziny co w Studio i PDF (stations.js = kopia lib/stations.js, pilnowana testem) ──
const rolaSzk = (s) => {
  const r = (s.rola || '').toLowerCase();
  if (r === 'instruktor' || r === 'training') return r;
  const st = (s.station || '').toLowerCase();
  if (st === 'instruktor' || st === 'training') return st;
  return null;
};
const nazwaStanowiska = (s) => {
  const u = (s.station || '').toLowerCase();
  if (u === 'training') return 'Szkolenie';
  if (u === 'instruktor') return 'Szkolenie (instruktor)';
  return s.szkoli ? `${s.station} · szkoli` : s.station;
};
// Instruktor ma w grafiku dwa wiersze na te same godziny (stacja + „instruktor”) — w aplikacji to JEDNA zmiana z dopiskiem.
const minOf = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
const nachodza = (a, b) => { let a1 = minOf(a.start), a2 = minOf(a.end); if (a2 <= a1) a2 += 1440; let b1 = minOf(b.start), b2 = minOf(b.end); if (b2 <= b1) b2 += 1440; return a1 < b2 && b1 < a2; };
const scalZmiany = (arr) => {
  const zwykle = [], instr = [];
  (arr || []).forEach((s) => (rolaSzk(s) === 'instruktor' ? instr : zwykle).push(s));
  const out = zwykle.map((s) => ({ ...s }));
  instr.forEach((i) => {
    const para = out.find((s) => s.date === i.date && String(s.name).toUpperCase().trim() === String(i.name).toUpperCase().trim() && nachodza(s, i));
    if (para) { para.szkoli = true; para.partnerSzk = i.partner || i.uczen || null; } else out.push({ ...i, szkoli: true, station: i.station });
  });
  return out;
};

const monthNames = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
const monthNamesGen = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
const dniPelne = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
const fmtDzien = (iso, opts = { weekday: 'short', day: 'numeric', month: 'long' }) => new Intl.DateTimeFormat('pl-PL', opts).format(new Date(iso + 'T12:00:00'));
const fmtH = (h) => Number(h || 0).toFixed(1).replace('.', ',');

const saveToStorage = (k, d) => { try { localStorage.setItem(k, JSON.stringify(d)); } catch {} };
const loadFromStorage = (k, def = null) => { try { const d = localStorage.getItem(k); return d ? JSON.parse(d) : def; } catch { return def; } };
const getTodayString = () => { const t = new Date(); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };

// SEC-01: każde wywołanie z tokenem sesji; 401 przy ważnym tokenie = wygaśnięcie → wylogowanie
const authHeaders = () => { const t = loadFromStorage('rex_token', null); return t ? { Authorization: `Bearer ${t}` } : {}; };
const obsluz401 = (r) => { if (r.status === 401 && loadFromStorage('rex_token', null)) { try { localStorage.removeItem('rex_token'); localStorage.removeItem('rex_user'); location.reload(); } catch {} } return r; };
const api = async (path) => { const r = obsluz401(await fetch(`${API_BASE}${path}`, { headers: { ...authHeaders() } })); return r.json(); };
const apiSend = async (path, method, body) => { const r = obsluz401(await fetch(`${API_BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: body ? JSON.stringify(body) : undefined })); return r.json(); };

const normalizeName = (n) => (n || '').toString().trim().toUpperCase().replace(/\s+/g, ' ')
  .replace(/Ą/g, 'A').replace(/Ć/g, 'C').replace(/Ę/g, 'E').replace(/Ł/g, 'L').replace(/Ń/g, 'N').replace(/Ó/g, 'O').replace(/Ś/g, 'S').replace(/Ź/g, 'Z').replace(/Ż/g, 'Z');

// ── giełda zamian ──
const dfmtSw = (ds) => { const d = new Date(ds + 'T12:00:00'); const dni = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb']; return `${dni[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`; };
const opisZmiany = (s) => `${dfmtSw(s.date)} · ${s.station} · ${s.start}–${s.end} (${s.hours}h)`;
// status zamiany = ton semantyczny (ten sam słownik co w Studio): ok / warn / bad / neutral / info
const statusZamiany = (s) => {
  if (s.status === 'approved') return { txt: `Zatwierdzona — przejmuje: ${s.approvedVolunteerDisplay || s.approvedVolunteer}`, krotki: 'Zatwierdzona', ton: 'ok' };
  if (s.status === 'rejected') return { txt: 'Odrzucona przez kierownika', krotki: 'Odrzucona', ton: 'bad' };
  if (s.status === 'cancelled') return { txt: 'Anulowana', krotki: 'Anulowana', ton: 'neutral' };
  return s.volunteers.length ? { txt: `Zgłoszeń: ${s.volunteers.length} — czeka na decyzję kierownika`, krotki: 'Do decyzji', ton: 'warn' } : { txt: 'Otwarta — czeka na chętnych', krotki: 'Otwarta', ton: 'info' };
};
const calcHours = (start, end) => { if (!start || !end) return 0; const [sh, sm] = start.split(':').map(Number); const [eh, em] = end.split(':').map(Number); let h = eh - sh + (em - sm) / 60; if (h < 0) h += 24; return h; };
const godzinyZmiany = (z) => (z.hours != null ? z.hours : calcHours(z.start, z.end));

// ===================== LOGOWANIE =====================
const LoginScreen = ({ onLogin }) => {
  const [login, setLogin] = useState('');
  const [haslo, setHaslo] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('login');            // 'login' | 'newpass'
  const [acc, setAcc] = useState(null);
  const [zapamietaj, setZapamietaj] = useState(true);
  const [pokazHaslo, setPokazHaslo] = useState(false);
  const [startowe, setStartowe] = useState('');
  const [np1, setNp1] = useState('');
  const [np2, setNp2] = useState('');

  useEffect(() => { const z = loadFromStorage('rex_creds', null); if (z && z.login) setLogin(z.login); }, []);
  const toUser = (a) => ({ id: a.id, name: a.grafikName || a.name, display: a.name, login: a.login });

  const submit = async (e) => {
    if (e) e.preventDefault();
    if (!login.trim() || !haslo) { setError('Podaj identyfikator i hasło'); return; }
    setLoading(true); setError(''); setInfo('');
    try {
      const r = await apiSend('/accounts?action=auth', 'POST', { login: login.trim(), haslo });
      if (r.success) {
        if (r.account.mustChange) { setAcc(r.account); setStartowe(haslo); setStep('newpass'); }
        else {
          const u = toUser(r.account);
          try { if (window.PasswordCredential && navigator.credentials) { navigator.credentials.store(new window.PasswordCredential({ id: login.trim(), password: haslo, name: u.display })); } } catch {}
          if (r.token) saveToStorage('rex_token', r.token);
          if (zapamietaj) saveToStorage('rex_creds', { login: login.trim(), imie: u.display }); else { try { localStorage.removeItem('rex_creds'); } catch {} }
          saveToStorage('rex_user', u); onLogin(u);
        }
      } else setError(r.error || 'Nieprawidłowy identyfikator lub hasło');
    } catch { setError('Błąd połączenia z serwerem'); }
    setLoading(false);
  };
  const savePass = async (e) => {
    if (e) e.preventDefault();
    if (!/^\d{4,8}$/.test(np1)) { setError('PIN musi mieć 4–8 cyfr'); return; }
    if (np1 !== np2) { setError('PIN-y nie są takie same'); return; }
    setLoading(true); setError('');
    try {
      const r = await apiSend('/accounts?action=setpass', 'POST', { login: acc.login, oldHaslo: startowe, newPass: np1 });
      if (r.success) {
        const u = toUser(acc);
        if (r.token) saveToStorage('rex_token', r.token);
        if (zapamietaj) saveToStorage('rex_creds', { login: acc.login, imie: u.display });
        saveToStorage('rex_user', u); onLogin(u);
      } else setError(r.error || 'Nie udało się ustawić hasła');
    } catch { setError('Błąd połączenia z serwerem'); }
    setLoading(false);
  };
  const resetHasla = async () => {
    if (!login.trim()) { setError('Wpisz najpierw swój identyfikator'); return; }
    setLoading(true); setError(''); setInfo('');
    try { const r = await apiSend('/admin-auth', 'POST', { action: 'reset-request', login: login.trim() }); setInfo(r.message || 'Zgłoszenie wysłane — kierownik przekaże Ci tymczasowe hasło.'); }
    catch { setError('Błąd połączenia z serwerem'); }
    setLoading(false);
  };

  return (
    <div className="eh-login">
      <div className="eh-login-shell">
        <div className="eh-login-hero">
          <img className="eh-login-logo eh-login-logo-img" src="/brand/atmosphere-employee-lockup-graphite.svg" alt="Atmosphere — Employee Hub" />
          <small>TWÓJ DZIEŃ PRACY</small>
          <h2>Grafik, czas pracy i wnioski — zawsze pod ręką.</h2>
          <p className="eh-login-hero-copy">Jedno bezpieczne miejsce na Twoje zmiany, dyspozycje, urlopy i zamiany.</p>
          <div className="eh-login-hero-note"><ShieldCheck size={14} /> Bezpieczny dostęp pracowniczy</div>
        </div>
        {step === 'login' ? (
          <form className="eh-login-card" onSubmit={submit}>
            <img className="eh-login-logo eh-login-logo-card" src="/brand/atmosphere-employee-lockup-graphite.svg" alt="Atmosphere — Employee Hub" />
            <small>WITAJ PONOWNIE</small>
            <h1>Zaloguj się</h1>
            <p>Użyj identyfikatora pracownika lub firmowego adresu e-mail.</p>
            {error && <div className="eh-login-info err" role="alert">{error}</div>}
            {info && <div className="eh-login-info ok" role="status">{info}</div>}
            <label className="eh-login-field"><span>Identyfikator lub e-mail</span>
              <div className="eh-login-input"><Users size={18} /><input name="username" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} disabled={loading} autoFocus /></div>
            </label>
            <label className="eh-login-field"><span>Hasło</span>
              <div className="eh-login-input"><Lock size={18} /><input type={pokazHaslo ? 'text' : 'password'} name="password" autoComplete="current-password" placeholder="Wpisz hasło" value={haslo} onChange={(e) => setHaslo(e.target.value)} disabled={loading} /><button type="button" aria-label={pokazHaslo ? 'Ukryj hasło' : 'Pokaż hasło'} aria-pressed={pokazHaslo} onClick={() => setPokazHaslo((v) => !v)}>{pokazHaslo ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
            </label>
            <div className="eh-login-row">
              <label className="eh-login-remember"><input type="checkbox" checked={zapamietaj} onChange={(e) => setZapamietaj(e.target.checked)} /> Pozostań zalogowany</label>
              <button type="button" className="eh-login-forgot" onClick={resetHasla}>Nie pamiętam hasła</button>
            </div>
            <button type="submit" className="eh-login-submit" disabled={loading || !login.trim()}>{loading ? 'Logowanie…' : <>Zaloguj się <ArrowRight size={18} /></>}</button>
            <p className="eh-login-note"><ShieldCheck size={14} /> Dane logowania są przesyłane bezpiecznym połączeniem.</p>
            <div className="eh-login-foot">Atmosphere Employee Hub • {new Date().getFullYear()}</div>
          </form>
        ) : (
          <form className="eh-login-card" onSubmit={savePass}>
            <img className="eh-login-logo eh-login-logo-card" src="/brand/atmosphere-employee-lockup-graphite.svg" alt="Atmosphere — Employee Hub" />
            <small>PIERWSZE LOGOWANIE</small>
            <h1>Ustaw własny PIN</h1>
            <p>Hasło startowe od kierownika działa tylko raz. Wybierz własny PIN (4–8 cyfr).</p>
            {error && <div className="eh-login-info err" role="alert">{error}</div>}
            <label className="eh-login-field"><span>Nowy PIN</span>
              <div className="eh-login-input"><Lock size={18} /><input type="password" inputMode="numeric" maxLength={8} value={np1} onChange={(e) => setNp1(e.target.value)} disabled={loading} autoFocus /></div>
            </label>
            <label className="eh-login-field"><span>Powtórz PIN</span>
              <div className="eh-login-input"><Lock size={18} /><input type="password" inputMode="numeric" maxLength={8} value={np2} onChange={(e) => setNp2(e.target.value)} disabled={loading} /></div>
            </label>
            <button type="submit" className="eh-login-submit" disabled={loading}>{loading ? 'Zapisywanie…' : <>Zapisz i wejdź <ArrowRight size={18} /></>}</button>
            <p className="eh-login-note"><ShieldCheck size={14} /> PIN jest przechowywany wyłącznie jako bezpieczny skrót.</p>
            <div className="eh-login-foot">Atmosphere Employee Hub • {new Date().getFullYear()}</div>
          </form>
        )}
      </div>
    </div>
  );
};

// ===================== OKNA =====================
// Dialog (HIG): fokus wchodzi do okna, wraca po zamknięciu; Escape zamyka; tytuł powiązany z aria-labelledby.
let dialogSeq = 0;
const Dialog = ({ title, kicker, description, onClose, children, actions, size = 'medium' }) => {
  const ref = useRef(null);
  const [id] = useState(() => `eh-dlg-${++dialogSeq}`);
  useEffect(() => {
    const prev = document.body.style.overflow; const poprzedni = document.activeElement;
    document.body.style.overflow = 'hidden';
    const onKey = (ev) => { if (ev.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const pierwszy = ref.current && ref.current.querySelector('input, select, textarea, button:not([aria-label="Zamknij okno"])');
    if (pierwszy) pierwszy.focus({ preventScroll: true });
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); if (poprzedni && poprzedni.focus) poprzedni.focus({ preventScroll: true }); };
  }, [onClose]);
  return (
    <div className="dialog-backdrop" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onClose(); }}>
      <section ref={ref} className={`app-dialog dialog-${size}`} role="dialog" aria-modal="true" aria-labelledby={id}>
        <header className="dialog-header">
          <div>{kicker && <span>{kicker}</span>}<h2 id={id}>{title}</h2>{description && <p>{description}</p>}</div>
          <button type="button" onClick={onClose} aria-label="Zamknij okno"><X size={20} /></button>
        </header>
        <div className="dialog-body">{children}</div>
        {actions && <footer className="dialog-actions">{actions}</footer>}
      </section>
    </div>
  );
};

// Arkusz „Zespół dnia” (bottom sheet na telefonie, karta na desktopie)
const CoworkersSheet = ({ date, list, loading, onClose }) => {
  const d = new Date(date + 'T12:00:00');
  const dateLabel = `${dniPelne[d.getDay()]}, ${d.getDate()} ${monthNamesGen[d.getMonth()]} ${d.getFullYear()}`;
  const inicjaly = (n) => String(n || '').split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();
  return (
    <Dialog title="Zespół dnia" kicker="GRAFIK" description={dateLabel} onClose={onClose} size="small" actions={<button type="button" className="dialog-primary" onClick={onClose}>Zamknij</button>}>
      {loading ? <div className="eh-empty"><RefreshCw size={20} className="eh-spin" /><span>Wczytuję obsadę dnia…</span></div>
        : list.length === 0 ? <div className="eh-empty"><Users size={20} /><span>Nikt więcej nie pracuje tego dnia.</span></div>
        : <ul className="eh-team-list">{list.map((s, i) => (
          <li key={i}>
            <i style={{ background: stationFill(s.station), color: stationInk(s.station), boxShadow: `inset 0 0 0 1.5px ${stationAccent(s.station)}` }}>{inicjaly(s.name)}</i>
            <span><strong>{s.name}</strong><small>{s.start}–{s.end}</small></span>
            <em className={`eh-station-chip eh-fam-${stationFamily(s.station)}`}>{nazwaStanowiska(s)}</em>
          </li>))}</ul>}
    </Dialog>
  );
};

// ===================== EMPLOYEE HUB =====================
const HUB_ETYKIETY = { clock_in: 'Wejście', break_start: 'Start przerwy', break_end: 'Koniec przerwy', clock_out: 'Wyjście' };
const EH_TABS = [['start', 'Start', Home], ['schedule', 'Grafik', Calendar], ['time', 'Czas', Clock3], ['requests', 'Wnioski', MessageSquare], ['more', 'Więcej', Menu]];
const ehCzas = (ts) => new Date(ts).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
const ehDur = (sek) => `${String(Math.floor(sek / 3600)).padStart(2, '0')}:${String(Math.floor(sek / 60) % 60).padStart(2, '0')}:${String(sek % 60).padStart(2, '0')}`;
const EH_PUNCH = {
  clock_in: { title: 'Rozpocząć zmianę?', button: 'Potwierdź wejście', note: 'Zdarzenie trafi do Twojej karty czasu i do obsady na żywo u kierownika.' },
  break_start: { title: 'Rozpocząć przerwę?', button: 'Rozpocznij przerwę', note: 'Kierownik zobaczy zmianę statusu od razu.' },
  break_end: { title: 'Zakończyć przerwę?', button: 'Wróć do pracy', note: 'Czas przerwy zostanie dopisany do dzisiejszej karty czasu.' },
  clock_out: { title: 'Zakończyć zmianę?', button: 'Potwierdź wyjście', note: 'Po wyjściu karta czasu trafi do rozliczenia.' },
};
// stan rejestracji: aktywna zmiana = marka (info), przerwa = ostrzeżenie, zakończona = potwierdzony sukces; zieleń tylko dla sukcesu
const STAN_PRACY = { idle: ['Poza zmianą', 'neutral'], working: ['Na zmianie', 'info'], break: ['Na przerwie', 'warn'], done: ['Zmiana zakończona', 'ok'] };
const ST_LBL = { pending: 'Do decyzji', open: 'Do decyzji', approved: 'Zatwierdzony', rejected: 'Odrzucony', cancelled: 'Wycofany' };
const ST_TON = { pending: 'warn', open: 'warn', approved: 'ok', rejected: 'bad', cancelled: 'neutral' };
const AB_LBL = { urlop: 'Urlop wypoczynkowy', uz: 'Urlop na żądanie', l4: 'Zwolnienie (L4)', L4: 'Zwolnienie (L4)', inne: 'Inna nieobecność' };
const DY_LBL = (r) => r.type === 'available' ? 'Dostępny · cały dzień' : r.type === 'unavailable' ? 'Niedostępny · cały dzień' : r.type === 'from_time' ? `Dostępny od ${r.startTime}` : r.type === 'until_time' ? `Dostępny do ${r.endTime}` : `Pracuję ${r.startTime}–${r.endTime}`;
const Chip = ({ ton = 'neutral', children }) => <em className={`eh-chip ${ton}`}>{children}</em>;

// zakładki mają adresy (#start, #grafik, #czas, #wnioski, #wiecej) — działa przycisk „wstecz” i zakładki przeglądarki
const TAB_HASH = { start: 'start', schedule: 'grafik', time: 'czas', requests: 'wnioski', more: 'wiecej' };
const tabZHash = () => { const h = (location.hash || '').replace(/^#\/?/, '').toLowerCase(); return Object.keys(TAB_HASH).find((k) => TAB_HASH[k] === h) || 'start'; };

const EhHub = ({ user, shifts, swaps, publikacje, onConfirmGrafik, onLogout, openTeam, swapActions }) => {
  const [tab, setTabState] = useState(tabZHash);
  const setTab = (id) => { setTabState(id); if (TAB_HASH[id] && location.hash !== `#${TAB_HASH[id]}`) history.pushState(null, '', `#${TAB_HASH[id]}`); window.scrollTo({ top: 0 }); };
  useEffect(() => { const onHash = () => setTabState(tabZHash()); window.addEventListener('hashchange', onHash); window.addEventListener('popstate', onHash); return () => { window.removeEventListener('hashchange', onHash); window.removeEventListener('popstate', onHash); }; }, []);
  const [now, setNow] = useState(new Date());
  const [hub, setHub] = useState(null);
  const [pending, setPending] = useState(null);
  const [pendingBreak, setPendingBreak] = useState('unpaid');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);           // { tekst, ton }
  const [modal, setModal] = useState(null);
  const [dyspo, setDyspo] = useState([]);
  const [absencje, setAbsencje] = useState([]);
  const [okno, setOkno] = useState(null);
  const [planM, setPlanM] = useState({});             // planer miesiąca: data → { kind, time, time2, status? }
  const [pedzel, setPedzel] = useState({ kind: 'available', time: '14:00', time2: '22:00' });
  const [miesBusy, setMiesBusy] = useState(false);
  const [abDraft, setAbDraft] = useState({ type: 'urlop', from: '', to: '', note: '' });
  const [swapSel, setSwapSel] = useState('');
  const dzis = getTodayString();
  const pokaz = (tekst, ton = 'ok') => { setToast({ tekst, ton }); setTimeout(() => setToast(null), 3600); };
  // każda akcja z serwera kończy się komunikatem w pasku (zamiast alert())
  const wykonaj = async (fn, ok) => { const r = await fn(); if (r && r.success) { if (ok) pokaz(ok); } else pokaz((r && r.error) || 'Nie udało się wykonać akcji', 'bad'); return r; };

  const kindZ = (r) => r.type === 'available' ? { kind: 'available' } : r.type === 'unavailable' ? { kind: 'unavailable' } : r.type === 'from_time' ? { kind: 'from', time: r.startTime } : r.type === 'until_time' ? { kind: 'until', time: r.endTime } : { kind: 'window', time: r.startTime, time2: r.endTime };
  useEffect(() => {
    if (modal !== 'availability' || !okno) return;
    const m = {};
    (dyspo || []).filter((r) => r.date && r.date.slice(0, 7) === okno.targetMonth && r.status !== 'rejected').forEach((r) => { m[r.date] = { ...kindZ(r), status: r.status }; });
    setPlanM(m);
  }, [modal, okno && okno.targetMonth]);
  const dniMiesiaca = okno ? (() => { const [y, m] = okno.targetMonth.split('-').map(Number); const n = new Date(y, m, 0).getDate(); return Array.from({ length: n }, (_, i) => `${okno.targetMonth}-${String(i + 1).padStart(2, '0')}`); })() : [];
  const wiodacePuste = okno ? (new Date(okno.targetMonth + '-01T12:00:00').getDay() + 6) % 7 : 0;
  const malujDzien = (d) => setPlanM((m) => { const cur = m[d]; if (cur && cur.kind === pedzel.kind && !cur.status) { const c = { ...m }; delete c[d]; return c; } return { ...m, [d]: { kind: pedzel.kind, time: pedzel.time, time2: pedzel.time2 } }; });
  const malujWszystkie = () => setPlanM(Object.fromEntries(dniMiesiaca.map((d) => [d, { kind: pedzel.kind, time: pedzel.time, time2: pedzel.time2 }])));
  const skrotDnia = (x) => !x ? '' : x.kind === 'available' ? '✓' : x.kind === 'unavailable' ? '✕' : x.kind === 'from' ? `od ${x.time}` : x.kind === 'until' ? `do ${x.time}` : `${x.time}–${x.time2}`;
  const noweDni = Object.values(planM).filter((x) => !x.status).length;
  const wyslijMiesiac = async () => {
    const typMap = { available: 'available', unavailable: 'unavailable', from: 'from_time', until: 'until_time', window: 'specific_shift' };
    const items = Object.entries(planM).filter(([, x]) => !x.status).map(([date, x]) => ({ date, type: typMap[x.kind], startTime: x.kind === 'from' || x.kind === 'window' ? x.time : undefined, endTime: x.kind === 'until' ? x.time : x.kind === 'window' ? x.time2 : undefined }));
    if (!items.length) return pokaz('Zaznacz dni, dla których chcesz zgłosić dyspozycję.', 'warn');
    setMiesBusy(true);
    const r = await apiSend('/availability?action=request-bulk', 'POST', { items });
    setMiesBusy(false);
    if (r.success) { setModal(null); zaladujWnioski(); pokaz(`Wysłano dyspozycję na ${r.dni} ${r.dni === 1 ? 'dzień' : 'dni'} — kierownik zobaczy ją w kolejce decyzji.`); }
    else pokaz(r.error || 'Nie udało się wysłać dyspozycji', 'bad');
  };

  const zaladujHub = () => api('/clock?action=hub-state').then((r) => { if (r.success) setHub(r); }).catch(() => {});
  useEffect(() => { api('/org').then((r) => { if (r && r.success && r.unit) DEFAULT_LOCATION = `${r.unit.brand} ${r.unit.code} ${r.unit.city} ${r.unit.name}`; }).catch(() => {}); }, []);
  const zaladujWnioski = () => {
    api('/availability?reqs=1').then((r) => { if (r.success) setDyspo(r.requests || []); }).catch(() => {});
    api('/absences').then((r) => { if (r.success) setAbsencje(r.absences || []); }).catch(() => {});
    api('/availability?window=1').then((r) => { if (r.success && r.okno) setOkno(r.okno); }).catch(() => {});
  };
  useEffect(() => { zaladujHub(); zaladujWnioski(); const t1 = setInterval(zaladujHub, 30000); const t2 = setInterval(() => setNow(new Date()), 1000); return () => { clearInterval(t1); clearInterval(t2); }; }, []);

  const ev = (hub && hub.events) || [];
  const workState = !hub ? 'idle' : hub.state === 'working' ? 'working' : hub.state === 'break' ? 'break' : ev.some((e) => e.type === 'clock_out') ? 'done' : 'idle';
  const [workLabel, workTon] = STAN_PRACY[workState];
  const startEv = [...ev].reverse().find((e) => e.type === 'clock_in');
  const elapsed = startEv && (workState === 'working' || workState === 'break') ? Math.max(0, Math.floor((now.getTime() - startEv.at) / 1000)) : 0;
  const dzisZmiana = shifts.filter((x) => x.date === dzis).sort((a, b) => a.start.localeCompare(b.start))[0] || null;

  const confirmPunch = async () => {
    if (!pending) return;
    setBusy(true);
    const r = await apiSend('/clock?action=hub-event', 'POST', { action: pending, breakType: pending === 'break_start' ? pendingBreak : undefined, clientEventId: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
    setBusy(false); const typ = pending; setPending(null);
    if (r.success) {
      setHub((x) => ({ ...(x || {}), state: r.state, events: r.events || ((x && x.events) || []) }));
      pokaz(typ === 'clock_in' ? 'Zmiana rozpoczęta. Kierownik widzi Cię w obsadzie na żywo.' : typ === 'clock_out' ? 'Zmiana zakończona. Karta czasu została zapisana.' : typ === 'break_start' ? 'Przerwa rozpoczęta.' : 'Przerwa zakończona. Miłego powrotu!');
    } else pokaz(r.error || 'Nie udało się zapisać zdarzenia', 'bad');
  };
  const wyslijAbsencje = async () => {
    const r = await apiSend('/absences', 'POST', { type: abDraft.type, from: abDraft.from, to: abDraft.to, reason: abDraft.note });
    if (r.success) { setModal(null); setAbDraft({ type: 'urlop', from: '', to: '', note: '' }); zaladujWnioski(); pokaz('Wniosek wysłany. Kierownik otrzymał powiadomienie.'); }
    else pokaz(r.error || 'Nie udało się wysłać wniosku', 'bad');
  };

  // ── kalendarz miesiąca ──
  const mies = useMemo(() => { const set = new Set(shifts.map((x) => x.date.slice(0, 7))); set.add(dzis.slice(0, 7)); return [...set].sort(); }, [shifts]);
  const [ym, setYm] = useState(dzis.slice(0, 7));          // bieżący miesiąc jako wartość, nie indeks — lista miesięcy rośnie po wczytaniu grafiku
  const mIdx = Math.max(0, mies.indexOf(ym));
  const setMIdx = (fn) => { const i = Math.min(mies.length - 1, Math.max(0, typeof fn === 'function' ? fn(mIdx) : fn)); setYm(mies[i]); };
  const [selDay, setSelDay] = useState(dzis);
  const kalDni = useMemo(() => {
    const [y, m] = ym.split('-').map(Number);
    const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;
    const dim = new Date(y, m, 0).getDate();
    const out = [...Array.from({ length: lead }, () => null), ...Array.from({ length: dim }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`)];
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [ym]);
  const zmianyDnia = (d) => shifts.filter((x) => x.date === d);
  const mcLabel = (k) => { const [y, m] = String(k).split('-').map(Number); return `${monthNames[m - 1]} ${y}`; };
  const selShifts = zmianyDnia(selDay);
  const niepotw = (publikacje || []).filter((x) => !x.potwierdzone);
  const zmianyMies = shifts.filter((x) => x.date.slice(0, 7) === ym);
  const mieszH = zmianyMies.reduce((a, z) => a + godzinyZmiany(z), 0);
  const zaNamiH = zmianyMies.filter((x) => x.date < dzis).reduce((a, z) => a + godzinyZmiany(z), 0);

  const me = user.name;
  const mojaProsba = (x) => x.requesterAccountId ? x.requesterAccountId === user.id : normalizeName(x.requester) === normalizeName(me);
  const otwarteInnych = swaps.filter((x) => x.status === 'open' && !mojaProsba(x));
  const mojeProsby = swaps.filter(mojaProsba).sort((a, b) => b.createdAt - a.createdAt);
  const zgloszony = (x) => x.volunteers.some((v) => normalizeName(v) === normalizeName(me));
  const przyszle = shifts.filter((x) => x.date >= dzis).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  const inicjaly = (user.display || user.name).split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const dataNaglowek = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  const oknoOpis = okno ? (okno.otwarte ? `Okno otwarte do 20.${okno.deadline.slice(5, 7)}` : 'Okno zamknięte') : 'Dodaj dzień i godziny';

  return (
    <main className="employee-hub">
      {toast && <div className={`eh-toast ${toast.ton}`} role="status" aria-live="polite"><Check size={17} />{toast.tekst}</div>}
      <header className="eh-header">
        <div className="eh-brand"><img src="/brand/atmosphere-logo-graphite.svg" alt="Atmosphere" /><span>Employee Hub</span></div>
        <nav aria-label="Nawigacja Employee Hub">{EH_TABS.map(([id, label, Icon]) => <button key={id} type="button" className={tab === id ? 'active' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}><Icon size={17} />{label}</button>)}</nav>
        <div className="eh-header-actions">
          <button type="button" aria-label={niepotw.length ? `Powiadomienia: ${niepotw.length}` : 'Powiadomienia'} onClick={() => setTab('schedule')}><Bell size={19} />{niepotw.length > 0 && <i aria-hidden="true" />}</button>
          <button type="button" className="eh-avatar" aria-label="Profil" onClick={() => setTab('more')}>{inicjaly}</button>
        </div>
      </header>

      <div className="eh-container">
        {tab === 'start' && <>
          <section className="eh-welcome">
            <div><span>{dataNaglowek}</span><h1>Dzień dobry, {(user.display || user.name).split(' ')[0]}</h1><p>{dzisZmiana ? `Masz dziś zmianę ${dzisZmiana.start}–${dzisZmiana.end} na stanowisku ${dzisZmiana.station}.` : 'Nie masz dziś zaplanowanej zmiany.'}</p></div>
            <div className="eh-current-time" aria-label="Aktualna godzina"><Clock3 size={18} /><span>{now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</span></div>
          </section>

          {niepotw.length > 0 && <section className="eh-banner info"><CalendarCheck2 size={18} /><span><strong>Nowy grafik: {niepotw.map((x) => mcLabel(x.month)).join(', ')}</strong><small>Zapoznaj się ze zmianami i potwierdź otrzymanie grafiku.</small></span><button type="button" className="eh-primary" onClick={() => wykonaj(() => onConfirmGrafik(niepotw[0].month), 'Dziękujemy — potwierdzenie zapisane.')}>Potwierdzam</button></section>}

          <section className="eh-home-grid">
            <article className={`eh-card eh-punch-card ${workState}`}>
              <div className="eh-card-head"><div><span>REJESTRACJA CZASU</span><h2>{workLabel}</h2></div><Chip ton={workTon}>{workState === 'idle' ? 'Gotowe' : workState === 'done' ? 'Zapisano' : 'Aktywne'}</Chip></div>
              <div className="eh-punch-time"><strong>{workState === 'idle' ? ((hub && hub.planned && hub.planned.start) || (dzisZmiana && dzisZmiana.start) || '—') : ehDur(elapsed)}</strong><span>{workState === 'idle' ? 'planowany start' : 'od rozpoczęcia zmiany'}</span></div>
              <div className="eh-location"><MapPin size={18} /><span><strong>{DEFAULT_LOCATION}</strong><small>{hub && hub.planned ? `Zaplanowana zmiana ${hub.planned.start}–${hub.planned.end}${hub.planned.station ? ` · ${hub.planned.station}` : ''}` : 'Rejestracja w aplikacji Employee Hub'}</small></span></div>
              {workState === 'idle' && <button type="button" className="eh-primary eh-main-punch" disabled={busy} onClick={() => setPending('clock_in')}><LogIn size={20} /> Rozpocznij zmianę</button>}
              {workState === 'working' && <div className="eh-punch-actions"><button type="button" className="eh-secondary" disabled={busy} onClick={() => { setPendingBreak('unpaid'); setPending('break_start'); }}><Coffee size={18} /> Przerwa</button><button type="button" className="eh-primary" disabled={busy} onClick={() => setPending('clock_out')}><LogOut size={18} /> Zakończ zmianę</button></div>}
              {workState === 'break' && <button type="button" className="eh-primary eh-main-punch" disabled={busy} onClick={() => setPending('break_end')}><Timer size={20} /> Zakończ przerwę</button>}
              {workState === 'done' && <button type="button" className="eh-primary eh-main-punch" disabled><Check size={20} /> Zmiana zakończona</button>}
              <small className="eh-punch-note">Każde zdarzenie trafia do Twojej karty czasu i do obsady na żywo u kierownika.</small>
            </article>
            <aside className="eh-today-stack">
              <article className="eh-card eh-next-shift">
                <div className="eh-card-head"><span>DZISIEJSZA ZMIANA</span><Chip ton={dzisZmiana ? 'info' : 'neutral'}>{dzisZmiana ? 'Opublikowana' : 'Wolne'}</Chip></div>
                <strong>{dzisZmiana ? `${dzisZmiana.start}–${dzisZmiana.end}` : '—'}</strong>
                <p>{dzisZmiana ? `${nazwaStanowiska(dzisZmiana)} · ${fmtH(godzinyZmiany(dzisZmiana))} h` : 'Brak zaplanowanej zmiany na dziś.'}</p>
                <div>{dzisZmiana ? <button type="button" className="eh-link" onClick={() => openTeam(dzis)}><Users size={15} /> Zespół dnia</button> : <span />}<button type="button" className="eh-link" onClick={() => setTab('schedule')}>Grafik <ChevronRight size={15} /></button></div>
              </article>
              <article className="eh-card eh-month-hours">
                <div className="eh-card-head"><span>{mcLabel(ym).toUpperCase()}</span><button type="button" className="eh-link" onClick={() => setTab('time')}>Historia</button></div>
                <div><strong>{fmtH(mieszH)} h</strong><span>zaplanowano</span></div>
                <i role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(zaNamiH / Math.max(1, mieszH) * 100))}><b style={{ width: `${Math.min(100, Math.round(zaNamiH / Math.max(1, mieszH) * 100))}%` }} /></i>
                <small>{fmtH(zaNamiH)} z {fmtH(mieszH)} h za nami · {zmianyMies.length} zmian</small>
              </article>
            </aside>
          </section>

          <section className="eh-quick-grid" aria-label="Szybkie akcje">
            <button type="button" onClick={() => setModal('availability')}><i><CalendarCheck2 size={20} /></i><span><strong>Dyspozycyjność</strong><small>{oknoOpis}</small></span><ChevronRight size={16} /></button>
            <button type="button" onClick={() => setModal('absence')}><i><Calendar size={20} /></i><span><strong>Nieobecność</strong><small>Złóż nowy wniosek</small></span><ChevronRight size={16} /></button>
            <button type="button" onClick={() => setTab('requests')}><i><RefreshCw size={20} /></i><span><strong>Giełda zamian</strong><small>{otwarteInnych.length ? `${otwarteInnych.length} ${otwarteInnych.length === 1 ? 'otwarta oferta' : 'otwarte oferty'}` : 'Brak otwartych ofert'}</small></span><ChevronRight size={16} /></button>
          </section>

          <article className="eh-card eh-activity">
            <div className="eh-card-head"><span>DZISIAJ</span><button type="button" className="eh-link" onClick={() => setTab('time')}>Pełna karta czasu</button></div>
            {ev.length ? [...ev].reverse().slice(0, 4).map((e) => <div key={e.cid}><i>{e.type.includes('break') ? <Coffee size={16} /> : e.type === 'clock_in' ? <LogIn size={16} /> : <LogOut size={16} />}</i><span><strong>{HUB_ETYKIETY[e.type]}{e.type === 'break_start' ? (e.paid ? ' (płatna)' : ' (niepłatna)') : ''}</strong><small>{DEFAULT_LOCATION}</small></span><em>{ehCzas(e.at)}</em></div>) : <div className="eh-empty"><History size={20} /><span>Pierwsze zdarzenie pojawi się po rozpoczęciu zmiany.</span></div>}
          </article>
        </>}

        {tab === 'schedule' && <section className="eh-page">
          <div className="eh-page-heading"><div><span>GRAFIK</span><h1>Mój grafik</h1><p>Wybierz dzień, aby zobaczyć szczegóły zmiany i zespół.</p></div>
            <div className="eh-month-control"><button type="button" onClick={() => setMIdx((v) => Math.max(0, v - 1))} aria-label="Poprzedni miesiąc" disabled={mIdx <= 0}><ChevronLeft size={18} /></button><strong>{mcLabel(ym)}</strong><button type="button" onClick={() => setMIdx((v) => Math.min(mies.length - 1, v + 1))} aria-label="Następny miesiąc" disabled={mIdx >= mies.length - 1}><ChevronRight size={18} /></button><button type="button" className="eh-today-btn" onClick={() => { setYm(dzis.slice(0, 7)); setSelDay(dzis); }}>Dziś</button></div></div>
          <div className="eh-month-layout">
            <article className="eh-card eh-month-calendar">
              <div className="eh-calendar-toolbar"><div><span>GRAFIK OPUBLIKOWANY</span><strong>{zmianyMies.length} zmian · {fmtH(mieszH)} h</strong></div><div className="eh-legend" aria-hidden="true">{['lead', 'operations', 'production', 'control'].map((f) => <span key={f} className={`eh-fam-${f}`}>{{ lead: 'Kierownik', operations: 'Front', production: 'Kuchnia', control: 'Wsparcie' }[f]}</span>)}</div></div>
              <div className="eh-calendar-weekdays">{['PON', 'WT', 'ŚR', 'CZW', 'PT', 'SOB', 'ND'].map((d2) => <span key={d2}>{d2}</span>)}</div>
              <div className="eh-calendar-grid" role="grid">{kalDni.map((d2, i) => { const zs = d2 ? zmianyDnia(d2) : []; return <button type="button" key={i} disabled={!d2} aria-label={d2 ? `${fmtDzien(d2, { weekday: 'long', day: 'numeric', month: 'long' })}${zs.length ? `, zmiana ${zs[0].start}–${zs[0].end}` : ', wolne'}` : undefined} aria-pressed={d2 === selDay} className={`${d2 === selDay ? 'selected' : ''} ${zs.length ? 'has-shift' : ''} ${d2 === dzis ? 'today' : ''}`} onClick={() => d2 && setSelDay(d2)}><span>{d2 ? Number(d2.slice(8)) : ''}</span>{zs.slice(0, 1).map((z) => <i key={z.start} className={`eh-fam-${stationFamily(z.station)}`}><strong>{z.start}–{z.end}</strong><small>{z.station}</small></i>)}</button>; })}</div>
            </article>
            <aside className="eh-month-side">
              <article className="eh-card eh-day-detail">
                <div className="eh-card-head"><span>{fmtDzien(selDay, { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}</span><Chip ton={selShifts.length ? 'info' : 'neutral'}>{selShifts.length ? (selShifts.length === 1 ? '1 zmiana' : `${selShifts.length} zmiany`) : 'Wolne'}</Chip></div>
                {selShifts.length ? selShifts.map((z, i) => <div className={`eh-selected-shift eh-fam-${stationFamily(z.station)}`} key={i}><i><Briefcase size={18} /></i><span><small>{nazwaStanowiska(z)}{z.szkoli && z.partnerSzk ? ` · ${z.partnerSzk}` : ''}</small><strong>{z.start}–{z.end}</strong><em><MapPin size={12} /> {DEFAULT_LOCATION}</em></span><b>{fmtH(godzinyZmiany(z))} h</b><button type="button" className="eh-secondary" onClick={() => openTeam(selDay)}><Users size={16} /> Zespół dnia</button></div>)
                  : <div className="eh-day-empty"><CalendarCheck2 size={22} /><strong>Brak zaplanowanej zmiany</strong><span>To Twój dzień wolny — w grafiku nie ma opublikowanych godzin.</span></div>}
              </article>
              {niepotw.length > 0 && <article className="eh-card eh-confirm-card"><i><CalendarCheck2 size={22} /></i><h2>Grafik opublikowany</h2><p>Potwierdź, że znasz godziny swoich zmian: {niepotw.map((x) => mcLabel(x.month)).join(', ')}.</p><button type="button" className="eh-primary" onClick={() => wykonaj(() => onConfirmGrafik(niepotw[0].month), 'Dziękujemy — potwierdzenie zapisane.')}>Potwierdź grafik</button></article>}
            </aside>
          </div>
        </section>}

        {tab === 'time' && <section className="eh-page">
          <div className="eh-page-heading"><div><span>MOJE GODZINY</span><h1>Czas pracy</h1><p>Zdarzenia z aplikacji i miesięczny bilans planu.</p></div></div>
          <section className="eh-stats">
            <div><span>Plan · {mcLabel(ym)}</span><strong>{fmtH(mieszH)} h</strong><small>{zmianyMies.length} zmian</small></div>
            <div><span>Za nami</span><strong>{fmtH(zaNamiH)} h</strong><small>wg planu</small></div>
            <div><span>Dziś</span><strong>{workLabel}</strong><small>{ev.length === 1 ? '1 zdarzenie' : `${ev.length} zdarzeń`}</small></div>
            <div><span>Najbliższa zmiana</span><strong>{przyszle[0] ? fmtDzien(przyszle[0].date, { day: 'numeric', month: 'short' }) : '—'}</strong><small>{przyszle[0] ? `${przyszle[0].start}–${przyszle[0].end}` : 'brak w grafiku'}</small></div>
          </section>
          <section className="eh-time-layout">
            <article className="eh-card eh-time-history"><div className="eh-card-head"><span>KARTA DZISIAJ</span><Chip ton={workTon}>{workLabel}</Chip></div>
              {((hub && hub.planned) || dzisZmiana) && <div className="eh-time-line"><i /><span>Planowana zmiana</span><strong>{hub && hub.planned ? `${hub.planned.start}–${hub.planned.end}` : `${dzisZmiana.start}–${dzisZmiana.end}`}</strong></div>}
              {ev.map((e) => <div className="eh-time-line" key={e.cid}><i className="recorded" /><span>{HUB_ETYKIETY[e.type]}{e.type === 'break_start' ? (e.paid ? ' (płatna)' : ' (niepłatna)') : ''}</span><strong>{ehCzas(e.at)}</strong></div>)}
              {!ev.length && <div className="eh-empty"><Clock3 size={20} /><span>Brak zdarzeń. Rozpocznij zmianę na stronie startowej.</span></div>}
            </article>
            <article className="eh-card eh-month-list"><div className="eh-card-head"><span>NADCHODZĄCE ZMIANY</span><button type="button" className="eh-link" onClick={() => setTab('schedule')}>Grafik</button></div>
              {przyszle.slice(0, 6).map((z, i) => <div key={i}><i className={`eh-dot eh-fam-${stationFamily(z.station)}`} aria-hidden="true" /><span><strong>{fmtDzien(z.date)}</strong><small>{z.start}–{z.end} · {nazwaStanowiska(z)}</small></span><b>{fmtH(godzinyZmiany(z))} h</b></div>)}
              {!przyszle.length && <div className="eh-empty"><Calendar size={20} /><span>Brak nadchodzących zmian w opublikowanym grafiku.</span></div>}
            </article>
          </section>
        </section>}

        {tab === 'requests' && <section className="eh-page">
          <div className="eh-page-heading"><div><span>WNIOSKI</span><h1>Wnioski i zamiany</h1><p>Dyspozycyjność, urlopy oraz giełda zamian w jednym miejscu.</p></div><button type="button" className="eh-primary" onClick={() => setModal('absence')}><MessageSquare size={16} /> Nowy wniosek</button></div>
          <section className="eh-request-grid">
            <article className="eh-card eh-open-shift"><div className="eh-card-head"><span>GIEŁDA ZAMIAN</span><Chip ton={otwarteInnych.length ? 'info' : 'neutral'}>{otwarteInnych.length} otwartych</Chip></div>
              <div className="eh-swap-list">
                {otwarteInnych.length === 0 && <div className="eh-empty"><RefreshCw size={20} /><span>Brak otwartych ofert. Możesz wystawić własną zmianę poniżej.</span></div>}
                {otwarteInnych.map((x) => { const moje = zgloszony(x); const kol = przyszle.some((z) => z.date === x.shift.date); return (
                  <div className={`eh-swap-offer${moje ? ' mine' : ''}`} key={x.id}>
                    <i className={`eh-fam-${stationFamily(x.shift.station)}`}><span>{fmtDzien(x.shift.date, { weekday: 'short' }).replace('.', '').toUpperCase()}</span><strong>{Number(x.shift.date.slice(8))}</strong><small>{mcLabel(x.shift.date.slice(0, 7)).split(' ')[0].slice(0, 3).toUpperCase()}</small></i>
                    <span><small>{x.shift.station} · {x.requesterDisplay || x.requester}</small><strong>{x.shift.start}–{x.shift.end}</strong><em>{x.shift.hours} h{x.note ? ` · „${x.note}”` : ''}{x.volunteers && x.volunteers.length ? ` · zgłoszeń: ${x.volunteers.length}` : ''}{kol ? ' · masz już zmianę tego dnia' : ''}</em></span>
                    {moje ? <button type="button" className="eh-secondary" onClick={() => wykonaj(() => swapActions.unvolunteer(x.id), 'Zgłoszenie wycofane.')}>Wycofaj</button>
                      : <button type="button" className="eh-primary" onClick={() => wykonaj(() => swapActions.volunteer(x.id), 'Zgłoszenie wysłane — czeka na decyzję kierownika.')}>Zgłoś się</button>}
                  </div>); })}
              </div>
              {otwarteInnych.length > 0 && <p className="eh-note"><Lock size={15} /> Zgłoszenie wymaga akceptacji kierownika — zamiana przypisze zmianę do Twojego konta.</p>}
              {przyszle.length > 0 && <div className="eh-swap-create"><label className="dialog-field">Wystaw moją zmianę<select value={swapSel} onChange={(e) => setSwapSel(e.target.value)}><option value="">— wybierz zmianę —</option>{przyszle.map((z, i) => <option key={i} value={`${z.date}|${z.start}|${z.end}|${z.station}`}>{fmtDzien(z.date)} · {z.start}–{z.end} · {z.station}</option>)}</select></label><button type="button" className="eh-primary" disabled={!swapSel} onClick={() => { const cz = swapSel.split('|'); const z = przyszle.find((x2) => x2.date === cz[0] && x2.start === cz[1] && x2.end === cz[2]); wykonaj(() => swapActions.create({ date: cz[0], start: cz[1], end: cz[2], station: cz[3], hours: z && godzinyZmiany(z) }, ''), 'Zmiana wystawiona na giełdzie.'); setSwapSel(''); }}>Wystaw</button></div>}
            </article>
            <article className="eh-card eh-my-requests"><div className="eh-card-head"><span>MOJE WNIOSKI</span><button type="button" className="eh-link" onClick={() => setModal('availability')}><CalendarCheck2 size={14} /> Dyspozycyjność</button></div>
              {dyspo.slice(0, 4).map((r) => <div key={r.id}><i><CalendarCheck2 size={16} /></i><span><strong>{DY_LBL(r)}</strong><small>{fmtDzien(r.date)}{r.recurrence === 'weekly' ? ' · co tydzień' : ''}{r.managerNote ? ` · „${r.managerNote}”` : ''}</small></span><Chip ton={ST_TON[r.status] || 'neutral'}>{ST_LBL[r.status] || r.status}</Chip></div>)}
              {absencje.slice(0, 3).map((a) => <div key={a.id}><i><Calendar size={16} /></i><span><strong>{AB_LBL[a.type] || a.type}</strong><small>{a.from} → {a.to}{a.decidedBy ? ` · ${a.decidedBy}` : ''}</small></span><Chip ton={ST_TON[a.status] || 'neutral'}>{ST_LBL[a.status] || a.status}</Chip></div>)}
              {mojeProsby.slice(0, 3).map((x) => { const st = statusZamiany(x); return <div key={x.id}><i><RefreshCw size={16} /></i><span><strong>Zamiana zmiany</strong><small>{opisZmiany(x.shift)}</small></span>{x.status === 'open' ? <button type="button" className="eh-secondary eh-small" onClick={() => wykonaj(() => swapActions.cancel(x.id), 'Prośba o zamianę anulowana.')}>Anuluj</button> : <Chip ton={st.ton}>{st.krotki}</Chip>}</div>; })}
              {!dyspo.length && !absencje.length && !mojeProsby.length && <div className="eh-empty"><MessageSquare size={20} /><span>Nie masz jeszcze żadnych wniosków.</span></div>}
            </article>
          </section>
        </section>}

        {tab === 'more' && <section className="eh-page">
          <div className="eh-page-heading"><div><span>PROFIL I NARZĘDZIA</span><h1>Więcej</h1><p>Profil, informacje o aplikacji i wylogowanie.</p></div></div>
          <section className="eh-profile">
            <article className="eh-card eh-profile-card"><i aria-hidden="true">{inicjaly}</i><span><h2>{user.display || user.name}</h2><p>Pracownik · {DEFAULT_LOCATION}</p><small>Login: {user.login}</small></span><button type="button" className="eh-secondary" onClick={onLogout}><LogOut size={16} /> Wyloguj</button></article>
            <div className="eh-more-grid">
              <button type="button" onClick={() => setModal('availability')}><i><CalendarCheck2 size={20} /></i><span><strong>Dyspozycyjność</strong><small>{oknoOpis}</small></span><ChevronRight size={17} /></button>
              <button type="button" onClick={() => setModal('absence')}><i><Calendar size={20} /></i><span><strong>Urlopy i nieobecności</strong><small>Nowy wniosek</small></span><ChevronRight size={17} /></button>
              <button type="button" onClick={() => setTab('requests')}><i><RefreshCw size={20} /></i><span><strong>Giełda zamian</strong><small>{otwarteInnych.length ? `${otwarteInnych.length} otwartych ofert` : 'Brak otwartych ofert'}</small></span><ChevronRight size={17} /></button>
              <button type="button" onClick={() => setModal('about')}><i><Info size={20} /></i><span><strong>O aplikacji</strong><small>Atmosphere Employee Hub</small></span><ChevronRight size={17} /></button>
            </div>
            <p className="eh-footnote">W przygotowaniu: szkolenia, wiadomości od kierownika, prywatność i zgody.</p>
          </section>
        </section>}
      </div>

      <nav className="eh-mobile-nav" aria-label="Nawigacja mobilna">{EH_TABS.map(([id, label, Icon]) => <button key={id} type="button" className={tab === id ? 'active' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}><Icon size={22} /><span>{label}</span></button>)}</nav>

      {pending && <Dialog title={EH_PUNCH[pending].title} kicker="REJESTRACJA CZASU" description="Zdarzenie zostanie zapisane z aktualną godziną." onClose={() => setPending(null)} size="small" actions={<><button type="button" onClick={() => setPending(null)}>Anuluj</button>{pending === 'break_start' && <button type="button" onClick={() => setPendingBreak(pendingBreak === 'paid' ? 'unpaid' : 'paid')} aria-pressed={pendingBreak === 'paid'}>{pendingBreak === 'paid' ? 'Przerwa płatna' : 'Przerwa niepłatna'}</button>}<button type="button" className="dialog-primary" disabled={busy} onClick={confirmPunch}><Check size={16} /> {EH_PUNCH[pending].button}</button></>}>
        <div className="eh-punch-confirm"><div><Clock3 size={21} /><span><strong>{now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</strong><small>czas urządzenia</small></span></div><div><MapPin size={21} /><span><strong>{DEFAULT_LOCATION}</strong><small>lokalizacja zapisana przy zdarzeniu</small></span></div></div>
        <div className="dialog-notice info"><Info size={16} /><span>{EH_PUNCH[pending].note}</span></div>
      </Dialog>}

      {modal === 'availability' && <Dialog title="Dyspozycyjność na miesiąc" kicker="PLANER MIESIĄCA" description={okno ? `Dyspozycje zbieramy na ${new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(new Date(okno.targetMonth + '-01T12:00:00'))}${okno.otwarte ? ` · do 20.${okno.deadline.slice(5, 7)}` : ' · okno zamknięte'}. Wybierz wariant i dotykaj dni — możesz zgłosić cały miesiąc naraz.` : 'Wybierz wariant i zaznacz dni.'} onClose={() => setModal(null)} actions={<><button type="button" onClick={() => setModal(null)}>Anuluj</button><button type="button" className="dialog-primary" disabled={miesBusy || (okno && !okno.otwarte) || !noweDni} onClick={wyslijMiesiac}><MessageSquare size={16} /> {miesBusy ? 'Wysyłam…' : noweDni ? `Wyślij (${noweDni} ${noweDni === 1 ? 'dzień' : 'dni'})` : 'Wyślij'}</button></>}>
        <div className="eh-dyspo-brush" role="radiogroup" aria-label="Wariant dyspozycji">
          {[['available', 'Dostępny', 'ok'], ['unavailable', 'Niedostępny', 'no'], ['from', 'Od godziny', 'part'], ['until', 'Do godziny', 'part'], ['window', 'Pracuję od–do', 'win']].map(([k, l, cls]) => (
            <button type="button" key={k} role="radio" aria-checked={pedzel.kind === k} className={`eh-dyspo-brush-btn ${cls}${pedzel.kind === k ? ' active' : ''}`} onClick={() => setPedzel((p2) => ({ ...p2, kind: k }))}>{l}</button>
          ))}
        </div>
        {(pedzel.kind === 'from' || pedzel.kind === 'until' || pedzel.kind === 'window') && (
          <div className="eh-dyspo-times">
            {pedzel.kind !== 'until' && <label className="dialog-field">{pedzel.kind === 'window' ? 'Od' : 'Dostępny od'}<input type="time" value={pedzel.time} onChange={(e) => setPedzel((p2) => ({ ...p2, time: e.target.value }))} /></label>}
            {pedzel.kind !== 'from' && <label className="dialog-field">{pedzel.kind === 'window' ? 'Do' : 'Dostępny do'}<input type="time" value={pedzel.kind === 'until' ? pedzel.time : pedzel.time2} onChange={(e) => setPedzel((p2) => pedzel.kind === 'until' ? { ...p2, time: e.target.value } : { ...p2, time2: e.target.value })} /></label>}
            <small>Godziny zapisują się przy zaznaczaniu dni — ustaw je przed dotknięciem dnia.</small>
          </div>
        )}
        <div className="eh-dyspo-tools">
          <button type="button" onClick={malujWszystkie}>Zaznacz cały miesiąc</button>
          <button type="button" onClick={() => setPlanM((m) => Object.fromEntries(Object.entries(m).filter(([, x]) => x.status)))}>Wyczyść nowe</button>
          <span>{noweDni} do wysłania · {Object.values(planM).filter((x) => x.status).length} już zgłoszonych</span>
        </div>
        <div className="eh-dyspo-weekdays" aria-hidden="true">{['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'].map((d) => <span key={d}>{d}</span>)}</div>
        <div className="eh-dyspo-grid">
          {Array.from({ length: wiodacePuste }, (_, i) => <i key={`p${i}`} />)}
          {dniMiesiaca.map((d, i) => { const x = planM[d]; const cls = !x ? '' : x.kind === 'available' ? 'ok' : x.kind === 'unavailable' ? 'no' : x.kind === 'window' ? 'win' : 'part'; return (
            <button type="button" key={d} className={`eh-dyspo-day ${cls}${x && x.status ? ` ${x.status}` : ''}${(i + wiodacePuste) % 7 >= 5 ? ' weekend' : ''}`} aria-pressed={!!x} aria-label={`${fmtDzien(d, { weekday: 'long', day: 'numeric' })}${x ? `, ${skrotDnia(x)}${x.status ? (x.status === 'approved' ? ', zatwierdzona' : ', oczekuje') : ''}` : ''}`} onClick={() => malujDzien(d)}>
              <strong>{i + 1}</strong><small>{skrotDnia(x)}</small>
            </button>); })}
        </div>
        <div className="dialog-notice info"><Info size={16} /><span>Ponowne dotknięcie tym samym wariantem usuwa zaznaczenie. Dni już zgłoszone (obwódka) można nadpisać — nowy wpis zastąpi poprzedni po wysłaniu.</span></div>
      </Dialog>}

      {modal === 'absence' && <Dialog title="Nowy wniosek o nieobecność" kicker="WNIOSKI" description="Wniosek trafi do decyzji kierownika." onClose={() => setModal(null)} actions={<><button type="button" onClick={() => setModal(null)}>Anuluj</button><button type="button" className="dialog-primary" disabled={!abDraft.from || !abDraft.to} onClick={wyslijAbsencje}><MessageSquare size={16} /> Wyślij wniosek</button></>}>
        <div className="dialog-form-grid"><label className="dialog-field full">Rodzaj<select value={abDraft.type} onChange={(e) => setAbDraft((v) => ({ ...v, type: e.target.value }))}><option value="urlop">Urlop wypoczynkowy</option><option value="uz">Urlop na żądanie</option><option value="l4">Zwolnienie lekarskie</option><option value="inne">Inna nieobecność</option></select></label><label className="dialog-field">Od<input type="date" value={abDraft.from} onChange={(e) => setAbDraft((v) => ({ ...v, from: e.target.value }))} /></label><label className="dialog-field">Do<input type="date" value={abDraft.to} min={abDraft.from || undefined} onChange={(e) => setAbDraft((v) => ({ ...v, to: e.target.value }))} /></label><label className="dialog-field full">Komentarz<textarea value={abDraft.note} onChange={(e) => setAbDraft((v) => ({ ...v, note: e.target.value }))} placeholder="Opcjonalna informacja dla kierownika" /></label></div>
      </Dialog>}

      {modal === 'about' && <Dialog title="Atmosphere Employee Hub" kicker="O APLIKACJI" description="Aplikacja pracownika systemu Atmosphere." onClose={() => setModal(null)} size="small" actions={<button type="button" className="dialog-primary" onClick={() => setModal(null)}>Zamknij</button>}><div className="dialog-notice info"><Info size={16} /><span>Grafik, rejestracja czasu, dyspozycyjność, urlopy i giełda zamian. {DEFAULT_LOCATION}. © 2026 Atmosphere.</span></div></Dialog>}
    </main>
  );
};

function AtmosphereHubApp() {
  const [currentUser, setCurrentUser] = useState(() => loadFromStorage('rex_user', null));
  const [swaps, setSwaps] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [teamDate, setTeamDate] = useState(null);
  const [publikacje, setPublikacje] = useState([]);   // WFM-01: opublikowane miesiące + status potwierdzenia
  const [coworkers, setCoworkers] = useState([]);
  const [coLoading, setCoLoading] = useState(false);

  const openTeam = async (dateStr) => {
    setTeamDate(dateStr); setCoworkers([]); setCoLoading(true);
    try {
      const r = await api('/schedule?month=' + dateStr.slice(0, 7));
      const all = (r.success && r.shifts) ? r.shifts : [];
      setCoworkers(all.filter((s) => s.date === dateStr && !(s.mine != null ? s.mine : normalizeName(s.name) === normalizeName(currentUser.name))).sort((a, b) => (a.start || '').localeCompare(b.start || '')));
    } catch { setCoworkers([]); }
    setCoLoading(false);
  };

  const zapytanieOsoby = (u) => u && u.id ? `/schedule?accountId=${encodeURIComponent(u.id)}` : `/schedule?name=${encodeURIComponent(u.name)}`;
  const reloadShifts = () => currentUser && api(zapytanieOsoby(currentUser)).then((r) => { if (r.success) { setShifts(scalZmiany(r.shifts)); setPublikacje(r.publikacje || []); } }).catch(() => {});
  const reloadSwaps = () => api('/swaps').then((r) => { if (r.success) setSwaps(r.swaps || []); }).catch(() => {});
  useEffect(() => { if (currentUser) { reloadShifts(); reloadSwaps(); } }, [currentUser]);

  // akcje zwracają odpowiedź serwera — komunikat pokazuje EhHub (pasek stanu zamiast alert())
  const potwierdzGrafik = async (month) => { const r = await apiSend('/schedule?action=confirm', 'POST', { month }); if (r.success) reloadShifts(); return r; };
  const createSwap = async (shift, note) => { const r = await apiSend('/swaps', 'POST', { requester: currentUser.name, shift, note }); if (r.success) reloadSwaps(); return r; };
  const volunteerSwap = async (id) => { const r = await apiSend('/swaps', 'PUT', { id, action: 'volunteer', name: currentUser.name }); if (r.success) reloadSwaps(); return r; };
  const unvolunteerSwap = async (id) => { const r = await apiSend('/swaps', 'PUT', { id, action: 'unvolunteer', name: currentUser.name }); if (r.success) reloadSwaps(); return r; };
  const cancelSwap = async (id) => { const r = await apiSend('/swaps', 'PUT', { id, action: 'cancel' }); if (r.success) reloadSwaps(); return r; };

  const handleLogout = () => { localStorage.removeItem('rex_user'); localStorage.removeItem('rex_token'); setCurrentUser(null); setShifts([]); setSwaps([]); };

  if (!currentUser) return <LoginScreen onLogin={setCurrentUser} />;
  return (
    <>
      <EhHub user={currentUser} shifts={shifts} swaps={swaps} publikacje={publikacje} onConfirmGrafik={potwierdzGrafik} onLogout={handleLogout} openTeam={openTeam}
        swapActions={{ create: createSwap, volunteer: volunteerSwap, unvolunteer: unvolunteerSwap, cancel: cancelSwap }} />
      {teamDate && <CoworkersSheet date={teamDate} list={coworkers} loading={coLoading} onClose={() => setTeamDate(null)} />}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<AtmosphereHubApp />);
