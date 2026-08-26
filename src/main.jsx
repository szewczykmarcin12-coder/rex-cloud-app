import './tailwind.css';
import './workrhythm-mobile.css';
import './ordo-hub.css';
import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { Calendar, Home, Clock, Menu, X, ChevronLeft, ChevronRight, LogOut, Info, Cloud, MapPin, Search, Briefcase, RefreshCw, Users, Lock, CalendarCheck2, Ban, ArrowRight, Clock3, Timer, Repeat2, ShieldCheck, MessageSquare, Check, LogIn, Coffee, History, Bell, MapPin as MapPinIcon, ChevronDown, Eye, EyeOff } from 'lucide-react';

// ===================== CONFIG =====================
const API_BASE = String(import.meta.env.VITE_API_BASE || 'https://rex-cloud-backend.vercel.app/api').replace(/\/$/, '');
// ^ Zmień na URL swojego backendu po wdrożeniu

const DEFAULT_LOCATION = 'Popeyes PLK Kraków Galeria Krakowska';

const colors = {
  primary: { darkest: '#3F0B1C', dark: '#741334', medium: '#A7465F', light: '#B86D82', bg: '#F1E4E8', bgLight: '#F7F5F5' },
  accent: { dark: '#3F0B1C', medium: '#741334', light: '#A7465F', bg: '#F1E4E8' }
};

// Station color palette (matches Excel matrix sections)
const stationColors = {
  'PANIEROWANIE': '#7CB342', 'SMAŻENIE': '#B94352', 'KANAPKI / WRAPY': '#00A3E0',
  'KONTROLER': '#2F5D8A', 'WSPARCIE WIECZORNE / FLEX': '#9C27B0', 'DISPATCHER': '#A7465F',
  'PHU': '#00897B', 'DESERY / NAPOJE': '#EC407A', 'FRYTKI': '#A7465F', 'ZMYWAK': '#71656A',
  'PREP': '#8D6E63', 'DOSTAWA': '#5C6BC0', 'MANAGER': '#3F0B1C', 'MGR FUNKCYJNE': '#5A3542',
  'SZKOLENIA': '#a7465f', 'TRAINING': '#a7465f', 'INSTRUKTOR': '#00796B'
};
const stationColor = (s) => stationColors[(s || '').toUpperCase()] || colors.primary.medium;
const rolaSzk = (s) => {
  const r = (s.rola || '').toLowerCase();
  if (r === 'instruktor' || r === 'training') return r;
  const st = (s.station || '').toLowerCase();
  if (st === 'instruktor' || st === 'training') return st;
  return null;
};
// Etykieta pozycji — stare dane 'training'/'instruktor' pokazują "Szkolenie"
const nazwaStanowiska = (s) => {
  const u = (s.station || '').toLowerCase();
  if (u === 'training') return 'Szkolenie';
  if (u === 'instruktor') return s.szkoli && s.station && u !== 'instruktor' ? s.station : 'Szkolenie (instruktor)';
  return s.szkoli ? `${s.station} · szkoli` : s.station;
};

// ── Scalanie zmian szkoleniowych ──
// Instruktor ma w grafiku DWA wiersze na te same godziny: stację roboczą (np. KONTROLER)
// i równoległy wiersz "instruktor". W aplikacji pokazujemy to jako JEDNĄ zmianę
// z dopiskiem o szkoleniu — dzięki temu nic się nie nakłada, a godziny liczą się raz.
const minOf = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
const nachodza = (a, b) => {
  let a1 = minOf(a.start), a2 = minOf(a.end); if (a2 <= a1) a2 += 1440;
  let b1 = minOf(b.start), b2 = minOf(b.end); if (b2 <= b1) b2 += 1440;
  return a1 < b2 && b1 < a2;
};
const scalZmiany = (arr) => {
  const zwykle = [], instr = [];
  (arr || []).forEach((s) => (rolaSzk(s) === 'instruktor' ? instr : zwykle).push(s));
  const out = zwykle.map((s) => ({ ...s }));
  instr.forEach((i) => {
    // FIX: para tylko w obrębie TEJ SAMEJ osoby (jak w panelu)
    const para = out.find((s) => s.date === i.date && String(s.name).toUpperCase().trim() === String(i.name).toUpperCase().trim() && nachodza(s, i));
    if (para) { para.szkoli = true; para.partnerSzk = i.partner || i.uczen || null; }   // dopisek na istniejącej zmianie
    else out.push({ ...i, szkoli: true, station: i.station });  // instruktor bez pary — pokaż raz
  });
  return out;
};

const paraLabel = (shift) => {
  if (shift.szkoli) return { rola: 'Szkolisz tego dnia', osoba: shift.partnerSzk || '' };
  const r = rolaSzk(shift);
  if (!r) return null;
  return r === 'instruktor'
    ? { rola: 'Szkolenie · szkoli', osoba: shift.partner || '' }
    : { rola: 'Szkolenie · instruktor', osoba: shift.partner || '' };
};

const monthNames = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
const monthNamesGen = ['stycznia','lutego','marca','kwietnia','maja','czerwca','lipca','sierpnia','września','października','listopada','grudnia'];
const dniPelne = ['niedziela','poniedziałek','wtorek','środa','czwartek','piątek','sobota'];
const dayNames = ['PON','WT','ŚR','CZW','PT','SOB','NIEDZ'];
const dayShort = ['NIEDZ','PON','WT','ŚR','CZW','PT','SOB'];

