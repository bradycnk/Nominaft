
import React, { useState } from 'react';
import { supabase } from '../lib/supabase.ts';

const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });
        if (signUpError) throw signUpError;
        alert('Registro exitoso. Por favor verifica tu correo electrónico si es necesario o intenta iniciar sesión.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error en la autenticación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-600 text-white text-3xl mb-4 shadow-lg shadow-emerald-200">
            🏥
          </div>
          <h1 className="text-3xl font-bold text-slate-900">FarmaNomina Pro</h1>
          <p className="text-slate-500 mt-2">Gestión Profesional de Nómina (LOTTT)</p>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200 border border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">
            {isSignUp ? 'Crear Cuenta Administrativa' : 'Iniciar Sesión'}
          </h2>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded-r-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Juan Pérez"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Correo Electrónico</label>
              <input
                type="email"
                required
                placeholder="admin@farmacia.com"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Contraseña</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-100 transition-all transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? 'Procesando...' : isSignUp ? 'Registrarse' : 'Entrar al Sistema'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-emerald-600 hover:text-emerald-700 font-semibold text-sm transition-colors"
            >
              {isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
            </button>
          </div>
        </div>
        
        <p className="text-center text-slate-400 text-xs mt-8">
          &copy; 2024 FarmaNomina Pro. Todos los cálculos basados en LOTTT y Tasas BCV Oficiales.
        </p>
      </div>
    </div>
  );
};

export default Auth;
