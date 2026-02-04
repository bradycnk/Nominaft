
import React from 'react';
import { ConfigGlobal } from '../types';

interface DashboardOverviewProps {
  config: ConfigGlobal | null;
}

const DashboardOverview: React.FC<DashboardOverviewProps> = ({ config }) => {
  const stats = [
    { label: 'Tasa BCV Oficial', value: `Bs. ${config?.tasa_bcv || '---'}`, icon: '📈', color: 'bg-blue-500' },
    { label: 'Cestaticket (Indexado)', value: `$${config?.cestaticket_usd || '---'}`, icon: '🍔', color: 'bg-orange-500' },
    { label: 'Total Empleados', value: '12', icon: '👥', color: 'bg-emerald-500' },
    { label: 'Nómina Estimada VEF', value: 'Bs. 45,230.00', icon: '💳', color: 'bg-purple-500' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, idx) => (
        <div key={idx} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className={`${stat.color} w-12 h-12 rounded-lg flex items-center justify-center text-2xl shadow-inner`}>
            {stat.icon}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
            <p className="text-xl font-bold text-slate-800">{stat.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DashboardOverview;
