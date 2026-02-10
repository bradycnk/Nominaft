
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.ts';
import { Empleado, ConfigGlobal, Asistencia } from '../types.ts';
import { calculatePayroll, fetchBcvRate, calculateWorkedHours, isWeekend } from '../services/payrollService.ts';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const LOGO_URL = "https://cfncthqiqabezmemosrz.supabase.co/storage/v1/object/public/expedientes/logos/logo_1770579845203.jpeg";

const PayrollProcessor: React.FC<{ config: ConfigGlobal | null }> = ({ config }) => {
  const [employees, setEmployees] = useState<Empleado[]>([]);
  const [attendances, setAttendances] = useState<Asistencia[]>([]);
  const [isUpdatingRate, setIsUpdatingRate] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  
  // Estado para selección de Quincena
  const [periodo, setPeriodo] = useState<'Q1' | 'Q2'>('Q1');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadData();
  }, [periodo, selectedMonth, selectedYear]);

  const loadData = async () => {
    setLoadingData(true);
    
    // Calcular fechas inicio y fin según quincena
    const startDay = periodo === 'Q1' ? 1 : 16;
    const endDay = periodo === 'Q1' ? 15 : new Date(selectedYear, selectedMonth + 1, 0).getDate();
    
    const startDate = new Date(selectedYear, selectedMonth, startDay).toISOString().split('T')[0];
    const endDate = new Date(selectedYear, selectedMonth, endDay).toISOString().split('T')[0];

    // Cargar Empleados
    const { data: empData } = await supabase
      .from('empleados')
      .select('*, sucursales(id, nombre_id, rif, direccion, es_principal)')
      .eq('activo', true);
    
    // Cargar Asistencias del rango seleccionado
    const { data: attData } = await supabase
      .from('asistencias')
      .select('*')
      .gte('fecha', startDate)
      .lte('fecha', endDate);

    setEmployees(empData || []);
    setAttendances(attData || []);
    setLoadingData(false);
  };

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

  const generatePDF = async (emp: Empleado, calc: any) => {
    if (!config) return;

    // Fechas para el recibo
    const startDay = periodo === 'Q1' ? 1 : 16;
    const endDay = periodo === 'Q1' ? 15 : new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const fechaDesde = `${startDay.toString().padStart(2, '0')}/${(selectedMonth + 1).toString().padStart(2, '0')}/${selectedYear}`;
    const fechaHasta = `${endDay.toString().padStart(2, '0')}/${(selectedMonth + 1).toString().padStart(2, '0')}/${selectedYear}`;

    // Lógica de horas trabajadas (si hay asistencia)
    const empAsistencias = attendances.filter(a => a.empleado_id === emp.id && a.estado === 'presente');
    let totalHorasRegulares = 0;
    let totalHorasExtras = 0;
    let diasDescansoTrabajados = 0;

    empAsistencias.forEach(att => {
        const horasDia = calculateWorkedHours(att.hora_entrada, att.hora_salida);
        const esFinDeSemana = isWeekend(att.fecha);
        if (esFinDeSemana) {
            diasDescansoTrabajados += 1;
            totalHorasRegulares += horasDia;
        } else {
            if (horasDia > 8) {
                totalHorasRegulares += 8;
                totalHorasExtras += (horasDia - 8);
            } else {
                totalHorasRegulares += horasDia;
            }
        }
    });

    const salarioHoraBs = calc.salario_diario_normal / 8;
    const montoHorasRegulares = totalHorasRegulares * salarioHoraBs;
    const montoHorasExtras = totalHorasExtras * (salarioHoraBs * 1.5);
    const montoDiasDescanso = diasDescansoTrabajados * (calc.salario_diario_normal * 1.5);

    const usaCalculoAsistencia = empAsistencias.length > 0;
    
    // Si hay asistencia, usamos los cálculos reales, si no, usamos el estándar de la quincena (15 días)
    const baseAsignaciones = usaCalculoAsistencia 
        ? (montoHorasRegulares + montoHorasExtras + montoDiasDescanso) 
        : calc.sueldo_periodo;
    
    const diasPagados = usaCalculoAsistencia ? empAsistencias.length : (periodo === 'Q1' ? 15 : (endDay - 15));

    // Generación PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const fechaEmision = new Date().toLocaleString('es-VE');
    
    // --- Header ---
    try {
        const imgProps = doc.getImageProperties(LOGO_URL);
        const imgWidth = 25;
        const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
        // Bajamos el logo y contenido (y=15)
        doc.addImage(LOGO_URL, 'JPEG', 15, 15, imgWidth, imgHeight);
    } catch (e) { console.warn("Logo error", e); }

    doc.setFont("courier", "bold");
    doc.setFontSize(14);
    // Título un poco más abajo
    doc.text("RECIBO DE PAGO DE NÓMINA", pageWidth / 2, 25, { align: "center" });
    
    // Fecha y hora de emisión (Top Right)
    doc.setFontSize(8);
    doc.setFont("courier", "normal");
    doc.text(`Emisión: ${fechaEmision}`, pageWidth - 15, 15, { align: "right" });

    doc.setFontSize(9);
    doc.setFont("courier", "normal");
    
    // Bajamos 3 líneas más aprox. para que no choque con el logo (y=50)
    let y = 50;
    
    // Alineación derecha usando pageWidth - margen
    doc.text(`EMPRESA: ${emp.sucursales?.nombre_id || 'FarmaNomina C.A.'}`, 15, y);
    doc.text(`RIF: ${emp.sucursales?.rif || 'J-12345678-9'}`, pageWidth - 15, y, { align: "right" });
    y += 5;
    
    const direccion = emp.sucursales?.direccion || 'Sede Principal';
    // Dividir texto si es muy largo para no salir del margen
    const splitDireccion = doc.splitTextToSize(`DIR: ${direccion}`, pageWidth - 30);
    doc.text(splitDireccion, 15, y);
    y += (splitDireccion.length * 5); // Ajustar altura dinámica
    
    y += 3;
    doc.text("==========================================================================", 15, y);
    y += 5;

    // Datos Trabajador
    doc.setFont("courier", "bold");
    doc.text(`TRABAJADOR: ${emp.nombre} ${emp.apellido}`, 15, y);
    doc.text(`C.I.: ${emp.cedula}`, pageWidth - 15, y, { align: "right" });
    doc.setFont("courier", "normal");
    y += 5;
    
    doc.text(`Cargo: ${emp.cargo || 'General'}`, 15, y);
    doc.text(`Ingreso: ${emp.fecha_ingreso}`, pageWidth - 15, y, { align: "right" });
    y += 5;
    
    doc.text(`Antigüedad: ${calc.anios_servicio} años`, 15, y);
    doc.text(`Período: ${fechaDesde} al ${fechaHasta} (${periodo})`, pageWidth - 15, y, { align: "right" });
    y += 6;
    
    // SALARIO INTEGRAL (Base de cálculo)
    doc.setFillColor(245, 245, 245);
    doc.rect(15, y, pageWidth - 30, 20, 'F'); // Aumentamos altura de la caja
    y += 4;
    doc.setFont("courier", "bold");
    doc.setFontSize(9);
    doc.text("INFORMACIÓN SALARIAL (BASE DE CÁLCULO PRESTACIONES)", 20, y);
    y += 5;
    
    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    // Distribución horizontal controlada
    doc.text(`Salario Diario: Bs. ${calc.salario_diario_normal.toLocaleString('es-VE', {minimumFractionDigits: 2})}`, 20, y);
    doc.text(`+ Alic. Utilidades: Bs. ${calc.alicuota_utilidades_diaria.toLocaleString('es-VE', {minimumFractionDigits: 2})}`, 80, y);
    doc.text(`+ Alic. Vacaciones: Bs. ${calc.alicuota_vacaciones_diaria.toLocaleString('es-VE', {minimumFractionDigits: 2})}`, 140, y);
    y += 5;
    
    doc.setFont("courier", "bold");
    doc.text(`= SALARIO INTEGRAL DIARIO: Bs. ${calc.salario_diario_integral.toLocaleString('es-VE', {minimumFractionDigits: 2})}`, 20, y);
    y += 10; // Salir de la caja
    
    // Prestaciones Acumuladas
    doc.setFontSize(8);
    doc.setFont("courier", "normal");
    const acumulado = emp.prestaciones_acumuladas_vef || 0;
    doc.text(`GARANTÍA PRESTACIONES ACUMULADA: Bs. ${acumulado.toLocaleString('es-VE', {minimumFractionDigits: 2})}`, pageWidth - 15, y, {align: 'right'});
    y += 5;

    doc.setFontSize(9);
    doc.text("--------------------------------------------------------------------------", 15, y);
    
    // Tabla Conceptos
    y += 5;
    doc.setFont("courier", "bold");
    doc.text("CONCEPTOS", 15, y);
    doc.text("ASIGNACIONES", 145, y, { align: "right" });
    doc.text("DEDUCCIONES", 195, y, { align: "right" }); // Alineado al margen derecho (210-15=195)
    doc.setFont("courier", "normal");
    y += 4;
    doc.text("--------------------------------------------------------------------------", 15, y);
    y += 5;

    const addRow = (concepto: string, asignacion: number | null, deduccion: number | null) => {
        // Truncar concepto si es muy largo
        const conceptoLimpio = concepto.length > 45 ? concepto.substring(0, 42) + '...' : concepto;
        doc.text(conceptoLimpio, 15, y);
        
        if (asignacion !== null) doc.text(`${asignacion.toLocaleString('es-VE', {minimumFractionDigits: 2})}`, 145, y, { align: "right" });
        if (deduccion !== null) doc.text(`${deduccion.toLocaleString('es-VE', {minimumFractionDigits: 2})}`, 195, y, { align: "right" });
        y += 5;
    };

    if (usaCalculoAsistencia) {
        addRow(`Sueldo Normal (${totalHorasRegulares.toFixed(1)} hrs)`, montoHorasRegulares, null);
        if (totalHorasExtras > 0) addRow(`Horas Extras (${totalHorasExtras.toFixed(1)} hrs)`, montoHorasExtras, null);
        if (diasDescansoTrabajados > 0) addRow(`Días Descanso (${diasDescansoTrabajados})`, montoDiasDescanso, null);
    } else {
        const diasStr = periodo === 'Q1' ? '15 Días' : `${diasPagados} Días`;
        addRow(`Sueldo Básico Quincenal (${diasStr})`, calc.sueldo_periodo, null);
    }

    // Deducciones
    addRow("S.S.O (IVSS) - 4%", null, calc.deduccion_ivss);
    addRow("R.P.E (Paro Forzoso) - 0.5%", null, calc.deduccion_spf);
    addRow("F.A.O.V (Vivienda) - 1%", null, calc.deduccion_faov);

    y += 2;
    doc.text("--------------------------------------------------------------------------", 15, y);
    y += 5;

    // Totales
    doc.setFont("courier", "bold");
    doc.text("TOTAL A PAGAR:", 15, y);
    doc.text(`${calc.neto_pagar_vef.toLocaleString('es-VE', {minimumFractionDigits: 2})}`, 145, y, { align: "right" });
    
    y += 8;
    // Cestaticket (Lógica visual: Solo si > 0)
    if (calc.bono_alimentacion_vef > 0) {
        doc.setFontSize(8);
        doc.text("(+) Cestaticket Socialista (No Salarial):", 15, y);
        doc.text(`${calc.bono_alimentacion_vef.toLocaleString('es-VE', {minimumFractionDigits: 2})}`, 145, y, { align: "right" });
    } else if (periodo === 'Q1') {
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text("(*) Cestaticket Socialista: Se paga en 2da Quincena", 15, y);
        doc.setTextColor(0, 0, 0);
    }
    
    // Pie de página
    y += 30;
    doc.setFontSize(9);
    doc.text("Recibí Conforme:", 25, y);
    doc.line(25, y + 10, 85, y + 10);
    doc.text("Firma y Huella del Trabajador", 35, y + 15);

    doc.text("Por la Empresa:", 125, y);
    doc.line(125, y + 10, 185, y + 10);
    
    doc.save(`Recibo_Nomina_${periodo}_${emp.cedula}.pdf`);
  };

  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header y Configuración de Periodo */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
           <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
             <span>💰</span> Procesar Nómina
           </h3>
           <p className="text-sm text-slate-500">Cálculo Quincenal LOTTT</p>
        </div>

        <div className="flex flex-wrap gap-4 items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
           <select 
             className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg p-2.5 outline-none font-bold"
             value={selectedMonth}
             onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
           >
             {meses.map((m, i) => <option key={i} value={i}>{m}</option>)}
           </select>
           
           <input 
             type="number" 
             className="w-20 bg-white border border-slate-200 text-slate-700 text-sm rounded-lg p-2.5 outline-none font-bold"
             value={selectedYear}
             onChange={(e) => setSelectedYear(parseInt(e.target.value))}
           />

           <div className="flex bg-white rounded-lg border border-slate-200 p-1">
             <button 
               onClick={() => setPeriodo('Q1')}
               className={`px-4 py-1.5 rounded-md text-xs font-black uppercase tracking-wide transition-all ${periodo === 'Q1' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-400 hover:text-slate-600'}`}
             >
               1ra Quincena
             </button>
             <button 
               onClick={() => setPeriodo('Q2')}
               className={`px-4 py-1.5 rounded-md text-xs font-black uppercase tracking-wide transition-all ${periodo === 'Q2' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-400 hover:text-slate-600'}`}
             >
               2da Quincena (Cestaticket)
             </button>
           </div>
        </div>
      </div>

      <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-xl flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-emerald-800 uppercase tracking-wide mb-1">Parámetros Económicos</h3>
          <p className="text-xs text-emerald-600 font-medium">
            Tasa BCV: <span className="font-bold">Bs. {config?.tasa_bcv}</span> | 
            Cestaticket: <span className="font-bold">${config?.cestaticket_usd}</span> | 
            Utilidades: <span className="font-bold">{config?.dias_utilidades || 30} días</span>
          </p>
        </div>
        <button 
          onClick={handleUpdateBcv}
          disabled={isUpdatingRate}
          className="bg-white text-emerald-600 border border-emerald-200 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-emerald-100 transition-colors disabled:opacity-50"
        >
          {isUpdatingRate ? '...' : 'Actualizar Tasa'}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loadingData ? (
            <div className="text-center py-20">
               <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent animate-spin rounded-full mx-auto mb-4"></div>
               <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Calculando deducciones y alícuotas...</span>
            </div>
        ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-[#F8F9FB] text-slate-400 uppercase text-[10px] font-black tracking-[0.1em] border-b border-slate-100">
                <tr>
                    <th className="px-6 py-4">Empleado</th>
                    <th className="px-6 py-4 text-center">Salario Integral (Base)</th>
                    <th className="px-6 py-4 text-right">Devengado Quincena</th>
                    <th className="px-6 py-4 text-right">Deducciones</th>
                    <th className="px-6 py-4 text-right text-emerald-600">Neto a Pagar</th>
                    <th className="px-6 py-4 text-center">Recibo</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                {employees.map(emp => {
                    if (!config) return null;
                    // Calcular para la quincena seleccionada (aprox 15 dias)
                    const diasCalculo = periodo === 'Q1' ? 15 : 15; 
                    const calc = calculatePayroll(emp, config, diasCalculo, periodo);

                    return (
                    <tr key={emp.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-4">
                           <div className="font-bold text-slate-800">{emp.nombre} {emp.apellido}</div>
                           <div className="text-[10px] text-slate-400 font-bold uppercase">{emp.cargo}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                           <div className="text-xs font-bold text-slate-600">Bs. {calc.salario_diario_integral.toLocaleString('es-VE', {minimumFractionDigits: 2})}</div>
                           <div className="text-[9px] text-slate-400">Diario Integral</div>
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-medium text-slate-700">
                           Bs. {calc.sueldo_periodo.toLocaleString('es-VE', {minimumFractionDigits: 2})}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-rose-500 text-xs">
                           - {calc.total_deducciones.toLocaleString('es-VE', {minimumFractionDigits: 2})}
                        </td>
                        <td className="px-6 py-4 text-right">
                           <div className="font-black text-emerald-600 text-base">
                             Bs. {calc.neto_pagar_vef.toLocaleString('es-VE', {minimumFractionDigits: 2})}
                           </div>
                           {periodo === 'Q2' && <div className="text-[9px] text-emerald-400 font-bold uppercase tracking-tight">+ Cestaticket</div>}
                        </td>
                        <td className="px-6 py-4 text-center">
                        <button 
                            onClick={() => generatePDF(emp, calc)}
                            className="bg-white border border-slate-200 hover:border-emerald-400 hover:text-emerald-600 text-slate-400 p-2 rounded-xl transition-all shadow-sm active:scale-95"
                            title="Descargar Recibo Legal"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                        </button>
                        </td>
                    </tr>
                    );
                })}
                </tbody>
            </table>
            </div>
        )}
      </div>
    </div>
  );
};

export default PayrollProcessor;
