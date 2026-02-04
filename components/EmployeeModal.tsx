
import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase.ts';
import { Empleado } from '../types.ts';

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeToEdit?: Empleado | null;
}

const EmployeeModal: React.FC<EmployeeModalProps> = ({ isOpen, onClose, employeeToEdit }) => {
  const [loading, setLoading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(employeeToEdit?.foto_url || null);
  
  const [formData, setFormData] = useState({
    cedula: employeeToEdit?.cedula || '',
    rif: employeeToEdit?.rif || '',
    nombre: employeeToEdit?.nombre || '',
    apellido: employeeToEdit?.apellido || '',
    cargo: employeeToEdit?.cargo || '',
    fecha_ingreso: employeeToEdit?.fecha_ingreso || new Date().toISOString().split('T')[0],
    salario_usd: employeeToEdit?.salario_usd || 0,
    activo: employeeToEdit?.activo ?? true,
    foto_url: employeeToEdit?.foto_url || '',
    cv_url: employeeToEdit?.cv_url || '',
  });

  const photoInputRef = useRef<HTMLInputElement>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (file: File, type: 'photo' | 'cv', cedula: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${type}_${cedula}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${cedula}/${fileName}`;

    const { error: uploadError, data } = await supabase.storage
      .from('expedientes')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('expedientes')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let finalFotoUrl = formData.foto_url;
      let finalCvUrl = formData.cv_url;

      // Cargar archivos si fueron seleccionados
      if (photoInputRef.current?.files?.[0] || cvInputRef.current?.files?.[0]) {
        setUploadingFiles(true);
        if (photoInputRef.current?.files?.[0]) {
          finalFotoUrl = await handleFileUpload(photoInputRef.current.files[0], 'photo', formData.cedula);
        }
        if (cvInputRef.current?.files?.[0]) {
          finalCvUrl = await handleFileUpload(cvInputRef.current.files[0], 'cv', formData.cedula);
        }
      }

      const payload = {
        ...formData,
        salario_usd: Number(formData.salario_usd),
        foto_url: finalFotoUrl,
        cv_url: finalCvUrl,
      };

      let error;
      if (employeeToEdit) {
        const { error: updateError } = await supabase
          .from('empleados')
          .update(payload)
          .eq('id', employeeToEdit.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('empleados')
          .insert([payload]);
        error = insertError;
      }

      if (error) throw error;
      onClose();
    } catch (err: any) {
      alert('Error al guardar: ' + err.message);
    } finally {
      setLoading(false);
      setUploadingFiles(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl my-8 animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
          <h2 className="text-xl font-bold text-slate-800">
            {employeeToEdit ? 'Editar Expediente' : 'Nuevo Ingreso (LOTTT)'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors text-2xl">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Sección de Foto Carnet */}
          <div className="flex flex-col items-center mb-6">
            <div 
              onClick={() => photoInputRef.current?.click()}
              className="w-32 h-40 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 transition-all overflow-hidden relative group"
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Carnet" className="w-full h-full object-cover" />
              ) : (
                <>
                  <span className="text-3xl mb-2">📸</span>
                  <span className="text-[10px] font-bold text-slate-400 text-center px-4 uppercase">Foto Carnet</span>
                </>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                Cambiar Foto
              </div>
            </div>
            <input 
              type="file" 
              ref={photoInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handlePhotoChange}
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cédula de Identidad</label>
              <input
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono"
                value={formData.cedula}
                onChange={e => setFormData({ ...formData, cedula: e.target.value })}
                placeholder="V-25888999"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Registro RIF</label>
              <input
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono"
                value={formData.rif}
                onChange={e => setFormData({ ...formData, rif: e.target.value })}
                placeholder="V-25888999-0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre(s)</label>
              <input
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                value={formData.nombre}
                onChange={e => setFormData({ ...formData, nombre: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Apellido(s)</label>
              <input
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                value={formData.apellido}
                onChange={e => setFormData({ ...formData, apellido: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cargo / Puesto</label>
              <input
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                value={formData.cargo}
                onChange={e => setFormData({ ...formData, cargo: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha de Ingreso</label>
              <input
                type="date"
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                value={formData.fecha_ingreso}
                onChange={e => setFormData({ ...formData, fecha_ingreso: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Salario Mensual (USD)</label>
            <div className="relative">
              <span className="absolute left-4 top-3 text-slate-400 font-bold">$</span>
              <input
                type="number"
                step="0.01"
                required
                className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono text-lg font-bold"
                value={formData.salario_usd}
                onChange={e => setFormData({ ...formData, salario_usd: parseFloat(e.target.value) })}
              />
            </div>
          </div>

          {/* Carga de Curriculum */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Adjuntar Curriculum Vitae (PDF/JPG/PNG)</label>
            <div className="flex items-center gap-4">
              <button 
                type="button"
                onClick={() => cvInputRef.current?.click()}
                className="bg-white border border-slate-200 px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-2"
              >
                <span>📎</span> Seleccionar Archivo
              </button>
              <input 
                type="file" 
                ref={cvInputRef} 
                className="hidden" 
                accept=".pdf,image/jpeg,image/png" 
              />
              <span className="text-xs text-slate-400 truncate max-w-[200px]">
                {cvInputRef.current?.files?.[0]?.name || (formData.cv_url ? 'CV Cargado previamente' : 'Ningún archivo seleccionado')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="activo"
              className="w-5 h-5 accent-emerald-600 cursor-pointer"
              checked={formData.activo}
              onChange={e => setFormData({ ...formData, activo: e.target.checked })}
            />
            <label htmlFor="activo" className="text-sm font-semibold text-slate-700 cursor-pointer">Empleado Activo</label>
          </div>

          <div className="flex gap-4 pt-6 sticky bottom-0 bg-white py-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-4 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || uploadingFiles}
              className="flex-2 px-12 py-4 rounded-xl bg-emerald-600 text-white font-bold shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading || uploadingFiles ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                  <span>Guardando...</span>
                </>
              ) : (
                <span>{employeeToEdit ? 'Actualizar Expediente' : 'Finalizar Registro'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeModal;
