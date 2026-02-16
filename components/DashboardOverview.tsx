
import React from 'react';
import { ConfigGlobal } from '../types';

interface DashboardOverviewProps {
  config: ConfigGlobal | null;
  totalEmployees: number;
  estimatedPayrollVEF: number;
}

const DashboardOverview: React.FC<DashboardOverviewProps> = ({ config, totalEmployees, estimatedPayrollVEF }) => {
  const stats = [
    { 
      label: 'Tasa BCV Oficial', 
      value: `Bs. ${config?.tasa_bcv?.toLocaleString('es-VE', { minimumFractionDigits: 4 }) || '---'}`, 
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ), 
      color: 'from-blue-500 to-indigo-600',
      shadow: 'shadow-blue-200'
    },
    { 
      label: 'Cestaticket Indexado', 
      value: `$${config?.cestaticket_usd || '---'}`, 
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ), 
      color: 'from-orange-400 to-rose-500',
      shadow: 'shadow-orange-200'
    },
    { 
      label: 'Nómina Activa', 
      value: totalEmployees.toString(), 
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 005.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ), 
      color: 'from-emerald-400 to-teal-600',
      shadow: 'shadow-emerald-200'
    },
    { 
      label: 'Compromiso VEF', 
      value: `Bs. ${estimatedPayrollVEF.toLocaleString('es-VE', { minimumFractionDigits: 0 })}`, 
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ), 
      color: 'from-purple-500 to-violet-700',
      shadow: 'shadow-purple-200'
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
      {stats.map((stat, idx) => (
        <div 
          key={idx} 
          className={`group bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col gap-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:border-emerald-100 relative overflow-hidden`}
        >
          {/* Decorative background circle */}
          <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full bg-gradient-to-br ${stat.color} opacity-5 group-hover:scale-150 transition-transform duration-700`}></div>
          
          <div className={`bg-gradient-to-br ${stat.color} w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform duration-300 group-hover:rotate-12`}>
            {stat.icon}
          </div>
          
          <div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
            <p className="text-2xl font-black text-slate-900 tracking-tight group-hover:text-emerald-600 transition-colors">
              {stat.value}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sincronizado</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DashboardOverview;
