import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { Calendar, Home, Clock, Menu, X, ChevronLeft, ChevronRight, LogOut, Info, Cloud, MapPin, Search, Briefcase } from 'lucide-react';

// ===================== CONFIG =====================
const API_BASE = 'https://rex-cloud-backend.vercel.app/api';
// ^ Zmień na URL swojego backendu po wdrożeniu

const DEFAULT_LOCATION = 'Popeyes PLK Kraków Galeria Krakowska';

const colors = {
  primary: { darkest: '#082567', dark: '#213b76', medium: '#395185', light: '#526695', bg: '#e8edf5', bgLight: '#f1f4f9' },
  accent: { dark: '#FDA785', medium: '#FFBF99', light: '#FBCEB1', bg: '#FFF5EE' }
};

// Station color palette (matches Excel matrix sections)
const stationColors = {
  'PANIEROWANIE': '#7CB342', 'SMAŻENIE': '#E74C3C', 'KANAPKI / WRAPY': '#00A3E0',
  'KONTROLER': '#1E3A8A', 'WSPARCIE WIECZORNE / FLEX': '#9C27B0', 'DISPATCHER': '#FF7043',
  'PHU': '#00897B', 'DESERY / NAPOJE': '#EC407A', 'FRYTKI': '#FBC02D', 'ZMYWAK': '#64748B',
  'PREP': '#8D6E63', 'DOSTAWA': '#5C6BC0', 'MANAGER': '#082567', 'MGR FUNKCYJNE': '#455A64',
  'SZKOLENIA': '#26A69A', 'TRAINING': '#26A69A', 'INSTRUKTOR': '#00796B'
};
const stationColor = (s) => stationColors[(s || '').toUpperCase()] || colors.primary.medium;
const nazwaStanowiska = (st) => {
  const u = (st || '').toLowerCase();
  if (u === 'training') return 'Szkolenie (uczeń)';
  if (u === 'instruktor') return 'Szkolenie (instruktor)';
  return st;
};
const paraLabel = (shift) => {
  if (!shift.partner) return null;
  const u = (shift.station || '').toLowerCase();
  if (u === 'training') return { rola: 'Instruktor', osoba: shift.partner };
  if (u === 'instruktor') return { rola: 'Szkoli', osoba: shift.partner };
  return null;
};

const monthNames = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
const dayNames = ['PON','WT','ŚR','CZW','PT','SOB','NIEDZ'];
const dayShort = ['NIEDZ','PON','WT','ŚR','CZW','PT','SOB'];

