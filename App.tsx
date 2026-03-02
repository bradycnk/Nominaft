import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar.tsx';
import EmployeeTable from './components/EmployeeTable.tsx';
import DashboardOverview from './components/DashboardOverview.tsx';
import PayrollProcessor from './components/PayrollProcessor.tsx';
import AttendanceManager from './components/AttendanceManager.tsx';
import BranchManager from './components/BranchManager.tsx';
import UserManager from './components/UserManager.tsx';
import Auth from './components/Auth.tsx';
import Configuration from './components/Configuration.tsx';
import AIAssistant from './components/AIAssistant.tsx';
import { supabase } from './lib/supabase.ts';
import { ConfigGlobal } from './types.ts';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [config, setConfig] = useState<ConfigGlobal | null>(null);
  const [loading, setLoading] = useState(true);
  
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

  const fetchData = async () => {
    try {
      const { data: configData } = await supabase.from('configuracion_global').select('*').single();
      if (configData) setConfig(configData);

      const { count } = await supabase
        .from('empleados')
        .select('*', { count: 'exact', head: true })
        .eq('activo', true);
      setTotalEmployees(count || 0);

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

  useEffect(() => {
    if (!session) return;

    fetchData();

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
          <p className="text-slate-600 font-medium tracking-widest uppercase text-[10px] font-black">Iniciando sistema experto...</p>
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
          <DashboardOverview 
            config={config} 
            totalEmployees={totalEmployees} 
            estimatedPayrollVEF={estimatedPayrollVEF}
            setActiveTab={setActiveTab}
          />
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
        return <Configuration config={config} onUpdate={() => {}} />;
      case 'usuarios':
        return <UserManager />;
      default:
        return <div>Seleccione una opción</div>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 ml-72 p-12 overflow-y-auto">
        <header className="flex justify-between items-center mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter capitalize">{activeTab}</h1>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em]">Gestión Farmacéutica Inteligente</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-sm font-black text-slate-800">{session.user.user_metadata.full_name || session.user.email}</p>
              <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mt-0.5">Administrador Senior</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-black text-lg shadow-xl shadow-emerald-500/20 transition-transform hover:rotate-3">
              {(session.user.user_metadata.full_name?.[0] || 'A').toUpperCase()}
            </div>
          </div>
        </header>

        {renderContent()}
      </main>
      <AIAssistant />
    </div>
  );
};

export default App;
