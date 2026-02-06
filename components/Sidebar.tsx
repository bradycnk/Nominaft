
import React from 'react';
import { supabase } from '../lib/supabase.ts';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'sucursales', label: 'Sucursales', icon: '🏢' },
    { id: 'empleados', label: 'Empleados', icon: '👥' },
    { id: 'nomina', label: 'Procesar Nómina', icon: '💰' },
    { id: 'asistencia', label: 'Asistencia', icon: '📅' },
    { id: 'config', label: 'Configuración', icon: '⚙️' },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="w-64 bg-slate-900 h-screen text-white flex flex-col fixed left-0 top-0">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold text-emerald-400 flex items-center gap-2">
          <span>🏥</span> FarmaNomina
        </h1>
        <p className="text-xs text-slate-400 mt-1">Gestión LOTTT Profesional</p>
      </div>
      <nav className="flex-1 mt-6 px-4 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === item.id
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span>{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-800">
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 text-red-400 hover:text-red-300 w-full px-4 py-2"
        >
          <span>🚪</span> Cerrar Sesión
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
