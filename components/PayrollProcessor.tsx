import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.ts';
import { Empleado, ConfigGlobal, Asistencia, Adelanto, ReceiptPrintConfig } from '../types.ts';
import { calculatePayroll, fetchBcvRate, processAttendanceRecords } from '../services/payrollService.ts';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const LOGO_URL = "https://cfncthqiqabezmemosrz.supabase.co/storage/v1/object/public/expedientes/logos/logo_1770579845203.jpeg";

const defaultReceiptConfig: ReceiptPrintConfig = {
  includeCestaticket: true,
  includeExtraDiurna: true,
  includeExtraNocturna: true,
  includeBonoNocturno: true,
  includeDescansoAsistencia: true,
  includeDescansoFijo: true,
  diasDescansoFijo: 4,
  includeCustomAmount: false,
  customAmountLabel: 'Bono Especial',
  customAmountValue: 0,
  includeIvss: true,
  includeSpf: true,
  includeFaov: true,
  includeAdelantos: true,
};

const toBoolean = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback);
const toNumber = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return fallback;
};
const toText = (value: unknown, fallback: string): string => (typeof value === 'string' ? value : fallback);

const normalizeReceiptPrintConfig = (rawConfig: unknown): ReceiptPrintConfig => {
  const source = rawConfig && typeof rawConfig === 'object' ? (rawConfig as Partial<ReceiptPrintConfig>) : {};

  return {
    includeCestaticket: toBoolean(source.includeCestaticket, defaultReceiptConfig.includeCestaticket),
    includeExtraDiurna: toBoolean(source.includeExtraDiurna, defaultReceiptConfig.includeExtraDiurna),
    includeExtraNocturna: toBoolean(source.includeExtraNocturna, defaultReceiptConfig.includeExtraNocturna),
    includeBonoNocturno: toBoolean(source.includeBonoNocturno, defaultReceiptConfig.includeBonoNocturno),
    includeDescansoAsistencia: toBoolean(source.includeDescansoAsistencia, defaultReceiptConfig.includeDescansoAsistencia),
    includeDescansoFijo: toBoolean(source.includeDescansoFijo, defaultReceiptConfig.includeDescansoFijo),
    diasDescansoFijo: Math.max(0, Math.floor(toNumber(source.diasDescansoFijo, defaultReceiptConfig.diasDescansoFijo))),
    includeCustomAmount: toBoolean(source.includeCustomAmount, defaultReceiptConfig.includeCustomAmount),
    customAmountLabel: toText(source.customAmountLabel, defaultReceiptConfig.customAmountLabel),
    customAmountValue: Math.max(0, toNumber(source.customAmountValue, defaultReceiptConfig.customAmountValue)),
    includeIvss: toBoolean(source.includeIvss, defaultReceiptConfig.includeIvss),
    includeSpf: toBoolean(source.includeSpf, defaultReceiptConfig.includeSpf),
    includeFaov: toBoolean(source.includeFaov, defaultReceiptConfig.includeFaov),
    includeAdelantos: toBoolean(source.includeAdelantos, defaultReceiptConfig.includeAdelantos),
  };
};

