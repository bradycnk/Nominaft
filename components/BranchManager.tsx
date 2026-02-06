
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.ts';
import { Sucursal } from '../types.ts';

const BranchManager: React.FC = () => {
  const [branches, setBranches] = useState<Sucursal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    nombre_id: '',
    direccion: '',
    administrador: '',
    correo_admin: ''
  });

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('sucursales').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      setBranches(data);
      // Intentar obtener el logo de la primera sucursal como logo corporativo por ahora
      if (data.length > 0 && data[0].logo_url) setLogoUrl(data[0].logo_url);
    }
    setLoading(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `company_logo_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('expedientes')
        .upload(`logos/${fileName}`, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('expedientes')
        .getPublicUrl(`logos/${fileName}`);

      setLogoUrl(publicUrl);
      alert("Logo corporativo actualizado correctamente.");
    } catch (err: any) {
      alert("Error cargando logo: " + err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('sucursales').insert([{ ...formData, logo_url: logoUrl }]);
    if (error) {
      alert("Error: " + error.message);
    } else {
      setShowModal(false);
      setFormData({ nombre_id: '', direccion: '', administrador: '', correo_admin: '' });
      fetchBranches();
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Sección de Logo Corporativo */}
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden relative group">
            {logoUrl ? (
              <img src={logoUrl} className="w-full h-full object-contain p-2" alt="Logo" />
            ) : (
              <span className="text-3xl">🏥</span>
            )}
            <div 
              onClick={() => logoInputRef.current?.click()}
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold cursor-pointer transition-opacity"
            >
              {uploadingLogo ? '...' : 'Subir Logo'}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Logo de la Organización</h3>
            <p className="text-sm text-slate-500">Aparecerá en los recibos y reportes oficiales.</p>
          </div>
        </div>
        <button 
          onClick={() => logoInputRef.current?.click()}
          disabled={uploadingLogo}
          className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center gap-2"
        >
          {uploadingLogo ? 'Cargando...' : '📷 Cambiar Logo'}
        </button>
        <input type="file" ref={logoInputRef} onChange={handleLogoUpload} className="hidden" accept="image/*" />
      </div>

      {/* Lista de Sucursales */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Sucursales Activas</h2>
            <p className="text-xs text-slate-500 font-medium">Control de sedes farmacéuticas</p>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg"
          >
            + Agregar Sucursal
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black tracking-widest">
              <tr>
                <th className="px-6 py-4">Nombre / ID</th>
                <th className="px-6 py-4">Dirección</th>
                <th className="px-6 py-4">Administrador</th>
                <th className="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={4} className="p-10 text-center text-slate-400">Cargando sedes...</td></tr>
              ) : branches.length === 0 ? (
                <tr><td colSpan={4} className="p-10 text-center text-slate-300 font-medium">No hay sucursales registradas</td></tr>
              ) : branches.map(branch => (
                <tr key={branch.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-slate-800">{branch.nombre_id}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-slate-600 max-w-xs">{branch.direccion}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-slate-700">{branch.administrador}</div>
                    <div className="text-[10px] text-emerald-600 font-bold">{branch.correo_admin}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button className="text-slate-400 hover:text-emerald-600 p-2">✏️</button>
                    <button className="text-slate-400 hover:text-red-600 p-2">🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Nueva Sucursal */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg animate-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Registrar Nueva Sede</h2>
              <button onClick={() => setShowModal(false)} className="text-2xl text-slate-400">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre o ID de Sucursal</label>
                <input required className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" value={formData.nombre_id} onChange={e => setFormData({...formData, nombre_id: e.target.value})} placeholder="Ej: Farmacia Principal Este" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dirección Completa</label>
                <textarea required className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none h-24" value={formData.direccion} onChange={e => setFormData({...formData, direccion: e.target.value})} placeholder="Calle... Local..." />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Administrador</label>
                  <input required className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" value={formData.administrador} onChange={e => setFormData({...formData, administrador: e.target.value})} placeholder="Nombre completo" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Correo Electrónico</label>
                  <input required type="email" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" value={formData.correo_admin} onChange={e => setFormData({...formData, correo_admin: e.target.value})} placeholder="admin@sucursal.com" />
                </div>
              </div>
              <div className="flex gap-3 pt-6">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-all">Cancelar</button>
                <button type="submit" className="flex-2 bg-emerald-600 text-white py-4 px-8 rounded-xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all">Guardar Sede</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchManager;
