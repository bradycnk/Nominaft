
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.ts';
import { Empleado, ConfigGlobal } from '../types.ts';
import { calculatePayroll, fetchBcvRate } from '../services/payrollService.ts';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const PayrollProcessor: React.FC<{ config: ConfigGlobal | null }> = ({ config }) => {
  const [employees, setEmployees] = useState<Empleado[]>([]);
  const [isUpdatingRate, setIsUpdatingRate] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('empleados')
        .select('*, sucursales(nombre_id)')
        .eq('activo', true);
      setEmployees(data || []);
    };
    load();
  }, []);

  const handleUpdateBcv = async () => {
    setIsUpdatingRate(true);
    try {
      const newRate = await fetchBcvRate();
      if (config) {
        const { error } = await supabase
          .from('configuracion_global')
          .update({ tasa_bcv: newRate })
          .eq('id', config.id);
        
        if (error) throw error;
        alert(`Tasa BCV actualizada a Bs. ${newRate}`);
      }
    } catch (err) {
      console.error("Error actualizando tasa:", err);
      alert("No se pudo conectar con el servicio de tasas. Verifique su conexión.");
    } finally {
      setIsUpdatingRate(false);
    }
  };

  const generatePDF = (emp: Empleado, calc: any) => {
    const doc = new jsPDF();
    const margin = 20;
    const currentMonth = new Date().toLocaleString('es-VE', { month: 'long', year: 'numeric' });

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('FARMANOMINA PRO', margin, 20);
    
    doc.setFontSize(10);
    doc.text(`SUCURSAL: ${emp.sucursales?.nombre_id || 'Principal'}`, margin, 28);
    doc.text(`RIF: ${emp.rif || 'J-00000000-0'}`, margin, 33);
    
    doc.setFontSize(14);
    doc.text('RECIBO DE PAGO DE NÓMINA', 105, 50, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`PERIODO: ${currentMonth.toUpperCase()}`, 105, 57, { align: 'center' });

    // Información Empleado
    doc.autoTable({
      startY: 65,
      head: [['DATOS DEL TRABAJADOR', '']],
      body: [
        ['Nombre Completo:', `${emp.nombre} ${emp.apellido}`],
        ['Cédula de Identidad:', emp.cedula],
        ['Cargo:', emp.cargo || 'General'],
        ['Fecha de Ingreso:', emp.fecha_ingreso],
      ],
      theme: 'plain',
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] },
      styles: { fontSize: 9 }
    });

    // Detalle de Cálculos
    doc.autoTable({
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [['DESCRIPCIÓN', 'ASIGNACIONES (Bs.)', 'DEDUCCIONES (Bs.)']],
      body: [
        ['Sueldo Base (VEF)', emp.salario_base_vef.toLocaleString('es-VE', { minimumFractionDigits: 2 }), ''],
        ['Diferencial Indexación ($)', (calc.sueldo_base_vef - emp.salario_base_vef).toLocaleString('es-VE', { minimumFractionDigits: 2 }), ''],
        ['Bono Alimentación (Cestaticket)', calc.bono_alimentacion_vef.toLocaleString('es-VE', { minimumFractionDigits: 2 }), ''],
        ['S.S.O. (IVSS 4%)', '', calc.deduccion_ivss.toLocaleString('es-VE', { minimumFractionDigits: 2 })],
        ['S.P.F. (Paro Forzoso 0.5%)', '', calc.deduccion_spf.toLocaleString('es-VE', { minimumFractionDigits: 2 })],
        ['F.A.O.V. (Ahorro Habitacional 1%)', '', calc.deduccion_faov.toLocaleString('es-VE', { minimumFractionDigits: 2 })],
      ],
      foot: [[
        'TOTALES NETO A PAGAR', 
        '', 
        `Bs. ${calc.neto_pagar_vef.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`
      ]],
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59] },
      footStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold' }
    });

    // Firmas
    const finalY = (doc as any).lastAutoTable.finalY + 40;
    doc.line(margin, finalY, margin + 60, finalY);
    doc.text('Recibí Conforme (Firma)', margin, finalY + 5);
    
    doc.line(130, finalY, 130 + 60, finalY);
    doc.text('Sello y Firma Patrono', 130, finalY + 5);

    doc.save(`Recibo_${emp.apellido}_${currentMonth}.pdf`);
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
                <th className="px-4 py-3 text-center">Ref ($)</th>
                <th className="px-4 py-3">Base (VEF)</th>
                <th className="px-4 py-3">IVSS (4%)</th>
                <th className="px-4 py-3">FAOV (1%)</th>
                <th className="px-4 py-3">Cestaticket</th>
                <th className="px-4 py-3 font-bold text-slate-800">Neto a Pagar</th>
                <th className="px-4 py-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map(emp => {
                if (!config) return null;
                const calc = calculatePayroll(emp, config);
                return (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800">{emp.nombre} {emp.apellido}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">{emp.cargo}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-center text-slate-400">${emp.salario_usd}</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-600">
                      Bs. {Number(emp.salario_base_vef || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 font-mono text-rose-400">-{calc.deduccion_ivss.toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono text-rose-400">-{calc.deduccion_faov.toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono text-emerald-500">+{calc.bono_alimentacion_vef.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 font-mono font-black text-slate-900">
                      Bs. {calc.neto_pagar_vef.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button 
                        onClick={() => generatePDF(emp, calc)}
                        className="p-2 hover:bg-emerald-50 text-slate-300 hover:text-emerald-600 rounded-lg transition-all"
                        title="Descargar Recibo PDF"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-8 flex justify-end">
          <button className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all shadow-xl">
             Confirmar y Cerrar Nómina Mensual
          </button>
        </div>
      </div>
    </div>
  );
};

export default PayrollProcessor;
