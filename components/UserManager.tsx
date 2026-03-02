
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.ts';
import { User } from '@supabase/supabase-js';
import UserModal from './UserModal.tsx';

type UserWithRole = User & { role: string };

const UserManager: React.FC = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('list-users');
      if (error) throw error;

      const users: UserWithRole[] = data?.users || [];
      setUsers(users);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    fetchUsers();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200 bg-white flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Gestión de Usuarios</h2>
          <p className="text-sm text-slate-500 font-medium">Administre los usuarios del sistema</p>
        </div>
        <button 
          onClick={handleAddUser}
          className="bg-[#10b981] hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-50 active:scale-95"
        >
          + Agregar Usuario
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F8F9FB] text-slate-400 uppercase text-[10px] font-black tracking-[0.15em] border-b border-slate-100">
            <tr>
              <th className="px-8 py-4">Nombre</th>
              <th className="px-8 py-4">Email</th>
              <th className="px-8 py-4">Rol</th>
              <th className="px-8 py-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr>
                <td colSpan={4} className="p-20 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent animate-spin rounded-full"></div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Cargando usuarios...</span>
                  </div>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-20 text-center">
                  <div className="text-4xl mb-4 opacity-20">👥</div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">No hay usuarios registrados en el sistema</p>
                </td>
              </tr>
            ) : (
              users.map(user => (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="font-black uppercase text-slate-800 text-sm leading-tight tracking-tight">{(user.raw_user_meta_data as any)?.full_name || (user.raw_user_meta_data as any)?.name || user.email}</div>
                  </td>
                  <td className="px-8 py-5 font-mono text-[11px] font-bold text-slate-500">{user.email}</td>
                  <td className="px-8 py-5">
                    <span className="px-4 py-1.5 rounded-full text-[9px] font-black tracking-widest uppercase border bg-slate-100 text-slate-400 border-slate-200">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <div className="flex justify-center gap-1">
                      <button className="p-2.5 hover:bg-slate-100 text-slate-300 hover:text-amber-500 rounded-xl transition-all" title="Editar Usuario">
                        <span className="text-lg">✏️</span>
                      </button>
                      <button className="p-2.5 hover:bg-slate-100 text-slate-300 hover:text-rose-500 rounded-xl transition-all" title="Eliminar Usuario">
                        <span className="text-lg">🗑️</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <UserModal isOpen={isModalOpen} onClose={handleCloseModal} />
    </div>
  );
};

export default UserManager;
