
import React, { useState } from 'react';
import { supabase } from '../lib/supabase.ts';
import { Empleado } from '../types.ts';

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeToEdit?: Empleado | null;
}

const EmployeeModal: React.FC<EmployeeModalProps> = ({ isOpen, onClose, employeeToEdit }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    cedula: employeeToEdit?.cedula || '',
    nombre: employeeToEdit?.nombre || '',
    apellido: employeeToEdit?.apellido || '',
    cargo: employeeToEdit?.cargo || '',
    fecha_ingreso: employeeToEdit?.fecha_ingreso || new Date().toISOString().split('T')[0],
    salario_usd: employeeToEdit?.salario_usd || 0,
    activo: employeeToEdit?.activo ?? true,
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        salario_usd: Number(formData.salario_usd),
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
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800">
            {employeeToEdit ? 'Editar Empleado' : 'Registrar Nuevo Empleado'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors text-2xl">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cédula / ID</label>
              <input
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                value={formData.cedula}
                onChange={e => setFormData({ ...formData, cedula: e.target.value })}
                placeholder="V-00000000"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cargo</label>
              <input
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                value={formData.cargo}
                onChange={e => setFormData({ ...formData, cargo: e.target.value })}
                placeholder="Ej. Farmacéutico"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre</label>
              <input
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                value={formData.nombre}
                onChange={e => setFormData({ ...formData, nombre: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Apellido</label>
              <input
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                value={formData.apellido}
                onChange={e => setFormData({ ...formData, apellido: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Salario Base (USD)</label>
              <div className="relative">
                <span className="absolute left-4 top-2.5 text-slate-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono"
                  value={formData.salario_usd}
                  onChange={e => setFormData({ ...formData, salario_usd: parseFloat(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha de Ingreso</label>
              <input
                type="date"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                value={formData.fecha_ingreso}
                onChange={e => setFormData({ ...formData, fecha_ingreso: e.target.value })}
              />
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

          <div className="flex gap-3 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all disabled:opacity-50"
            >
              {loading ? 'Guardando...' : employeeToEdit ? 'Actualizar' : 'Guardar Empleado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeModal;