const saveToStorage = (k, d) => { try { localStorage.setItem(k, JSON.stringify(d)); } catch {} };
const loadFromStorage = (k, def = null) => { try { const d = localStorage.getItem(k); return d ? JSON.parse(d) : def; } catch { return def; } };
const getTodayString = () => { const t = new Date(); return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0'); };

const api = async (path) => { const r = await fetch(`${API_BASE}${path}`); return r.json(); };

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
  const [name, setName] = useState('');
  const [roster, setRoster] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    api('/schedule?roster=1').then(r => { if (r.success) setRoster(r.roster || []); }).catch(() => {});
  }, []);

  const onNameChange = (v) => {
    setName(v);
    if (v.length >= 1) {
      const norm = v.trim().toUpperCase();
      setSuggestions(roster.filter(n => n.toUpperCase().includes(norm)).slice(0, 6));
    } else setSuggestions([]);
  };

  const handleLogin = async (loginName) => {
    const useName = (loginName || name).trim();
    if (!useName) { setError('Wpisz swoje imię lub nazwisko'); return; }
    setLoading(true); setError('');
    try {
      const r = await api(`/schedule?name=${encodeURIComponent(useName)}`);
      if (r.success && r.found) {
        const user = { name: r.displayName || useName };
        saveToStorage('rex_user', user);
        onLogin(user);
      } else {
        setError('Nie znaleziono pracownika o tym nazwisku w grafiku');
      }
    } catch { setError('Błąd połączenia z serwerem'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{background: 'linear-gradient(to bottom, #051845, '+colors.primary.darkest+')'}}>
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-12">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{backgroundColor: colors.primary.medium}}><Cloud size={32} className="text-white" /></div>
          <div><span className="text-white text-3xl font-light">REX</span><span className="text-3xl font-light ml-2" style={{color: colors.primary.bg}}>Cloud</span></div>
        </div>
        <div className="bg-white rounded-2xl p-8">
          <div className="flex items-center justify-center gap-2 mb-2"><Search size={20} style={{color: colors.primary.medium}} /><h2 className="text-2xl font-semibold">Zaloguj się</h2></div>
          <p className="text-center text-sm text-slate-500 mb-6">Wpisz swoje imię, aby zobaczyć swój grafik</p>
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}
          <div className="space-y-4">
            <div className="relative">
              <label className="block text-sm text-slate-600 mb-1">Imię / Nazwisko</label>
              <input type="text" value={name} onChange={(e) => onNameChange(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} className="w-full px-4 py-3 rounded-xl border focus:outline-none" placeholder="np. KOWALSKI" disabled={loading} autoFocus />
              {suggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white rounded-xl shadow-lg border overflow-hidden">
                  {suggestions.map(s => (
                    <button key={s} onClick={() => { setName(s); setSuggestions([]); handleLogin(s); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-sm font-medium" style={{color: colors.primary.dark}}>{s}</button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => handleLogin()} disabled={loading} className="w-full text-white font-semibold py-3 rounded-xl transition-colors" style={{backgroundColor: loading ? colors.primary.light : colors.primary.medium}}>{loading ? 'Sprawdzam...' : 'Pokaż mój grafik'}</button>
          </div>
          <p className="text-xs text-slate-400 text-center mt-4">Grafik ustala kierownik zmiany</p>
        </div>
      </div>
    </div>
  );
};

// ===================== CALENDAR =====================

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
  const items = [{ id: 'home', icon: Home, label: 'Strona domowa' }, { id: 'shifts', icon: Calendar, label: 'Mój grafik' }, { id: 'hours', icon: Clock, label: 'Moje godziny' }, { id: 'about', icon: Info, label: 'O aplikacji' }];
  const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (<>{isOpen && <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />}
    <div className={'fixed top-0 left-0 h-full w-72 bg-white z-50 transform transition-transform flex flex-col ' + (isOpen ? 'translate-x-0' : '-translate-x-full')}>
      <div className="p-4 pt-8" style={{background: 'linear-gradient(to right, '+colors.primary.darkest+', '+colors.primary.dark+')'}}><div className="flex items-center gap-2 mb-4"><Cloud size={24} className="text-white" /><span className="text-white text-lg font-light">REX <span style={{color: colors.primary.bg}}>Cloud</span></span></div></div>
      <div className="p-4 border-b flex items-center gap-3"><div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold" style={{backgroundColor: colors.primary.medium}}>{initials}</div><div><p className="font-semibold text-sm">{user.name}</p><p className="text-slate-500 text-xs">Pracownik</p></div></div>
      <nav className="p-4 flex-1">{items.map(item => (<button key={item.id} onClick={() => { onNavigate(item.id); onClose(); }} className="w-full flex items-center gap-4 px-4 py-3 rounded-xl" style={currentPage === item.id ? {backgroundColor: colors.primary.bg, color: colors.primary.dark} : {color: '#475569'}}><item.icon size={20} /><span className="font-medium">{item.label}</span></button>))}</nav>
      <div className="p-4 border-t"><button onClick={() => { onLogout(); onClose(); }} className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-red-600"><LogOut size={20} /><span className="font-medium">Wyloguj się</span></button></div>
    </div></>);
};

const Header = ({ title, onMenuClick }) => (<div className="text-white px-4 py-4 flex items-center justify-between sticky top-0 z-30" style={{background: 'linear-gradient(to right, '+colors.primary.dark+', '+colors.primary.darkest+')'}}><div className="flex items-center gap-3"><Cloud size={24} /><span className="text-lg font-medium">{title}</span></div><button onClick={onMenuClick} className="p-2"><Menu size={24} /></button></div>);

// ===================== SHIFT CARD =====================

const ShiftCard = ({ shift, isToday }) => {
  const d = new Date(shift.date);
  const h = shift.hours != null ? shift.hours : calcHours(shift.start, shift.end);
  return (
    <div className="rounded-xl shadow-sm mb-3 p-4" style={{ backgroundColor: isToday ? colors.primary.bg : 'white', borderLeft: '4px solid ' + stationColor(shift.station) }}>
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
            <span className="text-sm font-medium" style={{color: stationColor(shift.station)}}>{nazwaStanowiska(shift.station)}</span>
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

const HomePage = ({ nextShift, onNavigateToShifts, monthHours, monthShiftCount }) => {
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
  return (
    <div className="p-4 space-y-4 pb-24">
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

const ShiftsPage = ({ date, onDateChange, shifts }) => {
  const [selectedDay, setSelectedDay] = useState(null);
  const todayStr = getTodayString();
  const filtered = shifts.filter(s => { const d = new Date(s.date); return (!selectedDay || d.getDate() === selectedDay) && d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear(); }).sort((a, b) => new Date(a.date) - new Date(b.date) || a.start.localeCompare(b.start));
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-20">
      <CalendarView date={date} onDateChange={onDateChange} shifts={shifts} onDayClick={setSelectedDay} selectedDay={selectedDay} />
      <div className="flex-1 p-4">
        {filtered.length === 0 ? (<div className="text-center py-12"><Cloud size={48} className="text-slate-300 mx-auto mb-4" /><p className="text-slate-500">Brak zmian w tym okresie</p></div>) : (
          filtered.map((shift, i) => (
            <div key={i}>
              {shift.date === todayStr && (<div className="flex items-center gap-2 mb-2 px-2"><div className="h-px flex-1" style={{backgroundColor: colors.primary.medium}}></div><span className="text-xs font-semibold px-2 py-1 rounded-full" style={{backgroundColor: colors.primary.bg, color: colors.primary.dark}}>DZIŚ</span><div className="h-px flex-1" style={{backgroundColor: colors.primary.medium}}></div></div>)}
              <ShiftCard shift={shift} isToday={shift.date === todayStr} />
            </div>
          ))
        )}
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
    <div className="p-8 text-center" style={{background: 'linear-gradient(to right, '+colors.primary.darkest+', '+colors.primary.dark+')'}}><Cloud size={40} className="text-white mx-auto mb-4" /><span className="text-white text-2xl font-light">REX <span style={{color: colors.primary.bg}}>Cloud</span></span><p className="mt-2" style={{color: colors.primary.bg}}>v3.0</p></div>
    <div className="p-6 space-y-4">
      <div className="rounded-xl p-4" style={{backgroundColor: colors.primary.bg}}><span className="font-semibold" style={{color: colors.primary.darkest}}>Jak to działa</span><ul className="text-sm mt-2 space-y-1" style={{color: colors.primary.dark}}><li>• Logujesz się swoim imieniem lub nazwiskiem</li><li>• Widzisz swój grafik ułożony przez kierownika</li><li>• Grafik pochodzi z matrycy Excel</li></ul></div>
      <p className="text-slate-500 text-sm text-center">© 2025 REX Cloud by M. Szewczyk</p>
    </div>
  </div></div>
);

// ===================== MAIN =====================

function REXCloudApp() {
  const [currentUser, setCurrentUser] = useState(() => loadFromStorage('rex_user', null));
  const [sidebar, setSidebar] = useState(false);
  const [page, setPage] = useState('home');
  const [date, setDate] = useState(() => new Date());
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setLoading(true);
      api(`/schedule?name=${encodeURIComponent(currentUser.name)}`).then(r => {
        if (r.success) setShifts(r.shifts || []);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [currentUser]);

  const handleLogin = (u) => setCurrentUser(u);
  const handleLogout = () => { localStorage.removeItem('rex_user'); setCurrentUser(null); setPage('home'); setShifts([]); };

  const todayStr = getTodayString();
  const nextShift = shifts.filter(s => s.date >= todayStr).sort((a, b) => new Date(a.date) - new Date(b.date) || a.start.localeCompare(b.start))[0] || null;
  const now = new Date();
  const monthShifts = shifts.filter(s => { const d = new Date(s.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
  const monthHours = monthShifts.reduce((a, s) => a + (s.hours != null ? s.hours : calcHours(s.start, s.end)), 0);

  const titles = { home: 'Strona domowa', shifts: 'Mój grafik', hours: 'Moje godziny', about: 'O aplikacji' };

  if (!currentUser) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar isOpen={sidebar} onClose={() => setSidebar(false)} currentPage={page} onNavigate={setPage} user={currentUser} onLogout={handleLogout} />
      <Header title={titles[page] || 'REX Cloud'} onMenuClick={() => setSidebar(true)} />
      {loading ? (<div className="flex items-center justify-center py-20"><Cloud size={48} style={{color: colors.primary.medium}} className="animate-pulse" /></div>) : (<>
        {page === 'home' && <HomePage nextShift={nextShift} onNavigateToShifts={() => setPage('shifts')} monthHours={monthHours} monthShiftCount={monthShifts.length} />}
        {page === 'shifts' && <ShiftsPage date={date} onDateChange={setDate} shifts={shifts} />}
        {page === 'hours' && <HoursPage shifts={shifts} />}
        {page === 'about' && <AboutPage />}
      </>)}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-2 flex justify-around z-10">
        {[['home', Home, 'Home'], ['shifts', Calendar, 'Grafik'], ['hours', Clock, 'Godziny'], ['about', Info, 'Info']].map(([id, Icon, label]) => (
          <button key={id} onClick={() => setPage(id)} className="flex flex-col items-center p-2" style={{color: page === id ? colors.primary.medium : '#94a3b8'}}><Icon size={24} /><span className="text-xs mt-1">{label}</span></button>
        ))}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<REXCloudApp />);
