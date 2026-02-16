
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.ts';
import { Empleado, ConfigGlobal, Asistencia } from '../types.ts';
import { calculatePayroll, fetchBcvRate, processAttendanceRecords } from '../services/payrollService.ts';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const LOGO_URL = "https://cfncthqiqabezmemosrz.supabase.co/storage/v1/object/public/expedientes/logos/logo_1770579845203.jpeg";

const PayrollProcessor: React.FC<{ config: ConfigGlobal | null }> = ({ config }) => {
  const [employees, setEmployees] = useState<Empleado[]>([]);
  const [attendances, setAttendances] = useState<Asistencia[]>([]);
  const [isUpdatingRate, setIsUpdatingRate] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  
  const [periodo, setPeriodo] = useState<'Q1' | 'Q2'>('Q1');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadData();
  }, [periodo, selectedMonth, selectedYear]);

  const loadData = async () => {
    setLoadingData(true);
    const startDay = periodo === 'Q1' ? 1 : 16;
    const endDay = periodo === 'Q1' ? 15 : new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const startDate = new Date(selectedYear, selectedMonth, startDay).toISOString().split('T')[0];
    const endDate = new Date(selectedYear, selectedMonth, endDay).toISOString().split('T')[0];

    const { data: empData } = await supabase.from('empleados').select('*, sucursales(*)').eq('activo', true);
    const { data: attData } = await supabase.from('asistencias').select('*').gte('fecha', startDate).lte('fecha', endDate);

    setEmployees(empData || []);
    setAttendances(attData || []);
    setLoadingData(false);
  };

  const handleUpdateBcv = async () => {
    setIsUpdatingRate(true);
    try {
      const newRate = await fetchBcvRate();
      if (config) {
        await supabase.from('configuracion_global').update({ tasa_bcv: newRate }).eq('id', config.id);
        alert(`Tasa BCV actualizada: Bs. ${newRate}`);
      }
    } catch (err) { alert("Error BCV"); } finally { setIsUpdatingRate(false); }
  };

  const generatePDF = async (emp: Empleado, calc: any) => {
    if (!config) return;

    const startDay = periodo === 'Q1' ? 1 : 16;
    const endDay = periodo === 'Q1' ? 15 : new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const fechaDesde = `${startDay.toString().padStart(2, '0')}/${(selectedMonth + 1).toString().padStart(2, '0')}/${selectedYear}`;
    const fechaHasta = `${endDay.toString().padStart(2, '0')}/${(selectedMonth + 1).toString().padStart(2, '0')}/${selectedYear}`;

    const empAsistencias = attendances.filter(a => a.empleado_id === emp.id);
    const hoursData = processAttendanceRecords(empAsistencias);
    const usaCalculoAsistencia = hoursData.diasTrabajados > 0;

    const salarioHoraBs = calc.salario_diario_normal / 8;
    const montoHorasNormales = hoursData.totalNormal * salarioHoraBs;
    const montoExtrasDiurnas = hoursData.totalExtraDiurna * (salarioHoraBs * 1.5);
    const montoExtrasNocturnas = hoursData.totalExtraNocturna * (salarioHoraBs * 1.5); 
    const montoDescanso = hoursData.totalDescanso * (salarioHoraBs * 1.5);
    const montoBonoNocturno = hoursData.totalNightHours * (salarioHoraBs * 0.30);

    let totalAsignacionesCalculadas = montoHorasNormales + montoExtrasDiurnas + montoExtrasNocturnas + montoDescanso + montoBonoNocturno;
    if (!usaCalculoAsistencia) totalAsignacionesCalculadas = calc.sueldo_periodo;
    
    const netoFinal = totalAsignacionesCalculadas + calc.bono_alimentacion_vef - calc.total_deducciones;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const fechaEmision = new Date().toLocaleString('es-VE');
    
    // --- Header ---
    try {
        const imgWidth = 25;
        doc.addImage(LOGO_URL, 'JPEG', 15, 15, imgWidth, 15);
    } catch (e) {}

    doc.setFont("courier", "bold");
    doc.setFontSize(14);
    doc.text("RECIBO DE PAGO DE NÓMINA", pageWidth / 2, 25, { align: "center" });
    
    doc.setFontSize(8);
    doc.setFont("courier", "normal");
    doc.text(`Emisión: ${fechaEmision}`, pageWidth - 15, 15, { align: "right" });

    let y = 50;
    doc.setFontSize(9);
    doc.text(`EMPRESA: ${emp.sucursales?.nombre_id || 'FarmaNomina C.A.'}`, 15, y);
    doc.text(`RIF: ${emp.sucursales?.rif || 'J-12345678-9'}`, pageWidth - 15, y, { align: "right" });
    y += 10;
    
    doc.setFont("courier", "bold");
    doc.text(`TRABAJADOR: ${emp.nombre} ${emp.apellido}`, 15, y);
    doc.text(`C.I.: ${emp.cedula}`, pageWidth - 15, y, { align: "right" });
    y += 5;
    doc.setFont("courier", "normal");
    doc.text(`Cargo: ${emp.cargo || 'General'}`, 15, y);
    doc.text(`Período: ${fechaDesde} al ${fechaHasta}`, pageWidth - 15, y, { align: "right" });
    y += 10;
    
    // Tabla Conceptos
    doc.setFont("courier", "bold");
    doc.text("CONCEPTO", 15, y);
    doc.text("ASIGNACIONES", 145, y, { align: "right" });
    doc.text("DEDUCCIONES", 195, y, { align: "right" }); 
    y += 5;
    doc.line(15, y, pageWidth - 15, y);
    y += 5;
    doc.setFont("courier", "normal");

    const addRow = (concepto: string, asignacion: number | null, deduccion: number | null) => {
        doc.text(concepto.substring(0, 45), 15, y);
        if (asignacion !== null) doc.text(`${asignacion.toLocaleString('es-VE', {minimumFractionDigits: 2})}`, 145, y, { align: "right" });
        if (deduccion !== null) doc.text(`${deduccion.toLocaleString('es-VE', {minimumFractionDigits: 2})}`, 195, y, { align: "right" });
        y += 5;
    };

    if (usaCalculoAsistencia) {
        addRow(`Sueldo Normal (${hoursData.diasTrabajados} Días / ${hoursData.totalNormal.toFixed(1)} hrs)`, montoHorasNormales, null);
        if (montoExtrasDiurnas > 0) addRow(`Horas Extras Diurnas (1.5x)`, montoExtrasDiurnas, null);
        if (montoExtrasNocturnas > 0) addRow(`Horas Extras Nocturnas (1.5x)`, montoExtrasNocturnas, null);
        if (montoBonoNocturno > 0) {
            // Referencia explícita a la LOTTT para mayor claridad contable
            const etiqueta = hoursData.totalNightHours > (hoursData.diasTrabajados * 4) ? "Bono Nocturno (Jornada Nocturna Art.173)" : "Bono Nocturno (Horas Nocturnas)";
            addRow(`${etiqueta} (${hoursData.totalNightHours.toFixed(1)} hrs)`, montoBonoNocturno, null);
        }
        if (montoDescanso > 0) addRow(`Días de Descanso / Feriados`, montoDescanso, null);
    } else {
        addRow(`Sueldo Básico Quincenal`, calc.sueldo_periodo, null);
    }

    addRow("IVSS (S.S.O) 4%", null, calc.deduccion_ivss);
    addRow("R.P.E (Paro Forzoso) 0.5%", null, calc.deduccion_spf);
    addRow("F.A.O.V 1%", null, calc.deduccion_faov);

    y += 5;
    doc.line(15, y, pageWidth - 15, y);
    y += 5;
    doc.setFont("courier", "bold");
    doc.text("TOTAL NETO A RECIBIR (Bs.):", 15, y);
    doc.text(`${netoFinal.toLocaleString('es-VE', {minimumFractionDigits: 2})}`, 145, y, { align: "right" });
    
    if (calc.bono_alimentacion_vef > 0) {
        y += 8;
        doc.setFontSize(8);
        doc.text(`+ Cestaticket Socialista: Bs. ${calc.bono_alimentacion_vef.toLocaleString('es-VE', {minimumFractionDigits: 2})}`, 15, y);
    }

    doc.save(`Recibo_${emp.cedula}_${periodo}.pdf`);
  };

  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  return (
    <div className="p-8 space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center">
        <div>
           <h3 className="text-xl font-bold text-slate-800">Cálculo de Nómina Detallado</h3>
           <p className="text-xs text-slate-500 uppercase font-black tracking-widest mt-1">Soporte Jornada Nocturna & Mixta</p>
        </div>
        <div className="flex gap-4 items-center bg-slate-50 p-2 rounded-xl">
           <select className="bg-white border p-2 rounded-lg text-sm font-bold" value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))}>
             {meses.map((m, i) => <option key={i} value={i}>{m}</option>)}
           </select>
           <button onClick={() => setPeriodo(periodo === 'Q1' ? 'Q2' : 'Q1')} className="bg-[#1E1E2D] text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase">
             {periodo === 'Q1' ? '1ra Quincena' : '2da Quincena'}
           </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b">
            <tr>
              <th className="px-6 py-4">Empleado</th>
              <th className="px-6 py-4 text-center">Horas Totales</th>
              <th className="px-6 py-4 text-center">Bono Nocturno</th>
              <th className="px-6 py-4 text-right">Neto Bs.</th>
              <th className="px-6 py-4 text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {employees.map(emp => {
                if (!config) return null;
                const empAsistencias = attendances.filter(a => a.empleado_id === emp.id);
                const hData = processAttendanceRecords(empAsistencias);
                const calc = calculatePayroll(emp, config, 15, periodo);
                
                const salarioHora = calc.salario_diario_normal / 8;
                const asignaciones = (hData.totalNormal * salarioHora) + 
                                   (hData.totalExtraDiurna * salarioHora * 1.5) + 
                                   (hData.totalExtraNocturna * salarioHora * 1.5) +
                                   (hData.totalDescanso * salarioHora * 1.5) +
                                   (hData.totalNightHours * salarioHora * 0.30);
                
                const neto = (hData.diasTrabajados > 0 ? asignaciones : calc.sueldo_periodo) + calc.bono_alimentacion_vef - calc.total_deducciones;

                return (
                  <tr key={emp.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-bold text-slate-700">{emp.nombre} {emp.apellido}</td>
                    <td className="px-6 py-4 text-center">{(hData.totalNormal + hData.totalExtraDiurna + hData.totalExtraNocturna + hData.totalDescanso).toFixed(1)}h</td>
                    <td className="px-6 py-4 text-center">
                       {hData.totalNightHours > 0 ? (
                         <span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full text-[10px] font-bold">
                           {hData.totalNightHours.toFixed(1)}h Aplicado
                         </span>
                       ) : <span className="text-slate-300">---</span>}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600">Bs. {neto.toLocaleString('es-VE', {minimumFractionDigits: 2})}</td>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => generatePDF(emp, calc)} className="text-slate-400 hover:text-emerald-600 transition-colors">📄</button>
                    </td>
                  </tr>
                );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PayrollProcessor;
