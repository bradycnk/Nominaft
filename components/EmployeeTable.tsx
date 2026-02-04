
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.ts';
import { Empleado } from '../types.ts';
import EmployeeModal from './EmployeeModal.tsx';

const EmployeeTable: React.FC = () => {
  const [employees, setEmployees] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Empleado | null>(null);

  useEffect(() => {
    fetchEmployees();

    const channel = supabase
      .channel('schema-db-changes-employees')
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

  const handleAddClick = () => {
    setSelectedEmployee(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (emp: Empleado) => {
    setSelectedEmployee(emp);
    setIsModalOpen(true);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Nómina de Empleados</h2>
          <p className="text-xs text-slate-500 mt-1">Total registrados: {employees.length}</p>
        </div>
        <button 
          onClick={handleAddClick}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-100 transform active:scale-95"
        >
          + Agregar Empleado
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-6 py-4 font-bold">Empleado</th>
              <th className="px-6 py-4 font-bold">Cédula</th>
              <th className="px-6 py-4 font-bold">Cargo</th>
              <th className="px-6 py-4 font-bold text-right">Salario (USD)</th>
              <th className="px-6 py-4 font-bold">Estatus</th>
              <th className="px-6 py-4 font-bold text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && employees.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent animate-spin rounded-full"></div>
                    <span className="text-slate-400 text-sm font-medium">Actualizando lista...</span>
                  </div>
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center">
                  <div className="text-slate-300 text-4xl mb-2">📁</div>
                  <p className="text-slate-400 text-sm">No se encontraron empleados registrados.</p>
                </td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 font-bold shadow-sm">
                        {emp.nombre[0]}{emp.apellido[0]}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 leading-tight">{emp.nombre} {emp.apellido}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ingreso: {new Date(emp.fecha_ingreso).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-medium font-mono text-sm">{emp.cedula}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-[11px] font-bold uppercase">{emp.cargo}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-mono font-bold text-emerald-600">
                      ${emp.salario_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase ${
                      emp.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                      {emp.activo ? 'ACTIVO' : 'INACTIVO'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      <button 
                        onClick={() => handleEditClick(emp)}
                        className="p-2 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-lg transition-all"
                        title="Editar Empleado"
                      >
                        ✏️
                      </button>
                      <button className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-all" title="Ver Expediente">📑</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <EmployeeModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        employeeToEdit={selectedEmployee}
      />
    </div>
  );
};

export default EmployeeTable;
