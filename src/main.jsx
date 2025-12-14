import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { Calendar, Home, Umbrella, Clock, Menu, X, ChevronLeft, ChevronRight, LogOut, Info, User, Plus, Cloud, TrendingUp, DollarSign, BarChart3, Lock, Users, MapPin } from 'lucide-react';

// ============================================
// KONFIGURACJA API
// ============================================
const API_URL = 'https://rex-cloud-backend.vercel.app/api/calendar';
const DEFAULT_LOCATION = 'Popeyes PLK Kraków Galeria Krakowska';
const positionColors = { 
  'KIT': '#7CB342',
  'CAS': '#00A3E0',
  'SUP': '#E74C3C',
  'RUN': '#9C27B0',
  'SIN': '#FF9800',
  'LOB': '#607D8B'
};
const monthNames = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
const dayNames = ['PON', 'WT', 'ŚR', 'CZW', 'PT', 'SOB', 'NIEDZ'];
const dayNamesFull = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];

// ============================================
// LOCAL STORAGE HELPERS
// ============================================
const saveToStorage = (key, data) => {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { console.error('Storage save error:', e); }
};

const loadFromStorage = (key, defaultValue = null) => {
  try { const data = localStorage.getItem(key); return data ? JSON.parse(data) : defaultValue; } catch (e) { return defaultValue; }
};

// ============================================
// SYSTEM UŻYTKOWNIKÓW Z HASHOWANIEM
// ============================================
const hashPassword = async (password) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const USERS = [
  {
    id: 'user_ms_001',
    pinHash: '8eebb0799014a38852ffad12b8ba8c3fad326e1b92f83a01549c4e69b0bb9893',
    profile: {
      name: 'MARCIN SZEWCZYK',
      initials: 'MS',
      email: 'szewczyk.marcin12@gmail.com',
      company: 'Rex Concepts',
      phone: '',
      address: 'Kraków',
      hourlyRate: 0
    }
  }
];

const authenticateUser = async (email, pin) => {
  const emailLower = email.toLowerCase().trim();
  const pinHash = await hashPassword(pin.trim());
  
  for (const user of USERS) {
    if (user.profile.email.toLowerCase() === emailLower && user.pinHash === pinHash) {
      const savedProfile = loadFromStorage(`profile_${user.id}`);
      const profile = savedProfile ? { ...user.profile, ...savedProfile } : { ...user.profile };
      return { id: user.id, profile };
    }
  }
  return null;
};

// ============================================
// ICS PARSER & GENERATOR
// ============================================
const parseICS = (icsContent) => {
  const shifts = [];
  const dayNamesFullArr = ['NIEDZ', 'PON', 'WT', 'ŚR', 'CZW', 'PT', 'SOB'];
  icsContent.split('BEGIN:VEVENT').slice(1).forEach((block, i) => {
    try {
      const get = (f) => { const m = block.match(new RegExp(f + '[^:]*:(.+?)(?:\\r?\\n|$)')); return m ? m[1].trim() : null; };
      const dtstart = get('DTSTART'), dtend = get('DTEND'), summary = get('SUMMARY'), location = get('LOCATION') || DEFAULT_LOCATION, uid = get('UID');
      if (dtstart && summary) {
        const parseDate = (s) => { if (!s) return null; const c = s.replace('Z', '').replace(/[^0-9T]/g, ''); return new Date(parseInt(c.substring(0,4)), parseInt(c.substring(4,6))-1, parseInt(c.substring(6,8)), parseInt(c.substring(9,11))||0, parseInt(c.substring(11,13))||0); };
        const start = parseDate(dtstart), end = parseDate(dtend);
        if (start) {
          const posMatch = summary.match(/^(KIT|CAS|SUP|RUN|SIN|LOB)/i);
          const pos = posMatch ? posMatch[1].toUpperCase() : 'KIT';
          shifts.push({ id: uid || 'shift-'+Date.now()+'-'+i, date: start.getFullYear()+'-'+String(start.getMonth()+1).padStart(2,'0')+'-'+String(start.getDate()).padStart(2,'0'), dayName: dayNamesFullArr[start.getDay()], dayNum: start.getDate(), shifts: [{ time: String(start.getHours()).padStart(2,'0')+':'+String(start.getMinutes()).padStart(2,'0')+' - '+(end ? String(end.getHours()).padStart(2,'0')+':'+String(end.getMinutes()).padStart(2,'0') : '23:00'), type: pos, color: positionColors[pos] || '#00A3E0' }], location: location.replace(/\\n/g, ' ') });
        }
      }
    } catch(e) {}
  });
  return shifts.sort((a,b) => new Date(a.date) - new Date(b.date));
};

const generateICS = (shifts) => {
  const fmt = (d) => d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+'T'+String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0')+'00';
  const events = shifts.map(s => { const [st, et] = s.shifts[0].time.split(' - '); const [sh, sm] = st.split(':'); const [eh, em] = et.split(':'); const start = new Date(s.date); start.setHours(+sh, +sm); const end = new Date(s.date); end.setHours(+eh, +em); const uid = typeof s.id === 'string' && s.id.includes('@') ? s.id : 'shift-'+s.id+'@rexcloud.app'; return 'BEGIN:VEVENT\nUID:'+uid+'\nDTSTAMP:'+fmt(new Date())+'\nDTSTART:'+fmt(start)+'\nDTEND:'+fmt(end)+'\nSUMMARY:'+s.shifts[0].type+' - Popeyes PLK\nLOCATION:'+s.location+'\nSTATUS:CONFIRMED\nEND:VEVENT'; }).join('\n');
  return 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//REX Cloud//PL\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\nX-WR-CALNAME:REX Cloud\n'+events+'\nEND:VCALENDAR';
};

const getTodayString = () => {
  const today = new Date();
  return today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
};

