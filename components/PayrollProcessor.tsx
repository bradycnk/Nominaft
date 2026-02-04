
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Empleado, ConfigGlobal } from '../types';
import { calculatePayroll, fetchBcvRate } from '../services/payrollService';

const PayrollProcessor: React.FC<{ config: ConfigGlobal | null }> = ({ config }) => {
  const [employees, setEmployees] = useState<Empleado[]>([]);
  const [isUpdatingRate, setIsUpdatingRate] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('empleados').select('*').eq('activo', true);
      setEmployees(data || []);
    };
    load();
  }, []);

  const handleUpdateBcv = async () => {
    setIsUpdatingRate(true);
    const newRate = await fetchBcvRate();
    if (config) {
      await supabase
        .from('configuracion_global')
        .update({ tasa_bcv: newRate })
        .eq('id', config.id);
      alert(`Tasa BCV actualizada a Bs. ${newRate}`);
    }
    setIsUpdatingRate(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-xl flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-emerald-900">Configuración de Pago Actual</h3>
          <p className="text-sm text-emerald-700">
            Tasa Aplicable: <span className="font-bold font-mono">Bs. {config?.tasa_bcv}</span> | 
            Cestaticket: <span className="font-bold font-mono">${config?.cestaticket_usd}</span>
          </p>
        </div>
        <button 
          onClick={handleUpdateBcv}
          disabled={isUpdatingRate}
          className="bg-white text-emerald-600 border border-emerald-200 px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-100 transition-colors disabled:opacity-50"
        >
          {isUpdatingRate ? 'Actualizando...' : '🔄 Actualizar Tasa BCV (DolarAPI)'}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Previsualización de Nómina Mensual</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Empleado</th>
                <th className="px-4 py-3">Base (USD)</th>
                <th className="px-4 py-3">Base (VEF)</th>
                <th className="px-4 py-3">IVSS (4%)</th>
                <th className="px-4 py-3">FAOV (1%)</th>
                <th className="px-4 py-3">Cestaticket</th>
                <th className="px-4 py-3 font-bold text-slate-800">Total a Pagar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map(emp => {
                if (!config) return null;
                const calc = calculatePayroll(emp, config);
                return (
                  <tr key={emp.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">{emp.nombre} {emp.apellido}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">${emp.salario_usd}</td>
                    <td className="px-4 py-3 font-mono">Bs. {calc.sueldo_base_vef.toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono text-red-500">-{calc.deduccion_ivss.toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono text-red-500">-{calc.deduccion_faov.toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono text-green-600">+{calc.bono_alimentacion_vef.toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-700">Bs. {calc.neto_pagar_vef.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex justify-end">
          <button className="bg-slate-800 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-900 transition-all shadow-lg">
            Confirmar y Generar Recibos PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default PayrollProcessor;
