
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.ts';
import { Empleado, Asistencia } from '../types.ts';

const AttendanceManager: React.FC = () => {
  const [employees, setEmployees] = useState<Empleado[]>([]);
  const [attendances, setAttendances] = useState<Record<string, Asistencia>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. Marcar inasistencias automáticas vía RPC si existe o lógica local
      await supabase.rpc('marcar_inasistencias_del_dia');

      // 2. Cargar empleados activos
      const { data: empData } = await supabase
        .from('empleados')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true });

      // 3. Cargar asistencias de hoy
      const { data: attData } = await supabase
        .from('asistencias')
        .select('*')
        .eq('fecha', today);

      setEmployees(empData || []);
      
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
      fetchInitialData(); // Refrescar para confirmar
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

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span>🕒</span> Control de Asistencia Diaria
          </h2>
          <p className="text-sm text-slate-500 font-medium">Fecha: <span className="text-emerald-600 font-bold">{new Date().toLocaleDateString('es-VE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
        </div>
        {isPast4PM() && (
          <div className="bg-rose-100 text-rose-700 px-4 py-2 rounded-lg text-xs font-black animate-pulse">
            ⚠️ CIERRE DE ENTRADAS ACTIVO (4:00 PM)
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-100">
            <tr>
              <th className="px-6 py-4">Empleado</th>
              <th className="px-6 py-4">Hora Entrada</th>
              <th className="px-6 py-4">Hora Salida</th>
              <th className="px-6 py-4">Estado Actual</th>
              <th className="px-6 py-4 text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={5} className="p-10 text-center text-slate-400 font-medium">Sincronizando reloj biométrico...</td></tr>
            ) : employees.map(emp => {
              const att = attendances[emp.id];
              const isMissing = !att && isPast4PM();
              const isVerified = att?.id !== undefined;

              return (
                <tr key={emp.id} className={`hover:bg-slate-50/50 transition-colors ${isMissing ? 'bg-rose-50/30' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-slate-100">
                        {emp.foto_url ? <img src={emp.foto_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-400">{emp.nombre[0]}</div>}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800">{emp.nombre} {emp.apellido}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">{emp.cargo}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <input 
                      type="time" 
                      value={att?.hora_entrada || ''} 
                      onChange={(e) => handleTimeChange(emp.id, 'hora_entrada', e.target.value)}
                      disabled={isMissing || att?.estado === 'falta'}
                      className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input 
                      type="time" 
                      value={att?.hora_salida || ''} 
                      onChange={(e) => handleTimeChange(emp.id, 'hora_salida', e.target.value)}
                      disabled={isMissing || att?.estado === 'falta'}
                      className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50"
                    />
                  </td>
                  <td className="px-6 py-4">
                    {isMissing || att?.estado === 'falta' ? (
                      <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-[10px] font-black uppercase">Inasistencia</span>
                    ) : isVerified ? (
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase flex items-center gap-1 w-fit">
                        <span>✓</span> Verificado
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-slate-100 text-slate-400 rounded-full text-[10px] font-black uppercase">Pendiente</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => verifyAttendance(emp.id)}
                      disabled={savingId === emp.id || isMissing || att?.estado === 'falta'}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                        isVerified 
                        ? 'bg-slate-100 text-slate-400 cursor-default' 
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-100'
                      }`}
                    >
                      {savingId === emp.id ? '...' : isVerified ? 'Actualizar' : 'Verificar'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="p-4 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 font-bold uppercase text-center tracking-widest">
        Sistema sincronizado con horario legal LOTTT Venezuela
      </div>
    </div>
  );
};

export default AttendanceManager;