const saveToStorage = (k, d) => { try { localStorage.setItem(k, JSON.stringify(d)); } catch {} };
const loadFromStorage = (k, def = null) => { try { const d = localStorage.getItem(k); return d ? JSON.parse(d) : def; } catch { return def; } };
const getTodayString = () => { const t = new Date(); return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0'); };

// SEC-01: każde wywołanie z tokenem sesji; 401 przy ważnym tokenie = wygaśnięcie → wylogowanie
const authHeaders = () => { const t = loadFromStorage('rex_token', null); return t ? { Authorization: `Bearer ${t}` } : {}; };
const obsluz401 = (r) => { if (r.status === 401 && loadFromStorage('rex_token', null)) { try { localStorage.removeItem('rex_token'); localStorage.removeItem('rex_user'); location.reload(); } catch {} } return r; };
const api = async (path) => { const r = obsluz401(await fetch(`${API_BASE}${path}`, { headers: { ...authHeaders() } })); return r.json(); };
const apiSend = async (path, method, body) => { const r = obsluz401(await fetch(`${API_BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: body ? JSON.stringify(body) : undefined })); return r.json(); };

const normalizeName = (n) => (n || '').toString().trim().toUpperCase().replace(/\s+/g, ' ')
  .replace(/Ą/g,'A').replace(/Ć/g,'C').replace(/Ę/g,'E').replace(/Ł/g,'L').replace(/Ń/g,'N').replace(/Ó/g,'O').replace(/Ś/g,'S').replace(/Ź/g,'Z').replace(/Ż/g,'Z');

// ── Giełda zamian (helpery) ──
const dfmtSw = (ds) => { const d = new Date(ds); const dni = ['nd','pn','wt','śr','cz','pt','sb']; return `${dni[d.getDay()]} ${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`; };
const opisZmiany = (s) => `${dfmtSw(s.date)} · ${s.station} · ${s.start}–${s.end} (${s.hours}h)`;
const swapKey = (s) => s.date + '|' + s.station + '|' + s.start + '|' + s.end;
const statusZamiany = (s) => {
  if (s.status === 'approved') return { txt: `Zatwierdzona — przejmuje: ${s.approvedVolunteerDisplay || s.approvedVolunteer}`, kol: '#741334', bg: '#F1E4E8' };
  if (s.status === 'rejected') return { txt: 'Odrzucona przez ASM', kol: '#B94352', bg: '#F5E3E8' };
  if (s.status === 'cancelled') return { txt: 'Anulowana', kol: '#A38D95', bg: '#EDE3E6' };
  return s.volunteers.length ? { txt: `Zgłoszeń: ${s.volunteers.length} — czeka na akceptację ASM`, kol: '#A7465F', bg: '#fff2e8' } : { txt: 'Otwarta — czeka na chętnych', kol: colors.primary.medium, bg: colors.primary.bgLight };
};

const calcHours = (start, end) => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let h = eh - sh + (em - sm) / 60;
  if (h < 0) h += 24;
  return h;
};

// ===================== LOGIN =====================

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
    try { const r = await apiSend('/admin-auth', 'POST', { action: 'reset-request', login: login.trim() }); setInfo(r.message || 'Zgłoszenie wysłane — manager przekaże Ci tymczasowe hasło.'); }
    catch { setError('Błąd połączenia z serwerem'); }
    setLoading(false);
  };

  return (
    <div className="eh-login">
      <div className="eh-login-shell">
        <div className="eh-login-hero">
          <div className="eh-login-logo"><b>ORDO</b><span>EMPLOYEE HUB</span></div>
          <small>TWÓJ DZIEŃ PRACY</small>
          <h2>Wszystko, czego potrzebujesz — zawsze pod ręką.</h2>
          <p className="eh-login-hero-copy">Grafik, zespół, czas pracy i wnioski w jednym bezpiecznym miejscu.</p>
          <div className="eh-login-hero-note"><ShieldCheck size={13} /> Bezpieczny dostęp pracowniczy</div>
        </div>
        {step === 'login' ? (
          <form className="eh-login-card" onSubmit={submit}>
            <small>WITAJ PONOWNIE</small>
            <h1>Zaloguj się</h1>
            <p>Użyj identyfikatora pracownika lub firmowego adresu e-mail.</p>
            {error && <div className="eh-login-info err">{error}</div>}
            {info && <div className="eh-login-info ok">{info}</div>}
            <label className="eh-login-field"><span>Identyfikator lub e-mail</span>
              <div className="eh-login-input"><Users size={17} /><input name="username" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} disabled={loading} autoFocus /></div>
            </label>
            <label className="eh-login-field"><span>Hasło</span>
              <div className="eh-login-input"><Lock size={17} /><input type={pokazHaslo ? 'text' : 'password'} name="password" autoComplete="current-password" placeholder="Wpisz hasło" value={haslo} onChange={(e) => setHaslo(e.target.value)} disabled={loading} /><button type="button" aria-label="Pokaż hasło" onClick={() => setPokazHaslo((v) => !v)}>{pokazHaslo ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
            </label>
            <div className="eh-login-row">
              <label className="eh-login-remember"><input type="checkbox" checked={zapamietaj} onChange={(e) => setZapamietaj(e.target.checked)} /> Pozostań zalogowany</label>
              <button type="button" className="eh-login-forgot" onClick={resetHasla}>Nie pamiętam hasła</button>
            </div>
            <button type="submit" className="eh-login-submit" disabled={loading || !login.trim()}>{loading ? 'Logowanie…' : <>Zaloguj się <ArrowRight size={17} /></>}</button>
            <p className="eh-login-note"><ShieldCheck size={13} /> Dane logowania są przesyłane bezpiecznym połączeniem.</p>
            <div className="eh-login-foot">ORDO Employee Hub • {new Date().getFullYear()}</div>
          </form>
        ) : (
          <form className="eh-login-card" onSubmit={savePass}>
            <small>PIERWSZE LOGOWANIE</small>
            <h1>Ustaw własny PIN</h1>
            <p>Hasło startowe od managera działa tylko raz. Wybierz własny PIN (4–8 cyfr).</p>
            {error && <div className="eh-login-info err">{error}</div>}
            <label className="eh-login-field"><span>Nowy PIN</span>
              <div className="eh-login-input"><Lock size={17} /><input type="password" inputMode="numeric" maxLength={8} value={np1} onChange={(e) => setNp1(e.target.value)} disabled={loading} autoFocus /></div>
            </label>
            <label className="eh-login-field"><span>Powtórz PIN</span>
              <div className="eh-login-input"><Lock size={17} /><input type="password" inputMode="numeric" maxLength={8} value={np2} onChange={(e) => setNp2(e.target.value)} disabled={loading} /></div>
            </label>
            <button type="submit" className="eh-login-submit" disabled={loading}>{loading ? 'Zapisywanie…' : <>Zapisz i wejdź <ArrowRight size={17} /></>}</button>
            <p className="eh-login-note"><ShieldCheck size={13} /> PIN jest przechowywany wyłącznie jako bezpieczny skrót.</p>
            <div className="eh-login-foot">ORDO Employee Hub • {new Date().getFullYear()}</div>
          </form>
        )}
      </div>
    </div>
  );
};

const CalendarView = ({ date, onDateChange, shifts, onDayClick, selectedDay }) => {
  const year = date.getFullYear(), month = date.getMonth();
  const firstDay = new Date(year, month, 1), lastDay = new Date(year, month + 1, 0), startDay = (firstDay.getDay() + 6) % 7;
  const days = [];
  for (let i = 0; i < startDay; i++) days.push({ day: new Date(year, month, 0).getDate() - startDay + i + 1, current: false });
  for (let i = 1; i <= lastDay.getDate(); i++) days.push({ day: i, current: true });
  for (let i = 1; days.length < 42; i++) days.push({ day: i, current: false });
  const getShifts = (d) => { const ds = year+'-'+String(month+1).padStart(2,'0')+'-'+String(d).padStart(2,'0'); return shifts.filter(s => s.date === ds); };
  const today = new Date(), isToday = (d) => today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
  const hlStyle = (item) => { if (!item.current) return {}; if (selectedDay !== null) { if (item.day === selectedDay) return {backgroundColor: colors.primary.bg, color: colors.primary.dark}; return {}; } if (isToday(item.day)) return {backgroundColor: colors.primary.medium, color: 'white'}; return {}; };
  return (
    <div className="bg-white">
      <div className="flex items-center justify-between px-4 py-4 border-b"><button onClick={() => onDateChange(new Date(year, month-1, 1))} className="p-2"><ChevronLeft size={24} /></button><span className="text-lg font-semibold">{monthNames[month]} {year}</span><button onClick={() => onDateChange(new Date(year, month+1, 1))} className="p-2"><ChevronRight size={24} /></button></div>
      <div className="grid grid-cols-7 gap-1 p-2">
        {dayNames.map(d => <div key={d} className="text-center text-xs font-medium py-2 rounded-lg" style={{backgroundColor: colors.primary.bg, color: colors.primary.light}}>{d}</div>)}
        {days.map((item, i) => { const sh = item.current ? getShifts(item.day) : []; return (
          <button key={i} onClick={() => item.current && onDayClick(item.day === selectedDay ? null : item.day)} className={'flex flex-col items-center py-2 rounded-full ' + (!item.current ? 'text-slate-300' : '')} style={hlStyle(item)}>
            <span className="text-sm font-medium">{item.day}</span>
            {sh.length > 0 && item.current && <div className="flex gap-0.5 mt-1">{sh.slice(0,3).map((s,j) => <div key={j} className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: stationColor(s.station)}} />)}</div>}
          </button>
        ); })}
      </div>
    </div>
  );
};

// ===================== SIDEBAR / HEADER =====================

const Sidebar = ({ isOpen, onClose, currentPage, onNavigate, user, onLogout }) => {
  const items = [{ id: 'home', icon: Home, label: 'Strona domowa' }, { id: 'shifts', icon: Calendar, label: 'Mój grafik' }, { id: 'dyspo', icon: CalendarCheck2, label: 'Dyspozycyjność' }, { id: 'hours', icon: Clock, label: 'Moje godziny' }, { id: 'swaps', icon: RefreshCw, label: 'Giełda zamian' }, { id: 'wnioski', icon: Briefcase, label: 'Urlopy i wnioski' }, { id: 'about', icon: Info, label: 'O aplikacji' }];
  const initials = (user.display || user.name).split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (<>{isOpen && <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />}
    <div className={'fixed top-0 left-0 h-full w-72 bg-white z-50 transform transition-transform flex flex-col ' + (isOpen ? 'translate-x-0' : '-translate-x-full')}>
      <div className="p-4 pt-8" style={{background: colors.primary.darkest}}><div className="flex items-center gap-2 mb-4"><Cloud size={24} className="text-white" /><span className="text-white text-lg font-light"><b className="tracking-[0.18em]">ORDO</b> <span className="text-[10px] font-bold tracking-widest align-middle" style={{color: colors.primary.light}}>EMPLOYEE HUB</span></span></div></div>
      <div className="p-4 border-b flex items-center gap-3"><div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold" style={{backgroundColor: colors.primary.medium}}>{initials}</div><div><p className="font-semibold text-sm">{user.display || user.name}</p><p className="text-slate-500 text-xs">Pracownik</p></div></div>
      <nav className="p-4 flex-1">{items.map(item => (<button key={item.id} onClick={() => { onNavigate(item.id); onClose(); }} className="w-full flex items-center gap-4 px-4 py-3 rounded-xl" style={currentPage === item.id ? {backgroundColor: colors.primary.bg, color: colors.primary.dark} : {color: '#5A3542'}}><item.icon size={20} /><span className="font-medium">{item.label}</span></button>))}</nav>
      <div className="p-4 border-t"><button onClick={() => { onLogout(); onClose(); }} className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-red-600"><LogOut size={20} /><span className="font-medium">Wyloguj się</span></button></div>
    </div></>);
};

const Header = ({ title, onMenuClick }) => (<div className="text-white px-4 py-4 flex items-center justify-between sticky top-0 z-30" style={{background: colors.primary.dark}}><div className="flex items-center gap-3"><Cloud size={24} /><span className="text-lg font-medium">{title}</span></div><button onClick={onMenuClick} className="p-2"><Menu size={24} /></button></div>);

// ===================== SHIFT CARD =====================

// Wykrywanie podwójnego kliknięcia/tapnięcia (niezawodne na telefonie i desktopie)
const DblTapRow = ({ children, onDouble }) => {
  const last = React.useRef(0);
  const handle = () => { const now = Date.now(); if (now - last.current < 350) { last.current = 0; onDouble(); } else { last.current = now; } };
  return <div onClick={handle} className="mb-3 cursor-pointer select-none">{children}</div>;
};

// Okienko „Współpracownicy ze zmiany"
const CoworkersModal = ({ date, list, loading, onClose }) => {
  const d = new Date(date);
  const dateLabel = `${dniPelne[d.getDay()]}, ${d.getDate()} ${monthNamesGen[d.getMonth()]} ${d.getFullYear()}`;
  const inicjaly = (n) => n.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl max-h-[80vh] flex flex-col">
        <div className="p-5 border-b"><h2 className="text-xl font-bold" style={{ color: colors.primary.darkest }}>Współpracownicy ze zmiany</h2><p className="text-sm text-slate-500 mt-1 capitalize">{dateLabel}</p></div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {loading ? (<div className="flex items-center justify-center py-10"><Cloud size={36} style={{ color: colors.primary.medium }} className="animate-pulse" /></div>)
            : list.length === 0 ? (<p className="text-slate-400 text-center py-8">Nikt więcej nie pracuje tego dnia.</p>)
            : list.map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-xl">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold shrink-0" style={{ backgroundColor: stationColor(s.station) }}>{inicjaly(s.name)}</div>
                <div className="flex-1 min-w-0"><p className="font-semibold truncate" style={{ color: colors.primary.darkest }}>{s.name}</p><p className="text-sm text-slate-500">{s.start} - {s.end}</p></div>
                <span className="text-xs px-2 py-1 rounded font-medium shrink-0" style={{ backgroundColor: colors.primary.bg, color: stationColor(s.station) }}>{nazwaStanowiska(s)}</span>
              </div>
            ))}
        </div>
        <div className="p-4 border-t"><button onClick={onClose} className="w-full text-white font-semibold py-3 rounded-xl" style={{ backgroundColor: colors.primary.medium }}>Ok</button></div>
      </div>
    </div>
  );
};

const ShiftCard = ({ shift, isToday, onTeam }) => {
  const d = new Date(shift.date);
  const h = shift.hours != null ? shift.hours : calcHours(shift.start, shift.end);
  return (
    <div className="relative rounded-xl shadow-sm p-4" style={{ backgroundColor: isToday ? colors.primary.bg : 'white', borderLeft: '4px solid ' + stationColor(shift.station) }}>
      {onTeam && (
        <button onClick={(e) => { e.stopPropagation(); onTeam(); }} className="absolute top-2 right-2 w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: colors.primary.bg }} title="Współpracownicy ze zmiany">
          <Users size={18} style={{ color: colors.primary.medium }} />
        </button>
      )}
      <div className="flex gap-4">
        <div className="rounded-xl px-3 py-2 text-center min-w-16" style={{backgroundColor: isToday ? colors.primary.bgLight : colors.primary.bg}}>
          <p className="text-xs" style={{color: colors.primary.light}}>{dayShort[d.getDay()]}</p>
          <p className="text-xl font-bold">{d.getDate()}.{String(d.getMonth()+1).padStart(2,'0')}</p>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={16} className="text-slate-400" />
            <span className="font-semibold">{shift.start} - {shift.end}</span>
            <span className="text-xs px-2 py-0.5 rounded font-medium" style={{backgroundColor: colors.primary.bg, color: colors.primary.dark}}>{h}h</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Briefcase size={14} style={{color: stationColor(shift.station)}} />
            <span className="text-sm font-medium" style={{color: stationColor(shift.station)}}>{nazwaStanowiska(shift)}</span>
          </div>
          {paraLabel(shift) && (
            <div className="flex items-center gap-2 mt-1">
              <Search size={14} style={{color: stationColor(shift.station)}} />
              <span className="text-sm" style={{color: colors.primary.dark}}>{paraLabel(shift).rola}: <span className="font-semibold">{paraLabel(shift).osoba}</span></span>
            </div>
          )}
          <div className="flex items-center gap-2 mt-1"><MapPin size={14} className="text-slate-400" /><span className="text-slate-500 text-sm">{DEFAULT_LOCATION}</span></div>
        </div>
      </div>
    </div>
  );
};

// ===================== PAGES =====================

// ═════════ ORDO — Dialog wzorca (ui-dialog) ═════════
const Dialog = ({ title, kicker, description, onClose, children, actions, size = 'medium' }) => {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (ev) => { if (ev.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [onClose]);
  return (
    <div className="dialog-backdrop" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onClose(); }}>
      <section className={`app-dialog dialog-${size}`} role="dialog" aria-modal="true">
        <header className="dialog-header">
          <div>{kicker && <span>{kicker}</span>}<h2>{title}</h2>{description && <p>{description}</p>}</div>
          <button onClick={onClose} aria-label="Zamknij okno"><X size={19} /></button>
        </header>
        <div className="dialog-body">{children}</div>
        {actions && <footer className="dialog-actions">{actions}</footer>}
      </section>
    </div>
  );
};

// ═════════ ORDO Employee Hub — rejestracja czasu (zastępuje terminal REX Clock) ═════════
const HUB_ETYKIETY = { clock_in: 'Wejście', break_start: 'Start przerwy', break_end: 'Koniec przerwy', clock_out: 'Wyjście' };
const HubClockCard = () => {
  const [stan, setStan] = useState(null);
  const [busy, setBusy] = useState(false);
  const zaladuj = () => api('/clock?action=hub-state').then((r) => { if (r.success) setStan(r); }).catch(() => {});
  useEffect(() => { zaladuj(); const t = setInterval(zaladuj, 30000); return () => clearInterval(t); }, []);
  const zdarzenie = async (typ, breakType) => {
    const pytania = { clock_in: 'Rozpocząć zmianę?', break_start: 'Rozpocząć przerwę?', break_end: 'Zakończyć przerwę i wrócić do pracy?', clock_out: 'Zakończyć zmianę?' };
    if (!window.confirm(pytania[typ])) return;
    setBusy(true);
    const r = await apiSend('/clock?action=hub-event', 'POST', { action: typ, breakType, clientEventId: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
    setBusy(false);
    if (r.success) setStan((x) => ({ ...(x || {}), state: r.state, events: r.events || ((x && x.events) || []) }));
    else alert(r.error || 'Nie udało się zapisać zdarzenia');
  };
  const st = stan ? stan.state : null;
  const chip = st === 'working' ? ['W pracy', '#741334', '#F1E4E8'] : st === 'break' ? ['Na przerwie', '#A7465F', '#F1E4E8'] : ['Poza zmianą', colors.primary.medium, colors.primary.bgLight];
  const czasEv = (e) => new Date(e.at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  const btn = (kol) => `w-full py-3.5 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50`;
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4" style={{ borderLeft: '4px solid ' + colors.primary.dark }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold flex items-center gap-2"><Clock3 size={19} style={{ color: colors.primary.medium }} /> Rejestracja czasu</h3>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ color: chip[1], backgroundColor: chip[2] }}>{chip[0]}</span>
      </div>
      {stan && stan.planned && <p className="text-xs mb-3" style={{ color: colors.primary.light }}>Zaplanowana zmiana: <b style={{ color: colors.primary.darkest }}>{stan.planned.start}–{stan.planned.end}</b>{stan.planned.station ? ` · ${stan.planned.station}` : ''}</p>}
      {!stan && <p className="text-sm text-slate-400">Ładowanie…</p>}
      {st === 'off' && <button disabled={busy} onClick={() => zdarzenie('clock_in')} className={btn()} style={{ backgroundColor: colors.primary.darkest }}><LogIn size={18} /> Rozpocznij zmianę</button>}
      {st === 'working' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button disabled={busy} onClick={() => zdarzenie('break_start', 'unpaid')} className="py-3 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50" style={{ backgroundColor: '#F1E4E8', color: '#A7465F' }}><Coffee size={17} /> Przerwa niepłatna</button>
            <button disabled={busy} onClick={() => zdarzenie('break_start', 'paid')} className="py-3 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50" style={{ backgroundColor: colors.primary.bgLight, color: colors.primary.dark }}><Coffee size={17} /> Przerwa płatna</button>
          </div>
          <button disabled={busy} onClick={() => zdarzenie('clock_out')} className={btn()} style={{ backgroundColor: '#B94352' }}><LogOut size={18} /> Zakończ zmianę</button>
        </div>
      )}
      {st === 'break' && <button disabled={busy} onClick={() => zdarzenie('break_end')} className={btn()} style={{ backgroundColor: colors.primary.medium }}><Coffee size={18} /> Wróć z przerwy</button>}
      {stan && (stan.events || []).length > 0 && (
        <div className="mt-3 pt-3 border-t space-y-1.5" style={{ borderColor: colors.primary.bg }}>
          {[...stan.events].reverse().slice(0, 4).map((e) => (
            <div key={e.cid} className="flex items-center gap-2 text-xs" style={{ color: colors.primary.dark }}>
              <History size={13} style={{ color: colors.primary.light }} />
              <span className="font-medium">{HUB_ETYKIETY[e.type]}{e.type === 'break_start' ? (e.paid ? ' (płatna)' : ' (niepłatna)') : ''}</span>
              <span className="ml-auto tabular-nums" style={{ color: colors.primary.light }}>{czasEv(e)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ═════════ REX WorkRhythm Modules v1.0.0 — Dyspozycyjność (mobile) ═════════
const DY_TYPES = [
  { id: 'available', title: 'Mogę pracować', detail: 'Cały dzień', icon: Check },
  { id: 'unavailable', title: 'Nie mogę pracować', detail: 'Cały dzień', icon: Ban },
  { id: 'from_time', title: 'Od godziny', detail: 'Np. od 14:00', icon: ArrowRight },
  { id: 'until_time', title: 'Do godziny', detail: 'Np. do 16:00', icon: Clock3 },
  { id: 'specific_shift', title: 'Konkretna zmiana', detail: 'Podaj początek i koniec', icon: Timer },
];
const DY_CZASY = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i * 15 / 60)).padStart(2, '0')}:${String((i * 15) % 60).padStart(2, '0')}`);
const dyAdd = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const dyPon = (iso) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
const dyFmt = (d) => new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(d + 'T12:00:00'));
const dyLabel = (r) => r.type === 'available' ? 'Mogę pracować · cały dzień' : r.type === 'unavailable' ? 'Nie mogę pracować · cały dzień' : r.type === 'from_time' ? `Mogę pracować od ${r.startTime}` : r.type === 'until_time' ? `Mogę pracować do ${r.endTime}` : `Preferowana zmiana ${r.startTime}–${r.endTime}`;

const DyspoPage = () => {
  const dzisIso = new Date().toISOString().slice(0, 10);
  const [weekStart, setWeekStart] = useState(dyPon(dzisIso));
  const [selectedDate, setSelectedDate] = useState(dzisIso);
  const [typ, setTyp] = useState('available');
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('22:00');
  const [recurrence, setRecurrence] = useState('once');
  const [repeatUntil, setRepeatUntil] = useState(dyAdd(dzisIso, 35));
  const [note, setNote] = useState('');
  const [reqs, setReqs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [okno, setOkno] = useState(null);
  const pokaz = (m) => { setToast(m); setTimeout(() => setToast(''), 2600); };
  const zaladuj = () => api('/availability?reqs=1').then((r) => { if (r.success) setReqs(r.requests || []); }).catch(() => {});
  useEffect(() => {
    zaladuj();
    api('/availability?window=1').then((r) => {
      if (r.success && r.okno) {
        setOkno(r.okno);
        const start = `${r.okno.targetMonth}-01`;
        setWeekStart(dyPon(start));
        setSelectedDate(start);
        setRepeatUntil(`${r.okno.targetMonth}-28`);
      }
    }).catch(() => {});
  }, []);
  const wOknie = (d) => !okno || d.slice(0, 7) === okno.targetMonth;
  const mcNazwa = okno ? new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(new Date(okno.targetMonth + '-01T12:00:00')) : '';
  const zamkniete = okno ? !okno.otwarte : false;
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => { const date = dyAdd(weekStart, i); const d = new Date(date + 'T12:00:00'); return { date, label: new Intl.DateTimeFormat('pl-PL', { weekday: 'short' }).format(d).replace('.', '').toUpperCase(), day: String(d.getDate()) }; }), [weekStart]);
  const naDate = useMemo(() => new Map(reqs.map((r) => [r.date, r])), [reqs]);
  const wyslij = async (e) => {
    e.preventDefault(); setSaving(true);
    const r = await apiSend('/availability?action=request', 'POST', { date: selectedDate, type: typ, startTime, endTime, recurrence, repeatUntil: recurrence === 'weekly' ? repeatUntil : null, note });
    setSaving(false);
    if (r.success) { setNote(''); zaladuj(); pokaz('Dyspozycja wysłana do managera'); }
    else pokaz(r.error || 'Nie udało się wysłać dyspozycji');
  };
  const tydzienTytul = `${new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short' }).format(new Date(week[0].date + 'T12:00:00'))}–${new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short' }).format(new Date(week[6].date + 'T12:00:00'))}`;
  const nadchodzace = [...reqs].filter((r) => r.date >= dzisIso || r.recurrence === 'weekly').sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div className="p-4 pb-24" style={{ maxWidth: 480, margin: '0 auto' }}>
      <section className="mobile-intro">
        <span>WORKRHYTHM</span>
        <h1>Podaj dyspozycję</h1>
        <p>{okno ? `Dyspozycje zbieramy na ${mcNazwa}.` : 'Powiedz managerowi, kiedy możesz pracować.'} Dyspozycja nie zmienia automatycznie opublikowanego grafiku.</p>
      </section>
      {zamkniete && (
        <div className="mobile-week-card" style={{ borderLeft: '4px solid #B94352' }}>
          <div className="mobile-deadline" style={{ color: '#B94352' }}><Clock3 size={15} /><span><strong>Okno zamknięte.</strong> Termin składania dyspozycji na {mcNazwa} minął 20. dnia miesiąca. Otworzyć może je wyłącznie ASM.</span></div>
        </div>
      )}
      <section className="mobile-week-card">
        <header>
          <button aria-label="Poprzedni tydzień" onClick={() => setWeekStart(dyAdd(weekStart, -7))}><ChevronLeft size={19} /></button>
          <div><small>WYBRANY TYDZIEŃ</small><strong>{tydzienTytul}</strong></div>
          <button aria-label="Następny tydzień" onClick={() => setWeekStart(dyAdd(weekStart, 7))}><ChevronRight size={19} /></button>
        </header>
        <div className="mobile-week-days">
          {week.map((d) => { const saved = naDate.get(d.date); const poza = !wOknie(d.date); return <button key={d.date} disabled={poza} style={poza ? { opacity: .35 } : undefined} className={`${selectedDate === d.date ? 'active' : ''} ${saved ? `has-request ${saved.status}` : ''}`} onClick={() => setSelectedDate(d.date)}>
            <span>{d.label}</span><strong>{d.day}</strong>{saved ? <i /> : <em />}
          </button>; })}
        </div>
        <div className="mobile-deadline"><Clock3 size={15} /><span><strong>Termin zgłoszeń</strong> {okno ? `do 20.${okno.deadline.slice(5, 7)}.${okno.deadline.slice(0, 4)} (na ${mcNazwa})` : '—'}</span></div>
      </section>
      <form className="mobile-availability-form" onSubmit={wyslij}>
        <div className="mobile-section-head"><div><small>WYBRANY DZIEŃ</small><strong>{dyFmt(selectedDate)}</strong></div><CalendarCheck2 size={22} /></div>
        <fieldset className="mobile-type-grid">
          <legend>Wybierz swoją dyspozycję</legend>
          {DY_TYPES.map((o) => <button type="button" key={o.id} className={`${typ === o.id ? 'active' : ''} ${o.id === 'specific_shift' ? 'wide' : ''}`} onClick={() => setTyp(o.id)}>
            <span><o.icon size={19} /></span><div><strong>{o.title}</strong><small>{o.detail}</small></div>{typ === o.id && <i><Check size={12} /></i>}
          </button>)}
        </fieldset>
        {(typ === 'from_time' || typ === 'until_time' || typ === 'specific_shift') && <div className="mobile-time-fields">
          {(typ === 'from_time' || typ === 'specific_shift') && <label><span>{typ === 'specific_shift' ? 'Początek' : 'Mogę od'}</span><select value={startTime} onChange={(e) => setStartTime(e.target.value)}>{DY_CZASY.map((t) => <option key={t}>{t}</option>)}</select></label>}
          {(typ === 'until_time' || typ === 'specific_shift') && <label><span>{typ === 'specific_shift' ? 'Koniec' : 'Mogę do'}</span><select value={endTime} onChange={(e) => setEndTime(e.target.value)}>{DY_CZASY.map((t) => <option key={t}>{t}</option>)}</select></label>}
        </div>}
        <section className="mobile-repeat-card">
          <div><Repeat2 size={18} /><span><strong>Powtarzaj co tydzień</strong><small>Ta sama dyspozycja w kolejne tygodnie</small></span><button type="button" className={recurrence === 'weekly' ? 'on' : ''} aria-label="Powtarzaj co tydzień" onClick={() => setRecurrence((v) => v === 'once' ? 'weekly' : 'once')}><i /></button></div>
          {recurrence === 'weekly' && <label><span>Powtarzaj do</span><input type="date" value={repeatUntil} min={selectedDate} onChange={(e) => setRepeatUntil(e.target.value)} /></label>}
        </section>
        <label className="mobile-comment"><span><MessageSquare size={16} /> Komentarz <small>(opcjonalnie)</small></span><textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Np. zajęcia na uczelni, opieka nad dzieckiem..." /><small>{note.length}/500</small></label>
        <button className="mobile-submit" disabled={saving || zamkniete || !wOknie(selectedDate)}><Check size={18} /> {zamkniete ? 'Okno zamknięte' : !wOknie(selectedDate) ? `Wybierz dzień z ${mcNazwa}` : saving ? 'Wysyłanie...' : 'Wyślij dyspozycję'}</button>
      </form>
      <section className="mobile-my-requests">
        <header><div><small>MOJE ZGŁOSZENIA</small><strong>Nadchodzące dyspozycje</strong></div><span>{nadchodzace.length}</span></header>
        {nadchodzace.slice(0, 4).map((r) => <article key={r.id}>
          <div className={`mobile-request-icon ${r.type}`}><CalendarCheck2 size={18} /></div>
          <div><strong>{dyFmt(r.date)}</strong><span>{dyLabel(r)}</span>{r.recurrence === 'weekly' && <small><Repeat2 size={11} /> co tydzień do {r.repeatUntil}</small>}{r.managerNote && <small><MessageSquare size={11} /> {r.managerNote}</small>}</div>
          <b className={r.status}>{r.status === 'pending' ? 'Oczekuje' : r.status === 'approved' ? 'Zaakceptowana' : 'Odrzucona'}</b>
        </article>)}
        {!nadchodzace.length && <article><div className="mobile-request-icon available"><CalendarCheck2 size={18} /></div><div><strong>Brak zgłoszeń</strong><span>Wyślij pierwszą dyspozycję powyżej.</span></div></article>}
      </section>
      {toast && <div className="rex-mobile-toast"><Check size={16} /> {toast}</div>}
    </div>
  );
};

// WFM-03: wnioski o urlop / absencje — pracownik składa, kierownik decyduje w panelu
const WnioskiPage = () => {
  const [lista, setLista] = useState(null);
  const [typ, setTyp] = useState('urlop');
  const [od, setOd] = useState('');
  const [doDnia, setDoDnia] = useState('');
  const [powod, setPowod] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const TY = { urlop: 'Urlop wypoczynkowy', uz: 'Urlop na żądanie', l4: 'Zwolnienie (L4)', inne: 'Inna absencja' };
  const ST = { open: ['Oczekuje', '#A7465F', '#F1E4E8'], approved: ['Zatwierdzony', '#741334', '#F1E4E8'], rejected: ['Odrzucony', '#B94352', '#F5E3E8'], cancelled: ['Wycofany', '#A38D95', '#EDE3E6'] };
  const zaladuj = () => { api('/absences').then((r) => { if (r.success) setLista(r.absences || []); }).catch(() => {}); };
  useEffect(zaladuj, []);
  const wyslij = async () => {
    if (!od || !doDnia) return setMsg(['err', 'Podaj zakres dat']);
    setBusy(true); setMsg(null);
    const r = await apiSend('/absences', 'POST', { type: typ, from: od, to: doDnia, reason: powod });
    setBusy(false);
    if (r.success) { setOd(''); setDoDnia(''); setPowod(''); zaladuj(); setMsg(['ok', 'Wniosek wysłany — czeka na decyzję kierownika.']); }
    else setMsg(['err', r.error || 'Nie udało się wysłać wniosku']);
  };
  const wycofaj = async (a) => { const r = await apiSend('/absences', 'PUT', { id: a.id, action: 'cancel' }); if (r.success) zaladuj(); else alert(r.error || 'Błąd'); };
  const inp = 'w-full px-3 py-2.5 rounded-lg border text-sm';
  return (
    <div className="p-4 space-y-4 pb-24">
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <h3 className="text-lg font-semibold mb-3">Nowy wniosek</h3>
        {msg && <div className="p-2.5 rounded-lg mb-3 text-sm" style={{ backgroundColor: msg[0] === 'ok' ? '#F1E4E8' : '#F5E3E8', color: msg[0] === 'ok' ? '#741334' : '#B94352' }}>{msg[1]}</div>}
        <div className="space-y-3">
          <select value={typ} onChange={(e) => setTyp(e.target.value)} className={inp} style={{ borderColor: colors.primary.bg }}>{Object.entries(TY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <div className="flex gap-2">
            <div className="flex-1"><label className="text-xs text-slate-500">Od</label><input type="date" value={od} onChange={(e) => setOd(e.target.value)} className={inp} style={{ borderColor: colors.primary.bg }} /></div>
            <div className="flex-1"><label className="text-xs text-slate-500">Do</label><input type="date" value={doDnia} onChange={(e) => setDoDnia(e.target.value)} className={inp} style={{ borderColor: colors.primary.bg }} /></div>
          </div>
          <input value={powod} onChange={(e) => setPowod(e.target.value)} placeholder="Powód (opcjonalnie)" className={inp} style={{ borderColor: colors.primary.bg }} />
          <button disabled={busy} onClick={wyslij} className="w-full py-3 rounded-xl text-white font-semibold disabled:opacity-50" style={{ backgroundColor: colors.primary.medium }}>{busy ? 'Wysyłam…' : 'Wyślij wniosek'}</button>
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <h3 className="text-lg font-semibold mb-3">Moje wnioski</h3>
        {lista === null ? <p className="text-sm text-slate-400">Ładowanie…</p> : lista.length === 0 ? <p className="text-sm text-slate-400">Brak wniosków.</p> : (
          <div className="space-y-2">
            {lista.map((a) => { const st = ST[a.status] || ST.open; return (
              <div key={a.id} className="rounded-xl p-3" style={{ backgroundColor: colors.primary.bgLight }}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{TY[a.type] || a.type}</p>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color: st[1], backgroundColor: st[2] }}>{st[0]}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{a.from} → {a.to}{a.reason ? ` · ${a.reason}` : ''}</p>
                {a.decidedBy && <p className="text-[11px] text-slate-400 mt-0.5">Decyzja: {a.decidedBy}</p>}
                {a.status === 'open' && <button onClick={() => wycofaj(a)} className="text-xs mt-2 font-medium" style={{ color: '#B94352' }}>Wycofaj wniosek</button>}
              </div>
            ); })}
          </div>
        )}
      </div>
    </div>
  );
};

const HomePage = ({ nextShift, onNavigateToShifts, monthHours, monthShiftCount, publikacje = [], onConfirm }) => {
  const [, force] = useState(0);
  useEffect(() => { const i = setInterval(() => force(n => n + 1), 60000); return () => clearInterval(i); }, []);
  const countdown = () => {
    if (!nextShift) return { days: 0, hours: 0, min: 0 };
    const target = new Date(nextShift.date); const [h, m] = nextShift.start.split(':'); target.setHours(+h, +m, 0, 0);
    const diff = target - new Date();
    if (diff <= 0) return { days: 0, hours: 0, min: 0 };
    return { days: Math.floor(diff / 86400000), hours: Math.floor((diff % 86400000) / 3600000), min: Math.floor((diff % 3600000) / 60000) };
  };
  const cd = countdown();
  const niepotwierdzone = publikacje.filter((x) => !x.potwierdzone);
  return (
    <div className="p-4 space-y-4 pb-24">
      <HubClockCard />
      {niepotwierdzone.map((pb) => (
        <div key={pb.month} className="bg-white rounded-2xl shadow-sm p-4" style={{ borderLeft: '4px solid #A7465F' }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-sm">Nowy grafik: {pb.month} <span className="text-xs font-normal text-slate-400">(wersja {pb.wersjaPub})</span></p>
              <p className="text-xs text-slate-500 mt-0.5">Zapoznaj się ze zmianami i potwierdź otrzymanie grafiku.</p>
            </div>
            <button onClick={() => onConfirm(pb.month)} className="px-3 py-2 rounded-lg text-white text-sm font-semibold shrink-0" style={{ backgroundColor: colors.primary.medium }}>Potwierdzam</button>
          </div>
        </div>
      ))}
      <div className="bg-white rounded-2xl shadow-sm p-4 cursor-pointer" style={{borderLeft: '4px solid '+colors.primary.medium}} onClick={onNavigateToShifts}>
        <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold">Następna zmiana</h3><Calendar size={24} style={{color: colors.primary.medium}} /></div>
        {nextShift ? (
          <div className="flex gap-4">
            <div className="rounded-xl p-3 text-center min-w-16" style={{backgroundColor: colors.primary.bg}}><p className="text-sm" style={{color: colors.primary.light}}>{dayShort[new Date(nextShift.date).getDay()]}</p><p className="text-3xl font-bold">{new Date(nextShift.date).getDate()}</p><p className="text-xs" style={{color: colors.primary.light}}>{monthNames[new Date(nextShift.date).getMonth()].slice(0,3).toUpperCase()}</p></div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1"><Clock size={16} className="text-slate-400" /><span className="font-semibold">{nextShift.start} - {nextShift.end}</span></div>
              <div className="flex items-center gap-2 mb-2"><Briefcase size={14} style={{color: stationColor(nextShift.station)}} /><span className="text-sm font-medium" style={{color: stationColor(nextShift.station)}}>{nextShift.station}</span></div>
              <div className="flex gap-4 mt-3 pt-3 border-t">
                <div className="text-center"><p className="text-2xl font-bold" style={{color: colors.primary.medium}}>{cd.days}</p><p className="text-xs text-slate-500">Dni</p></div>
                <div className="text-center"><p className="text-2xl font-bold">{cd.hours}</p><p className="text-xs text-slate-500">godz</p></div>
                <div className="text-center"><p className="text-2xl font-bold">{cd.min}</p><p className="text-xs text-slate-500">min</p></div>
              </div>
              <p className="text-xs text-slate-400 mt-2">do rozpoczęcia</p>
            </div>
          </div>
        ) : (<div className="text-center py-4"><Cloud size={40} className="text-slate-200 mx-auto mb-2" /><p className="text-slate-500">Brak zaplanowanych zmian</p></div>)}
      </div>
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <h3 className="text-lg font-semibold mb-4">Ten miesiąc</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl p-4 text-center" style={{backgroundColor: colors.primary.bg}}><p className="text-3xl font-bold" style={{color: colors.primary.dark}}>{monthHours.toFixed(1)}</p><p className="text-sm" style={{color: colors.primary.light}}>godzin</p></div>
          <div className="rounded-xl p-4 text-center" style={{backgroundColor: colors.accent.bg}}><p className="text-3xl font-bold" style={{color: colors.accent.dark}}>{monthShiftCount}</p><p className="text-sm" style={{color: colors.accent.dark}}>zmian</p></div>
        </div>
      </div>
    </div>
  );
};

const ShiftsPage = ({ date, onDateChange, shifts, onOpenTeam }) => {
  const [selectedDay, setSelectedDay] = useState(null);
  const todayStr = getTodayString();
  const filtered = shifts.filter(s => { const d = new Date(s.date); return (!selectedDay || d.getDate() === selectedDay) && d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear(); }).sort((a, b) => new Date(a.date) - new Date(b.date) || a.start.localeCompare(b.start));
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-20">
      <CalendarView date={date} onDateChange={onDateChange} shifts={shifts} onDayClick={setSelectedDay} selectedDay={selectedDay} />
      <div className="flex-1 p-4">
        {filtered.length === 0 ? (<div className="text-center py-12"><Cloud size={48} className="text-slate-300 mx-auto mb-4" /><p className="text-slate-500">Brak zmian w tym okresie</p></div>) : (<>
          <p className="text-xs text-slate-400 mb-3 flex items-center gap-1"><Users size={13} />Kliknij dwukrotnie dzień (lub ikonę) — zobaczysz zespół</p>
          {filtered.map((shift, i) => (
            <div key={i}>
              {shift.date === todayStr && (<div className="flex items-center gap-2 mb-2 px-2"><div className="h-px flex-1" style={{backgroundColor: colors.primary.medium}}></div><span className="text-xs font-semibold px-2 py-1 rounded-full" style={{backgroundColor: colors.primary.bg, color: colors.primary.dark}}>DZIŚ</span><div className="h-px flex-1" style={{backgroundColor: colors.primary.medium}}></div></div>)}
              <DblTapRow onDouble={() => onOpenTeam(shift.date)}><ShiftCard shift={shift} isToday={shift.date === todayStr} onTeam={() => onOpenTeam(shift.date)} /></DblTapRow>
            </div>
          ))}
        </>)}
      </div>
    </div>
  );
};

const HoursPage = ({ shifts }) => {
  const now = new Date();
  const monthsData = useMemo(() => {
    const arr = [];
    for (let i = 2; i >= 0; i--) {
      let month = now.getMonth() - i, year = now.getFullYear();
      if (month < 0) { month += 12; year -= 1; }
      const ms = shifts.filter(s => { const d = new Date(s.date); return d.getMonth() === month && d.getFullYear() === year; });
      const totalH = ms.reduce((a, s) => a + (s.hours != null ? s.hours : calcHours(s.start, s.end)), 0);
      // Station breakdown
      const stations = {};
      ms.forEach(s => { const st = s.station || 'Inne'; stations[st] = (stations[st] || 0) + (s.hours != null ? s.hours : calcHours(s.start, s.end)); });
      arr.push({ month, year, label: monthNames[month].slice(0, 3), fullLabel: monthNames[month], totalHours: totalH, count: ms.length, stations });
    }
    return arr;
  }, [shifts]);
  const cur = monthsData[2];
  const max = Math.max(...monthsData.map(m => m.totalHours), 1);
  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-24 space-y-4">
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold">{cur.fullLabel} {cur.year}</h3><Clock size={24} style={{color: colors.primary.medium}} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl p-4 text-center" style={{backgroundColor: colors.primary.bg}}><p className="text-3xl font-bold" style={{color: colors.primary.dark}}>{cur.totalHours.toFixed(1)}</p><p className="text-sm" style={{color: colors.primary.light}}>godzin</p></div>
          <div className="rounded-xl p-4 text-center" style={{backgroundColor: colors.accent.bg}}><p className="text-3xl font-bold" style={{color: colors.accent.dark}}>{cur.count}</p><p className="text-sm" style={{color: colors.accent.dark}}>zmian</p></div>
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <h3 className="text-lg font-semibold mb-4">Ostatnie 3 miesiące</h3>
        <div className="flex items-end justify-between gap-2 h-32">{monthsData.map((m, i) => { const h = (m.totalHours / max) * 100; return (<div key={i} className="flex flex-col items-center flex-1"><span className="text-xs font-semibold mb-1">{m.totalHours.toFixed(0)}h</span><div className="w-full rounded-t-lg" style={{ height: Math.max(h, 5)+'%', backgroundColor: colors.primary.medium, opacity: i === 2 ? 1 : 0.6 }} /><span className="text-xs text-slate-500 mt-2">{m.label}</span></div>); })}</div>
      </div>
      {Object.keys(cur.stations).length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h3 className="text-lg font-semibold mb-4">Podział wg stanowisk — {cur.fullLabel}</h3>
          <div className="space-y-2">
            {Object.entries(cur.stations).sort((a,b) => b[1]-a[1]).map(([st, h]) => { const pct = (h / cur.totalHours) * 100; return (
              <div key={st} className="flex items-center gap-3">
                <span className="text-xs font-medium w-32 truncate">{st}</span>
                <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: pct+'%', backgroundColor: stationColor(st) }} /></div>
                <span className="text-sm text-slate-600 w-14 text-right">{h.toFixed(1)}h</span>
              </div>
            ); })}
          </div>
        </div>
      )}
    </div>
  );
};

