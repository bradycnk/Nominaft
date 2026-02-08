
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

  useEffect(() => {
    const loadData = async () => {
      setLoadingData(true);
      // Cargar Empleados
      const { data: empData } = await supabase
        .from('empleados')
        .select('*, sucursales(id, nombre_id, rif, direccion, es_principal)')
        .eq('activo', true);
      
      // Cargar Asistencias del Mes Actual
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString();
      
      const { data: attData } = await supabase
        .from('asistencias')
        .select('*')
        .gte('fecha', startOfMonth)
        .lte('fecha', endOfMonth);

      setEmployees(empData || []);
      setAttendances(attData || []);
      setLoadingData(false);
    };
    loadData();
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

  const generatePDF = async (emp: Empleado, calc: any) => {
    if (!config) return;

    // 1. Procesar Asistencia para el Recibo
    const empAsistencias = attendances.filter(a => a.empleado_id === emp.id && a.estado === 'presente');
    
    let totalHorasRegulares = 0;
    let totalHorasExtras = 0; // Simulamos > 8 horas
    let diasDescansoTrabajados = 0; // Sábados y Domingos

    empAsistencias.forEach(att => {
        const horasDia = calculateWorkedHours(att.hora_entrada, att.hora_salida);
        const esFinDeSemana = isWeekend(att.fecha);

        if (esFinDeSemana) {
            diasDescansoTrabajados += 1; // Cuenta como día trabajado en descanso
            totalHorasRegulares += horasDia; // Sumamos al total de horas también
        } else {
            if (horasDia > 8) {
                totalHorasRegulares += 8;
                totalHorasExtras += (horasDia - 8);
            } else {
                totalHorasRegulares += horasDia;
            }
        }
    });

    // Cálculos Monetarios basados en Asistencia Real (Aprox para el recibo)
    const salarioDiarioBs = emp.salario_base_vef / 30;
    const salarioHoraBs = salarioDiarioBs / 8;
    
    const montoHorasRegulares = totalHorasRegulares * salarioHoraBs;
    const montoHorasExtras = totalHorasExtras * (salarioHoraBs * 1.5); // 50% Recargo LOTTT
    const montoDiasDescanso = diasDescansoTrabajados * (salarioDiarioBs * 1.5); // 50% Recargo día descanso trabajado

    // Ajuste: Si no hay asistencia registrada, usamos el cálculo base mensual (calc) por defecto
    // para no generar recibos en cero si no se ha usado el modulo de asistencia aun.
    const usaCalculoAsistencia = empAsistencias.length > 0;
    
    const baseAsignaciones = usaCalculoAsistencia ? (montoHorasRegulares + montoHorasExtras + montoDiasDescanso) : calc.sueldo_base_vef;

    // Recálculo de deducciones basado en el total devengado real
    const ivssReal = baseAsignaciones * 0.04;
    const faovReal = baseAsignaciones * 0.01;
    const spfReal = baseAsignaciones * 0.005;
    const totalDeduccionesReal = ivssReal + faovReal + spfReal;
    const netoPagarReal = baseAsignaciones + calc.bono_alimentacion_vef - totalDeduccionesReal;


    // 2. Generación del PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    // --- Header con Logo ---
    try {
        const imgProps = doc.getImageProperties(LOGO_URL);
        const imgWidth = 30;
        const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
        // Logo en su posición original (parte superior izquierda)
        doc.addImage(LOGO_URL, 'JPEG', 15, 10, imgWidth, imgHeight);
    } catch (e) {
        console.warn("No se pudo cargar el logo", e);
    }

    // Datos Empresa
    doc.setFont("courier", "bold");
    doc.setFontSize(14);
    // Título centrado arriba
    doc.text("RECIBO DE PAGO DE NÓMINA", pageWidth / 2, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont("courier", "normal");
    
    // Desplazamos todo el bloque de texto hacia abajo (Y += 20) para que empiece DEBAJO del logo
    doc.text("==========================================================================", 15, 50);
    
    doc.text(`EMPRESA: ${emp.sucursales?.nombre_id || 'FarmaNomina C.A.'}`, 15, 55);
    doc.text(`RIF: ${emp.sucursales?.rif || 'J-12345678-9'}`, 140, 55);
    
    // Truncar dirección para evitar desbordamiento
    const direccion = emp.sucursales?.direccion || 'Sede Principal';
    const direccionTruncada = direccion.length > 60 ? direccion.substring(0, 60) + '...' : direccion;
    doc.text(`DIRECCIÓN: ${direccionTruncada}`, 15, 60);
    
    doc.text("==========================================================================", 15, 65);

    // Datos del Trabajador
    doc.text("DATOS DEL TRABAJADOR", 15, 70);
    doc.text(`Nombre: ${emp.nombre} ${emp.apellido}`, 15, 75);
    doc.text(`Cargo: ${emp.cargo || 'General'}`, 15, 80);
    
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString('es-VE');
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toLocaleDateString('es-VE');
    
    doc.text(`Período de Pago: Mensual`, 15, 85);
    doc.text(`Salario Base Diario: Bs. ${salarioDiarioBs.toLocaleString('es-VE', {minimumFractionDigits: 2})}`, 15, 90);

    // Columna Derecha de Datos Trabajador
    doc.text(`C.I.: ${emp.cedula}`, 115, 75);
    doc.text(`Fecha Ingreso: ${emp.fecha_ingreso}`, 115, 80);
    doc.text(`Desde: ${firstDay}  Hasta: ${lastDay}`, 115, 85);
    doc.text(`Salario Base Hora: Bs. ${salarioHoraBs.toLocaleString('es-VE', {minimumFractionDigits: 2})}`, 115, 90);

    doc.text("--------------------------------------------------------------------------", 15, 95);

    // Tabla de Conceptos
    // Iniciamos más abajo
    let y = 102; 
    doc.setFont("courier", "bold");
    
    doc.text("CONCEPTOS", 15, y);
    doc.text("CANTIDAD", 125, y, { align: "right" });
    doc.text("ASIGNACIONES", 160, y, { align: "right" });
    doc.text("DEDUCCIONES", 195, y, { align: "right" });
    doc.setFont("courier", "normal");
    
    y += 4;
    doc.text("--------------------------------------------------------------------------", 15, y);
    y += 5;

    // Filas de Asignaciones
    const addRow = (concepto: string, cantidad: string, asignacion: number | null, deduccion: number | null) => {
        doc.text(concepto, 15, y);
        if (cantidad) doc.text(cantidad, 125, y, { align: "right" });
        if (asignacion !== null) doc.text(`${asignacion.toLocaleString('es-VE', {minimumFractionDigits: 2})} Bs`, 160, y, { align: "right" });
        if (deduccion !== null) doc.text(`${deduccion.toLocaleString('es-VE', {minimumFractionDigits: 2})} Bs`, 195, y, { align: "right" });
        y += 5;
    };

    if (usaCalculoAsistencia) {
        addRow("(+) Salario Básico (L-V)", `${totalHorasRegulares.toFixed(1)} Horas`, montoHorasRegulares, null);
        if (totalHorasExtras > 0) addRow("(+) Horas Extras Diurnas", `${totalHorasExtras.toFixed(1)} Horas`, montoHorasExtras, null);
        if (diasDescansoTrabajados > 0) addRow("(+) Días Descanso Trabajados", `${diasDescansoTrabajados} Días`, montoDiasDescanso, null);
    } else {
        addRow("(+) Salario Básico Mensual", "30 Días", calc.sueldo_base_vef, null);
    }

    y += 2;
    
    // Filas de Deducciones
    addRow("(-) S.S.O (IVSS) - 4%", "-------", null, ivssReal);
    addRow("(-) R.P.E (Paro Forzoso) - 0.5%", "-------", null, spfReal);
    addRow("(-) F.A.O.V (Vivienda) - 1%", "-------", null, faovReal);

    y += 4;
    doc.text("--------------------------------------------------------------------------", 15, y);
    y += 5;

    // Subtotales
    doc.setFont("courier", "bold");
    doc.text("SUB-TOTALES:", 15, y);
    doc.text(`${baseAsignaciones.toLocaleString('es-VE', {minimumFractionDigits: 2})} Bs`, 160, y, { align: "right" });
    doc.text(`${totalDeduccionesReal.toLocaleString('es-VE', {minimumFractionDigits: 2})} Bs`, 195, y, { align: "right" });
    
    y += 5;
    doc.text("==========================================================================", 15, y);
    y += 6;
    
    // Neto a Pagar
    doc.setFontSize(12);
    doc.text("NETO A PAGAR:", 15, y);
    doc.text(`${netoPagarReal.toLocaleString('es-VE', {minimumFractionDigits: 2})} Bs.`, 195, y, { align: "right" });
    doc.setFontSize(10);
    
    y += 6;
    doc.text("==========================================================================", 15, y);
    y += 6;

    // Cestaticket (No Salarial)
    doc.text("(+) Cestaticket Socialista", 15, y);
    doc.text("(No Salarial)", 105, y, { align: "center" }); 
    doc.text(`${calc.bono_alimentacion_vef.toLocaleString('es-VE', {minimumFractionDigits: 2})} Bs.`, 195, y, { align: "right" });

    y += 6;
    doc.text("==========================================================================", 15, y);

    // Pie de página
    y += 20;
    doc.text("He recibido a mi entera satisfacción el monto neto a pagar...", 15, y);
    
    y += 25;
    doc.line(20, y, 90, y); // Línea Trabajador
    doc.line(120, y, 190, y); // Línea Patrono
    
    y += 5;
    doc.text("Firma del Trabajador", 55, y, { align: "center" });
    doc.text("Firma del Patrono", 155, y, { align: "center" });
    
    y += 5;
    doc.text("Huella Dactilar", 55, y, { align: "center" });

    doc.save(`Recibo_LOTTT_${emp.cedula}.pdf`);
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
        
        {loadingData ? (
            <div className="text-center py-10 text-slate-400 font-bold uppercase tracking-widest text-xs">Cargando datos de empleados y asistencia...</div>
        ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                    <th className="px-4 py-3">Empleado</th>
                    <th className="px-4 py-3 text-center">Ref ($)</th>
                    <th className="px-4 py-3">Base (VEF)</th>
                    <th className="px-4 py-3">Asistencia</th>
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
                    const records = attendances.filter(a => a.empleado_id === emp.id).length;

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
                        <td className="px-4 py-3">
                           {records > 0 ? (
                               <span className="text-emerald-600 font-black text-xs bg-emerald-100 px-2 py-1 rounded">{records} días reg.</span>
                           ) : (
                               <span className="text-amber-500 font-black text-xs bg-amber-100 px-2 py-1 rounded">Sin Data</span>
                           )}
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
                            className="p-2 hover:bg-emerald-50 text-slate-300 hover:text-emerald-600 rounded-lg transition-all flex flex-col items-center gap-1"
                            title="Descargar Recibo LOTTT"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-[8px] font-black uppercase">Recibo</span>
                        </button>
                        </td>
                    </tr>
                    );
                })}
                </tbody>
            </table>
            </div>
        )}
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
