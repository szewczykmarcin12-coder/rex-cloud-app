// ── Atmosphere (Smoky Blue, v16): JEDNO przypisanie stanowisk do pastelowych rodzin kolorów ──
// Używane przez Studio (grafik, siatka dnia, autoplan, model pracy, kwalifikacje), podgląd wydruku,
// generator PDF (RGB) i Employee Hub (kopia: rex-cloud-app/src/stations.js — identyczna, pilnowana testem).
// Zasada: tło = pastel rodziny, tekst = grafit, etykieta stanowiska zawsze widoczna; akcent rodziny = cienki pasek / kropka.
// Wartości równe tokenom --at-station-* w atmosphere-tokens.css.
export const STATION_FAMILIES = {
  lead:       { nazwa: 'Kierownik',          tone: 'deep',    fill: '#C5E3F7', accent: '#315F83', ink: '#132B46' },   // Blue Mist + Deep Navy
  operations: { nazwa: 'Front / obsługa',    tone: 'mid',     fill: '#E2ECF3', accent: '#7FA6C2', ink: '#315F83' },   // Smoky Blue
  production: { nazwa: 'Kuchnia',            tone: 'soft',    fill: '#FAE8DC', accent: '#B85C45', ink: '#7A3E2C' },   // Soft Apricot + Terracotta
  control:    { nazwa: 'Wsparcie / zadania', tone: 'outline', fill: '#F5F1EA', accent: '#526270', ink: '#3E4B55' },   // Ivory + Slate
  training:   { nazwa: 'Szkolenia',          tone: 'mid',     fill: '#EAF3ED', accent: '#3F6B55', ink: '#3F6B55' },   // sukces
  other:      { nazwa: 'Pozostałe',          tone: 'outline', fill: '#EEF1F4', accent: '#8E9CA7', ink: '#3E4B55' },
};
export const STATION_FAMILY = {
  'MANAGER': 'lead', 'MGR FUNKCYJNE': 'lead',
  'KONTROLER': 'operations', 'DISPATCHER': 'operations', 'PHU': 'operations', 'DESERY / NAPOJE': 'operations',
  'KANAPKI / WRAPY': 'production', 'PANIEROWANIE': 'production', 'SMAŻENIE': 'production', 'FRYTKI': 'production',
  'ZMYWAK': 'control', 'PREP': 'control', 'DOSTAWA': 'control', 'WSPARCIE WIECZORNE / FLEX': 'control',
  'SZKOLENIA': 'training', 'TRAINING': 'training', 'INSTRUKTOR': 'training',
};
// akcent = akcent RODZINY. Stanowiska w rodzinie rozróżnia etykieta, nie kolor — mniej barw, żadna spoza palety.
export const STATION_ACCENT = {};
const norm = (s) => String(s || '').trim().toUpperCase().replace(/\s+/g, ' ');
export const stationFamily = (st) => STATION_FAMILY[norm(st)] || 'other';
export const stationStyle = (st) => { const f = STATION_FAMILIES[stationFamily(st)]; return { family: stationFamily(st), tone: f.tone, fill: f.fill, accent: STATION_ACCENT[norm(st)] || f.accent, ink: f.ink, text: '#292D32' }; };
export const stationTone = (st) => stationStyle(st).tone;          // klasa gantt-/weekly-/print-shift-: deep | mid | soft | outline
export const stationFill = (st) => stationStyle(st).fill;
export const stationAccent = (st) => stationStyle(st).accent;
export const stationInk = (st) => stationStyle(st).ink;
const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const stationRgb = (st) => { const s = stationStyle(st); return { fill: rgb(s.fill), accent: rgb(s.accent), ink: rgb(s.ink), text: rgb(s.text) }; };
export const FAMILY_LEGEND = Object.entries(STATION_FAMILIES).filter(([k]) => k !== 'other' && k !== 'training').map(([k, f]) => ({ key: k, tone: f.tone, label: f.nazwa, fill: f.fill, accent: f.accent }));
