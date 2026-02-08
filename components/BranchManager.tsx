
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.ts';
import { Sucursal } from '../types.ts';

// Fix: Completed the BranchManager component implementation and added default export
const BranchManager: React.FC = () => {
  const [branches, setBranches] = useState<Sucursal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sucursales')
        .select('*')
        .order('nombre_id', { ascending: true });

      if (error) throw error;
      setBranches(data || []);
    } catch (error) {
      console.error('Error fetching branches:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200 bg-white flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Gestión de Sucursales</h2>
          <p className="text-sm text-slate-500 font-medium">Administre las sedes físicas de la farmacia</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-[#10b981] hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-50 active:scale-95"
        >
          + Agregar Sucursal
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F8F9FB] text-slate-400 uppercase text-[10px] font-black tracking-[0.15em] border-b border-slate-100">
            <tr>
              <th className="px-8 py-4">Sede / Identificador</th>
              <th className="px-8 py-4">RIF Patronal</th>
              <th className="px-8 py-4">Ubicación Física</th>
              <th className="px-8 py-4">Administrador Responsable</th>
              <th className="px-8 py-4 text-center">Tipo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr>
                <td colSpan={5} className="p-20 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent animate-spin rounded-full"></div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Sincronizando sedes...</span>
                  </div>
                </td>
              </tr>
            ) : branches.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-20 text-center">
                  <div className="text-4xl mb-4 opacity-20">🏢</div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">No hay sucursales registradas en el sistema</p>
                </td>
              </tr>
            ) : (
              branches.map(branch => (
                <tr key={branch.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 text-xl border border-emerald-100 shadow-sm transition-transform group-hover:scale-110">
                        {branch.logo_url ? (
                          <img src={branch.logo_url} className="w-full h-full object-cover rounded-2xl" alt="logo" />
                        ) : (
                          <span>🏢</span>
                        )}
                      </div>
                      <div>
                        <div className="font-black uppercase text-slate-800 text-sm leading-tight tracking-tight">{branch.nombre_id}</div>
                        <div className="text-[9px] font-black text-emerald-500 uppercase tracking-tighter mt-1">ID: {branch.id.split('-')[0]}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 font-mono text-[11px] font-bold text-slate-500">{branch.rif}</td>
                  <td className="px-8 py-5">
                    <div className="text-slate-500 text-xs max-w-xs truncate font-medium">{branch.direccion}</div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="text-slate-800 font-black text-xs uppercase">{branch.administrador}</div>
                    <div className="text-[10px] text-slate-400 font-bold">{branch.correo_admin}</div>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black tracking-widest uppercase border ${
                      branch.es_principal 
                      ? 'bg-emerald-100/50 text-emerald-600 border-emerald-200' 
                      : 'bg-slate-100 text-slate-400 border-slate-200'
                    }`}>
                      {branch.es_principal ? 'PRINCIPAL' : 'SUCURSAL'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      <div className="p-6 bg-[#F8F9FB] border-t border-slate-50 flex justify-center">
         <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">Gestión de Sedes Farmacéuticas • LOTTT v2.4</p>
      </div>
      
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-3xl mb-6">⚠️</div>
            <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">Acceso Restringido</h3>
            <p className="text-slate-500 mb-8 font-medium leading-relaxed">
              La creación de nuevas sucursales requiere privilegios de <span className="text-slate-900 font-bold">Administrador General</span>. Por favor, contacte al departamento de sistemas para habilitar nuevas sedes.
            </p>
            <button 
              onClick={() => setShowModal(false)} 
              className="w-full bg-[#1E1E2D] text-white py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all active:scale-95"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchManager;
