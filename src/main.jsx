import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { Calendar, Home, Umbrella, Clock, Menu, X, ChevronLeft, ChevronRight, LogOut, Info, User, Plus, Cloud, TrendingUp, DollarSign, BarChart3, Lock, Users, MapPin, AlertCircle } from 'lucide-react';

// ===================== CONFIG =====================
const API_BASE = 'https://rex-cloud-backend.vercel.app/api';
// Change this to your deployed backend URL ^

const DEFAULT_LOCATION = 'Popeyes PLK Kraków Galeria Krakowska';

const positionColors = { 'KIT': '#7CB342', 'CAS': '#00A3E0', 'SUP': '#E74C3C', 'RUN': '#9C27B0', 'SIN': '#FDA785', 'LOB': '#64748B', 'TRA': '#6B7280', 'MGR': '#1E3A8A' };
const positionNames = { 'KIT': 'Kuchnia', 'CAS': 'Kasa', 'SUP': 'Wsparcie', 'RUN': 'Runner', 'SIN': 'Sink', 'LOB': 'Lobby', 'TRA': 'Training', 'MGR': 'Manager' };
const colors = { primary: { darkest: '#082567', dark: '#213b76', medium: '#395185', light: '#526695', bg: '#e8edf5', bgLight: '#f1f4f9' }, accent: { dark: '#FDA785', medium: '#FFBF99', light: '#FBCEB1', bg: '#FFF5EE' } };

const monthNames = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
const dayNames = ['PON','WT','ŚR','CZW','PT','SOB','NIEDZ'];
const dayNamesFull = ['niedziela','poniedziałek','wtorek','środa','czwartek','piątek','sobota'];

