
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.ts';
import { Empleado, Asistencia } from '../types.ts';

const AttendanceManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'daily' | 'calendar'>('daily');
  const [employees, setEmployees] = useState<Empleado[]>([]);
  const [attendances, setAttendances] = useState<Record<string, Asistencia>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  
  // Estados para Calendario / Histórico
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [employeeHistory, setEmployeeHistory] = useState<Asistencia[]>([]);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'calendar' && selectedEmployeeId) {
      fetchEmployeeHistory();
    }
  }, [selectedEmployeeId, selectedMonth, selectedYear, activeTab]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      await supabase.rpc('marcar_inasistencias_del_dia');

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
      setAttendances(attMap);
    } catch (err) {
      console.error("Error cargando asistencia:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeeHistory = async () => {
    // Calcular rango del mes seleccionado
    const startDate = new Date(selectedYear, selectedMonth, 1).toISOString().split('T')[0];
    const endDate = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split('T')[0];

    const { data } = await supabase
      .from('asistencias')
      .select('*')
      .eq('empleado_id', selectedEmployeeId)
      .gte('fecha', startDate)
      .lte('fecha', endDate);

    setEmployeeHistory(data || []);
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

  const verifyAttendance = async (empId: string) => {
    setSavingId(empId);
    const data = attendances[empId];
    
    if (!data?.hora_entrada) {
      alert("Debe registrar al menos la hora de entrada.");
      setSavingId(null);
      return;
    }

    try {
      const payload = {
        empleado_id: empId,
        fecha: today,
        hora_entrada: data.hora_entrada,
        hora_salida: data.hora_salida || null,
        estado: 'presente' as const
      };

      const { error } = await supabase
        .from('asistencias')
        .upsert(payload, { onConflict: 'empleado_id,fecha' });

      if (error) throw error;
      fetchInitialData();
    } catch (err: any) {
      alert("Error al verificar: " + err.message);
    } finally {
      setSavingId(null);
    }
  };

  const isPast4PM = () => {
    const now = new Date();
    return now.getHours() >= 16;
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
    let diff = (date2.getTime() - date1.getTime()) / 1000 / 60 / 60; // Horas
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

    relevantHistory.forEach(h => {
      if (h.estado === 'presente') {
        totalHours += calculateHoursWorked(h.hora_entrada, h.hora_salida);
        daysWorked++;
      } else if (h.estado === 'falta') {
        inasistencias++;
      }
    });

    return { totalHours, daysWorked, inasistencias };
  };

  const renderCalendar = () => {
    const days = getDaysInMonth(selectedMonth, selectedYear);
    const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    
    // Relleno para que el mes empiece en el día correcto de la semana
    const firstDayIndex = days[0].getDay();
    const blanks = Array(firstDayIndex).fill(null);

    return (
      <div className="grid grid-cols-7 gap-2 mb-6">
        {weekDays.map(d => (
          <div key={d} className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest py-2">
            {d}
          </div>
        ))}
        
        {blanks.map((_, i) => <div key={`blank-${i}`} className="h-24 bg-transparent"></div>)}

        {days.map(date => {
          const dateStr = date.toISOString().split('T')[0];
          const record = employeeHistory.find(h => h.fecha === dateStr);
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const hours = record ? calculateHoursWorked(record.hora_entrada, record.hora_salida) : 0;
          const isOvertime = hours > 8; // LOTTT: Más de 8h es extra (Jornada Diurna)

          let bgColor = 'bg-white';
          let borderColor = 'border-slate-100';
          
          if (record?.estado === 'presente') {
            bgColor = 'bg-emerald-50';
            borderColor = 'border-emerald-200';
          } else if (record?.estado === 'falta') {
            bgColor = 'bg-rose-50';
            borderColor = 'border-rose-200';
          } else if (isWeekend) {
            bgColor = 'bg-slate-50';
          }

          return (
            <div key={dateStr} className={`h-24 border rounded-xl p-2 flex flex-col justify-between transition-all hover:scale-105 ${bgColor} ${borderColor}`}>
              <div className="flex justify-between items-start">
                <span className={`text-xs font-bold ${isWeekend ? 'text-slate-400' : 'text-slate-700'}`}>
                  {date.getDate()}
                </span>
                {record?.estado === 'presente' && (
                  <span className="text-[9px] font-black text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">
                    ASISTIO
                  </span>
                )}
                {record?.estado === 'falta' && (
                   <span className="text-[9px] font-black text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded">
                    FALTA
                  </span>
                )}
              </div>
              
              <div className="text-center">
                 {record?.hora_entrada && (
                   <div className="text-[10px] text-slate-500 font-mono">
                     {record.hora_entrada.slice(0,5)} - {record.hora_salida?.slice(0,5) || '?'}
                   </div>
                 )}
                 {hours > 0 && (
                   <div className={`text-[10px] font-bold mt-1 ${isOvertime ? 'text-amber-600' : 'text-slate-600'}`}>
                     {hours.toFixed(1)} hrs {isOvertime && '(Extra)'}
                   </div>
                 )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

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
             {isPast4PM() && (
              <div className="bg-rose-100 text-rose-700 px-4 py-2 rounded-lg text-[10px] font-black animate-pulse uppercase tracking-wide">
                ⚠️ Cierre Automático (4:00 PM)
              </div>
            )}
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#F8F9FB] text-slate-400 text-[10px] font-black uppercase tracking-[0.15em] border-b border-slate-50">
                <tr>
                  <th className="px-8 py-5">Empleado</th>
                  <th className="px-8 py-5">Entrada</th>
                  <th className="px-8 py-5">Salida</th>
                  <th className="px-8 py-5">Estatus</th>
                  <th className="px-8 py-5 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr><td colSpan={5} className="p-10 text-center text-slate-400 font-bold uppercase text-xs tracking-widest">Sincronizando reloj biométrico...</td></tr>
                ) : employees.map(emp => {
                  const att = attendances[emp.id];
                  const isMissing = !att && isPast4PM();
                  const isVerified = att?.id !== undefined;

                  return (
                    <tr key={emp.id} className={`hover:bg-slate-50/50 transition-colors ${isMissing ? 'bg-rose-50/30' : ''}`}>
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
                        <input 
                          type="time" 
                          value={att?.hora_entrada || ''} 
                          onChange={(e) => handleTimeChange(emp.id, 'hora_entrada', e.target.value)}
                          disabled={isMissing || att?.estado === 'falta'}
                          className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50 disabled:bg-slate-100"
                        />
                      </td>
                      <td className="px-8 py-5">
                        <input 
                          type="time" 
                          value={att?.hora_salida || ''} 
                          onChange={(e) => handleTimeChange(emp.id, 'hora_salida', e.target.value)}
                          disabled={isMissing || att?.estado === 'falta'}
                          className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50 disabled:bg-slate-100"
                        />
                      </td>
                      <td className="px-8 py-5">
                        {isMissing || att?.estado === 'falta' ? (
                          <span className="px-3 py-1.5 bg-rose-100 text-rose-600 rounded-lg text-[9px] font-black uppercase tracking-wider">Inasistencia</span>
                        ) : isVerified ? (
                          <span className="px-3 py-1.5 bg-emerald-100 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 w-fit">
                            <span>✓</span> Presente
                          </span>
                        ) : (
                          <span className="px-3 py-1.5 bg-slate-100 text-slate-400 rounded-lg text-[9px] font-black uppercase tracking-wider">Pendiente</span>
                        )}
                      </td>
                      <td className="px-8 py-5 text-center">
                        <button 
                          onClick={() => verifyAttendance(emp.id)}
                          disabled={savingId === emp.id || isMissing || att?.estado === 'falta'}
                          className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            isVerified 
                            ? 'bg-slate-100 text-slate-400 cursor-default' 
                            : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-100 active:scale-95'
                          }`}
                        >
                          {savingId === emp.id ? '...' : isVerified ? 'Actualizar' : 'Fichar'}
                        </button>
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

           {/* Resumen Quincenal LOTTT */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
              {[false, true].map((isSecondHalf) => {
                 const stats = getStatsQuincena(isSecondHalf);
                 const title = isSecondHalf ? 'Segunda Quincena (16 - Fin)' : 'Primera Quincena (01 - 15)';
                 
                 return (
                    <div key={title} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                       <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide mb-4 flex items-center gap-2">
                         <span>🗓️</span> {title}
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
                       <button className="w-full mt-4 bg-[#1E1E2D] text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black transition-all">
                          Cerrar Quincena
                       </button>
                    </div>
                 );
              })}
           </div>
        </div>
      )}

      <div className="p-4 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 font-bold uppercase text-center tracking-widest">
        Sistema sincronizado con horario legal LOTTT Venezuela • Jornada Diurna
      </div>
    </div>
  );
};

export default AttendanceManager;