// ============================================
// LOGIN SCREEN
// ============================================
const LoginScreen = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !pin) { setError('Wprowadź email i PIN'); return; }
    setLoading(true); setError('');
    try {
      const user = await authenticateUser(email, pin);
      if (user) { onLogin(user); } else { setError('Nieprawidłowy email lub PIN'); }
    } catch (e) { setError('Błąd logowania'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-800 to-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-12">
          <div className="w-14 h-14 bg-cyan-500 rounded-xl flex items-center justify-center"><Cloud size={32} className="text-white" /></div>
          <div><span className="text-white text-3xl font-light">REX</span><span className="text-cyan-300 text-3xl font-light ml-2">Cloud</span></div>
        </div>
        <div className="bg-white rounded-2xl p-8">
          <div className="flex items-center justify-center gap-2 mb-6"><Lock size={20} className="text-cyan-500" /><h2 className="text-2xl font-semibold">Zaloguj się</h2></div>
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}
          <div className="space-y-4">
            <div><label className="block text-sm text-slate-600 mb-1">Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl border focus:border-cyan-500 outline-none" placeholder="Email" disabled={loading} /></div>
            <div><label className="block text-sm text-slate-600 mb-1">PIN</label><input type="password" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} className="w-full px-4 py-3 rounded-xl border focus:border-cyan-500 outline-none" placeholder="••••" maxLength={4} disabled={loading} /></div>
            <button onClick={handleLogin} disabled={loading} className="w-full bg-cyan-500 hover:bg-cyan-600 disabled:bg-cyan-300 text-white font-semibold py-3 rounded-xl transition-colors">{loading ? 'Logowanie...' : 'Zaloguj się'}</button>
          </div>
          <p className="text-xs text-slate-400 text-center mt-4">Połączenie szyfrowane</p>
        </div>
      </div>
    </div>
  );
};

// ============================================
// UI COMPONENTS
// ============================================
const CalendarView = ({ date, onDateChange, shifts, onDayClick, selectedDay }) => {
  const year = date.getFullYear(), month = date.getMonth();
  const firstDay = new Date(year, month, 1), lastDay = new Date(year, month + 1, 0), startDay = (firstDay.getDay() + 6) % 7;
  const days = []; for (let i = 0; i < startDay; i++) days.push({ day: new Date(year, month, 0).getDate() - startDay + i + 1, current: false }); for (let i = 1; i <= lastDay.getDate(); i++) days.push({ day: i, current: true }); for (let i = 1; days.length < 42; i++) days.push({ day: i, current: false });
  const getShifts = (d) => { const ds = year+'-'+String(month+1).padStart(2,'0')+'-'+String(d).padStart(2,'0'); return shifts.find(s => s.date === ds)?.shifts || []; };
  const today = new Date(), isToday = (d) => today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
  return (<div className="bg-white"><div className="flex items-center justify-between px-4 py-4 border-b"><button onClick={() => onDateChange(new Date(year, month-1, 1))} className="p-2"><ChevronLeft size={24} /></button><span className="text-lg font-semibold">{monthNames[month]} {year}</span><button onClick={() => onDateChange(new Date(year, month+1, 1))} className="p-2"><ChevronRight size={24} /></button></div><div className="grid grid-cols-7 gap-1 p-2">{dayNames.map(d => <div key={d} className="text-center text-xs font-medium text-slate-500 py-2">{d}</div>)}{days.map((item, i) => { const sh = item.current ? getShifts(item.day) : []; return (<button key={i} onClick={() => item.current && onDayClick(item.day === selectedDay ? null : item.day)} className={`flex flex-col items-center py-2 rounded-full ${!item.current ? 'text-slate-300' : selectedDay === item.day ? 'bg-cyan-100 text-cyan-700' : isToday(item.day) ? 'bg-cyan-500 text-white' : 'text-slate-700'}`}><span className="text-sm font-medium">{item.day}</span>{sh.length > 0 && item.current && <div className="flex gap-0.5 mt-1">{sh.slice(0,3).map((s,j) => <div key={j} className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: s.color}} />)}</div>}</button>); })}</div></div>);
};

const Sidebar = ({ isOpen, onClose, currentPage, onNavigate, user, onLogout }) => {
  const items = [{ id: 'home', icon: Home, label: 'Strona domowa' }, { id: 'shifts', icon: Calendar, label: 'Zmiany' }, { id: 'holidays', icon: Umbrella, label: 'Czas wolny' }, { id: 'workedTime', icon: Clock, label: 'Przepracowany Czas' }, { id: 'userData', icon: User, label: 'Dane użytkownika' }, { id: 'about', icon: Info, label: 'O Aplikacji' }];
  return (<>{isOpen && <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />}<div className={`fixed top-0 left-0 h-full w-72 bg-white z-50 transform transition-transform flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}><div className="bg-gradient-to-r from-cyan-500 to-cyan-600 p-4 pt-8"><div className="flex items-center gap-2 mb-4"><Cloud size={24} className="text-white" /><span className="text-white text-lg font-light">REX <span className="text-cyan-200">Cloud</span></span></div></div><div className="p-4 border-b flex items-center gap-3"><div className="w-12 h-12 bg-cyan-500 rounded-full flex items-center justify-center text-white font-semibold">{user.initials}</div><div><p className="font-semibold text-sm">{user.name}</p><p className="text-slate-500 text-xs">{user.email}</p></div></div><nav className="p-4 flex-1">{items.map(item => (<button key={item.id} onClick={() => { onNavigate(item.id); onClose(); }} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl ${currentPage === item.id ? 'bg-cyan-50 text-cyan-600' : 'text-slate-600'}`}><item.icon size={20} /><span className="font-medium">{item.label}</span></button>))}</nav><div className="p-4 border-t"><button onClick={() => { onLogout(); onClose(); }} className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-red-600"><LogOut size={20} /><span className="font-medium">Wyloguj się</span></button></div></div></>);
};

