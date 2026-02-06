
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar.tsx';
import EmployeeTable from './components/EmployeeTable.tsx';
import DashboardOverview from './components/DashboardOverview.tsx';
import PayrollProcessor from './components/PayrollProcessor.tsx';
import AttendanceManager from './components/AttendanceManager.tsx';
import BranchManager from './components/BranchManager.tsx';
import Auth from './components/Auth.tsx';
import { supabase } from './lib/supabase.ts';
import { ConfigGlobal } from './types.ts';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [config, setConfig] = useState<ConfigGlobal | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Métricas del Dashboard
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [estimatedPayrollVEF, setEstimatedPayrollVEF] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Carga de configuración y métricas
  useEffect(() => {
    if (!session) return;

    const fetchData = async () => {
      try {
        // 1. Configuración Global
        const { data: configData } = await supabase.from('configuracion_global').select('*').single();
        if (configData) setConfig(configData);

        // 2. Conteo de Empleados
        const { count } = await supabase
          .from('empleados')
          .select('*', { count: 'exact', head: true })
          .eq('activo', true);
        setTotalEmployees(count || 0);

        // 3. Cálculo de Nómina Estimada (Suma salarios * tasa)
        const { data: employees } = await supabase
          .from('empleados')
          .select('salario_usd')
          .eq('activo', true);
        
        if (employees && configData) {
          const totalUsd = employees.reduce((sum, emp) => sum + Number(emp.salario_usd), 0);
          setEstimatedPayrollVEF(totalUsd * configData.tasa_bcv);
        }

      } catch (err) {
        console.error("Error cargando datos iniciales:", err);
      }
    };

    fetchData();

    // Suscripción a cambios
    const configChannel = supabase.channel('config-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'configuracion_global' }, 
      (payload) => {
        const newConfig = payload.new as ConfigGlobal;
        setConfig(newConfig);
        fetchData(); 
      })
      .subscribe();

    const employeeChannel = supabase.channel('employee-stats-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'empleados' }, 
      () => fetchData())
      .subscribe();

    return () => { 
      supabase.removeChannel(configChannel); 
      supabase.removeChannel(employeeChannel);
    };
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-600 mb-4"></div>
          <p className="text-slate-600 font-medium">Iniciando sistema...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <>
            <DashboardOverview 
              config={config} 
              totalEmployees={totalEmployees} 
              estimatedPayrollVEF={estimatedPayrollVEF}
            />
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-2xl font-bold text-slate-800 mb-4">Bienvenido al Panel de Farmacia</h2>
              <p className="text-slate-600 leading-relaxed mb-6">
                Gestión multi-sede parametrizada según la LOTTT. Administre sus sucursales y personal desde un solo lugar.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-slate-800 mb-2">Resumen Legal Quincenal</h4>
                  <ul className="text-sm text-slate-600 space-y-1">
                    <li>• IVSS/FAOV: Cálculos automatizados</li>
                    <li>• Tasa BCV: Sincronizada en tiempo real</li>
                  </ul>
                </div>
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <h4 className="font-bold text-emerald-800 mb-2">Estatus General</h4>
                  <p className="text-sm text-emerald-700">Todas las sucursales reportan asistencia al día.</p>
                </div>
              </div>
            </div>
          </>
        );
      case 'sucursales':
        return <BranchManager />;
      case 'empleados':
        return <EmployeeTable />;
      case 'nomina':
        return <PayrollProcessor config={config} />;
      case 'asistencia':
        return <AttendanceManager />;
      case 'config':
        return (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-2xl">
            <h2 className="text-xl font-bold text-slate-800 mb-6">Configuración del Sistema</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Tasa de Cambio Manual (BCV)</label>
                <input type="number" defaultValue={config?.tasa_bcv} className="mt-1 block w-full border-slate-300 rounded-md shadow-sm p-2 bg-slate-50" />
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
              <p className="text-sm font-bold text-slate-800">{session.user.user_metadata.full_name || session.user.email}</p>
              <button onClick={handleLogout} className="text-xs text-red-500 hover:text-red-700 font-semibold">Cerrar Sesión</button>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
              {(session.user.user_metadata.full_name?.[0] || 'A').toUpperCase()}
            </div>
          </div>
        </header>

        {renderContent()}
      </main>
    </div>
  );
};

export default App;