const AboutPage = () => (
  <div className="min-h-screen bg-slate-50 p-4 pb-24"><div className="bg-white rounded-2xl overflow-hidden">
    <div className="p-8 text-center" style={{background: colors.primary.darkest}}><Cloud size={40} className="text-white mx-auto mb-4" /><span className="text-white text-2xl font-bold tracking-[0.22em]">ORDO</span><p className="mt-1 text-[11px] font-bold tracking-[0.3em]" style={{color: colors.primary.light}}>EMPLOYEE HUB</p><p className="mt-1" style={{color: colors.primary.bg}}>ORDO Workforce Cloud</p></div>
    <div className="p-6 space-y-4">
      <div className="rounded-xl p-4" style={{backgroundColor: colors.primary.bg}}><span className="font-semibold" style={{color: colors.primary.darkest}}>Jak to działa</span><ul className="text-sm mt-2 space-y-1" style={{color: colors.primary.dark}}><li>• Logujesz się swoim imieniem lub nazwiskiem</li><li>• Widzisz swój grafik ułożony przez kierownika</li><li>• Grafik pochodzi z matrycy Excel</li></ul></div>
      <p className="text-slate-500 text-sm text-center">© 2026 ORDO Employee Hub by M. Szewczyk</p>
    </div>
  </div></div>
);

