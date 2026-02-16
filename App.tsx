
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

  useEffect(() => {
    if (!session) return;

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
          <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
            <DashboardOverview 
              config={config} 
              totalEmployees={totalEmployees} 
              estimatedPayrollVEF={estimatedPayrollVEF}
            />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main Card */}
              <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-10 opacity-10 transition-transform duration-700 group-hover:scale-125">
                   <svg className="w-32 h-32 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04M12 21a9.003 9.003 0 008.367-5.633a9.003 9.003 0 00-8.367-5.633A9.003 9.003 0 003.633 15.367A9.003 9.003 0 0012 21z" />
                   </svg>
                </div>
                
                <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Bienvenido al Panel de Control</h2>
                <p className="text-slate-500 leading-relaxed text-lg mb-10 max-w-xl">
                  Gestión administrativa de farmacias parametrizada según la LOTTT 2024. Su sistema está sincronizado con la tasa oficial del BCV.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 hover:border-emerald-200 transition-all duration-300">
                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-4">
                      <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </div>
                    <h4 className="font-black text-slate-800 text-sm uppercase tracking-wider mb-2">Salud Operativa</h4>
                    <ul className="text-xs text-slate-500 space-y-3">
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Cálculos IVSS/FAOV al día
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Historial de Asistencia validado
                      </li>
                    </ul>
                  </div>

                  <div className="p-8 bg-emerald-600 rounded-[2rem] shadow-xl shadow-emerald-900/10 text-white relative overflow-hidden group">
                    <div className="relative z-10">
                      <h4 className="font-black text-[10px] uppercase tracking-[0.2em] mb-4 opacity-80">Distribución de Carga</h4>
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-[10px] font-black uppercase mb-2">
                             <span>Sueldo Base</span>
                             <span>75%</span>
                          </div>
                          <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
                             <div className="w-3/4 h-full bg-white transition-all duration-1000 group-hover:w-[80%]"></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] font-black uppercase mb-2">
                             <span>Cestaticket</span>
                             <span>25%</span>
                          </div>
                          <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
                             <div className="w-1/4 h-full bg-emerald-200 transition-all duration-1000 group-hover:w-[35%]"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Side Card */}
              <div className="bg-[#1E1E2D] p-8 rounded-[3rem] shadow-2xl flex flex-col justify-between text-white relative overflow-hidden group">
                 <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent"></div>
                 <div>
                    <div className="w-14 h-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-6 border border-emerald-500/30 group-hover:rotate-6 transition-transform">
                       <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                       </svg>
                    </div>
                    <h3 className="text-xl font-black mb-2 tracking-tight">Reporte Rápido</h3>
                    <p className="text-slate-400 text-xs font-medium leading-relaxed">Todas las sedes operan sin incidentes de asistencia hoy.</p>
                 </div>
                 
                 <div className="mt-8 space-y-4">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between">
                       <span className="text-[10px] font-black uppercase text-slate-500">Próximo Pago</span>
                       <span className="text-xs font-bold text-emerald-400">En 5 días</span>
                    </div>
                    <button 
                      onClick={() => setActiveTab('asistencia')}
                      className="w-full bg-emerald-500 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all active:scale-95"
                    >
                      Ver Asistencias
                    </button>
                 </div>
              </div>
            </div>
          </div>
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
          <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 max-w-2xl animate-in fade-in zoom-in-95 duration-500">
            <h2 className="text-2xl font-black text-slate-900 mb-8 tracking-tight">Configuración de Expertos</h2>
            <div className="space-y-8">
              <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100">
                <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-4">Tasa de Cambio Manual (BCV)</label>
                <div className="flex items-center gap-4">
                  <div className="flex-1 relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Bs.</span>
                    <input type="number" step="0.0001" defaultValue={config?.tasa_bcv} className="w-full pl-14 pr-5 py-5 rounded-2xl border border-slate-200 bg-white text-xl font-black text-slate-800 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all" />
                  </div>
                  <button className="bg-emerald-600 text-white p-5 rounded-2xl shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all active:scale-95">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                </div>
              </div>
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
    </div>
  );
};

export default App;
