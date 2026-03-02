import React from 'react';
import { Empleado } from '../types';

interface EmployeePerformanceCardProps {
  employee: Empleado | null;
  stats: {
    present: number;
    absent: number;
  };
  rank: 'High' | 'Low';
}

const EmployeePerformanceCard: React.FC<EmployeePerformanceCardProps> = ({ employee, stats, rank }) => {
  if (!employee) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center text-slate-400">
        Cargando datos...
      </div>
    );
  }

  const rating = rank === 'High' ? 5 : 1;
  const rankText = rank === 'High' ? 'Empleado de Nivel Alto' : 'Empleado de Nivel Bajo';
  const rankColor = rank === 'High' ? 'text-emerald-500' : 'text-rose-500';

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <h3 className={`text-sm font-bold uppercase tracking-wider ${rankColor}`}>{rankText}</h3>
      <div className="flex items-center mt-4">
        <img src={employee.foto_url || 'https://via.placeholder.com/150'} alt={`${employee.nombre} ${employee.apellido}`} className="w-16 h-16 rounded-full object-cover mr-4" />
        <div>
          <p className="font-bold text-slate-800">{employee.nombre} {employee.apellido}</p>
          <p className="text-sm text-slate-500">{employee.cargo}</p>
        </div>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-sm">
          <p className="text-slate-500">Días Presente:</p>
          <p className="font-bold text-slate-800">{stats.present}</p>
        </div>
        <div className="flex justify-between text-sm">
          <p className="text-slate-500">Días Ausente:</p>
          <p className="font-bold text-slate-800">{stats.absent}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center">
        {'⭐'.repeat(rating)}
        {'☆'.repeat(5 - rating)}
      </div>
    </div>
  );
};

export default EmployeePerformanceCard;