// ===================== MAIN =====================

const SwapsPage = ({ user, shifts, swaps, onCreate, onVolunteer, onUnvolunteer, onCancel, onRefresh }) => {
  const me = user.name;
  const [sel, setSel] = useState('');
  const [note, setNote] = useState('');
  const today = getTodayString();
  const myUpcoming = shifts.filter(s => s.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  const mojaProsba = (s) => s.requesterAccountId ? s.requesterAccountId === user.id : normalizeName(s.requester) === normalizeName(me);
  const juz = new Set(swaps.filter(s => s.status === 'open' && mojaProsba(s)).map(swapKey));
  const dostepneMoje = myUpcoming.filter(s => !juz.has(swapKey(s)));
  const otwarteInnych = swaps.filter(s => s.status === 'open' && !mojaProsba(s));
  const mojeProsby = swaps.filter(s => mojaProsba(s)).sort((a, b) => b.createdAt - a.createdAt);
  const czyZgloszony = (s) => s.volunteers.some(v => normalizeName(v) === normalizeName(me));
  const wyslij = () => { const s = dostepneMoje.find(x => swapKey(x) === sel); if (!s) return; onCreate(s, note); setSel(''); setNote(''); };
  const inp = 'w-full px-3 py-2.5 rounded-xl border';

  return (
    <div className="p-4 space-y-4 pb-24">
      <div className="flex justify-end"><button onClick={onRefresh} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg" style={{ color: colors.primary.medium }}><RefreshCw size={16} />Odśwież</button></div>

      <div className="bg-white rounded-2xl shadow-sm p-4">
        <h3 className="font-semibold mb-1" style={{ color: colors.primary.darkest }}>Oddaj zmianę do zamiany</h3>
        <p className="text-xs mb-3" style={{ color: colors.primary.light }}>Wybierz swoją nadchodzącą zmianę — trafi na giełdę, a ASM zatwierdzi finalną zamianę.</p>
        {dostepneMoje.length === 0 ? <p className="text-sm text-slate-400">Brak nadchodzących zmian do wystawienia.</p> : (
          <div className="space-y-2">
            <select value={sel} onChange={e => setSel(e.target.value)} className={inp} style={{ borderColor: colors.primary.bg }}>
              <option value="">— wybierz zmianę —</option>
              {dostepneMoje.map(s => <option key={swapKey(s)} value={swapKey(s)}>{opisZmiany(s)}</option>)}
            </select>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Powód (opcjonalnie)" className={inp} style={{ borderColor: colors.primary.bg }} />
            <button onClick={wyslij} className="w-full text-white font-semibold py-2.5 rounded-xl" style={{ backgroundColor: colors.primary.medium }}>Wyślij prośbę o zamianę</button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-4">
        <h3 className="font-semibold mb-3" style={{ color: colors.primary.darkest }}>Giełda — zmiany innych ({otwarteInnych.length})</h3>
        {otwarteInnych.length === 0 ? <p className="text-sm text-slate-400">Brak otwartych zamian.</p> : (
          <div className="space-y-2">
            {otwarteInnych.map(s => (
              <div key={s.id} className="rounded-xl p-3 flex items-center justify-between gap-2" style={{ backgroundColor: colors.primary.bgLight }}>
                <div><p className="text-sm font-medium" style={{ color: colors.primary.darkest }}>{s.requesterDisplay || s.requester}</p><p className="text-xs" style={{ color: colors.primary.dark }}>{opisZmiany(s.shift)}</p>{s.note && <p className="text-xs italic text-slate-400">„{s.note}"</p>}</div>
                {czyZgloszony(s)
                  ? <button onClick={() => onUnvolunteer(s.id)} className="text-xs px-3 py-2 rounded-lg font-medium shrink-0" style={{ backgroundColor: '#fff2e8', color: '#A7465F' }}>Zgłoszony ✓</button>
                  : <button onClick={() => onVolunteer(s.id)} className="text-xs px-3 py-2 rounded-lg font-medium text-white shrink-0" style={{ backgroundColor: colors.primary.medium }}>Zgłoś się</button>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-4">
        <h3 className="font-semibold mb-3" style={{ color: colors.primary.darkest }}>Moje prośby ({mojeProsby.length})</h3>
        {mojeProsby.length === 0 ? <p className="text-sm text-slate-400">Nie masz jeszcze próśb o zamianę.</p> : (
          <div className="space-y-2">
            {mojeProsby.map(s => { const st = statusZamiany(s); return (
              <div key={s.id} className="rounded-xl p-3" style={{ backgroundColor: st.bg }}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium" style={{ color: colors.primary.dark }}>{opisZmiany(s.shift)}</p>
                  {s.status === 'open' && <button onClick={() => onCancel(s.id)} className="text-xs px-2 py-1 rounded-lg shrink-0" style={{ backgroundColor: 'white', color: '#B94352' }}>Anuluj</button>}
                </div>
                <p className="text-xs mt-1 font-medium" style={{ color: st.kol }}>{st.txt}</p>
                {s.status === 'open' && s.volunteers.length > 0 && <p className="text-xs mt-0.5 text-slate-500">Zgłoszeni: {(s.volunteersDisplay || s.volunteers.map(v => ({ display: v }))).map(v => v.display).join(', ')}</p>}
              </div>
            ); })}
          </div>
        )}
      </div>
    </div>
  );
};


// ═════════ ORDO EMPLOYEE HUB — układ wg wzorca v8 (realne dane) ═════════
const EH_TABS = [
  ['start', 'Start', Home], ['schedule', 'Grafik', Calendar], ['time', 'Czas', Clock3],
  ['requests', 'Wnioski', RefreshCw], ['more', 'Więcej', Menu],
];
const ehCzas = (ts) => new Date(ts).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
const ehDur = (sek) => `${String(Math.floor(sek / 3600)).padStart(2, '0')}:${String(Math.floor(sek / 60) % 60).padStart(2, '0')}:${String(sek % 60).padStart(2, '0')}`;
const EH_PUNCH = {
  clock_in: { title: 'Rozpocząć zmianę?', button: 'Potwierdź wejście', note: 'Zdarzenie trafi bezpośrednio do karty czasu i obsady managera.' },
  break_start: { title: 'Rozpocząć przerwę?', button: 'Rozpocznij przerwę', note: 'Manager zobaczy zmianę statusu od razu.' },
  break_end: { title: 'Zakończyć przerwę?', button: 'Wróć do pracy', note: 'Czas przerwy zostanie dopisany do dzisiejszej karty czasu.' },
  clock_out: { title: 'Zakończyć zmianę?', button: 'Potwierdź wyjście', note: 'Po wyjściu karta czasu trafi do rozliczenia.' },
};

const ehShiftTone = (st) => { const S = String(st || '').toUpperCase(); if (S.includes('KONTROLER')) return 'control'; if (S === 'MANAGER' || S === 'MGR FUNKCYJNE') return 'lead'; if (['SMAŻENIE', 'PANIEROWANIE', 'PREP', 'FRYTKI', 'ZMYWAK', 'BATTER'].includes(S)) return 'production'; return 'operations'; };

const EhHub = ({ user, shifts, swaps, publikacje, onConfirmGrafik, onLogout, openTeam, swapActions }) => {
  const [tab, setTab] = useState('start');
  const [now, setNow] = useState(new Date());
  const [hub, setHub] = useState(null);
  const [pending, setPending] = useState(null);
  const [pendingBreak, setPendingBreak] = useState('unpaid');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState(null);
  const [dyspo, setDyspo] = useState([]);
  const [absencje, setAbsencje] = useState([]);
  const [okno, setOkno] = useState(null);
  const [avDraft, setAvDraft] = useState({ date: '', kind: 'available', time: '14:00' });
  const [abDraft, setAbDraft] = useState({ type: 'urlop', from: '', to: '', note: '' });
  const [swapSel, setSwapSel] = useState('');
  const dzis = getTodayString();
  const pokaz = (m) => { setToast(m); setTimeout(() => setToast(''), 3600); };

  const zaladujHub = () => api('/clock?action=hub-state').then((r) => { if (r.success) setHub(r); }).catch(() => {});
  const zaladujWnioski = () => {
    api('/availability?reqs=1').then((r) => { if (r.success) setDyspo(r.requests || []); }).catch(() => {});
    api('/absences').then((r) => { if (r.success) setAbsencje(r.absences || []); }).catch(() => {});
    api('/availability?window=1').then((r) => { if (r.success && r.okno) { setOkno(r.okno); setAvDraft((v) => v.date ? v : { ...v, date: `${r.okno.targetMonth}-01` }); } }).catch(() => {});
  };
  useEffect(() => { zaladujHub(); zaladujWnioski(); const t1 = setInterval(zaladujHub, 30000); const t2 = setInterval(() => setNow(new Date()), 1000); return () => { clearInterval(t1); clearInterval(t2); }; }, []);

  const ev = (hub && hub.events) || [];
  const workState = !hub ? 'idle' : hub.state === 'working' ? 'working' : hub.state === 'break' ? 'break' : ev.some((e) => e.type === 'clock_out') ? 'done' : 'idle';
  const workLabel = workState === 'idle' ? 'Poza zmianą' : workState === 'working' ? 'Na zmianie' : workState === 'break' ? 'Na przerwie' : 'Zmiana zakończona';
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
      pokaz(typ === 'clock_in' ? 'Zmiana rozpoczęta. Manager widzi Cię teraz w obsadzie LIVE.' : typ === 'clock_out' ? 'Zmiana zakończona. Karta czasu została zapisana.' : typ === 'break_start' ? 'Przerwa rozpoczęta.' : 'Przerwa zakończona. Miłego powrotu!');
    } else pokaz(r.error || 'Nie udało się zapisać zdarzenia');
  };

  const wyslijDyspo = async () => {
    const typMap = { available: 'available', unavailable: 'unavailable', from: 'from_time', until: 'until_time' };
    const r = await apiSend('/availability?action=request', 'POST', { date: avDraft.date, type: typMap[avDraft.kind], startTime: avDraft.time, endTime: avDraft.time, note: '' });
    if (r.success) { setModal(null); zaladujWnioski(); pokaz('Dyspozycyjność została wysłana do managera.'); }
    else pokaz(r.error || 'Nie udało się wysłać dyspozycji');
  };
  const wyslijAbsencje = async () => {
    const r = await apiSend('/absences', 'POST', { type: abDraft.type, from: abDraft.from, to: abDraft.to, reason: abDraft.note });
    if (r.success) { setModal(null); zaladujWnioski(); pokaz('Wniosek wysłany. Manager otrzymał powiadomienie.'); }
    else pokaz(r.error || 'Nie udało się wysłać wniosku');
  };

  const mies = useMemo(() => { const set = new Set(shifts.map((x) => x.date.slice(0, 7))); set.add(dzis.slice(0, 7)); return [...set].sort(); }, [shifts]);
  const [mIdx, setMIdx] = useState(-1);
  useEffect(() => { if (mIdx === -1 && mies.length) setMIdx(Math.max(0, mies.indexOf(dzis.slice(0, 7)))); }, [mies]);
  const ym = mies[Math.max(0, mIdx)] || dzis.slice(0, 7);
  const [selDay, setSelDay] = useState(dzis);
  const kalDni = useMemo(() => {
    const [y, m] = ym.split('-').map(Number);
    const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;
    const dim = new Date(y, m, 0).getDate();
    const out = [...Array.from({ length: lead }, () => null), ...Array.from({ length: dim }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`)];
    while (out.length % 7 !== 0 || out.length < 42) out.push(null);
    return out;
  }, [ym]);
  const zmianyDnia = (d) => shifts.filter((x) => x.date === d);
  const mcLabel = (k) => { const [y, m] = String(k).split('-').map(Number); return `${monthNames[m - 1]} ${y}`; };
  const selShifts = zmianyDnia(selDay);
  const niepotw = (publikacje || []).filter((x) => !x.potwierdzone);
  const mieszH = shifts.filter((x) => x.date.slice(0, 7) === ym).reduce((a, x2) => a + (x2.hours != null ? x2.hours : calcHours(x2.start, x2.end)), 0);
  const zaNamiH = shifts.filter((x) => x.date.slice(0, 7) === ym && x.date < dzis).reduce((a, x2) => a + (x2.hours || 0), 0);

  const me = user.name;
  const mojaProsba = (x) => x.requesterAccountId ? x.requesterAccountId === user.id : normalizeName(x.requester) === normalizeName(me);
  const otwarteInnych = swaps.filter((x) => x.status === 'open' && !mojaProsba(x));
  const mojeProsby = swaps.filter(mojaProsba).sort((a, b) => b.createdAt - a.createdAt);
  const zgloszony = (x) => x.volunteers.some((v) => normalizeName(v) === normalizeName(me));
  const przyszle = shifts.filter((x) => x.date >= dzis).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  const DY_LBL = (r) => r.type === 'available' ? 'Dostępny · cały dzień' : r.type === 'unavailable' ? 'Niedostępny · cały dzień' : r.type === 'from_time' ? `Dostępny od ${r.startTime}` : r.type === 'until_time' ? `Dostępny do ${r.endTime}` : `Zmiana ${r.startTime}–${r.endTime}`;
  const AB_LBL = { urlop: 'Urlop wypoczynkowy', uz: 'Urlop na żądanie', l4: 'Zwolnienie (L4)', inne: 'Inna absencja' };
  const ST_LBL = { pending: 'Do decyzji', open: 'Do decyzji', approved: 'Zatwierdzony', rejected: 'Odrzucony', cancelled: 'Wycofany' };
  const inicjaly = (user.display || user.name).split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const dataNaglowek = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);

  return (
    <main className="employee-hub">
      {toast && <div className="eh-toast"><Check size={17} />{toast}</div>}
      <header className="eh-header">
        <div className="eh-brand"><b style={{ letterSpacing: '.2em', fontSize: 17, color: '#3f0b1c' }}>ORDO</b><span>EMPLOYEE HUB</span></div>
        <nav aria-label="Nawigacja Employee Hub">{EH_TABS.map(([id, label, Icon]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={17} />{label}</button>)}</nav>
        <div className="eh-header-actions"><button aria-label="Powiadomienia" onClick={() => setTab('requests')}><Bell size={19} />{niepotw.length > 0 && <i />}</button><div>{inicjaly}</div></div>
      </header>

      <div className="eh-container">
        {tab === 'start' && <>
          <section className="eh-welcome"><div><span>{dataNaglowek}</span><h1>Dzień dobry, {(user.display || user.name).split(' ')[0]}</h1><p>{dzisZmiana ? `Masz dziś zmianę ${dzisZmiana.start}–${dzisZmiana.end} na stanowisku ${dzisZmiana.station}.` : 'Nie masz dziś zaplanowanej zmiany.'} Wszystkie najważniejsze akcje są poniżej.</p></div><div className="eh-current-time"><Clock3 size={18} /><span>{now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</span></div></section>

          <section className="eh-home-grid">
            <article className={`eh-punch-card ${workState}`}>
              <div className="eh-punch-head"><div><span>REJESTRACJA CZASU</span><h2>{workLabel}</h2></div><em><i />{workState === 'idle' ? 'GOTOWE' : workState === 'done' ? 'ZAPISANO' : 'AKTYWNE'}</em></div>
              <div className="eh-punch-time"><strong>{workState === 'idle' ? ((hub && hub.planned && hub.planned.start) || (dzisZmiana && dzisZmiana.start) || '—') : ehDur(elapsed)}</strong><span>{workState === 'idle' ? 'planowany start' : 'czas od rozpoczęcia zmiany'}</span></div>
              <div className="eh-location"><MapPinIcon size={16} /><span><strong>{DEFAULT_LOCATION}</strong><small>{hub && hub.planned ? `Zaplanowana zmiana ${hub.planned.start}–${hub.planned.end}${hub.planned.station ? ` · ${hub.planned.station}` : ''}` : 'Rejestracja w aplikacji Employee Hub'}</small></span><Lock size={18} /></div>
              {workState === 'idle' && <button className="eh-main-punch" disabled={busy} onClick={() => setPending('clock_in')}><LogIn size={20} /> Rozpocznij zmianę</button>}
              {workState === 'working' && <div className="eh-punch-actions"><button disabled={busy} onClick={() => { setPendingBreak('unpaid'); setPending('break_start'); }}><Coffee size={18} /> Rozpocznij przerwę</button><button disabled={busy} onClick={() => setPending('clock_out')}><LogOut size={18} /> Zakończ zmianę</button></div>}
              {workState === 'break' && <button className="eh-main-punch" disabled={busy} onClick={() => setPending('break_end')}><Timer size={20} /> Zakończ przerwę</button>}
              {workState === 'done' && <button className="eh-main-punch" disabled><Check size={20} /> Zmiana zakończona</button>}
              <small className="eh-punch-note">Każde zdarzenie trafia bezpośrednio do karty czasu i obsady managera.</small>
            </article>
            <aside className="eh-today-stack">
              <article className="eh-card eh-next-shift"><div className="eh-card-head"><span>DZISIEJSZA ZMIANA</span><em>{dzisZmiana ? 'OPUBLIKOWANA' : 'WOLNE'}</em></div><strong>{dzisZmiana ? `${dzisZmiana.start}–${dzisZmiana.end}` : '—'}</strong><p>{dzisZmiana ? `${dzisZmiana.station} · ${(dzisZmiana.hours != null ? dzisZmiana.hours : calcHours(dzisZmiana.start, dzisZmiana.end))} h` : 'Brak zaplanowanej zmiany na dziś.'}</p><div><span><Users size={15} /> Zespół dnia po dwukliku w grafiku</span><button onClick={() => setTab('schedule')}>Szczegóły <ChevronRight size={15} /></button></div></article>
              <article className="eh-card eh-month-hours"><div className="eh-card-head"><span>{mcLabel(ym).toUpperCase()}</span><button onClick={() => setTab('time')}>Historia</button></div><div><strong>{mieszH.toFixed(1).replace('.', ',')} h</strong><span>zaplanowano</span></div><i><b style={{ width: `${Math.min(100, Math.round(zaNamiH / Math.max(1, mieszH) * 100))}%` }} /></i><small>{zaNamiH.toFixed(1).replace('.', ',')} / {mieszH.toFixed(1).replace('.', ',')} h za nami</small></article>
            </aside>
          </section>

          <section className="eh-quick-grid">
            <button onClick={() => setModal('availability')}><i><CalendarCheck2 size={19} /></i><span><strong>Dyspozycyjność</strong><small>{okno ? (okno.otwarte ? `Okno otwarte do 20.${okno.deadline.slice(5, 7)}` : 'Okno zamknięte') : 'Dodaj dzień i godziny'}</small></span><ChevronRight size={16} /></button>
            <button onClick={() => setModal('absence')}><i><Calendar size={19} /></i><span><strong>Nieobecność</strong><small>Złóż nowy wniosek</small></span><ChevronRight size={16} /></button>
            <button onClick={() => setTab('requests')}><i><RefreshCw size={19} /></i><span><strong>Giełda zmian</strong><small>{otwarteInnych.length ? `${otwarteInnych.length} otwartych ofert` : 'Brak otwartych ofert'}</small></span><ChevronRight size={16} /></button>
            <button className="is-disabled" disabled><i><Briefcase size={19} /></i><span><strong>Zadania</strong><small>Wkrótce</small></span><ChevronRight size={16} /></button>
          </section>

          <section className="eh-bottom-grid">
            <article className="eh-card eh-activity"><div className="eh-card-head"><span>DZISIAJ</span><button onClick={() => setTab('time')}>Pełna karta czasu</button></div>{ev.length ? [...ev].reverse().slice(0, 4).map((e) => <div key={e.cid}><i>{e.type.includes('break') ? <Coffee size={16} /> : e.type === 'clock_in' ? <LogIn size={16} /> : <LogOut size={16} />}</i><span><strong>{HUB_ETYKIETY[e.type]}{e.type === 'break_start' ? (e.paid ? ' (płatna)' : ' (niepłatna)') : ''}</strong><small>ORDO Employee Hub · {DEFAULT_LOCATION}</small></span><em>{ehCzas(e.at)}</em></div>) : <div className="eh-empty"><History size={20} /><span>Pierwsze zdarzenie pojawi się po rozpoczęciu zmiany.</span></div>}</article>
            <article className="eh-card eh-learning eh-learning-disabled"><div className="eh-card-head"><span>SZKOLENIA</span><em>WYŁĄCZONE</em></div><div><i><Briefcase size={24} /></i><span><strong>Moduł szkoleń jest nieaktywny</strong><small>Zostanie udostępniony w późniejszym terminie</small></span></div><button disabled><X size={16} /> Tymczasowo niedostępne</button></article>
          </section>
        </>}

        {tab === 'schedule' && <section className="eh-page">
          <div className="eh-page-heading"><div><span>MÓJ CZAS</span><h1>Kalendarz miesięczny</h1><p>Cały miesiąc w jednym widoku. Kliknij dzień, a dwuklikiem na zmianie otwórz skład zespołu.</p></div><div className="eh-month-control"><button onClick={() => setMIdx((v) => Math.max(0, v - 1))} aria-label="Poprzedni miesiąc"><ChevronLeft size={17} /></button><strong>{mcLabel(ym)}</strong><button onClick={() => setMIdx((v) => Math.min(mies.length - 1, v + 1))} aria-label="Następny miesiąc"><ChevronRight size={17} /></button><button onClick={() => { setMIdx(Math.max(0, mies.indexOf(dzis.slice(0, 7)))); setSelDay(dzis); }}>Dzisiaj</button></div></div>
          <div className="eh-month-layout">
            <article className="eh-card eh-month-calendar">
              <div className="eh-calendar-toolbar"><div><span>GRAFIK OPUBLIKOWANY</span><strong>{mcLabel(ym)}</strong></div><small><Users size={14} /> Dwuklik na zmianie = podgląd zespołu</small></div>
              <div className="eh-calendar-weekdays">{['PON', 'WT', 'ŚR', 'CZW', 'PT', 'SOB', 'ND'].map((d2) => <span key={d2}>{d2}</span>)}</div>
              <div className="eh-calendar-grid">{kalDni.map((d2, i) => { const zs = d2 ? zmianyDnia(d2) : []; return <button key={i} disabled={!d2} className={`${d2 === selDay ? 'selected' : ''} ${zs.length ? 'has-shift' : ''} ${d2 === dzis ? 'today' : ''}`} onClick={() => d2 && setSelDay(d2)} onDoubleClick={() => d2 && zs.length && openTeam(d2)}><span>{d2 ? Number(d2.slice(8)) : ''}</span>{zs.slice(0, 1).map((z) => <i key={z.start} className={`eh-shift-${ehShiftTone(z.station)}`}><strong>{z.start}–{z.end}</strong><small>{z.station}</small></i>)}{d2 === dzis && <em>DZIŚ</em>}</button>; })}</div>
            </article>
            <aside className="eh-month-side">
              <article className="eh-card eh-day-detail"><div className="eh-card-head"><span>{Number(selDay.slice(8))} {mcLabel(selDay.slice(0, 7)).toUpperCase()}</span><em>{selShifts.length ? `${selShifts.length} ZMIANA` : 'WOLNE'}</em></div>{selShifts.length ? selShifts.map((z, i) => <div className={`eh-selected-shift eh-shift-${ehShiftTone(z.station)}`} key={i} onDoubleClick={() => openTeam(selDay)}><i><Calendar size={18} /></i><span><small>{nazwaStanowiska(z)}</small><strong>{z.start}–{z.end}</strong><em><MapPinIcon size={12} /> {DEFAULT_LOCATION}</em></span><b>{(z.hours != null ? z.hours : calcHours(z.start, z.end))} h</b><button onClick={() => openTeam(selDay)}><Users size={15} /> Zespół</button></div>) : <div className="eh-day-empty"><CalendarCheck2 size={22} /><strong>Brak zaplanowanej zmiany</strong><span>To Twój dzień wolny. W kalendarzu nie ma publikowanych godzin.</span></div>}<p className="eh-doubleclick-hint"><Users size={14} /> Dwuklik na kartę zmiany lub przycisk „Zespół" pokaże obsadę tego dnia.</p></article>
              {niepotw.length > 0 && <article className="eh-card eh-confirm-card"><i><CalendarCheck2 size={22} /></i><h2>Grafik opublikowany</h2><p>Potwierdź, że znasz godziny swoich zmian: {niepotw.map((x) => x.month).join(', ')}.</p><button onClick={() => onConfirmGrafik(niepotw[0].month)}>Potwierdź grafik</button></article>}
            </aside>
          </div>
        </section>}

        {tab === 'time' && <section className="eh-page">
          <div className="eh-page-heading"><div><span>MOJE GODZINY</span><h1>Czas pracy</h1><p>Zdarzenia z aplikacji i miesięczny bilans planu.</p></div></div>
          <section className="eh-stats"><div><span>Plan · {mcLabel(ym)}</span><strong>{mieszH.toFixed(1).replace('.', ',')} h</strong><small>{shifts.filter((x) => x.date.slice(0, 7) === ym).length} zmian</small></div><div><span>Za nami</span><strong>{zaNamiH.toFixed(1).replace('.', ',')} h</strong><small>wg planu</small></div><div><span>Dziś</span><strong>{workLabel}</strong><small>{ev.length} zdarzeń</small></div><div><span>Najbliższa zmiana</span><strong>{przyszle[0] ? `${Number(przyszle[0].date.slice(8))}.${przyszle[0].date.slice(5, 7)}` : '—'}</strong><small>{przyszle[0] ? `${przyszle[0].start}–${przyszle[0].end}` : 'brak w grafiku'}</small></div></section>
          <section className="eh-time-layout"><article className="eh-card eh-time-history"><div className="eh-card-head"><span>KARTA DZISIAJ</span><em>{workLabel}</em></div>{((hub && hub.planned) || dzisZmiana) && <div className="eh-time-line"><i /><span>Planowana zmiana</span><strong>{hub && hub.planned ? `${hub.planned.start}–${hub.planned.end}` : `${dzisZmiana.start}–${dzisZmiana.end}`}</strong></div>}{ev.map((e) => <div className="eh-time-line" key={e.cid}><i className="recorded" /><span>{HUB_ETYKIETY[e.type]}{e.type === 'break_start' ? (e.paid ? ' (płatna)' : ' (niepłatna)') : ''}</span><strong>{ehCzas(e.at)}</strong></div>)}{!ev.length && <div className="eh-empty"><Clock3 size={20} /><span>Brak zdarzeń. Rozpocznij zmianę na stronie startowej.</span></div>}</article><article className="eh-card eh-month-list"><div className="eh-card-head"><span>NADCHODZĄCE ZMIANY</span><button onClick={() => setTab('schedule')}>Grafik</button></div>{przyszle.slice(0, 5).map((z, i) => <div key={i}><span><strong>{new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: 'numeric', month: 'long' }).format(new Date(z.date + 'T12:00:00'))}</strong><small>{z.start}–{z.end} · {z.station}</small></span><b>{(z.hours != null ? z.hours : calcHours(z.start, z.end))} h</b><em>Opublikowana</em></div>)}{!przyszle.length && <div className="eh-empty"><Calendar size={20} /><span>Brak nadchodzących zmian w opublikowanym grafiku.</span></div>}</article></section>
        </section>}

        {tab === 'requests' && <section className="eh-page">
          <div className="eh-page-heading"><div><span>SELF-SERVICE</span><h1>Wnioski i zmiany</h1><p>Dyspozycyjność, urlopy oraz giełda zamian w jednym miejscu.</p></div><button className="eh-primary" onClick={() => setModal('absence')}><MessageSquare size={16} /> Nowy wniosek</button></div>
          <section className="eh-request-grid">
            <article className="eh-card eh-open-shift"><div className="eh-card-head"><span>GIEŁDA ZAMIAN</span><em>{otwarteInnych.length} otwartych</em></div>
              {otwarteInnych.slice(0, 2).map((x) => <div key={x.id}><i><span>{new Intl.DateTimeFormat('pl-PL', { weekday: 'short' }).format(new Date(x.shift.date + 'T12:00:00')).replace('.', '').toUpperCase()}</span><strong>{Number(x.shift.date.slice(8))}</strong><small>{mcLabel(x.shift.date.slice(0, 7)).split(' ')[0].toUpperCase()}</small></i><span><small>{x.shift.station} · {x.requesterDisplay || x.requester}</small><strong>{x.shift.start}–{x.shift.end}</strong><em>{x.shift.hours} h{x.note ? ` · „${x.note}"` : ''}</em></span></div>)}
              {otwarteInnych[0] ? <p><Lock size={15} /> Zgłoszenie wymaga akceptacji managera — zamiana przypisze zmianę do Twojego konta.</p> : null}
              {otwarteInnych[0] ? (zgloszony(otwarteInnych[0]) ? <button onClick={() => swapActions.unvolunteer(otwarteInnych[0].id)}>Wycofaj zgłoszenie</button> : <button onClick={() => swapActions.volunteer(otwarteInnych[0].id)}>Zgłoś się po zmianę</button>) : <div className="eh-empty"><RefreshCw size={20} /><span>Brak otwartych ofert. Możesz wystawić własną zmianę poniżej.</span></div>}
              {przyszle.length > 0 && <div style={{ marginTop: 10, display: 'flex', gap: 8 }}><select value={swapSel} onChange={(e) => setSwapSel(e.target.value)} style={{ flex: 1, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--eh-line)', fontSize: 12 }}><option value="">— wystaw moją zmianę —</option>{przyszle.map((z, i) => <option key={i} value={`${z.date}|${z.start}|${z.end}|${z.station}`}>{z.date} · {z.start}–{z.end} · {z.station}</option>)}</select><button className="eh-primary" style={{ height: 38 }} disabled={!swapSel} onClick={() => { const cz = swapSel.split('|'); const z = przyszle.find((x2) => x2.date === cz[0] && x2.start === cz[1] && x2.end === cz[2]); swapActions.create({ date: cz[0], start: cz[1], end: cz[2], station: cz[3], hours: z && z.hours }, ''); setSwapSel(''); }}>Wystaw</button></div>}
            </article>
            <article className="eh-card eh-my-requests"><div className="eh-card-head"><span>MOJE WNIOSKI</span><button onClick={() => setModal('availability')}><CalendarCheck2 size={13} /> Dodaj dyspozycyjność</button></div>
              {dyspo.slice(0, 3).map((r) => <div key={r.id}><i><CalendarCheck2 size={16} /></i><span><strong>{DY_LBL(r)}</strong><small>{new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: 'numeric', month: 'long' }).format(new Date(r.date + 'T12:00:00'))}{r.recurrence === 'weekly' ? ' · co tydzień' : ''}{r.managerNote ? ` · „${r.managerNote}"` : ''}</small></span><em>{ST_LBL[r.status]}</em></div>)}
              {absencje.slice(0, 3).map((a) => <div key={a.id}><i><Calendar size={16} /></i><span><strong>{AB_LBL[a.type] || a.type}</strong><small>{a.from} → {a.to}{a.decidedBy ? ` · ${a.decidedBy}` : ''}</small></span><em>{ST_LBL[a.status]}</em></div>)}
              {mojeProsby.slice(0, 2).map((x) => <div key={x.id}><i><RefreshCw size={16} /></i><span><strong>Zamiana zmiany</strong><small>{opisZmiany(x.shift)}</small></span><em>{statusZamiany(x).txt.split(' — ')[0]}</em></div>)}
              {!dyspo.length && !absencje.length && !mojeProsby.length && <div className="eh-empty"><MessageSquare size={20} /><span>Nie masz jeszcze żadnych wniosków.</span></div>}
            </article>
          </section>
        </section>}

        {tab === 'more' && <section className="eh-page">
          <div className="eh-page-heading"><div><span>PROFIL I NARZĘDZIA</span><h1>Więcej</h1><p>Profil, informacje o aplikacji i wylogowanie.</p></div></div>
          <section className="eh-profile"><article className="eh-card eh-profile-card"><i>{inicjaly}</i><span><h2>{user.display || user.name}</h2><p>Pracownik · {DEFAULT_LOCATION}</p><small>Login: {user.login}</small></span><button onClick={onLogout}>Wyloguj</button></article>
            <div className="eh-more-grid">
              <button onClick={() => setModal('availability')}><i><CalendarCheck2 size={20} /></i><span><strong>Dyspozycyjność</strong><small>Dodaj dzień i godziny</small></span><ChevronRight size={17} /></button>
              <button onClick={() => setModal('absence')}><i><Calendar size={20} /></i><span><strong>Urlopy i nieobecności</strong><small>Nowy wniosek</small></span><ChevronRight size={17} /></button>
              <button onClick={() => setModal('about')}><i><Info size={20} /></i><span><strong>O aplikacji</strong><small>ORDO Employee Hub</small></span><ChevronRight size={17} /></button>
              <button className="is-disabled" disabled><i><Briefcase size={20} /></i><span><strong>Learning</strong><small>Moduł tymczasowo wyłączony</small></span><X size={17} /></button>
              <button className="is-disabled" disabled><i><MessageSquare size={20} /></i><span><strong>Feed i wiadomości</strong><small>Wkrótce</small></span><X size={17} /></button>
              <button className="is-disabled" disabled><i><Lock size={20} /></i><span><strong>Prywatność i zgody</strong><small>Wkrótce</small></span><X size={17} /></button>
            </div>
          </section>
        </section>}
      </div>

      <nav className="eh-mobile-nav" aria-label="Nawigacja mobilna">{EH_TABS.map(([id, label, Icon]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={20} /><span>{label}</span></button>)}</nav>

      {pending && <Dialog title={EH_PUNCH[pending].title} kicker="ORDO EMPLOYEE HUB" description="Zdarzenie zostanie zapisane z aktualną godziną." onClose={() => setPending(null)} size="small" actions={<><button onClick={() => setPending(null)}>Anuluj</button>{pending === 'break_start' && <button onClick={() => setPendingBreak(pendingBreak === 'paid' ? 'unpaid' : 'paid')}>{pendingBreak === 'paid' ? 'Przerwa: płatna' : 'Przerwa: niepłatna'}</button>}<button className="dialog-primary" disabled={busy} onClick={confirmPunch}><Check size={15} /> {EH_PUNCH[pending].button}</button></>}>
        <div className="eh-punch-confirm"><div><Clock3 size={21} /><span><strong>{now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</strong><small>czas urządzenia</small></span></div><div><MapPinIcon size={21} /><span><strong>{DEFAULT_LOCATION}</strong><small>lokalizacja zapisana przy zdarzeniu</small></span></div></div>
        <div className="dialog-notice"><Lock size={16} /><span>{EH_PUNCH[pending].note}</span></div>
      </Dialog>}

      {modal === 'availability' && <Dialog title="Nowa dyspozycyjność" kicker="DZIEŃ PO DNIU" description={okno ? `Dyspozycje zbieramy na ${new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(new Date(okno.targetMonth + '-01T12:00:00'))}${okno.otwarte ? ` · do 20.${okno.deadline.slice(5, 7)}` : ' · OKNO ZAMKNIĘTE'}.` : 'Wybierz datę i określ, kiedy możesz pracować.'} onClose={() => setModal(null)} actions={<><button onClick={() => setModal(null)}>Anuluj</button><button className="dialog-primary" disabled={!avDraft.date || (okno && !okno.otwarte)} onClick={wyslijDyspo}><MessageSquare size={15} /> Wyślij dyspozycyjność</button></>}>
        <div className="eh-availability-form">
          <label className="dialog-field eh-availability-date">Data dnia<input type="date" value={avDraft.date} min={okno ? `${okno.targetMonth}-01` : undefined} max={okno ? `${okno.targetMonth}-31` : undefined} onChange={(e) => setAvDraft((v) => ({ ...v, date: e.target.value }))} /></label>
          <div className="eh-availability-label"><span>Dyspozycja</span><small>Wybierz jeden wariant dla wskazanego dnia</small></div>
          <div className="eh-availability-options">{[['available', 'Dostępny', 'Mogę pracować przez cały dzień', Check], ['unavailable', 'Niedostępny', 'Nie mogę przyjąć zmiany', X], ['from', 'Dostępny od', 'Mogę rozpocząć od wskazanej godziny', Clock3], ['until', 'Dostępny do', 'Mogę pracować do wskazanej godziny', Clock3]].map(([id, label, copy, Icon]) => <button type="button" key={id} className={avDraft.kind === id ? 'active' : ''} onClick={() => setAvDraft((v) => ({ ...v, kind: id }))}><i><Icon size={16} /></i><span><strong>{label}</strong><small>{copy}</small></span>{avDraft.kind === id && <Check size={15} />}</button>)}</div>
          {(avDraft.kind === 'from' || avDraft.kind === 'until') && <label className="dialog-field eh-availability-time">{avDraft.kind === 'from' ? 'Dostępny od godziny' : 'Dostępny do godziny'}<input autoFocus type="time" value={avDraft.time} onChange={(e) => setAvDraft((v) => ({ ...v, time: e.target.value }))} /></label>}
        </div>
        <div className="dialog-notice" style={{ marginTop: 14 }}><Info size={16} /><span>Każda data ma osobny wpis. Ponowne wysłanie dla tego samego dnia zastąpi wcześniejszą dyspozycyjność.</span></div>
      </Dialog>}

      {modal === 'absence' && <Dialog title="Nowy wniosek o nieobecność" kicker="EMPLOYEE SELF-SERVICE" description="Wniosek trafi do decyzji managera." onClose={() => setModal(null)} actions={<><button onClick={() => setModal(null)}>Anuluj</button><button className="dialog-primary" disabled={!abDraft.from || !abDraft.to} onClick={wyslijAbsencje}><MessageSquare size={15} /> Wyślij wniosek</button></>}>
        <div className="dialog-form-grid"><label className="dialog-field full">Rodzaj<select value={abDraft.type} onChange={(e) => setAbDraft((v) => ({ ...v, type: e.target.value }))}><option value="urlop">Urlop wypoczynkowy</option><option value="uz">Urlop na żądanie</option><option value="l4">Zwolnienie lekarskie</option><option value="inne">Inna nieobecność</option></select></label><label className="dialog-field">Od<input type="date" value={abDraft.from} onChange={(e) => setAbDraft((v) => ({ ...v, from: e.target.value }))} /></label><label className="dialog-field">Do<input type="date" value={abDraft.to} onChange={(e) => setAbDraft((v) => ({ ...v, to: e.target.value }))} /></label><label className="dialog-field full">Komentarz<textarea value={abDraft.note} onChange={(e) => setAbDraft((v) => ({ ...v, note: e.target.value }))} placeholder="Opcjonalna informacja dla managera" /></label></div>
      </Dialog>}

      {modal === 'about' && <Dialog title="ORDO Employee Hub" kicker="O APLIKACJI" description="Aplikacja pracownika ORDO Workforce Cloud." onClose={() => setModal(null)} size="small"><div className="dialog-notice"><Info size={16} /><span>Grafik, rejestracja czasu, dyspozycyjność, urlopy i giełda zamian. Wersja v8 · {DEFAULT_LOCATION}. © 2026 ORDO by M. Szewczyk.</span></div></Dialog>}
    </main>
  );
};

function REXCloudApp() {
  const [currentUser, setCurrentUser] = useState(() => loadFromStorage('rex_user', null));
  const [swaps, setSwaps] = useState([]);
  const [sidebar, setSidebar] = useState(false);
  const [page, setPage] = useState('home');
  const [date, setDate] = useState(() => new Date());
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [teamDate, setTeamDate] = useState(null);
  const [publikacje, setPublikacje] = useState([]);   // WFM-01: opublikowane miesiące + status potwierdzenia
  const [coworkers, setCoworkers] = useState([]);
  const [coLoading, setCoLoading] = useState(false);

  const openTeam = async (dateStr) => {
    setTeamDate(dateStr); setCoworkers([]); setCoLoading(true);
    try {
      const r = await api('/schedule?month=' + dateStr.slice(0, 7));
      const all = (r.success && r.shifts) ? r.shifts : [];
      const list = all.filter(s => s.date === dateStr && !(s.mine != null ? s.mine : normalizeName(s.name) === normalizeName(currentUser.name))).sort((a, b) => (a.start || '').localeCompare(b.start || ''));
      setCoworkers(list);
    } catch { setCoworkers([]); }
    setCoLoading(false);
  };

  const zapytanieOsoby = (u) => u && u.id ? `/schedule?accountId=${encodeURIComponent(u.id)}` : `/schedule?name=${encodeURIComponent(u.name)}`;
  const reloadShifts = () => currentUser && api(zapytanieOsoby(currentUser)).then(r => { if (r.success) { setShifts(scalZmiany(r.shifts)); setPublikacje(r.publikacje || []); } }).catch(() => {});
  const potwierdzGrafik = async (month) => { const r = await apiSend('/schedule?action=confirm', 'POST', { month }); if (r.success) reloadShifts(); else alert(r.error || 'Nie udało się potwierdzić'); };
  const reloadSwaps = () => api('/swaps').then(r => { if (r.success) setSwaps(r.swaps || []); }).catch(() => {});

  useEffect(() => {
    if (currentUser) {
      setLoading(true);
      Promise.all([
        api(zapytanieOsoby(currentUser)).then(r => { if (r.success) { setShifts(scalZmiany(r.shifts)); setPublikacje(r.publikacje || []); } }),
        api('/swaps').then(r => { if (r.success) setSwaps(r.swaps || []); }),
      ]).catch(() => {}).finally(() => setLoading(false));
    }
  }, [currentUser]);

  // odśwież po wejściu w zakładkę Zamiany (żeby widać było zatwierdzenia ASM)
  useEffect(() => { if (currentUser && page === 'swaps') { reloadShifts(); reloadSwaps(); } }, [page]);

  const createSwap = async (shift, note) => { const r = await apiSend('/swaps', 'POST', { requester: currentUser.name, shift, note }); if (r.success) reloadSwaps(); else alert(r.error || 'Nie udało się wysłać prośby'); };
  const volunteerSwap = async (id) => { const r = await apiSend('/swaps', 'PUT', { id, action: 'volunteer', name: currentUser.name }); if (r.success) reloadSwaps(); else alert(r.error || 'Błąd'); };
  const unvolunteerSwap = async (id) => { const r = await apiSend('/swaps', 'PUT', { id, action: 'unvolunteer', name: currentUser.name }); if (r.success) reloadSwaps(); };
  const cancelSwap = async (id) => { const r = await apiSend('/swaps', 'PUT', { id, action: 'cancel' }); if (r.success) reloadSwaps(); };

  const handleLogin = (u) => setCurrentUser(u);
  const handleLogout = () => { localStorage.removeItem('rex_user'); localStorage.removeItem('rex_token'); setCurrentUser(null); setPage('home'); setShifts([]); setSwaps([]); };

  const todayStr = getTodayString();
  const nextShift = shifts.filter(s => s.date >= todayStr).sort((a, b) => new Date(a.date) - new Date(b.date) || a.start.localeCompare(b.start))[0] || null;
  const now = new Date();
  const monthShifts = shifts.filter(s => { const d = new Date(s.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
  const monthHours = monthShifts.reduce((a, s) => a + (s.hours != null ? s.hours : calcHours(s.start, s.end)), 0);

  const titles = { home: 'Strona domowa', shifts: 'Mój grafik', dyspo: 'Dyspozycyjność', hours: 'Moje godziny', swaps: 'Giełda zamian', wnioski: 'Urlopy i wnioski', about: 'O aplikacji' };

  if (!currentUser) return <LoginScreen onLogin={handleLogin} />;

  return (
    <>
      <EhHub
        user={currentUser}
        shifts={shifts}
        swaps={swaps}
        publikacje={publikacje}
        onConfirmGrafik={potwierdzGrafik}
        onLogout={handleLogout}
        openTeam={openTeam}
        swapActions={{ create: createSwap, volunteer: volunteerSwap, unvolunteer: unvolunteerSwap, cancel: cancelSwap }}
      />
      {teamDate && <CoworkersModal date={teamDate} list={coworkers} loading={coLoading} onClose={() => setTeamDate(null)} />}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<REXCloudApp />);
