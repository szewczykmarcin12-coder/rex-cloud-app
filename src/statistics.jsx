import React, { useState, useMemo } from 'react';
import { Clock, TrendingUp, DollarSign, Calendar, BarChart3 } from 'lucide-react';

const monthNames = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];

// Calculate hours from time string "HH:MM - HH:MM"
const calculateHours = (timeStr) => {
  try {
    const [start, end] = timeStr.split(' - ');
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let hours = eh - sh + (em - sm) / 60;
    if (hours < 0) hours += 24; // overnight shift
    return hours;
  } catch (e) {
    return 0;
  }
};

// Simple bar chart component
const BarChart = ({ data, maxValue, color = '#00A3E0' }) => {
  return (
    <div className="flex items-end justify-between gap-2 h-32">
      {data.map((item, i) => {
        const height = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
        return (
          <div key={i} className="flex flex-col items-center flex-1">
            <span className="text-xs font-semibold mb-1">{item.value.toFixed(0)}h</span>
            <div 
              className="w-full rounded-t-lg transition-all duration-500"
              style={{ 
                height: `${Math.max(height, 5)}%`,
                backgroundColor: color,
                opacity: i === data.length - 1 ? 1 : 0.6
              }}
            />
            <span className="text-xs text-slate-500 mt-2">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
};

// Position breakdown pie-like display
const PositionBreakdown = ({ positions }) => {
  const colors = { 'KIT': '#7CB342', 'CAS': '#00A3E0', 'SUP': '#E74C3C', 'RUN': '#9C27B0' };
  const total = Object.values(positions).reduce((a, b) => a + b, 0);
  
  if (total === 0) return null;
  
  return (
    <div className="space-y-2">
      {Object.entries(positions).filter(([_, hours]) => hours > 0).map(([pos, hours]) => {
        const percent = (hours / total) * 100;
        return (
          <div key={pos} className="flex items-center gap-3">
            <span className="text-sm font-medium w-10">{pos}</span>
            <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${percent}%`, backgroundColor: colors[pos] }}
              />
            </div>
            <span className="text-sm text-slate-600 w-16 text-right">{hours.toFixed(1)}h</span>
          </div>
        );
      })}
    </div>
  );
};

export const StatisticsPage = ({ shifts, hourlyRate = 0 }) => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  // Calculate stats for last 3 months
  const monthsData = useMemo(() => {
    const months = [];
    
    for (let i = 2; i >= 0; i--) {
      let month = currentMonth - i;
      let year = currentYear;
      if (month < 0) {
        month += 12;
        year -= 1;
      }
      
      const monthShifts = shifts.filter(s => {
        const d = new Date(s.date);
        return d.getMonth() === month && d.getFullYear() === year;
      });
      
      let totalHours = 0;
      let shiftsCount = 0;
      const positions = { KIT: 0, CAS: 0, SUP: 0, RUN: 0 };
      
      monthShifts.forEach(shift => {
        shift.shifts.forEach(s => {
          const hours = calculateHours(s.time);
          totalHours += hours;
          shiftsCount++;
          if (positions.hasOwnProperty(s.type)) {
            positions[s.type] += hours;
          }
        });
      });
      
      months.push({
        month,
        year,
        label: monthNames[month].substring(0, 3),
        fullLabel: monthNames[month],
        totalHours,
        shiftsCount,
        positions,
        earnings: totalHours * hourlyRate
      });
    }
    
    return months;
  }, [shifts, currentMonth, currentYear, hourlyRate]);
  
  const currentMonthData = monthsData[2];
  const totalHours3Months = monthsData.reduce((sum, m) => sum + m.totalHours, 0);
  const totalEarnings3Months = totalHours3Months * hourlyRate;
  const avgHoursPerMonth = totalHours3Months / 3;
  
  // Chart data
  const chartData = monthsData.map(m => ({
    label: m.label,
    value: m.totalHours
  }));
  const maxChartValue = Math.max(...chartData.map(d => d.value), 1);
  
  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-24 space-y-4">
      {/* Current month summary */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{currentMonthData.fullLabel} {currentMonthData.year}</h3>
          <Clock size={24} className="text-cyan-500" />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-cyan-50 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-cyan-600">{currentMonthData.totalHours.toFixed(1)}</p>
            <p className="text-sm text-cyan-700">godzin</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-emerald-600">{currentMonthData.shiftsCount}</p>
            <p className="text-sm text-emerald-700">zmian</p>
          </div>
        </div>
        
        {hourlyRate > 0 && (
          <div className="mt-4 bg-amber-50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign size={20} className="text-amber-600" />
                <span className="text-sm text-amber-700">Prognozowane wynagrodzenie</span>
              </div>
              <span className="text-xl font-bold text-amber-600">{currentMonthData.earnings.toFixed(2)} zł</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Hours chart */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Godziny - ostatnie 3 miesiące</h3>
          <BarChart3 size={24} className="text-cyan-500" />
        </div>
        
        <BarChart data={chartData} maxValue={maxChartValue} />
        
        <div className="mt-4 pt-4 border-t flex justify-between text-sm">
          <div>
            <span className="text-slate-500">Łącznie:</span>
            <span className="font-semibold ml-2">{totalHours3Months.toFixed(1)}h</span>
          </div>
          <div>
            <span className="text-slate-500">Średnia/mies.:</span>
            <span className="font-semibold ml-2">{avgHoursPerMonth.toFixed(1)}h</span>
          </div>
        </div>
      </div>
      
      {/* Position breakdown */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Podział wg stanowisk</h3>
          <TrendingUp size={24} className="text-cyan-500" />
        </div>
        
        <p className="text-sm text-slate-500 mb-3">{currentMonthData.fullLabel}</p>
        
        {currentMonthData.totalHours > 0 ? (
          <PositionBreakdown positions={currentMonthData.positions} />
        ) : (
          <p className="text-slate-400 text-center py-4">Brak danych</p>
        )}
      </div>
      
      {/* Earnings summary */}
      {hourlyRate > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Podsumowanie zarobków</h3>
            <DollarSign size={24} className="text-emerald-500" />
          </div>
          
          <div className="space-y-3">
            {monthsData.map((m, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium">{m.fullLabel}</p>
                  <p className="text-sm text-slate-500">{m.totalHours.toFixed(1)}h × {hourlyRate.toFixed(2)} zł</p>
                </div>
                <span className="text-lg font-semibold text-emerald-600">{m.earnings.toFixed(2)} zł</span>
              </div>
            ))}
            
            <div className="flex items-center justify-between pt-2 mt-2 border-t-2">
              <span className="font-semibold">Razem (3 mies.)</span>
              <span className="text-xl font-bold text-emerald-600">{totalEarnings3Months.toFixed(2)} zł</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Info about hourly rate */}
      {hourlyRate === 0 && (
        <div className="bg-amber-50 rounded-2xl p-4 text-center">
          <DollarSign size={32} className="text-amber-400 mx-auto mb-2" />
          <p className="text-amber-700 text-sm">
            Dodaj stawkę godzinową w zakładce "Dane użytkownika", aby zobaczyć prognozowane zarobki
          </p>
        </div>
      )}
    </div>
  );
};

export default StatisticsPage;
