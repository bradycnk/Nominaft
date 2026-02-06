
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.ts';
import { Sucursal } from '../types.ts';

const BranchManager: React.FC = () => {
  const [branches, setBranches] = useState<Sucursal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [editingBranch, setEditingBranch] = useState<Sucursal | null>(null);
  
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    nombre_id: '',
    rif: '',
    direccion: '',
    administrador: '',
    correo_admin: '',
    es_principal: false
  });

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sucursales')
        .select('*')
        .order('es_principal', { ascending: false });
      
      if (error) throw error;
      
      if (data) {
        setBranches(data);
        const principal = data.find(b => b.es_principal);
        if (principal?.logo_url) setLogoUrl(principal.logo_url);
      }
    } catch (err) {
      console.error("Error cargando sucursales:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      // 1. Subir al Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `logo_${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('expedientes')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // 2. Obtener URL Pública
      const { data: { publicUrl } } = supabase.storage
        .from('expedientes')
        .getPublicUrl(filePath);

      // 3. Persistencia en Base de Datos para la Sede Principal actual
      const principalBranch = branches.find(b => b.es_principal);
      if (principalBranch) {
        const { error: dbError } = await supabase
          .from('sucursales')
          .update({ logo_url: publicUrl })
          .eq('id', principalBranch.id);
        
        if (dbError) throw dbError;
      }

      setLogoUrl(publicUrl);
      fetchBranches(); // Refrescar para asegurar sincronía
      alert("Logo corporativo guardado y vinculado correctamente.");
    } catch (err: any) {
      console.error("Error en carga de logo:", err);
      alert("Error crítico: " + err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleEdit = (branch: Sucursal) => {
    setEditingBranch(branch);
    setFormData({
      nombre_id: branch.nombre_id,
      rif: branch.rif,
      direccion: branch.direccion,
      administrador: branch.administrador,
      correo_admin: branch.correo_admin,
      es_principal: branch.es_principal
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Si se marca como principal, desactivar las otras
      if (formData.es_principal) {
        await supabase.from('sucursales').update({ es_principal: false }).eq('es_principal', true);
      }

      const payload = {
        ...formData,
        logo_url: logoUrl,
        updated_at: new Date().toISOString()
      };

      let error;
      if (editingBranch) {
        const { error: updateError } = await supabase
          .from('sucursales')
          .update(payload)
          .eq('id', editingBranch.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('sucursales')
          .insert([payload]);
        error = insertError;
      }

      if (error) throw error;

      setShowModal(false);
      resetForm();
      fetchBranches();
      alert(editingBranch ? "Sede actualizada" : "Sede registrada exitosamente");
    } catch (err: any) {
      alert("Error al guardar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingBranch(null);
    setFormData({ nombre_id: '', rif: '', direccion: '', administrador: '', correo_admin: '', es_principal: false });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Está seguro de eliminar esta sucursal? Esta acción es irreversible.")) return;
    const { error } = await supabase.from('sucursales').delete().eq('id', id);
    if (!error) fetchBranches();
    else alert("No se pudo eliminar: " + error.message);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Sección de Logo Corporativo */}
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden relative group">
            {logoUrl ? (
              <img src={logoUrl} className="w-full h-full object-contain p-2" alt="Logo Corporativo" />
            ) : (
              <span className="text-3xl grayscale opacity-30">🏥</span>
            )}
            <div 
              onClick={() => !uploadingLogo && logoInputRef.current?.click()}
              className={`absolute inset-0 bg-emerald-600/80 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-black uppercase cursor-pointer transition-opacity ${uploadingLogo ? 'opacity-100' : ''}`}
            >
              {uploadingLogo ? 'Subiendo...' : 'Actualizar Logo'}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800 tracking-tight">Identidad Visual</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Este logo aparecerá en todos los Recibos de Pago</p>
          </div>
        </div>
        <button 
          onClick={() => logoInputRef.current?.click()}
          disabled={uploadingLogo}
          className="bg-[#10b981] text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-600 transition-all flex items-center gap-2"
        >
          {uploadingLogo ? 'Sincronizando...' : '📷 Cambiar Logo Principal'}
        </button>
        <input type="file" ref={logoInputRef} onChange={handleLogoUpload} className="hidden" accept="image/*" />
      </div>

      {/* Lista de Sucursales */}
      <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-white">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Red de Sucursales</h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Control de entidades fiscales farmacéuticas</p>
          </div>
          <button 
            onClick={() => { resetForm(); setShowModal(true); }}
            className="bg-slate-900 hover:bg-black text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg"
          >
            + Nueva Sucursal
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#F8F9FB] text-slate-400 text-[10px] uppercase font-black tracking-[0.2em] border-b border-slate-50">
              <tr>
                <th className="px-8 py-5">Sede / RIF</th>
                <th className="px-8 py-5">Dirección Fiscal</th>
                <th className="px-8 py-5">Responsable</th>
                <th className="px-8 py-5 text-center">Tipo</th>
                <th className="px-8 py-5 text-center">Gestión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={5} className="p-20 text-center"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent animate-spin rounded-full mx-auto"></div></td></tr>
              ) : branches.length === 0 ? (
                <tr><td colSpan={5} className="p-20 text-center text-slate-300 font-bold uppercase text-[10px] tracking-widest">No hay sucursales registradas</td></tr>
              ) : branches.map(branch => (
                <tr key={branch.id} className={`hover:bg-slate-50/50 transition-colors ${branch.es_principal ? 'bg-emerald-50/20' : ''}`}>
                  <td className="px-8 py-6">
                    <div className="text-sm font-black text-slate-800 uppercase leading-none mb-1.5">{branch.nombre_id}</div>
                    <div className="text-[10px] font-black text-emerald-500 tracking-tighter">RIF: {branch.rif || 'NO DEFINIDO'}</div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="text-[11px] font-medium text-slate-500 max-w-xs leading-relaxed">{branch.direccion}</div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="text-xs font-black text-slate-700 uppercase">{branch.administrador}</div>
                    <div className="text-[10px] text-slate-400 font-bold">{branch.correo_admin}</div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    {branch.es_principal ? (
                      <span className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest">Sede Fiscal</span>
                    ) : (
                      <span className="px-3 py-1 bg-slate-100 text-slate-400 rounded-lg text-[9px] font-black uppercase tracking-widest">Sucursal</span>
                    )}
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => handleEdit(branch)} className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-all" title="Editar">✏️</button>
                      <button onClick={() => handleDelete(branch.id)} className="p-2 hover:bg-rose-50 text-rose-500 rounded-lg transition-all" title="Eliminar">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Nueva/Editar Sucursal */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">{editingBranch ? 'Actualizar Sede' : 'Registrar Nueva Sede'}</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Configuración Fiscal de la Entidad</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-900 transition-all text-2xl font-light">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-10 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">Nombre Comercial</label>
                  <input required className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm font-bold" value={formData.nombre_id} onChange={e => setFormData({...formData, nombre_id: e.target.value})} placeholder="Farma Salud Principal" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">RIF Patronal</label>
                  <input required className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm font-bold font-mono" value={formData.rif} onChange={e => setFormData({...formData, rif: e.target.value})} placeholder="J-00000000-0" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">Dirección Fiscal Completa</label>
                <textarea required className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm font-medium h-24 resize-none" value={formData.direccion} onChange={e => setFormData({...formData, direccion: e.target.value})} placeholder="Av. Principal de..." />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">Administrador</label>
                  <input required className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm font-bold" value={formData.administrador} onChange={e => setFormData({...formData, administrador: e.target.value})} placeholder="Nombre del Regente" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">Email Admin</label>
                  <input required type="email" className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm font-bold" value={formData.correo_admin} onChange={e => setFormData({...formData, correo_admin: e.target.value})} placeholder="correo@empresa.com" />
                </div>
              </div>
              <div className="flex items-center gap-3 py-4 bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100/50">
                <input 
                  type="checkbox" 
                  id="es_principal" 
                  checked={formData.es_principal} 
                  onChange={e => setFormData({...formData, es_principal: e.target.checked})}
                  className="w-5 h-5 accent-emerald-600 rounded-md"
                />
                <label htmlFor="es_principal" className="text-xs font-black text-emerald-800 uppercase tracking-wider cursor-pointer">Marcar como SEDE PRINCIPAL (Dirección Fiscal Principal)</label>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-5 font-black text-[10px] uppercase tracking-widest text-slate-400 hover:bg-slate-50 rounded-2xl transition-all">Descartar</button>
                <button type="submit" disabled={loading} className="flex-2 bg-slate-900 text-white py-5 px-10 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-2xl hover:bg-black transition-all">
                  {loading ? 'Procesando...' : (editingBranch ? 'Actualizar Cambios' : 'Confirmar Registro')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchManager;
