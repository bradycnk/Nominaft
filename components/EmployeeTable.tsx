
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.ts';
import { Empleado } from '../types.ts';

const EmployeeTable: React.FC = () => {
  const [employees, setEmployees] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployees();

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'empleados' },
        () => {
          fetchEmployees();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('empleados')
        .select('*')
        .order('nombre', { ascending: true });

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200 flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800">Nómina de Empleados</h2>
        <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          + Agregar Empleado
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-sm uppercase">
            <tr>
              <th className="px-6 py-4 font-semibold">Empleado</th>
              <th className="px-6 py-4 font-semibold">Cédula</th>
              <th className="px-6 py-4 font-semibold">Cargo</th>
              <th className="px-6 py-4 font-semibold text-right">Salario (USD)</th>
              <th className="px-6 py-4 font-semibold">Estatus</th>
              <th className="px-6 py-4 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                  Cargando datos...
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                  No hay empleados registrados.
                </td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                        {emp.nombre[0]}{emp.apellido[0]}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800">{emp.nombre} {emp.apellido}</div>
                        <div className="text-xs text-slate-500">Ingreso: {emp.fecha_ingreso}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{emp.cedula}</td>
                  <td className="px-6 py-4 text-slate-600 font-medium">{emp.cargo}</td>
                  <td className="px-6 py-4 text-right font-mono text-emerald-600">
                    ${emp.salario_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      emp.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {emp.activo ? 'ACTIVO' : 'INACTIVO'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button className="p-1 hover:text-emerald-600 text-slate-400 transition-colors">✏️</button>
                      <button className="p-1 hover:text-blue-600 text-slate-400 transition-colors">📑</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EmployeeTable;
