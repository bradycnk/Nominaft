
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import EmployeeTable from './components/EmployeeTable';
import DashboardOverview from './components/DashboardOverview';
import PayrollProcessor from './components/PayrollProcessor';
import { supabase } from './lib/supabase';
import { ConfigGlobal } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [config, setConfig] = useState<ConfigGlobal | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase.from('configuracion_global').select('*').single();
      if (data) setConfig(data);
    };
    fetchConfig();

    // Suscripción para cambios en configuración (tasa BCV)
    const channel = supabase.channel('config-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'configuracion_global' }, 
      (payload) => setConfig(payload.new as ConfigGlobal))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <>
            <DashboardOverview config={config} />
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-2xl font-bold text-slate-800 mb-4">Bienvenido al Panel de Farmacia</h2>
              <p className="text-slate-600 leading-relaxed mb-6">
                Este sistema está parametrizado según la LOTTT vigente. Todos los cálculos en bolívares se ajustan automáticamente según la tasa BCV oficial sincronizada.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-slate-800 mb-2">Última Actualización Legal</h4>
                  <ul className="text-sm text-slate-600 space-y-1">
                    <li>• IVSS: 4% Retención Empleado</li>
                    <li>• FAOV: 1% Retención Empleado</li>
                    <li>• SPF: 0.5% Retención Empleado</li>
                    <li>• Cestaticket: $40 Indexado</li>
                  </ul>
                </div>
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <h4 className="font-bold text-emerald-800 mb-2">Alertas de Nómina</h4>
                  <p className="text-sm text-emerald-700">Quedan 3 días para el cierre de la quincena actual. Verifique las faltas en Asistencia.</p>
                </div>
              </div>
            </div>
          </>
        );
      case 'empleados':
        return <EmployeeTable />;
      case 'nomina':
        return <PayrollProcessor config={config} />;
      case 'asistencia':
        return (
          <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center">
            <div className="text-4xl mb-4">📅</div>
            <h2 className="text-xl font-bold text-slate-800">Control de Asistencia Biométrico</h2>
            <p className="text-slate-500 mt-2">Módulo de registro diario y cálculo de horas extras LOTTT.</p>
            <button className="mt-6 bg-slate-800 text-white px-4 py-2 rounded-lg">Configurar Calendario</button>
          </div>
        );
      case 'config':
        return (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-2xl">
            <h2 className="text-xl font-bold text-slate-800 mb-6">Configuración del Sistema</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Tasa de Cambio Manual (BCV)</label>
                <input type="number" defaultValue={config?.tasa_bcv} className="mt-1 block w-full border-slate-300 rounded-md shadow-sm p-2 bg-slate-50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Monto Cestaticket (USD)</label>
                <input type="number" defaultValue={config?.cestaticket_usd} className="mt-1 block w-full border-slate-300 rounded-md shadow-sm p-2 bg-slate-50" />
              </div>
              <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold">Guardar Cambios</button>
            </div>
          </div>
        );
      default:
        return <div>Seleccione una opción</div>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 capitalize">{activeTab}</h1>
            <p className="text-slate-500">Gestión Administrativa de la Salud</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-bold text-slate-800">Admin Farmacia</p>
              <p className="text-xs text-slate-500">Caja Principal / Nomina</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-300 overflow-hidden">
              <img src="https://picsum.photos/100/100" alt="Profile" />
            </div>
          </div>
        </header>

        {renderContent()}
      </main>
    </div>
  );
};

export default App;
