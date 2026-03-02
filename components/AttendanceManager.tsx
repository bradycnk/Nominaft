
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase.ts';
import { Empleado, Asistencia } from '../types.ts';
import { calculateDetailedShift } from '../services/payrollService.ts';

interface CalendarDayDraft {
  estado: Asistencia['estado'];
  hora_entrada: string;
  hora_salida: string;
  observaciones: string;
}

interface HolidayInfo {
  name: string;
  detail: string;
}

const pad2 = (value: number) => String(value).padStart(2, '0');
const formatDateKey = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const getEasterSunday = (year: number) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};

const getVenezuelanHolidays = (year: number): Record<string, HolidayInfo> => {
  const holidays: Record<string, HolidayInfo> = {};

  const addHoliday = (date: Date, name: string, detail: string) => {
    holidays[formatDateKey(date)] = { name, detail };
  };

  // Feriados fijos de uso nacional
  addHoliday(new Date(year, 0, 1), 'Año Nuevo', 'Celebración del inicio de año.');
  addHoliday(new Date(year, 3, 19), '19 de Abril', 'Declaración de la Independencia de Venezuela (1810).');
  addHoliday(new Date(year, 4, 1), 'Día del Trabajador', 'Conmemoración internacional del trabajo.');
  addHoliday(new Date(year, 5, 24), 'Batalla de Carabobo', 'Conmemoración de la Batalla de Carabobo (1821).');
  addHoliday(new Date(year, 6, 5), 'Día de la Independencia', 'Firma del Acta de la Independencia (1811).');
  addHoliday(new Date(year, 6, 24), 'Natalicio de Simón Bolívar', 'Conmemoración del nacimiento del Libertador.');
  addHoliday(new Date(year, 9, 12), 'Día de la Resistencia Indígena', 'Conmemoración de la resistencia de los pueblos originarios.');
  addHoliday(new Date(year, 11, 24), 'Nochebuena', 'Asueto navideño.');
  addHoliday(new Date(year, 11, 25), 'Navidad', 'Celebración de la Navidad.');
  addHoliday(new Date(year, 11, 31), 'Fin de Año', 'Asueto de cierre de año.');

  // Feriados móviles (basados en Pascua)
  const easterSunday = getEasterSunday(year);
  const carnavalMonday = new Date(easterSunday);
  carnavalMonday.setDate(easterSunday.getDate() - 48);
  const carnavalTuesday = new Date(easterSunday);
  carnavalTuesday.setDate(easterSunday.getDate() - 47);
  const holyThursday = new Date(easterSunday);
  holyThursday.setDate(easterSunday.getDate() - 3);
  const holyFriday = new Date(easterSunday);
  holyFriday.setDate(easterSunday.getDate() - 2);

  addHoliday(carnavalMonday, 'Lunes de Carnaval', 'Inicio del asueto de Carnaval.');
  addHoliday(carnavalTuesday, 'Martes de Carnaval', 'Cierre del asueto de Carnaval.');
  addHoliday(holyThursday, 'Jueves Santo', 'Conmemoración de Semana Santa.');
  addHoliday(holyFriday, 'Viernes Santo', 'Conmemoración de Semana Santa.');

  return holidays;
};

const AttendanceManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'daily' | 'calendar'>('daily');
  const [employees, setEmployees] = useState<Empleado[]>([]);
  
  // Estado para el formulario (Inputs)
  const [attendances, setAttendances] = useState<Record<string, Asistencia>>({});
  // Estado para la base de datos (Confirmación real)
  const [savedAttendances, setSavedAttendances] = useState<Record<string, Asistencia>>({});
  
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Estados para Calendario / Histórico
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [employeeHistory, setEmployeeHistory] = useState<Asistencia[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [dayDraft, setDayDraft] = useState<CalendarDayDraft>({
    estado: 'presente',
    hora_entrada: '',
    hora_salida: '',
    observaciones: ''
  });
  const [savingCalendarDay, setSavingCalendarDay] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const holidaysByDate = useMemo(() => getVenezuelanHolidays(selectedYear), [selectedYear]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'calendar' && selectedEmployeeId) {
      fetchEmployeeHistory();
    }
  }, [selectedEmployeeId, selectedMonth, selectedYear, activeTab]);

  useEffect(() => {
    setSelectedDate('');
    setDayDraft({
      estado: 'presente',
      hora_entrada: '',
      hora_salida: '',
      observaciones: ''
    });
  }, [selectedEmployeeId, selectedMonth, selectedYear]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: empData } = await supabase
        .from('empleados')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true });

      const { data: attData } = await supabase
        .from('asistencias')
        .select('*')
        .eq('fecha', today);

      setEmployees(empData || []);
      if (empData && empData.length > 0 && !selectedEmployeeId) {
        setSelectedEmployeeId(empData[0].id);
      }
      
      const attMap: Record<string, Asistencia> = {};
      attData?.forEach(a => {
        attMap[a.empleado_id] = a;
      });
      
      setAttendances(prev => ({ ...attMap }));
      setSavedAttendances(JSON.parse(JSON.stringify(attMap))); 

    } catch (err) {
      console.error("Error cargando asistencia:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeeHistory = async () => {
    const startDate = new Date(selectedYear, selectedMonth, 1).toISOString().split('T')[0];
    const endDate = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split('T')[0];

    const { data } = await supabase
      .from('asistencias')
      .select('*')
      .eq('empleado_id', selectedEmployeeId)
      .gte('fecha', startDate)
      .lte('fecha', endDate);

    const history = data || [];
    setEmployeeHistory(history);
    return history;
  };

  const getHistoryRecordByDate = (date: string) => {
    return employeeHistory.find((record) => record.fecha === date);
  };

  const openDayEditor = (date: string) => {
    const record = getHistoryRecordByDate(date);
    setSelectedDate(date);
    setDayDraft({
      estado: record?.estado || 'presente',
      hora_entrada: record?.hora_entrada?.slice(0, 5) || '',
      hora_salida: record?.hora_salida?.slice(0, 5) || '',
      observaciones: record?.observaciones || ''
    });
  };

  const saveCalendarDay = async () => {
    if (!selectedEmployeeId || !selectedDate) return;

    const existingRecord = getHistoryRecordByDate(selectedDate);
    if (existingRecord?.cerrado) {
      alert("El día seleccionado está cerrado administrativamente. No se puede editar.");
      return;
    }

    if (dayDraft.estado === 'presente' && !dayDraft.hora_entrada) {
      alert("Para estado 'presente' debe indicar hora de entrada.");
      return;
    }

    if (dayDraft.hora_salida && !dayDraft.hora_entrada) {
      alert("No puede guardar hora de salida sin una hora de entrada.");
      return;
    }

    setSavingCalendarDay(true);
    try {
      const payload = {
        empleado_id: selectedEmployeeId,
        fecha: selectedDate,
        estado: dayDraft.estado,
        hora_entrada: dayDraft.estado === 'presente' ? (dayDraft.hora_entrada || null) : null,
        hora_salida: dayDraft.estado === 'presente' ? (dayDraft.hora_salida || null) : null,
        observaciones: dayDraft.observaciones.trim() || null,
      };

      const { error } = await supabase
        .from('asistencias')
        .upsert(payload, { onConflict: 'empleado_id,fecha' });

      if (error) throw error;

      const refreshedHistory = await fetchEmployeeHistory();
      if (selectedDate === today) await fetchInitialData();
      const refreshedRecord = refreshedHistory.find((record) => record.fecha === selectedDate);
      setDayDraft({
        estado: refreshedRecord?.estado || 'presente',
        hora_entrada: refreshedRecord?.hora_entrada?.slice(0, 5) || '',
        hora_salida: refreshedRecord?.hora_salida?.slice(0, 5) || '',
        observaciones: refreshedRecord?.observaciones || ''
      });
    } catch (err: any) {
      alert("Error al guardar cambios del día: " + err.message);
    } finally {
      setSavingCalendarDay(false);
    }
  };

  const handleTimeChange = (empId: string, field: 'hora_entrada' | 'hora_salida', value: string) => {
    setAttendances(prev => ({
      ...prev,
      [empId]: {
        ...(prev[empId] || { 
          empleado_id: empId, 
          fecha: today, 
          estado: 'presente' 
        } as Asistencia),
        [field]: value
      }
    }));
  };

  const saveEntry = async (empId: string) => {
    const savedData = savedAttendances[empId];
    if (savedData?.cerrado) return alert("El día ya está cerrado administrativamente. No se pueden hacer cambios.");

    const data = attendances[empId];
    if (!data?.hora_entrada) return alert("Ingrese la hora de entrada");

    setProcessingId(empId);
    try {
      const payload = {
        empleado_id: empId,
        fecha: today,
        hora_entrada: data.hora_entrada,
        estado: 'presente' as const
      };

      const { error } = await supabase
        .from('asistencias')
        .upsert(payload, { onConflict: 'empleado_id,fecha' });

      if (error) throw error;
      await fetchInitialData();
    } catch (err: any) {
      alert("Error al guardar entrada: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const saveExit = async (empId: string) => {
    const savedData = savedAttendances[empId];
    if (savedData?.cerrado) return alert("El día ya está cerrado administrativamente. No se pueden hacer cambios.");
    if (!savedData?.hora_entrada) return alert("Error: No hay hora de entrada registrada en el sistema.");
    
    const data = attendances[empId];
    if (!data?.hora_salida) return alert("Ingrese la hora de salida");

    if (data.hora_salida <= savedData.hora_entrada) {
      return alert("La hora de salida debe ser posterior a la entrada.");
    }

    setProcessingId(empId);
    try {
      const { error } = await supabase
        .from('asistencias')
        .update({ hora_salida: data.hora_salida })
        .eq('empleado_id', empId)
        .eq('fecha', today);

      if (error) throw error;
      await fetchInitialData();
    } catch (err: any) {
      alert("Error al guardar salida: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleCloseQuincena = async (isSecondHalf: boolean) => {
    const startDay = isSecondHalf ? 16 : 1;
    const endDay = isSecondHalf ? new Date(selectedYear, selectedMonth + 1, 0).getDate() : 15;
    
    const startDate = new Date(selectedYear, selectedMonth, startDay).toISOString().split('T')[0];
    const endDate = new Date(selectedYear, selectedMonth, endDay).toISOString().split('T')[0];

    const now = new Date();
    const rangeEnd = new Date(selectedYear, selectedMonth, endDay);
    if (rangeEnd > now && !confirm("¡Atención! Está intentando cerrar una quincena que aún no ha terminado. ¿Desea continuar?")) {
      return;
    }

    if (!confirm(`¿Confirma el CIERRE DE QUINCENA para el empleado seleccionado?\n\nPeríodo: ${startDate} al ${endDate}\n\nEsta acción bloqueará la edición de estos registros.`)) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('asistencias')
        .update({ cerrado: true })
        .eq('empleado_id', selectedEmployeeId)
        .gte('fecha', startDate)
        .lte('fecha', endDate);

      if (error) throw error;

      alert("Quincena cerrada correctamente. Registros bloqueados.");
      fetchEmployeeHistory();
    } catch (err: any) {
      alert("Error al cerrar quincena: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Funciones para Calendario LOTTT ---

  const getDaysInMonth = (month: number, year: number) => {
    const date = new Date(year, month, 1);
    const days = [];
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  };

  const calculateHoursWorked = (entrada?: string, salida?: string) => {
    if (!entrada || !salida) return 0;
    const [h1, m1] = entrada.split(':').map(Number);
    const [h2, m2] = salida.split(':').map(Number);
    const date1 = new Date(0, 0, 0, h1, m1);
    const date2 = new Date(0, 0, 0, h2, m2);
    let diff = (date2.getTime() - date1.getTime()) / 1000 / 60 / 60;
    if (diff < 0) diff += 24;
    return diff > 0 ? diff : 0;
  };

  const getStatsQuincena = (isSecondHalf: boolean) => {
    const startDay = isSecondHalf ? 16 : 1;
    const endDay = isSecondHalf ? 31 : 15;
    
    const relevantHistory = employeeHistory.filter(h => {
      const day = parseInt(h.fecha.split('-')[2]);
      return day >= startDay && day <= endDay;
    });

    let totalHours = 0;
    let daysWorked = 0;
    let inasistencias = 0;
    let isClosed = false;

    relevantHistory.forEach(h => {
      if (h.estado === 'presente') {
        totalHours += calculateHoursWorked(h.hora_entrada, h.hora_salida);
        daysWorked++;
      } else if (h.estado === 'falta') {
        inasistencias++;
      }
      if (h.cerrado) isClosed = true;
    });

    return { totalHours, daysWorked, inasistencias, isClosed };
  };

  const renderCalendar = () => {
    const days = getDaysInMonth(selectedMonth, selectedYear);
    const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    
    const firstDayIndex = days[0].getDay();
    const blanks = Array(firstDayIndex).fill(null);

    return (
      <div className="grid grid-cols-7 gap-2 mb-6">
        {weekDays.map(d => (
          <div key={d} className={`text-center text-[10px] font-black uppercase tracking-widest py-2 ${d === 'Dom' ? 'text-rose-400' : 'text-slate-400'}`}>
            {d}
          </div>
        ))}
        
        {blanks.map((_, i) => <div key={`blank-${i}`} className="h-28 bg-transparent"></div>)}

        {days.map(date => {
          const dateStr = date.toISOString().split('T')[0];
          const record = employeeHistory.find(h => h.fecha === dateStr);
          const holiday = holidaysByDate[dateStr];
          const isHoliday = !!holiday;
          const isSunday = date.getDay() === 0;
          const isSelectedDay = selectedDate === dateStr;

          // Cálculo detallado usando el servicio compartido
          const details = calculateDetailedShift(
            record?.hora_entrada || '', 
            record?.hora_salida || '', 
            dateStr
          );
          
          const totalExtras = details.extraDiurna + details.extraNocturna;
          const totalWorked = details.normal + totalExtras;
          
          // Lógica visual para Horario Mixto/Nocturno (Salida > 19:00 / 7PM)
          // O si el servicio detectó horas nocturnas
          const isMixedShift = (record?.hora_salida && record.hora_salida >= '19:00') || details.extraNocturna > 0;

          let bgColor = 'bg-white';
          let borderColor = 'border-slate-100';
          
          if (isHoliday) {
            bgColor = 'bg-orange-50';
            borderColor = 'border-orange-200';
          } else if (record?.estado === 'presente') {
            bgColor = isSunday ? 'bg-amber-50' : 'bg-emerald-50';
            borderColor = isSunday ? 'border-amber-200' : 'border-emerald-200';
          } else if (record?.estado === 'falta') {
            bgColor = 'bg-rose-50';
            borderColor = 'border-rose-200';
          } else if (isSunday) {
            bgColor = 'bg-slate-50';
          }

          if (record?.cerrado) {
            borderColor = 'border-slate-400';
          }

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => openDayEditor(dateStr)}
              className={`h-28 border rounded-xl p-2 flex flex-col relative transition-all hover:shadow-md text-left ${
                bgColor
              } ${borderColor} ${record?.cerrado ? 'opacity-80' : ''} ${
                isSelectedDay ? 'ring-2 ring-emerald-500 ring-offset-2' : ''
              }`}
            >
              {/* Header Día */}
              <div className="flex justify-between items-start mb-1">
                <span className={`text-xs font-bold ${isHoliday ? 'text-orange-600' : isSunday ? 'text-rose-500' : 'text-slate-700'}`}>
                  {date.getDate()}
                </span>
                <div className="flex gap-1">
                  {isHoliday && (
                    <span className="text-[8px] font-black text-orange-700 bg-orange-100 px-1 rounded border border-orange-200">
                      FERIADO
                    </span>
                  )}
                  {record?.cerrado && <span className="text-[9px]" title="Pagado">🔒</span>}
                  {record?.estado === 'falta' && (
                     <span className="text-[8px] font-black text-rose-600 bg-rose-100 px-1 rounded">FALTA</span>
                  )}
                </div>
              </div>
              
              {/* Contenido Asistencia */}
              {record?.estado === 'presente' ? (
                <div className="flex flex-col gap-0.5 mt-auto">
                    {isHoliday && (
                      <div className="mb-1 text-[8px] font-black text-orange-700 uppercase truncate" title={holiday?.detail}>
                        {holiday?.name}
                      </div>
                    )}
                    {/* Hora Entrada/Salida */}
                    <div className="text-[9px] text-slate-500 font-mono mb-1">
                        {record.hora_entrada?.slice(0,5)} - {record.hora_salida?.slice(0,5) || '?'}
                    </div>

                    {isSunday ? (
                        /* Lógica Domingo: Todo cuenta como especial */
                        <div className="bg-amber-100 text-amber-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-200 text-center">
                            D. Descanso: {details.descanso > 0 ? details.descanso.toFixed(1) : totalWorked.toFixed(1)}h
                        </div>
                    ) : (
                        /* Lógica Lunes-Sábado */
                        <>
                            {/* Horas Normales */}
                            <div className="flex justify-between items-center">
                                <span className="text-[9px] text-slate-500">Normal:</span>
                                <span className="text-[9px] font-bold text-slate-700">{details.normal.toFixed(1)}h</span>
                            </div>

                            {/* Horas Extras (Si existen) */}
                            {totalExtras > 0 && (
                                <div className="flex justify-between items-center bg-white/50 px-1 rounded">
                                    <span className="text-[9px] text-emerald-600 font-bold">+ Extra:</span>
                                    <span className="text-[9px] font-black text-emerald-700">{totalExtras.toFixed(1)}h</span>
                                </div>
                            )}

                            {/* Indicador Mixto/Nocturno */}
                            {isMixedShift && (
                                <div className="mt-1 text-center bg-indigo-100 text-indigo-700 text-[8px] font-black uppercase rounded py-0.5 px-1 border border-indigo-200 flex items-center justify-center gap-1">
                                    <span>🌙</span> H. Mixto
                                </div>
                            )}
                        </>
                    )}
                </div>
              ) : (
                 /* Sin asistencia */
                 <div className="mt-auto text-center">
                    {isHoliday ? (
                      <div className="space-y-0.5">
                        <div className="text-[8px] font-black text-orange-700 uppercase truncate">{holiday?.name}</div>
                        <div className="text-[8px] text-orange-500 leading-tight" title={holiday?.detail}>
                          {holiday?.detail}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[9px] text-slate-300 font-medium uppercase">
                        - Sin Reg -
                      </div>
                    )}
                 </div>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  const selectedHistoryRecord = selectedDate ? getHistoryRecordByDate(selectedDate) : null;
  const selectedHoliday = selectedDate ? holidaysByDate[selectedDate] : null;
  const selectedDateLabel = selectedDate
    ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString('es-VE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : '';

  return (
    <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
      
      {/* Header & Tabs */}
      <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <span>🕒</span> Control de Asistencia
          </h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
            Gestión de Jornada Laboral (LOTTT)
          </p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-xl">
           <button 
             onClick={() => setActiveTab('daily')}
             className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'daily' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
           >
             Control Diario
           </button>
           <button 
             onClick={() => setActiveTab('calendar')}
             className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'calendar' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
           >
             Histórico & Cierre
           </button>
        </div>
      </div>

      {/* VISTA DIARIA (Control de Asistencia del Día) */}
      {activeTab === 'daily' && (
        <>
          <div className="px-8 py-4 bg-slate-50 flex justify-between items-center border-b border-slate-100">
             <div className="text-sm font-bold text-slate-600">
               Fecha de Hoy: <span className="text-emerald-600 capitalize">{new Date().toLocaleDateString('es-VE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
             </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#F8F9FB] text-slate-400 text-[10px] font-black uppercase tracking-[0.15em] border-b border-slate-50">
                <tr>
                  <th className="px-8 py-5">Empleado</th>
                  <th className="px-8 py-5">Entrada</th>
                  <th className="px-8 py-5">Salida</th>
                  <th className="px-8 py-5">Estatus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr><td colSpan={4} className="p-10 text-center text-slate-400 font-bold uppercase text-xs tracking-widest">Sincronizando reloj biométrico...</td></tr>
                ) : employees.map(emp => {
                  const att = attendances[emp.id];
                  const savedAtt = savedAttendances[emp.id];

                  const entrySaved = !!savedAtt?.id; 
                  const exitSaved = !!savedAtt?.hora_salida;
                  const isClosed = savedAtt?.cerrado;

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm">
                            {emp.foto_url ? <img src={emp.foto_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-slate-400 uppercase">{emp.nombre[0]}{emp.apellido[0]}</div>}
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-800 uppercase tracking-tight">{emp.nombre} {emp.apellido}</div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wide mt-0.5">{emp.cargo}</div>
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2">
                          <input 
                            type="time" 
                            value={att?.hora_entrada || ''} 
                            onChange={(e) => handleTimeChange(emp.id, 'hora_entrada', e.target.value)}
                            disabled={entrySaved || isClosed} 
                            className={`px-4 py-2 rounded-xl border text-xs font-mono font-bold outline-none transition-all w-32 ${entrySaved || isClosed ? 'bg-slate-50 text-slate-500 border-slate-100' : 'bg-white border-emerald-200 text-emerald-800 focus:ring-2 focus:ring-emerald-500'}`}
                          />
                          {!entrySaved && !isClosed ? (
                             <button 
                               onClick={() => saveEntry(emp.id)}
                               disabled={processingId === emp.id || !att?.hora_entrada}
                               className="bg-emerald-600 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100 disabled:opacity-50 disabled:shadow-none"
                             >
                               {processingId === emp.id ? '...' : 'Confirmar'}
                             </button>
                          ) : (
                             <span className={`${isClosed ? 'text-slate-400' : 'text-emerald-500'} text-lg`}>
                               {isClosed ? '🔒' : '✓'}
                             </span>
                          )}
                        </div>
                      </td>

                      <td className="px-8 py-5">
                         <div className="flex items-center gap-2">
                           <input 
                             type="time" 
                             value={att?.hora_salida || ''} 
                             onChange={(e) => handleTimeChange(emp.id, 'hora_salida', e.target.value)}
                             disabled={!entrySaved || exitSaved || isClosed}
                             className={`px-4 py-2 rounded-xl border text-xs font-mono font-bold outline-none transition-all w-32 ${exitSaved || isClosed ? 'bg-slate-50 text-slate-500 border-slate-100' : !entrySaved ? 'bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed' : 'bg-white border-slate-200 text-slate-700 focus:ring-2 focus:ring-emerald-500'}`}
                           />
                           {entrySaved && !exitSaved && !isClosed && (
                              <button 
                                onClick={() => saveExit(emp.id)}
                                disabled={processingId === emp.id || !att?.hora_salida}
                                className="bg-emerald-600 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100 disabled:opacity-50 disabled:shadow-none"
                              >
                                {processingId === emp.id ? '...' : 'Confirmar'}
                              </button>
                           )}
                           {(exitSaved || isClosed) && <span className={`${isClosed ? 'text-slate-400' : 'text-slate-400'} text-lg`}>
                              {isClosed && !exitSaved ? '🔒' : '✓'}
                            </span>}
                         </div>
                      </td>

                      <td className="px-8 py-5">
                        {isClosed ? (
                           <span className="px-3 py-1.5 bg-slate-100 text-slate-400 rounded-lg text-[9px] font-black uppercase tracking-wider border border-slate-200">
                            Cerrado/Pagado
                          </span>
                        ) : exitSaved ? (
                          <span className="px-3 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-wider">Jornada Completada</span>
                        ) : entrySaved ? (
                          <span className="px-3 py-1.5 bg-emerald-100 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-wider animate-pulse">
                            Laborando
                          </span>
                        ) : (
                          <span className="px-3 py-1.5 bg-slate-50 text-slate-300 rounded-lg text-[9px] font-black uppercase tracking-wider">Pendiente</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* VISTA CALENDARIO / HISTÓRICO (Reporte LOTTT) */}
      {activeTab === 'calendar' && (
        <div className="p-8 animate-in slide-in-from-right-4 duration-300">
           
           {/* Filtros */}
           <div className="flex flex-col md:flex-row gap-6 mb-8 bg-[#F8F9FB] p-6 rounded-2xl border border-slate-100">
              <div className="flex-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Empleado</label>
                 <select 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                 >
                    {employees.map(e => <option key={e.id} value={e.id}>{e.nombre} {e.apellido}</option>)}
                 </select>
              </div>
              <div className="w-full md:w-48">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Mes</label>
                 <select 
                   className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 outline-none cursor-pointer"
                   value={selectedMonth}
                   onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                 >
                   {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, i) => (
                     <option key={i} value={i}>{m}</option>
                   ))}
                 </select>
              </div>
              <div className="w-full md:w-32">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Año</label>
                 <input 
                   type="number" 
                   className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 outline-none"
                   value={selectedYear}
                   onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                 />
              </div>
           </div>

           {/* Calendario Grid */}
           {renderCalendar()}

           {/* Editor por Día */}
           <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
             {!selectedDate ? (
               <div className="text-center text-sm text-slate-400 font-semibold">
                 Seleccione un día del calendario para editar entrada y salida.
               </div>
             ) : (
               <div className="space-y-5">
                 <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                   <div>
                     <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">
                       Edición de Asistencia del Día
                     </h3>
                     <p className="text-xs text-slate-500 font-semibold capitalize">{selectedDateLabel}</p>
                     {selectedHoliday && (
                       <div className="mt-2 inline-flex items-start gap-2 px-3 py-2 rounded-xl bg-orange-50 border border-orange-200">
                         <span className="text-sm">🟠</span>
                         <div>
                           <p className="text-[10px] font-black uppercase tracking-wide text-orange-700">
                             {selectedHoliday.name}
                           </p>
                           <p className="text-[11px] font-semibold text-orange-600">
                             {selectedHoliday.detail}
                           </p>
                         </div>
                       </div>
                     )}
                   </div>
                   {selectedHistoryRecord?.cerrado ? (
                     <span className="px-3 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-wider">
                       Día Cerrado / No Editable
                     </span>
                   ) : (
                     <span className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-wider">
                       Editable
                     </span>
                   )}
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                   <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Estado</label>
                     <select
                       value={dayDraft.estado}
                       onChange={(e) =>
                         setDayDraft((prev) => ({
                           ...prev,
                           estado: e.target.value as Asistencia['estado'],
                           hora_entrada: e.target.value === 'presente' ? prev.hora_entrada : '',
                           hora_salida: e.target.value === 'presente' ? prev.hora_salida : ''
                         }))
                       }
                       disabled={!!selectedHistoryRecord?.cerrado}
                       className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                     >
                       <option value="presente">Presente</option>
                       <option value="falta">Falta</option>
                       <option value="reposo">Reposo</option>
                       <option value="vacaciones">Vacaciones</option>
                     </select>
                   </div>

                   <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Hora Entrada</label>
                     <input
                       type="time"
                       value={dayDraft.hora_entrada}
                       onChange={(e) => setDayDraft((prev) => ({ ...prev, hora_entrada: e.target.value }))}
                       disabled={dayDraft.estado !== 'presente' || !!selectedHistoryRecord?.cerrado}
                       className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-mono font-bold text-slate-700 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                     />
                   </div>

                   <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Hora Salida</label>
                     <input
                       type="time"
                       value={dayDraft.hora_salida}
                       onChange={(e) => setDayDraft((prev) => ({ ...prev, hora_salida: e.target.value }))}
                       disabled={dayDraft.estado !== 'presente' || !!selectedHistoryRecord?.cerrado}
                       className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-mono font-bold text-slate-700 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                     />
                   </div>

                   <div className="md:col-span-1 flex items-end">
                     <button
                       type="button"
                       onClick={saveCalendarDay}
                       disabled={savingCalendarDay || !!selectedHistoryRecord?.cerrado}
                       className="w-full py-3 rounded-xl bg-[#1E1E2D] text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black transition-all disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                     >
                       {savingCalendarDay ? 'Guardando...' : 'Guardar Día'}
                     </button>
                   </div>
                 </div>

                 <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Observaciones</label>
                   <textarea
                     value={dayDraft.observaciones}
                     onChange={(e) => setDayDraft((prev) => ({ ...prev, observaciones: e.target.value }))}
                     disabled={!!selectedHistoryRecord?.cerrado}
                     placeholder="Notas del día (opcional)"
                     className="w-full min-h-20 px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 outline-none disabled:bg-slate-100 disabled:text-slate-400 resize-y"
                   />
                 </div>
               </div>
             )}
           </div>

           {/* Resumen Quincenal LOTTT */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
              {[false, true].map((isSecondHalf) => {
                 const stats = getStatsQuincena(isSecondHalf);
                 const title = isSecondHalf ? 'Segunda Quincena (16 - Fin)' : 'Primera Quincena (01 - 15)';
                 
                 return (
                    <div key={title} className={`border rounded-2xl p-6 shadow-sm transition-all ${stats.isClosed ? 'bg-slate-50 border-slate-200 opacity-80' : 'bg-white border-slate-200'}`}>
                       <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide mb-4 flex items-center gap-2">
                         <span>🗓️</span> {title}
                         {stats.isClosed && <span className="ml-auto text-[10px] bg-slate-200 text-slate-500 px-2 py-1 rounded">CERRADO</span>}
                       </h3>
                       <div className="space-y-3">
                          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                             <span className="text-xs font-medium text-slate-500">Días Trabajados</span>
                             <span className="text-sm font-black text-slate-800">{stats.daysWorked} días</span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-xl">
                             <span className="text-xs font-medium text-emerald-700">Horas Totales</span>
                             <span className="text-sm font-black text-emerald-800">{stats.totalHours.toFixed(1)} hrs</span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-rose-50 rounded-xl">
                             <span className="text-xs font-medium text-rose-700">Faltas / Inasistencias</span>
                             <span className="text-sm font-black text-rose-800">{stats.inasistencias}</span>
                          </div>
                       </div>
                       <button 
                         onClick={() => handleCloseQuincena(isSecondHalf)}
                         disabled={stats.isClosed}
                         className={`w-full mt-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                            stats.isClosed 
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                            : 'bg-[#1E1E2D] text-white hover:bg-black'
                         }`}
                       >
                          {stats.isClosed ? 'Quincena Cerrada' : 'Cerrar Quincena'}
                       </button>
                    </div>
                 );
              })}
           </div>
        </div>
      )}

      <div className="p-4 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 font-bold uppercase text-center tracking-widest">
        Sistema sincronizado con horario legal LOTTT Venezuela • Jornada Diurna/Mixta
      </div>
    </div>
  );
};

export default AttendanceManager;