const PayrollProcessor: React.FC<{ config: ConfigGlobal | null }> = ({ config }) => {
  const [employees, setEmployees] = useState<Empleado[]>([]);
  const [attendances, setAttendances] = useState<Asistencia[]>([]);
  const [adelantos, setAdelantos] = useState<Adelanto[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  
  // Estados para el Modal de Adelantos
  const [showAdelantoModal, setShowAdelantoModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [loanDetailEmployeeId, setLoanDetailEmployeeId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [adelantoMonto, setAdelantoMonto] = useState('');
  const [adelantoTipo, setAdelantoTipo] = useState<Adelanto['tipo']>('adelanto_nomina');
  const [adelantoCuota, setAdelantoCuota] = useState('');
  const [adelantoMotivo, setAdelantoMotivo] = useState('');
  const [receiptConfig, setReceiptConfig] = useState<ReceiptPrintConfig>(defaultReceiptConfig);
  const [receiptConfigEmployeeId, setReceiptConfigEmployeeId] = useState<string | null>(null);
  const [savingReceiptConfig, setSavingReceiptConfig] = useState(false);

  const [periodo, setPeriodo] = useState<'Q1' | 'Q2'>('Q1');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const currentPayrollPeriodKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${periodo}`;

  useEffect(() => {
    loadData();
  }, [periodo, selectedMonth, selectedYear]);

  useEffect(() => {
    if (!config) {
      setReceiptConfig(defaultReceiptConfig);
      return;
    }
    setReceiptConfig(normalizeReceiptPrintConfig(config.receipt_print_config));
  }, [config]);

  const loadData = async () => {
    setLoadingData(true);
    const startDay = periodo === 'Q1' ? 1 : 16;
    const endDay = periodo === 'Q1' ? 15 : new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const startDate = new Date(selectedYear, selectedMonth, startDay).toISOString().split('T')[0];
    const endDate = new Date(selectedYear, selectedMonth, endDay).toISOString().split('T')[0];

    const { data: empData } = await supabase.from('empleados').select('*, sucursales(*)').eq('activo', true);
    const { data: attData } = await supabase.from('asistencias').select('*').gte('fecha', startDate).lte('fecha', endDate);
    
    // Cargar adelantos pendientes o aprobados en este rango de fecha (o sin fecha de pago aún)
    const { data: adData } = await supabase
        .from('adelantos')
        .select('*')
        .in('estado', ['aprobado', 'pagado']); 
        // Aprobados para descuento actual y pagados para visualización histórica en detalle.

    setEmployees(empData || []);
    setAttendances(attData || []);
    setAdelantos(adData || []);
    setLoadingData(false);
  };

  const handleCreateAdelanto = async () => {
    if (!selectedEmployeeId || !adelantoMonto) return;

    const monto = toNumber(adelantoMonto, 0);
    const cuotaIngresada = toNumber(adelantoCuota, 0);
    const cuotaQuincenal = adelantoTipo === 'prestamo_credito'
      ? Math.min(monto, Math.max(0, cuotaIngresada))
      : monto;

    if (monto <= 0) {
      alert('Ingrese un monto válido.');
      return;
    }

    if (adelantoTipo === 'prestamo_credito' && cuotaQuincenal <= 0) {
      alert('Para préstamo/crédito debe indicar una cuota quincenal mayor a 0.');
      return;
    }

    try {
        const { error } = await supabase.from('adelantos').insert({
            empleado_id: selectedEmployeeId,
            tipo: adelantoTipo,
            monto,
            cuota_quincenal: cuotaQuincenal,
            saldo_pendiente: monto,
            motivo: adelantoMotivo || (adelantoTipo === 'prestamo_credito' ? 'Préstamo / Crédito' : 'Adelanto de Nómina'),
            estado: 'aprobado',
            fecha_solicitud: new Date().toISOString()
        });
        
        if (error) throw error;
        setShowAdelantoModal(false);
        setAdelantoMonto('');
        setAdelantoCuota('');
        setAdelantoTipo('adelanto_nomina');
        setAdelantoMotivo('');
        loadData(); // Recargar para ver el cambio
        alert('Registro guardado correctamente');
    } catch (err) {
        console.error(err);
        alert('Error al registrar adelanto');
    }
  };

  const getAdelantoStatus = (item: Adelanto) => {
    const tipo = item.tipo || 'adelanto_nomina';
    const saldoPendiente = Math.max(0, toNumber(item.saldo_pendiente ?? item.monto, 0));
    const cuotaQuincenal = Math.max(0, toNumber(item.cuota_quincenal ?? item.monto, 0));
    return { tipo, saldoPendiente, cuotaQuincenal };
  };

  const getAdelantosForPeriod = (empleadoId: string, maxAllowed: number) => {
    const aplicados: Array<{ id: string; tipo: 'adelanto_nomina' | 'prestamo_credito'; deducted: number; newSaldo: number }> = [];
    let remaining = Math.max(0, maxAllowed);

    const pendientes = adelantos
      .filter((a) => a.empleado_id === empleadoId && a.estado === 'aprobado')
      .sort((a, b) => new Date(a.fecha_solicitud || 0).getTime() - new Date(b.fecha_solicitud || 0).getTime());

    for (const item of pendientes) {
      if (remaining <= 0) break;
      const { tipo, saldoPendiente, cuotaQuincenal } = getAdelantoStatus(item);
      if (saldoPendiente <= 0) continue;
      if (item.ultimo_periodo_descuento === currentPayrollPeriodKey) continue;

      const solicitado = tipo === 'prestamo_credito' ? cuotaQuincenal : saldoPendiente;
      const descontar = Math.min(solicitado, saldoPendiente, remaining);
      if (descontar <= 0) continue;

      remaining -= descontar;
      const newSaldo = Math.max(0, Number((saldoPendiente - descontar).toFixed(2)));
      aplicados.push({ id: item.id, tipo, deducted: descontar, newSaldo });
    }

    const total = aplicados.reduce((sum, item) => sum + item.deducted, 0);
    return { total, aplicados };
  };

  const getPrestamoSaldoByEmployee = (empleadoId: string) => {
    const prestamosActivos = adelantos.filter((item) => {
      if (item.empleado_id !== empleadoId) return false;
      if (item.estado !== 'aprobado') return false;
      return (item.tipo || 'adelanto_nomina') === 'prestamo_credito';
    });

    const totalSaldoPendiente = prestamosActivos.reduce((sum, item) => {
      const saldo = Math.max(0, toNumber(item.saldo_pendiente ?? item.monto, 0));
      return sum + saldo;
    }, 0);

    return {
      totalSaldoPendiente,
      cantidad: prestamosActivos.length,
    };
  };

  const getPrestamosDetalleByEmployee = (empleadoId: string) =>
    adelantos
      .filter((item) => item.empleado_id === empleadoId && (item.tipo || 'adelanto_nomina') === 'prestamo_credito')
      .sort((a, b) => new Date(b.created_at || b.fecha_solicitud || 0).getTime() - new Date(a.created_at || a.fecha_solicitud || 0).getTime());

  const persistAdelantosApplied = async (aplicados: Array<{ id: string; tipo: 'adelanto_nomina' | 'prestamo_credito'; deducted: number; newSaldo: number }>) => {
    if (aplicados.length === 0) return;

    const deduccionPorId = new Map<string, { deducted: number; newSaldo: number }>();
    for (const item of aplicados) {
      deduccionPorId.set(item.id, item);
    }

    const updates = Array.from(deduccionPorId.entries()).map(([id, item]) =>
      supabase
        .from('adelantos')
        .update({
          saldo_pendiente: item.newSaldo,
          estado: item.newSaldo <= 0 ? 'pagado' : 'aprobado',
          ultimo_periodo_descuento: currentPayrollPeriodKey
        })
        .eq('id', id)
    );

    const results = await Promise.all(updates);
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;
  };

  const handleSaveReceiptConfig = async () => {
    setSavingReceiptConfig(true);
    try {
      if (receiptConfigEmployeeId) {
        const { error } = await supabase
          .from('empleados')
          .update({ receipt_print_config: receiptConfig })
          .eq('id', receiptConfigEmployeeId);

        if (error) throw error;
        setEmployees(prev => prev.map(emp => emp.id === receiptConfigEmployeeId ? { ...emp, receipt_print_config: receiptConfig } : emp));
      } else {
        if (!config?.id) {
          setShowConfigModal(false);
          return;
        }
        const { error } = await supabase
          .from('configuracion_global')
          .update({
            receipt_print_config: receiptConfig,
            updated_at: new Date().toISOString(),
          })
          .eq('id', config.id);

        if (error) throw error;
      }
      
      setShowConfigModal(false);
      alert('Configuración del recibo guardada.');
    } catch (error) {
      console.error(error);
      alert('No se pudo guardar la configuración del recibo.');
    } finally {
      setSavingReceiptConfig(false);
    }
  };

  const getEffectiveReceiptConfig = (emp?: Empleado): ReceiptPrintConfig => {
    if (emp && emp.receipt_print_config && Object.keys(emp.receipt_print_config).length > 0) {
      return normalizeReceiptPrintConfig(emp.receipt_print_config);
    }
    return config?.receipt_print_config ? normalizeReceiptPrintConfig(config.receipt_print_config) : defaultReceiptConfig;
  };

  const getPayrollBreakdown = (emp: Empleado) => {
    if (!config) return null;

    const effectiveConfig = getEffectiveReceiptConfig(emp);

    const empAsistencias = attendances.filter(a => a.empleado_id === emp.id);
    const hoursData = processAttendanceRecords(empAsistencias);
    const usaCalculoAsistencia = hoursData.diasTrabajados > 0;

    const salarioHora = (calculatePayroll(emp, config, 15, periodo, 0)).salario_diario_normal / 8;
    const asignacionesPorAsistencia =
      (hoursData.totalNormal * salarioHora) +
      (hoursData.totalExtraDiurna * salarioHora * 1.5) +
      (hoursData.totalExtraNocturna * salarioHora * 1.5) +
      (hoursData.totalDescanso * salarioHora * 1.5) +
      (hoursData.totalNightHours * salarioHora * 0.30);

    const calc = calculatePayroll(emp, config, 15, periodo, asignacionesPorAsistencia);

    const montoHorasNormales = usaCalculoAsistencia ? (hoursData.totalNormal * salarioHora) : calc.sueldo_periodo;
    const montoExtrasDiurnas = hoursData.totalExtraDiurna * (salarioHora * 1.5);
    const montoExtrasNocturnas = hoursData.totalExtraNocturna * (salarioHora * 1.5);
    const montoBonoNocturno = hoursData.totalNightHours * (salarioHora * 0.30);
    const montoDescansoAsistencia = hoursData.totalDescanso * (salarioHora * 1.5);
    const montoDescansoFijo = effectiveConfig.includeDescansoFijo
      ? calc.salario_diario_normal * Math.max(0, effectiveConfig.diasDescansoFijo || 0)
      : 0;
    const montoCustom = effectiveConfig.includeCustomAmount ? Math.max(0, effectiveConfig.customAmountValue || 0) : 0;
    const montoCestaticket = effectiveConfig.includeCestaticket ? calc.bono_alimentacion_vef : 0;

    const totalAsignaciones =
      montoHorasNormales +
      (effectiveConfig.includeExtraDiurna ? montoExtrasDiurnas : 0) +
      (effectiveConfig.includeExtraNocturna ? montoExtrasNocturnas : 0) +
      (effectiveConfig.includeBonoNocturno ? montoBonoNocturno : 0) +
      (effectiveConfig.includeDescansoAsistencia ? montoDescansoAsistencia : 0) +
      montoDescansoFijo +
      montoCustom +
      montoCestaticket;

    const deduccionIvss = effectiveConfig.includeIvss ? calc.deduccion_ivss : 0;
    const deduccionSpf = effectiveConfig.includeSpf ? calc.deduccion_spf : 0;
    const deduccionFaov = effectiveConfig.includeFaov ? calc.deduccion_faov : 0;
    const maxAdelantosPermitido = Math.max(0, totalAsignaciones - (deduccionIvss + deduccionSpf + deduccionFaov));
    const adelantosCalculados = effectiveConfig.includeAdelantos
      ? getAdelantosForPeriod(emp.id, maxAdelantosPermitido)
      : { total: 0, aplicados: [] as Array<{ id: string; tipo: 'adelanto_nomina' | 'prestamo_credito'; deducted: number; newSaldo: number }> };
    const totalAdelantos = adelantosCalculados.total;
    const totalAdelantoNomina = adelantosCalculados.aplicados
      .filter((item) => item.tipo === 'adelanto_nomina')
      .reduce((sum, item) => sum + item.deducted, 0);
    const totalPrestamoCredito = adelantosCalculados.aplicados
      .filter((item) => item.tipo === 'prestamo_credito')
      .reduce((sum, item) => sum + item.deducted, 0);

    const totalDeducciones = deduccionIvss + deduccionSpf + deduccionFaov + totalAdelantos;
    const neto = totalAsignaciones - totalDeducciones;

    return {
      calc,
      hoursData,
      usaCalculoAsistencia,
      montoHorasNormales,
      montoExtrasDiurnas,
      montoExtrasNocturnas,
      montoBonoNocturno,
      montoDescansoAsistencia,
      montoDescansoFijo,
      montoCustom,
      montoCestaticket,
      deduccionIvss,
      deduccionSpf,
      deduccionFaov,
      adelantosAplicados: adelantosCalculados.aplicados,
      totalAdelantos,
      totalAdelantoNomina,
      totalPrestamoCredito,
      totalAsignaciones,
      totalDeducciones,
      neto,
    };
  };

  const generatePDF = async (emp: Empleado, breakdownInput: ReturnType<typeof getPayrollBreakdown>, doc?: jsPDF) => {
    if (!config) return;
    if (!breakdownInput) return;

    const effectiveConfig = getEffectiveReceiptConfig(emp);

    const isGlobal = !!doc;
    const pdf = doc || new jsPDF();

    const {
      calc,
      hoursData,
      usaCalculoAsistencia,
      montoHorasNormales,
      montoExtrasDiurnas,
      montoExtrasNocturnas,
      montoBonoNocturno,
      montoDescansoAsistencia,
      montoDescansoFijo,
      montoCustom,
      montoCestaticket,
      deduccionIvss,
      deduccionSpf,
      deduccionFaov,
      totalAdelantos,
      totalAdelantoNomina,
      totalPrestamoCredito,
      neto,
    } = breakdownInput;
    const startDay = periodo === 'Q1' ? 1 : 16;
    const endDay = periodo === 'Q1' ? 15 : new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const fechaDesde = `${startDay.toString().padStart(2, '0')}/${(selectedMonth + 1).toString().padStart(2, '0')}/${selectedYear}`;
    const fechaHasta = `${endDay.toString().padStart(2, '0')}/${(selectedMonth + 1).toString().padStart(2, '0')}/${selectedYear}`;

    const pageWidth = pdf.internal.pageSize.width;
    const fechaEmision = new Date().toLocaleString('es-VE');
    
    // --- Header ---
    try {
        const imgWidth = 25;
        // Si tienes el logo en base64 úsalo aquí para evitar problemas de CORS, si no, usa URL pública
        pdf.addImage(LOGO_URL, 'JPEG', 15, 15, imgWidth, 15);
    } catch (e) {}

    pdf.setFont("courier", "bold");
    pdf.setFontSize(14);
    pdf.text("RECIBO DE PAGO DE NÓMINA", pageWidth / 2, 25, { align: "center" });
    
    pdf.setFontSize(8);
    pdf.setFont("courier", "normal");
    pdf.text(`Emisión: ${fechaEmision}`, pageWidth - 15, 15, { align: "right" });

    let y = 50;
    pdf.setFontSize(9);
    pdf.text(`EMPRESA: ${emp.sucursales?.nombre_id || 'FarmaNomina C.A.'}`, 15, y);
    pdf.text(`RIF: ${emp.sucursales?.rif || 'J-12345678-9'}`, pageWidth - 15, y, { align: "right" });
    y += 10;
    
    pdf.setFont("courier", "bold");
    pdf.text(`TRABAJADOR: ${emp.nombre} ${emp.apellido}`, 15, y);
    pdf.text(`C.I.: ${emp.cedula}`, pageWidth - 15, y, { align: "right" });
    y += 5;
    pdf.setFont("courier", "normal");
    pdf.text(`Cargo: ${emp.cargo || 'General'}`, 15, y);
    pdf.text(`Período: ${fechaDesde} al ${fechaHasta}`, pageWidth - 15, y, { align: "right" });
    y += 5;
    pdf.text(`Salario Base Mensual (Bs): ${Number(calc.sueldo_base_mensual).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`, 15, y);
    y += 10;
    
    // Tabla Conceptos
    pdf.setFont("courier", "bold");
    pdf.text("CONCEPTO", 15, y);
    pdf.text("ASIGNACIONES", 145, y, { align: "right" });
    pdf.text("DEDUCCIONES", 195, y, { align: "right" }); 
    y += 5;
    pdf.line(15, y, pageWidth - 15, y);
    y += 5;
    pdf.setFont("courier", "normal");

    const addRow = (concepto: string, asignacion: number | null, deduccion: number | null) => {
        pdf.text(concepto.substring(0, 45), 15, y);
        if (asignacion !== null) pdf.text(`${asignacion.toLocaleString('es-VE', {minimumFractionDigits: 2})}`, 145, y, { align: "right" });
        if (deduccion !== null) pdf.text(`${deduccion.toLocaleString('es-VE', {minimumFractionDigits: 2})}`, 195, y, { align: "right" });
        y += 5;
    };

    if (usaCalculoAsistencia) {
        addRow(`Sueldo Normal (${hoursData.diasTrabajados} Días / ${hoursData.totalNormal.toFixed(1)} hrs)`, montoHorasNormales, null);
        if (effectiveConfig.includeExtraDiurna && montoExtrasDiurnas > 0) addRow(`Asignación Extra Diurna (1.5x)`, montoExtrasDiurnas, null);
        if (effectiveConfig.includeExtraNocturna && montoExtrasNocturnas > 0) addRow(`Asignación Extra Nocturna (1.5x)`, montoExtrasNocturnas, null);
        if (effectiveConfig.includeBonoNocturno && montoBonoNocturno > 0) {
            const etiqueta = hoursData.totalNightHours > (hoursData.diasTrabajados * 4) ? "Bono Nocturno (Jornada Nocturna Art.173)" : "Bono Nocturno (Horas Nocturnas)";
            addRow(`${etiqueta} (${hoursData.totalNightHours.toFixed(1)} hrs)`, montoBonoNocturno, null);
        }
        if (effectiveConfig.includeDescansoAsistencia && montoDescansoAsistencia > 0) addRow(`Días de Descanso / Feriados`, montoDescansoAsistencia, null);
    } else {
        addRow(`Sueldo Básico Quincenal`, calc.sueldo_periodo, null);
    }

    if (effectiveConfig.includeDescansoFijo && montoDescansoFijo > 0) {
        addRow(`Días de Descanso Fijos (${effectiveConfig.diasDescansoFijo} días)`, montoDescansoFijo, null);
    }

    if (effectiveConfig.includeCustomAmount && montoCustom > 0) {
        addRow(effectiveConfig.customAmountLabel || 'Monto Adicional', montoCustom, null);
    }

    if (effectiveConfig.includeCestaticket && montoCestaticket > 0) {
         addRow(`Cestaticket Socialista`, montoCestaticket, null);
    }

    if (effectiveConfig.includeIvss) addRow("IVSS (S.S.O) 4%", null, deduccionIvss);
    if (effectiveConfig.includeSpf) addRow("R.P.E (Paro Forzoso) 0.5%", null, deduccionSpf);
    if (effectiveConfig.includeFaov) addRow("F.A.O.V 1%", null, deduccionFaov);

    if (effectiveConfig.includeAdelantos && totalAdelantos > 0) {
        if (totalAdelantoNomina > 0) addRow("Adelanto de Nómina", null, totalAdelantoNomina);
        if (totalPrestamoCredito > 0) addRow("Préstamo / Crédito", null, totalPrestamoCredito);
    }

    y += 5;
    pdf.line(15, y, pageWidth - 15, y);
    y += 5;
    pdf.setFont("courier", "bold");
    pdf.text("TOTAL NETO A RECIBIR (Bs.):", 15, y);
    pdf.text(`${neto.toLocaleString('es-VE', {minimumFractionDigits: 2})}`, 145, y, { align: "right" });
    
    // Footer firmas
    y = pageWidth - 50; // Al final de la página (casi)
    if (y < 200) y = 220; // Asegurar espacio

    pdf.line(20, y, 90, y);
    pdf.text("Firma Trabajador", 35, y + 5);
    
    pdf.line(120, y, 190, y);
    pdf.text("Firma Empleador", 135, y + 5);


    if (!isGlobal) {
        pdf.save(`Recibo_${emp.cedula}_${periodo}.pdf`);
    }
  };

  const generateGlobalPDF = async () => {
    if (!config) return;
    const doc = new jsPDF();
    let isFirstPage = true;
    const adelantosAplicadosGlobal: Array<{ id: string; tipo: 'adelanto_nomina' | 'prestamo_credito'; deducted: number; newSaldo: number }> = [];

    for (const emp of employees) {
        if (!isFirstPage) {
            doc.addPage();
        }

        const breakdown = getPayrollBreakdown(emp);
        if (!breakdown) continue;
        await generatePDF(emp, breakdown, doc);
        adelantosAplicadosGlobal.push(...breakdown.adelantosAplicados);
        isFirstPage = false;
    }

    doc.save(`Nomina_Global_${meses[selectedMonth]}_${selectedYear}_${periodo}.pdf`);
  };

  const handleCerrarQuincena = async () => {
    if (!config) return;
    
    if (!window.confirm(`¿Está seguro de cerrar la quincena (${periodo} de ${meses[selectedMonth]} ${selectedYear})? Esto descontará automáticamente las cuotas de los préstamos y adelantos pendientes. ¡Asegúrese de haber generado los recibos antes!`)) {
      return;
    }

    const adelantosAplicadosGlobal: Array<{ id: string; tipo: 'adelanto_nomina' | 'prestamo_credito'; deducted: number; newSaldo: number }> = [];

    for (const emp of employees) {
        const breakdown = getPayrollBreakdown(emp);
        if (!breakdown) continue;
        adelantosAplicadosGlobal.push(...breakdown.adelantosAplicados);
    }

    if (adelantosAplicadosGlobal.length === 0) {
      alert('No hay adelantos o préstamos pendientes por descontar en este período.');
      return;
    }

    try {
      await persistAdelantosApplied(adelantosAplicadosGlobal);
      await loadData();
      alert('Quincena cerrada exitosamente. Los saldos de los préstamos han sido actualizados.');
    } catch (error) {
      console.error(error);
      alert('Hubo un error actualizando los saldos de adelantos.');
    }
  };

  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const loanDetailEmployee = loanDetailEmployeeId ? employees.find((e) => e.id === loanDetailEmployeeId) : null;
  const loanDetailItems = loanDetailEmployeeId ? getPrestamosDetalleByEmployee(loanDetailEmployeeId) : [];

  return (
    <div className="p-8 space-y-6">
      
      {/* Modal Adelantos */}
      {showAdelantoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
            <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl">
                <h3 className="text-xl font-black text-slate-800 mb-4">Registrar Adelanto / Préstamo</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo</label>
                        <select
                          className="w-full p-3 border rounded-xl font-semibold"
                          value={adelantoTipo}
                          onChange={e => setAdelantoTipo(e.target.value as Adelanto['tipo'])}
                        >
                          <option value="adelanto_nomina">Adelanto de Nómina</option>
                          <option value="prestamo_credito">Préstamo / Crédito</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monto (Bs.)</label>
                        <input type="number" className="w-full p-3 border rounded-xl font-bold text-lg" value={adelantoMonto} onChange={e => setAdelantoMonto(e.target.value)} autoFocus />
                    </div>
                    {adelantoTipo === 'prestamo_credito' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cuota Quincenal (Bs.)</label>
                        <input
                          type="number"
                          className="w-full p-3 border rounded-xl font-bold text-lg"
                          value={adelantoCuota}
                          onChange={e => setAdelantoCuota(e.target.value)}
                        />
                      </div>
                    )}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Motivo</label>
                        <input
                          type="text"
                          className="w-full p-3 border rounded-xl"
                          value={adelantoMotivo}
                          onChange={e => setAdelantoMotivo(e.target.value)}
                          placeholder={adelantoTipo === 'prestamo_credito' ? 'Ej: Préstamo escolar' : 'Ej: Emergencia médica'}
                        />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button
                          onClick={() => {
                            setShowAdelantoModal(false);
                            setAdelantoMonto('');
                            setAdelantoTipo('adelanto_nomina');
                            setAdelantoCuota('');
                            setAdelantoMotivo('');
                          }}
                          className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 rounded-xl hover:bg-slate-200"
                        >
                          Cancelar
                        </button>
                        <button onClick={handleCreateAdelanto} className="flex-1 py-3 text-white font-bold bg-emerald-600 rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-600/20">Guardar</button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Modal Detalle de Préstamos */}
      {loanDetailEmployeeId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200 p-4">
          <div className="bg-white p-8 rounded-3xl w-full max-w-4xl shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-800">Detalle de Préstamos / Créditos</h3>
                <p className="text-xs font-semibold text-slate-500 mt-1">
                  {loanDetailEmployee ? `${loanDetailEmployee.nombre} ${loanDetailEmployee.apellido}` : 'Empleado'}
                </p>
              </div>
              <button
                onClick={() => setLoanDetailEmployeeId(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {loanDetailItems.length === 0 ? (
              <div className="py-12 text-center text-sm font-semibold text-slate-400">
                No hay préstamos/créditos registrados para este empleado.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b">
                    <tr>
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3 text-right">Monto Original</th>
                      <th className="px-4 py-3 text-right">Cuota Quincenal</th>
                      <th className="px-4 py-3 text-right">Saldo Pendiente</th>
                      <th className="px-4 py-3 text-center">Estado</th>
                      <th className="px-4 py-3 text-center">Último Período</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {loanDetailItems.map((item) => {
                      const saldo = Math.max(0, toNumber(item.saldo_pendiente ?? item.monto, 0));
                      const cuota = Math.max(0, toNumber(item.cuota_quincenal ?? item.monto, 0));
                      const monto = Math.max(0, toNumber(item.monto, 0));
                      const fecha = item.fecha_solicitud
                        ? new Date(`${item.fecha_solicitud}T00:00:00`).toLocaleDateString('es-VE')
                        : '-';

                      return (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-semibold text-slate-700">{fecha}</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-700">Bs. {monto.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-700">Bs. {cuota.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                          <td className={`px-4 py-3 text-right font-black ${saldo > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            Bs. {saldo.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${item.estado === 'pagado' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {item.estado || 'aprobado'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-xs font-semibold text-slate-500">{item.ultimo_periodo_descuento || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Configuración de Recibo */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200 p-4">
          <div className="bg-white p-8 rounded-3xl w-full max-w-3xl shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-slate-800">
                {receiptConfigEmployeeId ? `Configurar Recibo (${employees.find(e => e.id === receiptConfigEmployeeId)?.nombre} ${employees.find(e => e.id === receiptConfigEmployeeId)?.apellido})` : 'Configurar Recibo Global'}
              </h3>
              <button onClick={() => setShowConfigModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 border rounded-xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Asignaciones</p>
                <div className="space-y-3 text-sm font-semibold text-slate-700">
                  <label className="flex items-center justify-between"><span>Mostrar Cestaticket</span><input type="checkbox" checked={receiptConfig.includeCestaticket} onChange={e => setReceiptConfig(prev => ({ ...prev, includeCestaticket: e.target.checked }))} /></label>
                  <label className="flex items-center justify-between"><span>Asignación Extra Diurna</span><input type="checkbox" checked={receiptConfig.includeExtraDiurna} onChange={e => setReceiptConfig(prev => ({ ...prev, includeExtraDiurna: e.target.checked }))} /></label>
                  <label className="flex items-center justify-between"><span>Asignación Extra Nocturna</span><input type="checkbox" checked={receiptConfig.includeExtraNocturna} onChange={e => setReceiptConfig(prev => ({ ...prev, includeExtraNocturna: e.target.checked }))} /></label>
                  <label className="flex items-center justify-between"><span>Bono Nocturno</span><input type="checkbox" checked={receiptConfig.includeBonoNocturno} onChange={e => setReceiptConfig(prev => ({ ...prev, includeBonoNocturno: e.target.checked }))} /></label>
                  <label className="flex items-center justify-between"><span>Descanso por Asistencia</span><input type="checkbox" checked={receiptConfig.includeDescansoAsistencia} onChange={e => setReceiptConfig(prev => ({ ...prev, includeDescansoAsistencia: e.target.checked }))} /></label>
                </div>
              </div>

              <div className="p-4 border rounded-xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Deducciones</p>
                <div className="space-y-3 text-sm font-semibold text-slate-700">
                  <label className="flex items-center justify-between"><span>IVSS</span><input type="checkbox" checked={receiptConfig.includeIvss} onChange={e => setReceiptConfig(prev => ({ ...prev, includeIvss: e.target.checked }))} /></label>
                  <label className="flex items-center justify-between"><span>SPF</span><input type="checkbox" checked={receiptConfig.includeSpf} onChange={e => setReceiptConfig(prev => ({ ...prev, includeSpf: e.target.checked }))} /></label>
                  <label className="flex items-center justify-between"><span>FAOV</span><input type="checkbox" checked={receiptConfig.includeFaov} onChange={e => setReceiptConfig(prev => ({ ...prev, includeFaov: e.target.checked }))} /></label>
                  <label className="flex items-center justify-between"><span>Adelantos</span><input type="checkbox" checked={receiptConfig.includeAdelantos} onChange={e => setReceiptConfig(prev => ({ ...prev, includeAdelantos: e.target.checked }))} /></label>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 border rounded-xl space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Descanso y Monto Adicional</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center justify-between text-sm font-semibold text-slate-700">
                  <span>Incluir Días de Descanso Fijos</span>
                  <input type="checkbox" checked={receiptConfig.includeDescansoFijo} onChange={e => setReceiptConfig(prev => ({ ...prev, includeDescansoFijo: e.target.checked }))} />
                </label>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Cantidad de Días (ej: 4)</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full p-3 border rounded-xl font-bold"
                    value={receiptConfig.diasDescansoFijo}
                    onChange={e =>
                      setReceiptConfig(prev => ({
                        ...prev,
                        diasDescansoFijo: Math.max(0, Math.floor(toNumber(e.target.value, 0)))
                      }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="flex items-center justify-between text-sm font-semibold text-slate-700">
                  <span>Agregar Monto Extra</span>
                  <input type="checkbox" checked={receiptConfig.includeCustomAmount} onChange={e => setReceiptConfig(prev => ({ ...prev, includeCustomAmount: e.target.checked }))} />
                </label>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Etiqueta</label>
                  <input
                    type="text"
                    className="w-full p-3 border rounded-xl font-semibold"
                    value={receiptConfig.customAmountLabel}
                    onChange={e => setReceiptConfig(prev => ({ ...prev, customAmountLabel: e.target.value }))}
                    placeholder="Ej: Bono productividad"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Monto (Bs.)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-full p-3 border rounded-xl font-bold"
                    value={receiptConfig.customAmountValue}
                    onChange={e =>
                      setReceiptConfig(prev => ({
                        ...prev,
                        customAmountValue: Math.max(0, toNumber(e.target.value, 0))
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setReceiptConfig(defaultReceiptConfig)} className="px-5 py-3 bg-slate-100 rounded-xl text-slate-700 font-bold">Restablecer</button>
              <button
                onClick={handleSaveReceiptConfig}
                disabled={savingReceiptConfig}
                className="px-5 py-3 bg-emerald-600 rounded-xl text-white font-bold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {savingReceiptConfig ? 'Guardando...' : 'Guardar Configuración'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center">
        <div>
           <h3 className="text-xl font-bold text-slate-800">Cálculo de Nómina Detallado</h3>
           <p className="text-xs text-slate-500 uppercase font-black tracking-widest mt-1">Soporte Jornada Nocturna & Mixta</p>
        </div>
        <div className="flex gap-4 items-center bg-slate-50 p-2 rounded-xl">
           <select className="bg-white border p-2 rounded-lg text-sm font-bold" value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}>
             {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
           </select>
           <select className="bg-white border p-2 rounded-lg text-sm font-bold" value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))}>
             {meses.map((m, i) => <option key={i} value={i}>{m}</option>)}
           </select>
           <button onClick={() => setPeriodo(periodo === 'Q1' ? 'Q2' : 'Q1')} className="bg-[#1E1E2D] text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase">
             {periodo === 'Q1' ? '1ra Quincena' : '2da Quincena'}
           </button>
           <button onClick={() => {
              setReceiptConfigEmployeeId(null);
              setReceiptConfig(config?.receipt_print_config ? normalizeReceiptPrintConfig(config.receipt_print_config) : defaultReceiptConfig);
              setShowConfigModal(true);
           }} className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-slate-100 transition-colors flex items-center gap-1">
              <span>⚙️</span> Configurar
           </button>
            <button onClick={generateGlobalPDF} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-slate-700 transition-colors shadow-lg shadow-slate-800/20 flex items-center gap-1">
                <span>📄</span> Recibo Global
            </button>
            <button onClick={handleCerrarQuincena} className="bg-emerald-500 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20 flex items-center gap-1">
                <span>✅</span> Cerrar Quincena
            </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b">
            <tr>
              <th className="px-6 py-4">Empleado</th>
              <th className="px-6 py-4 text-center">Saldo Préstamos</th>
              <th className="px-6 py-4 text-center">Asignaciones</th>
              <th className="px-6 py-4 text-center">Deducciones</th>
              <th className="px-6 py-4 text-right">Neto a Pagar</th>
              <th className="px-6 py-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {employees.map(emp => {
                if (!config) return null;
                const breakdown = getPayrollBreakdown(emp);
                const prestamosData = getPrestamoSaldoByEmployee(emp.id);
                if (!breakdown) return null;

                return (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                        <div className="font-bold text-slate-700">{emp.nombre} {emp.apellido}</div>
                        <div className="text-xs text-slate-400">{emp.cedula}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => setLoanDetailEmployeeId(emp.id)}
                          className="w-full rounded-xl p-2 hover:bg-slate-50 transition-colors"
                          title="Ver detalle de préstamos"
                        >
                          <div className={`font-black ${prestamosData.totalSaldoPendiente > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                            Bs. {prestamosData.totalSaldoPendiente.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                          </div>
                          {prestamosData.cantidad > 0 ? (
                            <span className="block text-[10px] text-amber-500">{prestamosData.cantidad} préstamo(s) activo(s)</span>
                          ) : (
                            <span className="block text-[10px] text-slate-300">Sin préstamos</span>
                          )}
                        </button>
                    </td>
                    <td className="px-6 py-4 text-center font-medium text-emerald-600">
                        + {breakdown.totalAsignaciones.toLocaleString('es-VE', {minimumFractionDigits: 2})}
                    </td>
                    <td className="px-6 py-4 text-center text-rose-500 font-medium">
                        - {breakdown.totalDeducciones.toLocaleString('es-VE', {minimumFractionDigits: 2})}
                        {breakdown.totalAdelantos > 0 && (
                            <span className="block text-[10px] text-rose-400">(Inc. {breakdown.totalAdelantos.toLocaleString('es-VE')} adelanto/préstamo)</span>
                        )}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-black text-emerald-700 text-base">Bs. {breakdown.neto.toLocaleString('es-VE', {minimumFractionDigits: 2})}</td>
                    <td className="px-6 py-4 text-center flex justify-center gap-2">
                      <button 
                        onClick={() => {
                          setSelectedEmployeeId(emp.id);
                          setAdelantoTipo('adelanto_nomina');
                          setAdelantoMonto('');
                          setAdelantoCuota('');
                          setAdelantoMotivo('');
                          setShowAdelantoModal(true);
                        }}
                        className="p-2 bg-slate-100 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-all tooltip"
                        title="Registrar Adelanto"
                      >
                        💸
                      </button>
                      <button
                        onClick={() => {
                          setReceiptConfigEmployeeId(emp.id);
                          setReceiptConfig(getEffectiveReceiptConfig(emp));
                          setShowConfigModal(true);
                        }}
                        className="p-2 bg-slate-100 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-all tooltip"
                        title="Configurar Recibo Individual"
                      >
                        ⚙️
                      </button>
                      <button 
                        onClick={() => generatePDF(emp, breakdown)} 
                        className="p-2 bg-emerald-100 rounded-lg text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                        title="Descargar Recibo"
                      >
                        📄
                      </button>
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