const saveToStorage = (key, data) => { try { localStorage.setItem(key, JSON.stringify(data)); } catch {} };
const loadFromStorage = (key, def = null) => { try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : def; } catch { return def; } };
const getTodayString = () => { const t = new Date(); return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0'); };

const api = async (path, method = 'GET', body = null) => {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${API_BASE}${path}`, opts);
  return r.json();
};

// ===================== LOGIN =====================

const LoginScreen = ({ onLogin }) => {
  const [login, setLogin] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!login || !pin) { setError('Wprowadź login i PIN'); return; }
    setLoading(true); setError('');
    try {
      const r = await api('/auth', 'POST', { login: login.trim(), pin: pin.trim(), role: 'employee' });
      if (r.success) {
        saveToStorage('rex_user', r.user);
        onLogin(r.user);
      } else {
        setError(r.error || 'Nieprawidłowy login lub PIN');
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
          <div className="flex items-center justify-center gap-2 mb-6"><Lock size={20} style={{color: colors.primary.medium}} /><h2 className="text-2xl font-semibold">Zaloguj się</h2></div>
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}
          <div className="space-y-4">
            <div><label className="block text-sm text-slate-600 mb-1">Login</label><input type="text" value={login} onChange={(e) => setLogin(e.target.value)} className="w-full px-4 py-3 rounded-xl border focus:outline-none" placeholder="Twój login" disabled={loading} /></div>
            <div><label className="block text-sm text-slate-600 mb-1">PIN</label><input type="password" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} className="w-full px-4 py-3 rounded-xl border focus:outline-none" placeholder="••••" maxLength={8} disabled={loading} /></div>
            <button onClick={handleLogin} disabled={loading} className="w-full text-white font-semibold py-3 rounded-xl transition-colors" style={{backgroundColor: loading ? colors.primary.light : colors.primary.medium}}>{loading ? 'Logowanie...' : 'Zaloguj się'}</button>
          </div>
          <p className="text-xs text-slate-400 text-center mt-4">Login i PIN nadaje administrator</p>
        </div>
      </div>
    </div>
  );
};

// ===================== CALENDAR VIEW =====================

const CalendarView = ({ date, onDateChange, shifts, onDayClick, selectedDay }) => {
  const year = date.getFullYear(), month = date.getMonth();
  const firstDay = new Date(year, month, 1), lastDay = new Date(year, month + 1, 0), startDay = (firstDay.getDay() + 6) % 7;
  const days = []; for (let i = 0; i < startDay; i++) days.push({ day: new Date(year, month, 0).getDate() - startDay + i + 1, current: false }); for (let i = 1; i <= lastDay.getDate(); i++) days.push({ day: i, current: true }); for (let i = 1; days.length < 42; i++) days.push({ day: i, current: false });
  const getShifts = (d) => { const ds = year+'-'+String(month+1).padStart(2,'0')+'-'+String(d).padStart(2,'0'); const shift = shifts.find(s => s.date === ds); return shift ? [{ time: shift.startTime + ' - ' + shift.endTime, type: shift.position, color: positionColors[shift.position] || colors.primary.medium }] : []; };
  const today = new Date(), isToday = (d) => today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
  const getHighlightStyle = (item) => { if (!item.current) return {}; if (selectedDay !== null) { if (item.day === selectedDay) return {backgroundColor: colors.primary.bg, color: colors.primary.dark}; return {}; } else { if (isToday(item.day)) return {backgroundColor: colors.primary.medium, color: 'white'}; return {}; } };
  return (
    <div className="bg-white">
      <div className="flex items-center justify-between px-4 py-4 border-b"><button onClick={() => onDateChange(new Date(year, month-1, 1))} className="p-2"><ChevronLeft size={24} /></button><span className="text-lg font-semibold">{monthNames[month]} {year}</span><button onClick={() => onDateChange(new Date(year, month+1, 1))} className="p-2"><ChevronRight size={24} /></button></div>
      <div className="grid grid-cols-7 gap-1 p-2">
        {dayNames.map(d => <div key={d} className="text-center text-xs font-medium py-2 rounded-lg" style={{backgroundColor: colors.primary.bg, color: colors.primary.light}}>{d}</div>)}
        {days.map((item, i) => { const sh = item.current ? getShifts(item.day) : []; return (
          <button key={i} onClick={() => item.current && onDayClick(item.day === selectedDay ? null : item.day)} className={'flex flex-col items-center py-2 rounded-full ' + (!item.current ? 'text-slate-300' : '')} style={getHighlightStyle(item)}>
            <span className="text-sm font-medium">{item.day}</span>
            {sh.length > 0 && item.current && <div className="flex gap-0.5 mt-1">{sh.map((s,j) => <div key={j} className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: s.color}} />)}</div>}
          </button>
        ); })}
      </div>
    </div>
  );
};

// ===================== SIDEBAR & HEADER =====================

const Sidebar = ({ isOpen, onClose, currentPage, onNavigate, user, onLogout }) => {
  const items = [{ id: 'home', icon: Home, label: 'Strona domowa' }, { id: 'shifts', icon: Calendar, label: 'Zmiany' }, { id: 'holidays', icon: Umbrella, label: 'Czas wolny' }, { id: 'workedTime', icon: Clock, label: 'Przepracowany Czas' }, { id: 'userData', icon: User, label: 'Dane użytkownika' }, { id: 'about', icon: Info, label: 'O Aplikacji' }];
  return (<>{isOpen && <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />}
    <div className={'fixed top-0 left-0 h-full w-72 bg-white z-50 transform transition-transform flex flex-col ' + (isOpen ? 'translate-x-0' : '-translate-x-full')}>
      <div className="p-4 pt-8" style={{background: 'linear-gradient(to right, '+colors.primary.darkest+', '+colors.primary.dark+')'}}><div className="flex items-center gap-2 mb-4"><Cloud size={24} className="text-white" /><span className="text-white text-lg font-light">REX <span style={{color: colors.primary.bg}}>Cloud</span></span></div></div>
      <div className="p-4 border-b flex items-center gap-3"><div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold" style={{backgroundColor: colors.primary.medium}}>{user.initials}</div><div><p className="font-semibold text-sm">{user.name}</p><p className="text-slate-500 text-xs">{user.email || user.login || ''}</p></div></div>
      <nav className="p-4 flex-1">{items.map(item => (<button key={item.id} onClick={() => { onNavigate(item.id); onClose(); }} className="w-full flex items-center gap-4 px-4 py-3 rounded-xl" style={currentPage === item.id ? {backgroundColor: colors.primary.bg, color: colors.primary.dark} : {color: '#475569'}}><item.icon size={20} /><span className="font-medium">{item.label}</span></button>))}</nav>
      <div className="p-4 border-t"><button onClick={() => { onLogout(); onClose(); }} className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-red-600"><LogOut size={20} /><span className="font-medium">Wyloguj się</span></button></div>
    </div></>);
};

const Header = ({ title, onMenuClick }) => (<div className="text-white px-4 py-4 flex items-center justify-between sticky top-0 z-30" style={{background: 'linear-gradient(to right, '+colors.primary.dark+', '+colors.primary.darkest+')'}}><div className="flex items-center gap-3"><Cloud size={24} /><span className="text-lg font-medium">{title}</span></div><button onClick={onMenuClick} className="p-2"><Menu size={24} /></button></div>);

// ===================== SHIFT CARD =====================

const ShiftCard = ({ shift, isToday }) => (
  <div className={'rounded-xl shadow-sm mb-3 p-4 ' + (isToday ? '' : '')} style={{ backgroundColor: isToday ? colors.primary.bg : 'white', borderLeft: '4px solid ' + colors.primary.medium }}>
    <div className="flex gap-4">
      <div className="rounded-xl px-3 py-2 text-center min-w-14" style={{backgroundColor: isToday ? colors.primary.bgLight : colors.primary.bg}}>
        <p className="text-xs" style={{color: colors.primary.light}}>{shift.dayName}</p>
        <p className="text-xl font-bold">{shift.dayNum}.{String(new Date(shift.date).getMonth()+1).padStart(2,'0')}</p>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1"><span>{shift.startTime} - {shift.endTime}</span><span className="w-2 h-2 rounded-full" style={{backgroundColor: positionColors[shift.position]}} /><span className="text-sm text-slate-600">{shift.position} - {positionNames[shift.position] || shift.position}</span></div>
        <p className="text-slate-500 text-sm mt-1">{shift.location || DEFAULT_LOCATION}</p>
      </div>
    </div>
  </div>
);

// ===================== PAGES =====================

const HomePage = ({ nextShift, onNavigateToShifts, vacation, onNavigateToHolidays }) => {
  const [, forceUpdate] = useState(0);
  useEffect(() => { const i = setInterval(() => forceUpdate(n => n + 1), 60000); return () => clearInterval(i); }, []);
  const calcCountdown = (dateStr, time) => { if (!dateStr) return { days: 0, hours: 0, min: 0 }; const target = new Date(dateStr); if (time) { const [h, m] = time.split(':'); target.setHours(+h, +m, 0, 0); } const diff = target - new Date(); if (diff <= 0) return { days: 0, hours: 0, min: 0 }; return { days: Math.floor(diff / 86400000), hours: Math.floor((diff % 86400000) / 3600000), min: Math.floor((diff % 3600000) / 60000) }; };
  const shiftCountdown = nextShift ? calcCountdown(nextShift.date, nextShift.startTime) : { days: 0, hours: 0, min: 0 };

  return (
    <div className="p-4 space-y-4 pb-24">
      <div className="bg-white rounded-2xl shadow-sm p-4 cursor-pointer" style={{borderLeft: '4px solid '+colors.primary.medium}} onClick={onNavigateToShifts}>
        <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold">Następna zmiana</h3><Calendar size={24} style={{color: colors.primary.medium}} /></div>
        {nextShift ? (
          <div className="flex gap-4">
            <div className="rounded-xl p-3 text-center min-w-16" style={{backgroundColor: colors.primary.bg}}><p className="text-sm" style={{color: colors.primary.light}}>{nextShift.dayName}</p><p className="text-3xl font-bold">{nextShift.dayNum}</p></div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1"><Clock size={16} className="text-slate-400" /><span>{nextShift.startTime} - {nextShift.endTime}</span><span className="text-sm px-2 py-0.5 rounded" style={{backgroundColor: positionColors[nextShift.position]+'20', color: positionColors[nextShift.position]}}>{nextShift.position}</span></div>
              <p className="text-slate-500 text-sm mt-1">{nextShift.location || DEFAULT_LOCATION}</p>
              <div className="flex gap-4 mt-4 pt-3 border-t">
                <div className="text-center"><p className="text-2xl font-bold" style={{color: colors.primary.medium}}>{shiftCountdown.days}</p><p className="text-xs text-slate-500">Dni</p></div>
                <div className="text-center"><p className="text-2xl font-bold">{shiftCountdown.hours}</p><p className="text-xs text-slate-500">godz</p></div>
                <div className="text-center"><p className="text-2xl font-bold">{shiftCountdown.min}</p><p className="text-xs text-slate-500">min</p></div>
              </div>
            </div>
          </div>
        ) : (<div className="text-center py-4"><Cloud size={40} className="text-slate-200 mx-auto mb-2" /><p className="text-slate-500">Brak zaplanowanych zmian</p></div>)}
      </div>
    </div>
  );
};

const ShiftsPage = ({ date, onDateChange, shifts }) => {
  const [selectedDay, setSelectedDay] = useState(null);
  const todayStr = getTodayString();
  const filtered = shifts.filter(s => { const d = new Date(s.date); return (!selectedDay || d.getDate() === selectedDay) && d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear(); }).sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-20">
      <CalendarView date={date} onDateChange={onDateChange} shifts={shifts} onDayClick={setSelectedDay} selectedDay={selectedDay} />
      <div className="flex-1 p-4">
        {filtered.length === 0 ? (<div className="text-center py-12"><Cloud size={48} className="text-slate-300 mx-auto mb-4" /><p className="text-slate-500">Brak zmian w tym okresie</p></div>) : (
          filtered.map(shift => (
            <div key={shift.id}>
              {shift.date === todayStr && (<div className="flex items-center gap-2 mb-2 px-2"><div className="h-px flex-1" style={{backgroundColor: colors.primary.medium}}></div><span className="text-xs font-semibold px-2 py-1 rounded-full" style={{backgroundColor: colors.primary.bg, color: colors.primary.dark}}>DZIŚ</span><div className="h-px flex-1" style={{backgroundColor: colors.primary.medium}}></div></div>)}
              <ShiftCard shift={shift} isToday={shift.date === todayStr} />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const PreferencesPage = ({ date, onDateChange, requests, onAddRequest, user }) => {
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const todayStr = getTodayString();
  const [newPref, setNewPref] = useState({ date: todayStr, type: 'Pracuj', position: 'KIT', timeFrom: '08:00', timeTo: '16:00' });
  const types = ['Pracuj','Nie pracuj','Nie pracuj wcześniej','Nie pracuj później niż','Praca w godzinach'];
  const positions = [{ id: 'KIT', name: 'KIT - Kuchnia' },{ id: 'CAS', name: 'CAS - Kasa' },{ id: 'SUP', name: 'SUP - Wsparcie' },{ id: 'RUN', name: 'RUN - Runner' },{ id: 'SIN', name: 'SIN - Sink' },{ id: 'LOB', name: 'LOB - Lobby' },{ id: 'TRA', name: 'TRA - Training' },{ id: 'MGR', name: 'MGR - Manager' }];
  const needsFrom = ['Nie pracuj wcześniej','Praca w godzinach'].includes(newPref.type);
  const needsTo = ['Nie pracuj później niż','Praca w godzinach'].includes(newPref.type);
  const needsPos = newPref.type !== 'Nie pracuj';
  const typeMapping = { 'Pracuj': 'work', 'Nie pracuj': 'no_work', 'Nie pracuj wcześniej': 'no_early', 'Nie pracuj później niż': 'no_late', 'Praca w godzinach': 'hours' };

  const filteredRequests = requests.filter(r => { const d = new Date(r.date); return d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear(); });

  const handleAdd = async () => {
    if (newPref.date < todayStr) { setError('Nie można dodać wniosku w przeszłości'); return; }
    setError(''); setLoading(true);
    const d = new Date(newPref.date); const dayNamesShort = ['NI','PO','WT','ŚR','CZ','PT','SO'];
    const request = { date: newPref.date, dayName: dayNamesShort[d.getDay()], dayNum: d.getDate(), type: typeMapping[newPref.type] || 'work', typeLabel: newPref.type, position: needsPos ? newPref.position : null, timeFrom: needsFrom ? newPref.timeFrom : null, timeTo: needsTo ? newPref.timeTo : null, status: 'pending', employeeId: user?.id, employeeName: user?.name || 'Nieznany' };
    try {
      const r = await api('/requests', 'POST', { request });
      if (r.success) { onAddRequest(r.request); setShowModal(false); setNewPref({ date: todayStr, type: 'Pracuj', position: 'KIT', timeFrom: '08:00', timeTo: '16:00' }); }
      else setError(r.error || 'Błąd');
    } catch { setError('Błąd połączenia'); }
    setLoading(false);
  };

  const getStatusLabel = (status) => { if (status === 'approved') return { text: 'Zatwierdzony', color: '#7CB342' }; if (status === 'rejected') return { text: 'Odrzucony', color: '#E74C3C' }; return { text: 'Oczekuje', color: colors.accent.dark }; };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-20">
      <div className="bg-white px-4 py-4 border-b flex items-center justify-between"><button onClick={() => onDateChange(new Date(date.getFullYear(), date.getMonth()-1, 1))} className="p-2"><ChevronLeft size={24} /></button><span className="font-semibold">{monthNames[date.getMonth()]} {date.getFullYear()}</span><button onClick={() => onDateChange(new Date(date.getFullYear(), date.getMonth()+1, 1))} className="p-2"><ChevronRight size={24} /></button></div>
      <div className="p-4">
        <button onClick={() => { setShowModal(true); setError(''); }} className="flex items-center gap-2 font-medium mb-4" style={{color: colors.primary.medium}}><Plus size={20} /><span className="underline">Nowy wniosek</span></button>
        {filteredRequests.length === 0 ? (<div className="text-center py-12"><Cloud size={48} className="text-slate-300 mx-auto mb-4" /><p className="text-slate-500">Brak wniosków w tym miesiącu</p></div>) : filteredRequests.map(p => { const si = getStatusLabel(p.status); return (
          <div key={p.id} className="bg-white rounded-xl shadow-sm p-4 mb-3" style={{borderLeft: '4px solid '+si.color}}>
            <div className="flex items-center gap-4"><div className="rounded-xl px-3 py-2 text-center min-w-14" style={{backgroundColor: colors.accent.bg}}><p className="text-xs" style={{color: colors.accent.dark}}>{p.dayName}</p><p className="text-xl font-bold">{p.dayNum}</p></div><div className="flex-1"><p className="font-medium">{p.typeLabel || p.type}</p>{p.position && <p className="text-sm text-slate-600">{p.position} - {positionNames[p.position]}</p>}{(p.timeFrom || p.timeTo) && <p className="text-sm text-slate-500">{p.timeFrom && 'od '+p.timeFrom} {p.timeTo && 'do '+p.timeTo}</p>}<div className="flex items-center gap-2 mt-2"><AlertCircle size={14} style={{color: si.color}} /><span className="text-xs font-medium" style={{color: si.color}}>{si.text}</span></div></div></div>
          </div>
        );})}
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"><div className="bg-white w-full max-w-lg rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto">
          <h3 className="text-xl font-semibold mb-6">Nowy wniosek o zmianę</h3>
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}
          <div className="space-y-4">
            <div><label className="block text-sm font-medium mb-2" style={{color: colors.primary.medium}}>Data</label><input type="date" min={todayStr} value={newPref.date} onChange={(e) => setNewPref({...newPref, date: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl" /></div>
            <div><label className="block text-sm font-medium mb-2" style={{color: colors.primary.medium}}>Rodzaj</label><select value={newPref.type} onChange={(e) => setNewPref({...newPref, type: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl">{types.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            {needsFrom && (<div><label className="block text-sm font-medium mb-2" style={{color: colors.primary.medium}}>Od godziny</label><input type="time" value={newPref.timeFrom} onChange={(e) => setNewPref({...newPref, timeFrom: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl" /></div>)}
            {needsTo && (<div><label className="block text-sm font-medium mb-2" style={{color: colors.primary.medium}}>Do godziny</label><input type="time" value={newPref.timeTo} onChange={(e) => setNewPref({...newPref, timeTo: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl" /></div>)}
            {needsPos && (<div><label className="block text-sm font-medium mb-2" style={{color: colors.primary.medium}}>Pozycja</label><select value={newPref.position} onChange={(e) => setNewPref({...newPref, position: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl">{positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>)}
          </div>
          <div className="flex gap-3 mt-6"><button onClick={() => setShowModal(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-semibold" disabled={loading}>Anuluj</button><button onClick={handleAdd} disabled={loading} className="flex-1 py-3 text-white rounded-xl font-semibold" style={{backgroundColor: loading ? colors.primary.light : colors.primary.medium}}>{loading ? 'Wysyłanie...' : 'Złóż wniosek'}</button></div>
        </div></div>
      )}
    </div>
  );
};

const HolidaysPage = ({ vacation, onAddVacation }) => {
  const [showModal, setShowModal] = useState(false);
  const todayStr = getTodayString();
  const [newVac, setNewVac] = useState({ startDate: '', endDate: '', type: 'Urlop wypoczynkowy' });
  const vacTypes = ['Urlop wypoczynkowy','Urlop na żądanie','Urlop bezpłatny','Zwolnienie lekarskie','Inny'];
  const handleAdd = () => { if (newVac.startDate && newVac.endDate && newVac.startDate >= todayStr) { const days = Math.ceil((new Date(newVac.endDate) - new Date(newVac.startDate)) / 86400000) + 1; onAddVacation({ startDate: newVac.startDate, endDate: newVac.endDate, type: newVac.type, totalDays: days }); setShowModal(false); } };
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-24"><div className="p-4">
      <button onClick={() => setShowModal(true)} className="flex items-center gap-2 font-medium mb-4" style={{color: colors.accent.dark}}><Plus size={20} /><span className="underline">Dodaj urlop</span></button>
      {vacation ? (<div className="bg-white rounded-2xl shadow-sm p-4" style={{borderLeft: '4px solid '+colors.accent.dark}}><p className="font-semibold">{vacation.type}</p><p className="text-sm text-slate-600">{vacation.startDate} - {vacation.endDate} ({vacation.totalDays} dni)</p></div>) : (<div className="bg-white rounded-2xl shadow-sm p-8 text-center"><Umbrella size={64} style={{color: colors.accent.light}} className="mx-auto mb-4" /><p className="text-slate-500">Brak zaplanowanych urlopów</p></div>)}
    </div>
    {showModal && (<div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"><div className="bg-white w-full max-w-lg rounded-t-3xl p-6"><h3 className="text-xl font-semibold mb-6">Nowy urlop</h3><div className="space-y-4"><div><label className="block text-sm font-medium mb-2" style={{color: colors.accent.dark}}>Typ</label><select value={newVac.type} onChange={(e) => setNewVac({...newVac, type: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl">{vacTypes.map(t => <option key={t} value={t}>{t}</option>)}</select></div><div><label className="block text-sm font-medium mb-2" style={{color: colors.accent.dark}}>Od</label><input type="date" min={todayStr} value={newVac.startDate} onChange={(e) => setNewVac({...newVac, startDate: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl" /></div><div><label className="block text-sm font-medium mb-2" style={{color: colors.accent.dark}}>Do</label><input type="date" min={newVac.startDate || todayStr} value={newVac.endDate} onChange={(e) => setNewVac({...newVac, endDate: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl" /></div></div><div className="flex gap-3 mt-6"><button onClick={() => setShowModal(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-semibold">Anuluj</button><button onClick={handleAdd} className="flex-1 py-3 text-white rounded-xl font-semibold" style={{backgroundColor: colors.accent.dark}}>Złóż wniosek</button></div></div></div>)}</div>
  );
};

const calculateHours = (st, et) => { try { const [sh, sm] = st.split(':').map(Number); const [eh, em] = et.split(':').map(Number); let h = eh - sh + (em - sm) / 60; if (h < 0) h += 24; return h; } catch { return 0; } };

const StatisticsPage = ({ shifts, hourlyRate = 0 }) => {
  const now = new Date(); const currentMonth = now.getMonth(); const currentYear = now.getFullYear();
  const monthsData = useMemo(() => {
    const mths = [];
    for (let i = 2; i >= 0; i--) { let month = currentMonth - i; let year = currentYear; if (month < 0) { month += 12; year -= 1; }
      const ms = shifts.filter(s => { const d = new Date(s.date); return d.getMonth() === month && d.getFullYear() === year; });
      let totalH = 0, cnt = 0; const pos = { KIT:0, CAS:0, SUP:0, RUN:0, SIN:0, LOB:0, TRA:0, MGR:0 };
      ms.forEach(s => { const h = calculateHours(s.startTime, s.endTime); totalH += h; cnt++; if (pos.hasOwnProperty(s.position)) pos[s.position] += h; });
      mths.push({ month, year, label: monthNames[month].substring(0, 3), fullLabel: monthNames[month], totalHours: totalH, shiftsCount: cnt, positions: pos, earnings: totalH * hourlyRate });
    } return mths;
  }, [shifts, currentMonth, currentYear, hourlyRate]);
  const cur = monthsData[2]; const total3 = monthsData.reduce((s, m) => s + m.totalHours, 0);

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-24 space-y-4">
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold">{cur.fullLabel} {cur.year}</h3><Clock size={24} style={{color: colors.primary.medium}} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl p-4 text-center" style={{backgroundColor: colors.primary.bg}}><p className="text-3xl font-bold" style={{color: colors.primary.dark}}>{cur.totalHours.toFixed(1)}</p><p className="text-sm" style={{color: colors.primary.light}}>godzin</p></div>
          <div className="rounded-xl p-4 text-center" style={{backgroundColor: colors.primary.bg}}><p className="text-3xl font-bold" style={{color: colors.primary.dark}}>{cur.shiftsCount}</p><p className="text-sm" style={{color: colors.primary.light}}>zmian</p></div>
        </div>
        {hourlyRate > 0 && (<div className="mt-4 rounded-xl p-4" style={{backgroundColor: colors.accent.bg}}><div className="flex items-center justify-between"><span className="text-sm" style={{color: colors.accent.dark}}>Prognoza</span><span className="text-xl font-bold" style={{color: colors.accent.dark}}>{cur.earnings.toFixed(2)} zł</span></div></div>)}
      </div>
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <h3 className="text-lg font-semibold mb-4">Ostatnie 3 miesiące</h3>
        <div className="flex items-end justify-between gap-2 h-32">{monthsData.map((m, i) => { const max = Math.max(...monthsData.map(x => x.totalHours), 1); const h = (m.totalHours / max) * 100; return (<div key={i} className="flex flex-col items-center flex-1"><span className="text-xs font-semibold mb-1">{m.totalHours.toFixed(0)}h</span><div className="w-full rounded-t-lg" style={{ height: Math.max(h, 5)+'%', backgroundColor: colors.primary.medium, opacity: i === 2 ? 1 : 0.6 }} /><span className="text-xs text-slate-500 mt-2">{m.label}</span></div>); })}</div>
        <div className="mt-4 pt-4 border-t flex justify-between text-sm"><span className="text-slate-500">Łącznie: <strong>{total3.toFixed(1)}h</strong></span><span className="text-slate-500">Śr/mies.: <strong>{(total3/3).toFixed(1)}h</strong></span></div>
      </div>
      {hourlyRate === 0 && (<div className="rounded-2xl p-4 text-center" style={{backgroundColor: colors.accent.bg}}><DollarSign size={32} style={{color: colors.accent.medium}} className="mx-auto mb-2" /><p className="text-sm" style={{color: colors.accent.dark}}>Dodaj stawkę w "Dane użytkownika"</p></div>)}
    </div>
  );
};

const UserDataPage = ({ user, onUpdate }) => {
  const [form, setForm] = useState(user);
  const [saved, setSaved] = useState(false);
  const save = async () => {
    const updated = { ...form, hourlyRate: parseFloat(form.hourlyRate) || 0, initials: form.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() };
    try { await api('/users', 'PUT', { id: user.id, phone: updated.phone, address: updated.address, hourlyRate: updated.hourlyRate }); } catch {}
    onUpdate(updated); saveToStorage('rex_user', updated);
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };
  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-24"><div className="bg-white rounded-2xl overflow-hidden">
      <div className="p-6 text-center" style={{background: 'linear-gradient(to right, '+colors.primary.darkest+', '+colors.primary.dark+')'}}><div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-3"><span className="font-bold text-2xl" style={{color: colors.primary.medium}}>{user.initials}</span></div><h2 className="text-white text-xl font-semibold">{form.name}</h2></div>
      <div className="p-4 space-y-4">
        <div><label className="block text-sm font-medium text-slate-600 mb-1">Imię i nazwisko</label><input value={form.name} disabled className="w-full p-3 bg-slate-100 rounded-xl text-slate-500" /></div>
        <div><label className="block text-sm font-medium text-slate-600 mb-1">Login</label><input value={form.login || ''} disabled className="w-full p-3 bg-slate-100 rounded-xl text-slate-500" /></div>
        <div><label className="block text-sm font-medium text-slate-600 mb-1">Telefon</label><input type="tel" value={form.phone || ''} onChange={(e) => setForm({...form, phone: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl" placeholder="+48 123 456 789" /></div>
        <div><label className="block text-sm font-medium text-slate-600 mb-1">Adres</label><input value={form.address || ''} onChange={(e) => setForm({...form, address: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl" /></div>
        <div><label className="block text-sm font-medium text-slate-600 mb-1">Stawka godzinowa (zł)</label><input type="number" step="0.01" min="0" value={form.hourlyRate || ''} onChange={(e) => setForm({...form, hourlyRate: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl" /></div>
        <button onClick={save} className="w-full py-3 rounded-xl font-semibold text-white" style={{backgroundColor: saved ? colors.accent.dark : colors.primary.medium}}>{saved ? '✓ Zapisano' : 'Zapisz zmiany'}</button>
      </div>
    </div></div>
  );
};

const AboutPage = () => (<div className="min-h-screen bg-slate-50 p-4 pb-24"><div className="bg-white rounded-2xl overflow-hidden"><div className="p-8 text-center" style={{background: 'linear-gradient(to right, '+colors.primary.darkest+', '+colors.primary.dark+')'}}><Cloud size={40} className="text-white mx-auto mb-4" /><span className="text-white text-2xl font-light">REX <span style={{color: colors.primary.bg}}>Cloud</span></span><p className="mt-2" style={{color: colors.primary.bg}}>v2.0 — Vercel KV</p></div><div className="p-6 space-y-4"><div className="rounded-xl p-4" style={{backgroundColor: colors.primary.bg}}><span className="font-semibold" style={{color: colors.primary.darkest}}>Nowe w v2.0</span><ul className="text-sm mt-2 space-y-1" style={{color: colors.primary.dark}}><li>• Baza danych Vercel KV</li><li>• Konta użytkowników (admin nadaje login/PIN)</li><li>• Grafik zarządzany przez admina</li><li>• Wnioski z zatwierdzaniem</li></ul></div><p className="text-slate-500 text-sm text-center">© 2025 REX Cloud by M. Szewczyk</p></div></div></div>);

// ===================== MAIN APP =====================

function REXCloudApp() {
  const [currentUser, setCurrentUser] = useState(() => loadFromStorage('rex_user', null));
  const [sidebar, setSidebar] = useState(false);
  const [page, setPage] = useState('home');
  const [date, setDate] = useState(() => new Date());
  const [user, setUser] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [vacation, setVacation] = useState(null);

  // Sync data from API
  useEffect(() => {
    if (currentUser) {
      setUser(currentUser);
      // Fetch shifts for this user
      api(`/shifts?userId=${currentUser.id}`).then(r => { if (r.success) setShifts(r.shifts); }).catch(() => {});
      // Fetch requests for this user
      api(`/requests?userId=${currentUser.id}`).then(r => { if (r.success) setRequests(r.requests); }).catch(() => {});
    }
  }, [currentUser]);

  const handleLogin = (userData) => { setCurrentUser(userData); };
  const handleLogout = () => { localStorage.removeItem('rex_user'); setCurrentUser(null); setUser(null); setPage('home'); setShifts([]); setRequests([]); setVacation(null); };
  const addRequest = (req) => setRequests(prev => [...prev, req]);
  const addVacation = (v) => setVacation(v);
  const updateUser = (u) => { setUser(u); setCurrentUser(u); };

  const todayStr = getTodayString();
  const dayNamesFull2 = ['NIEDZ','PON','WT','ŚR','CZW','PT','SOB'];
  const nextShift = shifts.filter(s => s.date >= todayStr).sort((a, b) => new Date(a.date) - new Date(b.date))[0] || null;
  if (nextShift && !nextShift.dayNum) { const d = new Date(nextShift.date); nextShift.dayNum = d.getDate(); nextShift.dayName = dayNamesFull2[d.getDay()]; }

  const titles = { home: 'Strona domowa', shifts: 'Zmiany', preferences: 'Wnioski', holidays: 'Czas wolny', workedTime: 'Przepracowany Czas', userData: 'Dane użytkownika', about: 'O Aplikacji' };

  if (!currentUser) return <LoginScreen onLogin={handleLogin} />;
  if (!user) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Cloud size={48} style={{color: colors.primary.medium}} className="animate-pulse" /></div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar isOpen={sidebar} onClose={() => setSidebar(false)} currentPage={page} onNavigate={setPage} user={user} onLogout={handleLogout} />
      <Header title={titles[page] || 'REX Cloud'} onMenuClick={() => setSidebar(true)} />
      {page === 'home' && <HomePage nextShift={nextShift} onNavigateToShifts={() => setPage('shifts')} vacation={vacation} onNavigateToHolidays={() => setPage('holidays')} />}
      {page === 'shifts' && <ShiftsPage date={date} onDateChange={setDate} shifts={shifts} />}
      {page === 'preferences' && <PreferencesPage date={date} onDateChange={setDate} requests={requests} onAddRequest={addRequest} user={currentUser} />}
      {page === 'holidays' && <HolidaysPage vacation={vacation} onAddVacation={addVacation} />}
      {page === 'workedTime' && <StatisticsPage shifts={shifts} hourlyRate={user.hourlyRate || 0} />}
      {page === 'userData' && <UserDataPage user={user} onUpdate={updateUser} />}
      {page === 'about' && <AboutPage />}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-2 flex justify-around z-10">
        {[['home', Home, 'Home'], ['shifts', Calendar, 'Zmiany'], ['preferences', Plus, 'Wnioski'], ['holidays', Umbrella, 'Urlopy']].map(([id, Icon, label]) => (
          <button key={id} onClick={() => setPage(id)} className="flex flex-col items-center p-2" style={{color: page === id ? colors.primary.medium : '#94a3b8'}}><Icon size={24} /><span className="text-xs mt-1">{label}</span></button>
        ))}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<REXCloudApp />);