const Header = ({ title, onMenuClick }) => (<div className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white px-4 py-4 flex items-center justify-between sticky top-0 z-30"><div className="flex items-center gap-3"><Cloud size={24} /><span className="text-lg font-medium">{title}</span></div><button onClick={onMenuClick} className="p-2"><Menu size={24} /></button></div>);

// ============================================
// SWIPEABLE SHIFT CARD
// ============================================
const SwipeableShiftCard = ({ shift, onShowCoworkers, isRevealed, onReveal, isSelected, onSelect }) => {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);
  const hasMoved = useRef(false);
  
  // Synchronize with external isRevealed state
  useEffect(() => {
    if (!isRevealed && translateX > 0) {
      setTranslateX(0);
    }
  }, [isRevealed]);
  
  const handleTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
    hasMoved.current = false;
    setIsDragging(true);
  };
  
  const handleTouchMove = (e) => {
    if (!isDragging) return;
    currentX.current = e.touches[0].clientX;
    const diff = startX.current - currentX.current;
    if (Math.abs(diff) > 5) hasMoved.current = true;
    if (diff > 0) {
      setTranslateX(Math.min(diff, 80));
    } else {
      setTranslateX(0);
    }
  };
  
  const handleTouchEnd = () => {
    setIsDragging(false);
    if (translateX > 40) {
      setTranslateX(70);
      onReveal(shift.id);
    } else {
      setTranslateX(0);
      if (!hasMoved.current) {
        onSelect(shift.id);
      }
    }
  };
  
  const handleMouseDown = (e) => {
    startX.current = e.clientX;
    hasMoved.current = false;
    setIsDragging(true);
  };
  
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    currentX.current = e.clientX;
    const diff = startX.current - currentX.current;
    if (Math.abs(diff) > 5) hasMoved.current = true;
    if (diff > 0) {
      setTranslateX(Math.min(diff, 80));
    } else {
      setTranslateX(0);
    }
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
    if (translateX > 40) {
      setTranslateX(70);
      onReveal(shift.id);
    } else {
      setTranslateX(0);
      if (!hasMoved.current) {
        onSelect(shift.id);
      }
    }
  };
  
  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      if (translateX > 40) {
        setTranslateX(70);
        onReveal(shift.id);
      } else {
        setTranslateX(0);
      }
    }
  };
  
  const isOpen = translateX > 40 || isRevealed;
  const isHighlighted = isOpen || isSelected;
  
  return (
    <div className="relative overflow-hidden rounded-xl shadow-sm mb-3">
      {/* Action button behind */}
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-cyan-500 flex items-center justify-center rounded-r-xl">
        <button 
          onClick={() => onShowCoworkers(shift)}
          className="w-full h-full flex items-center justify-center"
        >
          <Users size={28} className="text-white" />
        </button>
      </div>
      
      {/* Main card */}
      <div 
        className={`relative border-l-4 border-cyan-400 p-4 transition-all duration-200 ${isHighlighted ? 'bg-cyan-50' : 'bg-white'}`}
        style={{ transform: `translateX(-${isRevealed ? 70 : translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex gap-4">
          <div className={`rounded-xl px-3 py-2 text-center min-w-14 ${isHighlighted ? 'bg-cyan-100' : 'bg-cyan-50'}`}>
            <p className="text-xs text-cyan-600">{shift.dayName}</p>
            <p className="text-xl font-bold">{shift.dayNum}.{String(new Date(shift.date).getMonth()+1).padStart(2,'0')}</p>
          </div>
          <div className="flex-1">
            {shift.shifts.map((s,i) => (
              <div key={i} className="flex items-center gap-2 mb-1">
                <span>{s.time}</span>
                <span className="w-2 h-2 rounded-full" style={{backgroundColor: s.color}} />
                <span className="text-sm text-slate-600">{s.type}</span>
              </div>
            ))}
            <p className="text-slate-500 text-sm mt-1">{shift.location}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// COWORKERS MODAL
// ============================================
const CoworkersModal = ({ shift, onClose }) => {
  if (!shift) return null;
  
  const shiftDate = new Date(shift.date);
  const formattedDate = `${dayNamesFull[shiftDate.getDay()]}, ${shiftDate.getDate()} ${monthNames[shiftDate.getMonth()].toLowerCase()} ${shiftDate.getFullYear()}`;
  
  // Placeholder - brak współpracowników
  const coworkers = [];
  
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-slate-50 w-full max-w-lg rounded-t-3xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-white p-4 border-b">
          <h3 className="text-xl font-semibold text-slate-700">Współpracownicy ze zmiany</h3>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Shift info */}
          <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                <MapPin size={20} className="text-slate-500" />
              </div>
              <span className="text-slate-700">{shift.location}</span>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                <Calendar size={20} className="text-slate-500" />
              </div>
              <span className="text-slate-700">{formattedDate}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                <Clock size={20} className="text-slate-500" />
              </div>
              <span className="text-slate-700">{shift.shifts[0].time}</span>
            </div>
          </div>
          
          {/* Coworkers list */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h4 className="text-lg font-semibold text-slate-700 mb-4">Współpracownicy ze zmiany</h4>
            
            {coworkers.length === 0 ? (
              <div className="text-center py-8">
                <Users size={48} className="text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400">Brak informacji o współpracownikach</p>
              </div>
            ) : (
              <div className="space-y-3">
                {coworkers.map((cw, i) => (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center">
                      <User size={24} className="text-slate-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">{cw.name}</p>
                      <p className="text-cyan-500 text-sm">{cw.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 bg-white border-t">
          <button 
            onClick={onClose}
            className="w-full py-3 bg-cyan-500 text-white font-semibold rounded-xl"
          >
            Ok
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// PAGES
// ============================================
const HomePage = ({ nextShift, onNavigateToShifts, vacation, onNavigateToHolidays }) => {
  const calcCountdown = (dateStr, time) => { if (!dateStr) return { days: 0, hours: 0, min: 0 }; const target = new Date(dateStr); if (time) { const [h, m] = time.split(':'); target.setHours(+h, +m); } const diff = target - new Date(); if (diff <= 0) return { days: 0, hours: 0, min: 0 }; return { days: Math.floor(diff / 86400000), hours: Math.floor((diff % 86400000) / 3600000), min: Math.floor((diff % 3600000) / 60000) }; };
  const shiftCountdown = nextShift ? calcCountdown(nextShift.date, nextShift.shifts[0].time.split(' - ')[0]) : null;
  const vacCountdown = vacation ? calcCountdown(vacation.startDate) : { days: 0, hours: 0, min: 0 };
  const vacDate = vacation ? new Date(vacation.startDate) : null;
  const vacEndDate = vacation ? new Date(vacation.endDate) : null;
  const vacDayNames = ['NIEDZ', 'PON', 'WT', 'ŚR', 'CZW', 'PT', 'SOB'];
  const formatDate = (d) => d.getDate()+'.'+String(d.getMonth()+1).padStart(2,'0');
  return (<div className="p-4 space-y-4 pb-24"><div className="bg-white rounded-2xl shadow-sm border-l-4 border-cyan-500 p-4 cursor-pointer" onClick={onNavigateToShifts}><div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold">Następna zmiana</h3><Calendar size={24} className="text-cyan-500" /></div>{nextShift ? (<div className="flex gap-4"><div className="bg-slate-50 rounded-xl p-3 text-center min-w-16"><p className="text-sm text-slate-500">{nextShift.dayName}</p><p className="text-3xl font-bold">{nextShift.dayNum}</p><p className="text-sm text-slate-500">{monthNames[new Date(nextShift.date).getMonth()].substring(0,3).toUpperCase()}</p></div><div className="flex-1">{nextShift.shifts.map((s, i) => (<div key={i} className="flex items-center gap-2 mb-1"><Clock size={16} className="text-slate-400" /><span>{s.time}</span><span className="text-sm px-2 py-0.5 rounded" style={{backgroundColor: s.color+'20', color: s.color}}>{s.type}</span></div>))}<p className="text-slate-500 text-sm mt-1">{nextShift.location}</p><div className="flex gap-4 mt-4 pt-3 border-t"><div className="text-center"><p className="text-2xl font-bold text-cyan-500">{shiftCountdown.days}</p><p className="text-xs text-slate-500">Dni</p></div><div className="text-center"><p className="text-2xl font-bold">{shiftCountdown.hours}</p><p className="text-xs text-slate-500">godz</p></div><div className="text-center"><p className="text-2xl font-bold">{shiftCountdown.min}</p><p className="text-xs text-slate-500">min</p></div></div></div></div>) : (<div className="text-center py-4"><Cloud size={40} className="text-slate-200 mx-auto mb-2" /><p className="text-slate-500">Brak zaplanowanych zmian</p></div>)}</div><div className="bg-white rounded-2xl shadow-sm border-l-4 border-amber-400 p-4 cursor-pointer" onClick={onNavigateToHolidays}><div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold">Następny urlop</h3><Umbrella size={24} className="text-amber-500" /></div>{vacation ? (<div className="flex gap-4"><div className="bg-amber-50 rounded-xl p-3 text-center min-w-16"><p className="text-sm text-amber-600">{vacDayNames[vacDate.getDay()]}</p><p className="text-3xl font-bold">{vacDate.getDate()}</p><p className="text-sm text-amber-600">{monthNames[vacDate.getMonth()].substring(0,3).toUpperCase()}</p></div><div className="flex-1"><div className="flex items-center gap-2 mb-1"><Umbrella size={16} className="text-amber-500" /><span className="font-medium">{vacation.type}</span></div><div className="flex items-center gap-2 text-slate-600 text-sm"><Calendar size={14} className="text-slate-400" /><span>{formatDate(vacDate)} - {formatDate(vacEndDate)}</span></div><p className="text-amber-600 text-sm font-medium mt-1">Łącznie: {vacation.totalDays} dni</p><div className="flex gap-4 mt-4 pt-3 border-t"><div className="text-center"><p className="text-2xl font-bold text-amber-500">{vacCountdown.days}</p><p className="text-xs text-slate-500">Dni</p></div><div className="text-center"><p className="text-2xl font-bold">{vacCountdown.hours}</p><p className="text-xs text-slate-500">godz</p></div><div className="text-center"><p className="text-2xl font-bold">{vacCountdown.min}</p><p className="text-xs text-slate-500">min</p></div></div></div></div>) : (<div className="text-center py-4"><Umbrella size={40} className="text-amber-200 mx-auto mb-2" /><p className="text-slate-500">Brak zaplanowanych urlopów</p></div>)}</div></div>);
};

const ShiftsPage = ({ date, onDateChange, shifts }) => {
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedShift, setSelectedShift] = useState(null);
  const [revealedShiftId, setRevealedShiftId] = useState(null);
  const [clickedShiftId, setClickedShiftId] = useState(null);
  
  const filtered = shifts.filter(s => { 
    const d = new Date(s.date); 
    return (!selectedDay || d.getDate() === selectedDay) && d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear(); 
  }).sort((a, b) => new Date(a.date) - new Date(b.date));
  
  const handleReveal = (shiftId) => {
    // Only one shift can be revealed at a time
    setRevealedShiftId(shiftId);
    setClickedShiftId(null); // Clear click selection when swiping
  };
  
  const handleSelect = (shiftId) => {
    // Toggle selection on click
    setClickedShiftId(prev => prev === shiftId ? null : shiftId);
    setRevealedShiftId(null); // Close any revealed shift when clicking
  };
  
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-20">
      <CalendarView date={date} onDateChange={onDateChange} shifts={shifts} onDayClick={setSelectedDay} selectedDay={selectedDay} />
      <div className="flex-1 p-4">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <Cloud size={48} className="text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">Brak zmian w tym okresie</p>
          </div>
        ) : (
          filtered.map(shift => (
            <SwipeableShiftCard 
              key={shift.id} 
              shift={shift} 
              onShowCoworkers={setSelectedShift}
              isRevealed={revealedShiftId === shift.id}
              onReveal={handleReveal}
              isSelected={clickedShiftId === shift.id}
              onSelect={handleSelect}
            />
          ))
        )}
      </div>
      
      {selectedShift && (
        <CoworkersModal 
          shift={selectedShift} 
          onClose={() => setSelectedShift(null)} 
        />
      )}
    </div>
  );
}; 

const PreferencesPage = ({ date, onDateChange, onAddShift }) => {
  const [prefs, setPrefs] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const todayStr = getTodayString();
  const [newPref, setNewPref] = useState({ date: todayStr, type: 'Pracuj', position: 'KIT', timeFrom: '08:00', timeTo: '16:00' });
  const types = ['Pracuj', 'Nie pracuj', 'Nie pracuj wcześniej', 'Nie pracuj później niż', 'Praca w godzinach'];
  const positions = [
    { id: 'KIT', name: 'KIT - Kuchnia' }, 
    { id: 'CAS', name: 'CAS - Kasa' }, 
    { id: 'SUP', name: 'SUP - Wsparcie' }, 
    { id: 'RUN', name: 'RUN - Runner' },
    { id: 'SIN', name: 'SIN - Sink' },
    { id: 'LOB', name: 'LOB - Lobby' }
  ];
  const needsFrom = ['Nie pracuj wcześniej', 'Praca w godzinach'].includes(newPref.type);
  const needsTo = ['Nie pracuj później niż', 'Praca w godzinach'].includes(newPref.type);
  const needsPos = newPref.type !== 'Nie pracuj';
  
  const handleAdd = () => {
    if (newPref.date < todayStr) {
      setError('Nie można dodać zmiany w przeszłości');
      return;
    }
    setError('');
    
    const d = new Date(newPref.date); 
    const dayNamesShort = ['NI', 'PO', 'WT', 'ŚR', 'CZ', 'PT', 'SO']; 
    const dayNamesFullArr = ['NIEDZ', 'PON', 'WT', 'ŚR', 'CZW', 'PT', 'SOB']; 
    const pref = { id: Date.now(), date: newPref.date, dayName: dayNamesShort[d.getDay()], dayNum: d.getDate(), type: newPref.type, position: needsPos ? newPref.position : null, timeFrom: needsFrom ? newPref.timeFrom : null, timeTo: needsTo ? newPref.timeTo : null }; 
    setPrefs([...prefs, pref]); 
    if (newPref.type !== 'Nie pracuj') { 
      const time = newPref.type === 'Praca w godzinach' ? newPref.timeFrom+' - '+newPref.timeTo : newPref.type === 'Nie pracuj wcześniej' ? newPref.timeFrom+' - 23:00' : newPref.type === 'Nie pracuj później niż' ? '06:00 - '+newPref.timeTo : '08:00 - 16:00'; 
      onAddShift({ id: Date.now()+1, date: newPref.date, dayName: dayNamesFullArr[d.getDay()], dayNum: d.getDate(), shifts: [{ time, type: newPref.position, color: positionColors[newPref.position] }], location: DEFAULT_LOCATION }); 
    } 
    setShowModal(false); 
    setNewPref({ date: todayStr, type: 'Pracuj', position: 'KIT', timeFrom: '08:00', timeTo: '16:00' }); 
  };
  
  return (<div className="flex flex-col min-h-screen bg-slate-50 pb-20"><div className="bg-white px-4 py-4 border-b flex items-center justify-between"><button onClick={() => onDateChange(new Date(date.getFullYear(), date.getMonth()-1, 1))} className="p-2"><ChevronLeft size={24} /></button><span className="font-semibold">{monthNames[date.getMonth()]} {date.getFullYear()}</span><button onClick={() => onDateChange(new Date(date.getFullYear(), date.getMonth()+1, 1))} className="p-2"><ChevronRight size={24} /></button></div><div className="p-4"><button onClick={() => { setShowModal(true); setError(''); }} className="flex items-center gap-2 text-cyan-600 font-medium mb-4"><Plus size={20} /><span className="underline">Nowy wniosek o zmianę</span></button>{prefs.length === 0 ? (<div className="text-center py-12"><Cloud size={48} className="text-slate-300 mx-auto mb-4" /><p className="text-slate-500">Brak wniosków</p></div>) : prefs.map(p => (<div key={p.id} className="bg-white rounded-xl shadow-sm border-l-4 border-cyan-400 p-4 mb-3"><div className="flex items-center gap-4"><div className="bg-cyan-50 rounded-xl px-3 py-2 text-center min-w-14"><p className="text-xs text-cyan-600">{p.dayName}</p><p className="text-xl font-bold">{p.dayNum}</p></div><div><p className="font-medium">{p.type}</p>{p.position && <p className="text-sm text-slate-600">{p.position}</p>}{(p.timeFrom || p.timeTo) && <p className="text-sm text-slate-500">{p.timeFrom && 'od '+p.timeFrom} {p.timeTo && 'do '+p.timeTo}</p>}</div></div></div>))}</div>{showModal && (<div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"><div className="bg-white w-full max-w-lg rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto"><h3 className="text-xl font-semibold mb-6">Nowy wniosek o zmianę</h3>
  {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}
  <div className="space-y-4"><div><label className="block text-sm font-medium text-cyan-600 mb-2">Data</label><input type="date" min={todayStr} value={newPref.date} onChange={(e) => setNewPref({...newPref, date: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl" /></div><div><label className="block text-sm font-medium text-cyan-600 mb-2">Rodzaj</label><select value={newPref.type} onChange={(e) => setNewPref({...newPref, type: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl">{types.map(t => <option key={t} value={t}>{t}</option>)}</select></div>{needsFrom && (<div><label className="block text-sm font-medium text-cyan-600 mb-2">Od godziny</label><input type="time" value={newPref.timeFrom} onChange={(e) => setNewPref({...newPref, timeFrom: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl" /></div>)}{needsTo && (<div><label className="block text-sm font-medium text-cyan-600 mb-2">Do godziny</label><input type="time" value={newPref.timeTo} onChange={(e) => setNewPref({...newPref, timeTo: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl" /></div>)}{needsPos && (<div><label className="block text-sm font-medium text-cyan-600 mb-2">Pozycja</label><select value={newPref.position} onChange={(e) => setNewPref({...newPref, position: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl">{positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>)}<div className="bg-green-50 p-3 rounded-xl text-sm text-green-700">✓ Zmiana zostanie automatycznie zsynchronizowana</div></div><div className="flex gap-3 mt-6"><button onClick={() => setShowModal(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-semibold">Anuluj</button><button onClick={handleAdd} className="flex-1 py-3 bg-cyan-500 text-white rounded-xl font-semibold">Dodaj zmianę</button></div></div></div>)}</div>);
};

const HolidaysPage = ({ vacation, onAddVacation }) => {
  const [showModal, setShowModal] = useState(false);
  const todayStr = getTodayString();
  const [newVac, setNewVac] = useState({ startDate: '', endDate: '', type: 'Urlop wypoczynkowy' });
  const vacTypes = ['Urlop wypoczynkowy', 'Urlop na żądanie', 'Urlop bezpłatny', 'Zwolnienie lekarskie', 'Inny'];
  const vacDayNames = ['NIEDZ', 'PON', 'WT', 'ŚR', 'CZW', 'PT', 'SOB'];
  const calcCountdown = (dateStr) => { if (!dateStr) return { days: 0, hours: 0, min: 0 }; const diff = new Date(dateStr) - new Date(); if (diff <= 0) return { days: 0, hours: 0, min: 0 }; return { days: Math.floor(diff / 86400000), hours: Math.floor((diff % 86400000) / 3600000), min: Math.floor((diff % 3600000) / 60000) }; };
  const formatDate = (d) => d.getDate()+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+d.getFullYear();
  const handleAdd = () => { if (newVac.startDate && newVac.endDate && newVac.startDate >= todayStr) { const start = new Date(newVac.startDate); const end = new Date(newVac.endDate); const days = Math.ceil((end - start) / 86400000) + 1; onAddVacation({ startDate: newVac.startDate, endDate: newVac.endDate, type: newVac.type, totalDays: days }); setShowModal(false); setNewVac({ startDate: '', endDate: '', type: 'Urlop wypoczynkowy' }); } };
  const vacDate = vacation ? new Date(vacation.startDate) : null;
  const vacEndDate = vacation ? new Date(vacation.endDate) : null;
  const vacCountdown = vacation ? calcCountdown(vacation.startDate) : null;
  return (<div className="flex flex-col min-h-screen bg-slate-50 pb-24"><div className="p-4"><button onClick={() => setShowModal(true)} className="flex items-center gap-2 text-amber-600 font-medium mb-4"><Plus size={20} /><span className="underline">Dodaj nowy urlop</span></button>{vacation ? (<div className="bg-white rounded-2xl shadow-sm border-l-4 border-amber-400 p-4"><div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold">Zaplanowany urlop</h3><Umbrella size={24} className="text-amber-500" /></div><div className="flex gap-4"><div className="bg-amber-50 rounded-xl p-3 text-center min-w-16"><p className="text-sm text-amber-600">{vacDayNames[vacDate.getDay()]}</p><p className="text-3xl font-bold">{vacDate.getDate()}</p><p className="text-sm text-amber-600">{monthNames[vacDate.getMonth()].substring(0,3).toUpperCase()}</p></div><div className="flex-1"><div className="flex items-center gap-2 mb-1"><Umbrella size={16} className="text-amber-500" /><span className="font-medium">{vacation.type}</span></div><div className="flex items-center gap-2 text-slate-600 text-sm"><Calendar size={14} className="text-slate-400" /><span>{formatDate(vacDate)} - {formatDate(vacEndDate)}</span></div><p className="text-amber-600 text-sm font-medium mt-1">Łącznie: {vacation.totalDays} dni</p><div className="flex gap-4 mt-4 pt-3 border-t"><div className="text-center"><p className="text-2xl font-bold text-amber-500">{vacCountdown.days}</p><p className="text-xs text-slate-500">Dni</p></div><div className="text-center"><p className="text-2xl font-bold">{vacCountdown.hours}</p><p className="text-xs text-slate-500">godz</p></div><div className="text-center"><p className="text-2xl font-bold">{vacCountdown.min}</p><p className="text-xs text-slate-500">min</p></div></div></div></div></div>) : (<div className="bg-white rounded-2xl shadow-sm p-8 text-center"><Umbrella size={64} className="text-amber-200 mx-auto mb-4" /><p className="text-slate-500 mb-4">Brak zaplanowanych urlopów</p><button onClick={() => setShowModal(true)} className="px-6 py-3 bg-amber-500 text-white font-semibold rounded-xl">Złóż wniosek</button></div>)}</div>{showModal && (<div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"><div className="bg-white w-full max-w-lg rounded-t-3xl p-6"><h3 className="text-xl font-semibold mb-6">Nowy wniosek urlopowy</h3><div className="space-y-4"><div><label className="block text-sm font-medium text-amber-600 mb-2">Typ urlopu</label><select value={newVac.type} onChange={(e) => setNewVac({...newVac, type: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl">{vacTypes.map(t => <option key={t} value={t}>{t}</option>)}</select></div><div><label className="block text-sm font-medium text-amber-600 mb-2">Data rozpoczęcia</label><input type="date" min={todayStr} value={newVac.startDate} onChange={(e) => setNewVac({...newVac, startDate: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl" /></div><div><label className="block text-sm font-medium text-amber-600 mb-2">Data zakończenia</label><input type="date" min={newVac.startDate || todayStr} value={newVac.endDate} onChange={(e) => setNewVac({...newVac, endDate: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl" /></div>{newVac.startDate && newVac.endDate && (<div className="bg-amber-50 p-3 rounded-xl text-sm text-amber-700">Łączna liczba dni: <strong>{Math.ceil((new Date(newVac.endDate) - new Date(newVac.startDate)) / 86400000) + 1}</strong></div>)}</div><div className="flex gap-3 mt-6"><button onClick={() => setShowModal(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-semibold">Anuluj</button><button onClick={handleAdd} className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-semibold">Złóż wniosek</button></div></div></div>)}</div>);
};

// ============================================
// STATISTICS PAGE
// ============================================
const calculateHours = (timeStr) => { try { const [start, end] = timeStr.split(' - '); const [sh, sm] = start.split(':').map(Number); const [eh, em] = end.split(':').map(Number); let hours = eh - sh + (em - sm) / 60; if (hours < 0) hours += 24; return hours; } catch (e) { return 0; } };
const BarChart = ({ data, maxValue, color = '#00A3E0' }) => (<div className="flex items-end justify-between gap-2 h-32">{data.map((item, i) => { const height = maxValue > 0 ? (item.value / maxValue) * 100 : 0; return (<div key={i} className="flex flex-col items-center flex-1"><span className="text-xs font-semibold mb-1">{item.value.toFixed(0)}h</span><div className="w-full rounded-t-lg transition-all duration-500" style={{ height: `${Math.max(height, 5)}%`, backgroundColor: color, opacity: i === data.length - 1 ? 1 : 0.6 }} /><span className="text-xs text-slate-500 mt-2">{item.label}</span></div>); })}</div>);
const PositionBreakdown = ({ positions }) => { const colors = { 'KIT': '#7CB342', 'CAS': '#00A3E0', 'SUP': '#E74C3C', 'RUN': '#9C27B0', 'SIN': '#FF9800', 'LOB': '#607D8B' }; const total = Object.values(positions).reduce((a, b) => a + b, 0); if (total === 0) return null; return (<div className="space-y-2">{Object.entries(positions).filter(([_, hours]) => hours > 0).map(([pos, hours]) => { const percent = (hours / total) * 100; return (<div key={pos} className="flex items-center gap-3"><span className="text-sm font-medium w-10">{pos}</span><div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: colors[pos] }} /></div><span className="text-sm text-slate-600 w-16 text-right">{hours.toFixed(1)}h</span></div>); })}</div>); };

const StatisticsPage = ({ shifts, hourlyRate = 0 }) => {
  const now = new Date(); const currentMonth = now.getMonth(); const currentYear = now.getFullYear();
  const monthsData = useMemo(() => { const months = []; for (let i = 2; i >= 0; i--) { let month = currentMonth - i; let year = currentYear; if (month < 0) { month += 12; year -= 1; } const monthShifts = shifts.filter(s => { const d = new Date(s.date); return d.getMonth() === month && d.getFullYear() === year; }); let totalHours = 0, shiftsCount = 0; const positions = { KIT: 0, CAS: 0, SUP: 0, RUN: 0, SIN: 0, LOB: 0 }; monthShifts.forEach(shift => { shift.shifts.forEach(s => { const hours = calculateHours(s.time); totalHours += hours; shiftsCount++; if (positions.hasOwnProperty(s.type)) positions[s.type] += hours; }); }); months.push({ month, year, label: monthNames[month].substring(0, 3), fullLabel: monthNames[month], totalHours, shiftsCount, positions, earnings: totalHours * hourlyRate }); } return months; }, [shifts, currentMonth, currentYear, hourlyRate]);
  const currentMonthData = monthsData[2]; const totalHours3Months = monthsData.reduce((sum, m) => sum + m.totalHours, 0); const totalEarnings3Months = totalHours3Months * hourlyRate; const avgHoursPerMonth = totalHours3Months / 3; const chartData = monthsData.map(m => ({ label: m.label, value: m.totalHours })); const maxChartValue = Math.max(...chartData.map(d => d.value), 1);
  return (<div className="min-h-screen bg-slate-50 p-4 pb-24 space-y-4"><div className="bg-white rounded-2xl shadow-sm p-4"><div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold">{currentMonthData.fullLabel} {currentMonthData.year}</h3><Clock size={24} className="text-cyan-500" /></div><div className="grid grid-cols-2 gap-4"><div className="bg-cyan-50 rounded-xl p-4 text-center"><p className="text-3xl font-bold text-cyan-600">{currentMonthData.totalHours.toFixed(1)}</p><p className="text-sm text-cyan-700">godzin</p></div><div className="bg-emerald-50 rounded-xl p-4 text-center"><p className="text-3xl font-bold text-emerald-600">{currentMonthData.shiftsCount}</p><p className="text-sm text-emerald-700">zmian</p></div></div>{hourlyRate > 0 && (<div className="mt-4 bg-amber-50 rounded-xl p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><DollarSign size={20} className="text-amber-600" /><span className="text-sm text-amber-700">Prognozowane wynagrodzenie</span></div><span className="text-xl font-bold text-amber-600">{currentMonthData.earnings.toFixed(2)} zł</span></div></div>)}</div><div className="bg-white rounded-2xl shadow-sm p-4"><div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold">Godziny - ostatnie 3 miesiące</h3><BarChart3 size={24} className="text-cyan-500" /></div><BarChart data={chartData} maxValue={maxChartValue} /><div className="mt-4 pt-4 border-t flex justify-between text-sm"><div><span className="text-slate-500">Łącznie:</span><span className="font-semibold ml-2">{totalHours3Months.toFixed(1)}h</span></div><div><span className="text-slate-500">Średnia/mies.:</span><span className="font-semibold ml-2">{avgHoursPerMonth.toFixed(1)}h</span></div></div></div><div className="bg-white rounded-2xl shadow-sm p-4"><div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold">Podział wg stanowisk</h3><TrendingUp size={24} className="text-cyan-500" /></div><p className="text-sm text-slate-500 mb-3">{currentMonthData.fullLabel}</p>{currentMonthData.totalHours > 0 ? <PositionBreakdown positions={currentMonthData.positions} /> : <p className="text-slate-400 text-center py-4">Brak danych</p>}</div>{hourlyRate > 0 && (<div className="bg-white rounded-2xl shadow-sm p-4"><div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold">Podsumowanie zarobków</h3><DollarSign size={24} className="text-emerald-500" /></div><div className="space-y-3">{monthsData.map((m, i) => (<div key={i} className="flex items-center justify-between py-2 border-b last:border-0"><div><p className="font-medium">{m.fullLabel}</p><p className="text-sm text-slate-500">{m.totalHours.toFixed(1)}h × {hourlyRate.toFixed(2)} zł</p></div><span className="text-lg font-semibold text-emerald-600">{m.earnings.toFixed(2)} zł</span></div>))}<div className="flex items-center justify-between pt-2 mt-2 border-t-2"><span className="font-semibold">Razem (3 mies.)</span><span className="text-xl font-bold text-emerald-600">{totalEarnings3Months.toFixed(2)} zł</span></div></div></div>)}{hourlyRate === 0 && (<div className="bg-amber-50 rounded-2xl p-4 text-center"><DollarSign size={32} className="text-amber-400 mx-auto mb-2" /><p className="text-amber-700 text-sm">Dodaj stawkę godzinową w zakładce "Dane użytkownika"</p></div>)}</div>);
};

// ============================================
// USER DATA PAGE
// ============================================
const UserDataPage = ({ user, onUpdate, userId }) => {
  const [form, setForm] = useState(user);
  const [saved, setSaved] = useState(false);
  
  const save = () => {
    const updatedUser = { ...form, hourlyRate: parseFloat(form.hourlyRate) || 0, initials: form.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() };
    onUpdate(updatedUser);
    saveToStorage(`profile_${userId}`, updatedUser);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  
  return (<div className="min-h-screen bg-slate-50 p-4 pb-24"><div className="bg-white rounded-2xl overflow-hidden"><div className="bg-gradient-to-r from-cyan-500 to-cyan-600 p-6 text-center"><div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-3"><span className="text-cyan-600 font-bold text-2xl">{user.initials}</span></div><h2 className="text-white text-xl font-semibold">{form.name}</h2><p className="text-cyan-100 text-sm mt-1">Konto zabezpieczone</p></div><div className="p-4 space-y-4"><div><label className="block text-sm font-medium text-slate-600 mb-1">Imię i nazwisko</label><input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl" placeholder="Imię i nazwisko" /></div><div><label className="block text-sm font-medium text-slate-600 mb-1">Email</label><input value={form.email} disabled className="w-full p-3 bg-slate-100 rounded-xl text-slate-500" /></div><div><label className="block text-sm font-medium text-slate-600 mb-1">Telefon</label><input type="tel" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl" placeholder="+48 123 456 789" /></div><div><label className="block text-sm font-medium text-slate-600 mb-1">Adres</label><input value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl" placeholder="Adres zamieszkania" /></div><div><label className="block text-sm font-medium text-slate-600 mb-1">Stawka godzinowa (zł)</label><input type="number" step="0.01" min="0" value={form.hourlyRate || ''} onChange={(e) => setForm({...form, hourlyRate: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl" placeholder="np. 27.70" /><p className="text-xs text-slate-400 mt-1">Używana do obliczania prognozowanych zarobków</p></div><button onClick={save} className={`w-full py-3 rounded-xl font-semibold ${saved ? 'bg-green-500 text-white' : 'bg-cyan-500 text-white'}`}>{saved ? '✓ Zapisano' : 'Zapisz zmiany'}</button></div></div></div>);
};

const AboutPage = () => (<div className="min-h-screen bg-slate-50 p-4 pb-24"><div className="bg-white rounded-2xl overflow-hidden"><div className="bg-gradient-to-r from-cyan-500 to-cyan-600 p-8 text-center"><Cloud size={40} className="text-white mx-auto mb-4" /><span className="text-white text-2xl font-light">REX <span className="text-cyan-200">Cloud</span></span><p className="text-cyan-100 mt-2">v3.2.0</p></div><div className="p-6 space-y-4"><div className="bg-green-50 rounded-xl p-4"><div className="flex items-center gap-2 mb-2"><Lock size={18} className="text-green-600" /><span className="font-semibold text-green-800">Bezpieczeństwo</span></div><ul className="text-sm text-green-700 space-y-1"><li>• Hasła hashowane SHA-256</li><li>• Dane zapisywane lokalnie</li><li>• Automatyczna synchronizacja</li></ul></div><p className="text-slate-500 text-sm text-center">© 2025 REX Cloud by M. Szewczyk</p></div></div></div>);

// ============================================
// MAIN APP
// ============================================
function REXCloudApp() {
  const [currentUser, setCurrentUser] = useState(null);
  const [sidebar, setSidebar] = useState(false);
  const [page, setPage] = useState('home');
  const [date, setDate] = useState(new Date(2025, 11, 1));
  const [user, setUser] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [vacation, setVacation] = useState(null);
  const [calendarSha, setCalendarSha] = useState(null);
  const [initialSyncDone, setInitialSyncDone] = useState(false);
  
  useEffect(() => {
    if (currentUser) {
      setUser(currentUser.profile);
      syncFromGitHub();
    }
  }, [currentUser]);
  
  useEffect(() => {
    if (currentUser && initialSyncDone && shifts.length > 0) {
      const timer = setTimeout(() => saveToGitHub(), 1500);
      return () => clearTimeout(timer);
    }
  }, [shifts, initialSyncDone]);
  
  const syncFromGitHub = async () => {
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      if (data.success && data.content) {
        const parsed = parseICS(data.content);
        setShifts(parsed);
        setCalendarSha(data.sha);
      }
      setInitialSyncDone(true);
    } catch (e) {
      console.error('Sync error:', e);
      setInitialSyncDone(true);
    }
  };
  
  const saveToGitHub = async () => {
    if (!calendarSha) return;
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: generateICS(shifts),
          sha: calendarSha,
          message: 'Auto-sync from REX Cloud'
        })
      });
      const data = await res.json();
      if (data.success) setCalendarSha(data.sha);
    } catch (e) { console.error('Save error:', e); }
  };
  
  const handleLogin = (userData) => { setCurrentUser(userData); };
  const handleLogout = () => { setCurrentUser(null); setUser(null); setPage('home'); setShifts([]); setVacation(null); setCalendarSha(null); setInitialSyncDone(false); };
  const addShift = (s) => { setShifts(prev => [...prev.filter(x => x.date !== s.date), s].sort((a,b) => new Date(a.date) - new Date(b.date))); };
  const addVacation = (v) => setVacation(v);
  const updateUser = (u) => setUser(u);
  const nextShift = shifts.filter(s => new Date(s.date) >= new Date()).sort((a,b) => new Date(a.date) - new Date(b.date))[0] || null;
  const titles = { home: 'Strona domowa', shifts: 'Zmiany', preferences: 'Wniosek o zmiany', holidays: 'Czas wolny', workedTime: 'Przepracowany Czas', userData: 'Dane użytkownika', about: 'O Aplikacji' };
  
  if (!currentUser) return <LoginScreen onLogin={handleLogin} />;
  if (!user) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Cloud size={48} className="text-cyan-500 animate-pulse" /></div>;
  
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar isOpen={sidebar} onClose={() => setSidebar(false)} currentPage={page} onNavigate={setPage} user={user} onLogout={handleLogout} />
      <Header title={titles[page] || 'REX Cloud'} onMenuClick={() => setSidebar(true)} />
      {page === 'home' && <HomePage nextShift={nextShift} onNavigateToShifts={() => setPage('shifts')} vacation={vacation} onNavigateToHolidays={() => setPage('holidays')} />}
      {page === 'shifts' && <ShiftsPage date={date} onDateChange={setDate} shifts={shifts} />}
      {page === 'preferences' && <PreferencesPage date={date} onDateChange={setDate} onAddShift={addShift} />}
      {page === 'holidays' && <HolidaysPage vacation={vacation} onAddVacation={addVacation} />}
      {page === 'workedTime' && <StatisticsPage shifts={shifts} hourlyRate={user.hourlyRate || 0} />}
      {page === 'userData' && <UserDataPage user={user} onUpdate={updateUser} userId={currentUser.id} />}
      {page === 'about' && <AboutPage />}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-2 flex justify-around z-10">
        {[['home', Home, 'Home'], ['shifts', Calendar, 'Zmiany'], ['preferences', Plus, 'Wnioski'], ['holidays', Umbrella, 'Urlopy']].map(([id, Icon, label]) => (
          <button key={id} onClick={() => setPage(id)} className={`flex flex-col items-center p-2 ${page === id ? 'text-cyan-500' : 'text-slate-400'}`}>
            <Icon size={24} /><span className="text-xs mt-1">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<REXCloudApp />);
