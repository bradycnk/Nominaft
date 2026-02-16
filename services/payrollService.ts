
import { ConfigGlobal, Empleado, Asistencia } from '../types.ts';

// Constantes Legales LOTTT
const TOPE_IVSS_SALARIOS_MINIMOS = 5;
const TOPE_SPF_SALARIOS_MINIMOS = 10; 

const LIMIT_DIURNAL = 8.0;
const LIMIT_MIXED = 7.5;
const LIMIT_NOCTURNAL = 7.0;

const NIGHT_START = 19.0; // 7:00 PM
const NIGHT_END = 5.0;   // 5:00 AM (Día siguiente)

/**
 * Convierte formato HH:MM a decimal (Ej: "08:30" -> 8.5)
 */
export const timeToDecimal = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h + (m / 60);
};

/**
 * Determina el solapamiento entre dos rangos de tiempo
 */
const getOverlap = (start1: number, end1: number, start2: number, end2: number) => {
  return Math.max(0, Math.min(end1, end2) - Math.max(start1, start2));
};

/**
 * Analiza un turno individual según LOTTT Art. 173 y 117.
 * detecta automáticamente si es Diurna, Mixta o Nocturna.
 */
export const calculateDetailedShift = (entrada: string, salida: string, fecha: string) => {
  if (!entrada || !salida) return { normal: 0, extraDiurna: 0, extraNocturna: 0, descanso: 0, nightHours: 0, shiftType: 'Diurna' };

  let start = timeToDecimal(entrada);
  let end = timeToDecimal(salida);
  
  // Manejo de turno que cruza medianoche (Ej: 22:00 a 06:00)
  if (end < start) end += 24; 

  const duration = end - start;
  const dateObj = new Date(fecha);
  const day = dateObj.getDay(); // 0 Dom, 6 Sab
  const isWeekend = day === 0 || day === 6;

  // 1. Calcular horas físicas nocturnas reales (entre 19:00 y 05:00)
  // Bloque A: 19:00 a 24:00 (Mismo día)
  const nightPhys1 = getOverlap(start, end, 19, 24);
  // Bloque B: 24:00 a 29:00 (00:00 a 05:00 día siguiente)
  const nightPhys2 = getOverlap(start, end, 24, 29);
  // Bloque C: 00:00 a 05:00 (Mismo día, si entró muy temprano)
  const nightPhys3 = getOverlap(start, end, 0, 5);

  const realNightHours = nightPhys1 + nightPhys2 + nightPhys3;

  // 2. Determinar tipo de Jornada (Art 173 LOTTT)
  let shiftType: 'Diurna' | 'Mixta' | 'Nocturna' = 'Diurna';
  let dailyLimit = LIMIT_DIURNAL;
  let paidNightHours = realNightHours;

  if (realNightHours > 4 || (start >= 19 && end <= 29)) {
    // Si labora más de 4 horas de noche, toda la jornada se considera Nocturna
    shiftType = 'Nocturna';
    dailyLimit = LIMIT_NOCTURNAL;
    paidNightHours = duration; // El bono nocturno aplica a TODA la jornada
  } else if (realNightHours > 0) {
    shiftType = 'Mixta';
    dailyLimit = LIMIT_MIXED;
    paidNightHours = realNightHours;
  }

  // 3. Caso especial Domingo/Descanso
  if (isWeekend) {
    return { normal: 0, extraDiurna: 0, extraNocturna: 0, descanso: duration, nightHours: paidNightHours, shiftType };
  }

  // 4. Desglose Normal vs Extra según el límite de su tipo de jornada
  let normal = 0;
  let extraDiurna = 0;
  let extraNocturna = 0;

  if (duration <= dailyLimit) {
    normal = duration;
  } else {
    normal = dailyLimit;
    const extraDuration = duration - dailyLimit;
    
    // Las extras se calculan basándose en cuándo ocurren
    const extraStart = start + dailyLimit;
    const extraEnd = end;

    // ¿Cuántas de las extras son de noche?
    const extraNight1 = getOverlap(extraStart, extraEnd, 19, 24);
    const extraNight2 = getOverlap(extraStart, extraEnd, 24, 29);
    const extraNight3 = getOverlap(extraStart, extraEnd, 0, 5);
    
    extraNocturna = extraNight1 + extraNight2 + extraNight3;
    extraDiurna = Math.max(0, extraDuration - extraNocturna);
  }

  return { normal, extraDiurna, extraNocturna, descanso: 0, nightHours: paidNightHours, shiftType };
};

/**
 * Procesa un array de asistencias y devuelve los totales acumulados
 */
export const processAttendanceRecords = (asistencias: Asistencia[]) => {
  let totalNormal = 0;
  let totalExtraDiurna = 0;
  let totalExtraNocturna = 0;
  let totalDescanso = 0;
  let totalNightHours = 0; 
  let diasTrabajados = 0;

  asistencias.forEach(att => {
    if (att.estado === 'presente' && att.hora_entrada && att.hora_salida) {
      const breakdown = calculateDetailedShift(att.hora_entrada, att.hora_salida, att.fecha);
      totalNormal += breakdown.normal;
      totalExtraDiurna += breakdown.extraDiurna;
      totalExtraNocturna += breakdown.extraNocturna;
      totalDescanso += breakdown.descanso;
      totalNightHours += breakdown.nightHours;
      diasTrabajados++;
    }
  });

  return { totalNormal, totalExtraDiurna, totalExtraNocturna, totalDescanso, totalNightHours, diasTrabajados };
};

export const calculateSeniorityYears = (fechaIngreso: string): number => {
  const ingreso = new Date(fechaIngreso);
  const hoy = new Date();
  let anios = hoy.getFullYear() - ingreso.getFullYear();
  const m = hoy.getMonth() - ingreso.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < ingreso.getDate())) {
    anios--;
  }
  return anios < 0 ? 0 : anios;
};

export const calculatePayroll = (
  empleado: Empleado,
  config: ConfigGlobal,
  diasTrabajados: number = 15, // Por defecto quincenal
  periodo: 'Q1' | 'Q2' = 'Q1'
) => {
  const tasa = config.tasa_bcv;
  const sueldoMensualVef = (empleado.salario_usd * tasa);
  const salarioDiarioNormal = sueldoMensualVef / 30;
  const sueldoPeriodoVef = salarioDiarioNormal * diasTrabajados;

  const aniosServicio = calculateSeniorityYears(empleado.fecha_ingreso);
  const diasBonoVacacional = Math.min(30, config.dias_bono_vacacional_base + Math.max(0, aniosServicio - 1));
  const diasUtilidades = config.dias_utilidades;

  const alicuotaBonoVacacionalDiaria = (salarioDiarioNormal * diasBonoVacacional) / 360;
  const alicuotaUtilidadesDiaria = (salarioDiarioNormal * diasUtilidades) / 360;
  const salarioDiarioIntegral = salarioDiarioNormal + alicuotaBonoVacacionalDiaria + alicuotaUtilidadesDiaria;

  const salarioMinimo = config.salario_minimo_vef;
  const topeIvss = salarioMinimo * TOPE_IVSS_SALARIOS_MINIMOS;
  const baseImponiblePeriodo = Math.min(sueldoPeriodoVef, (topeIvss / 30) * diasTrabajados);

  const deduccionIvss = baseImponiblePeriodo * 0.04; 
  const deduccionSpf = baseImponiblePeriodo * 0.005; 
  const deduccionFaov = sueldoPeriodoVef * 0.01; 

  const cestaticketMensualVef = config.cestaticket_usd * tasa;
  const bonoAlimentacionVef = periodo === 'Q2' ? cestaticketMensualVef : 0;

  const totalDeducciones = deduccionIvss + deduccionSpf + deduccionFaov;
  const netoPagarVef = sueldoPeriodoVef + bonoAlimentacionVef - totalDeducciones;

  return {
    anios_servicio: aniosServicio,
    salario_diario_normal: salarioDiarioNormal,
    salario_diario_integral: salarioDiarioIntegral,
    alicuota_utilidades_diaria: alicuotaUtilidadesDiaria,
    alicuota_vacaciones_diaria: alicuotaBonoVacacionalDiaria,
    dias_utilidades_anuales: diasUtilidades,
    dias_vacaciones_anuales: diasBonoVacacional,
    sueldo_base_mensual: sueldoMensualVef,
    sueldo_periodo: sueldoPeriodoVef,
    bono_alimentacion_vef: bonoAlimentacionVef,
    deduccion_ivss: deduccionIvss,
    deduccion_faov: deduccionFaov,
    deduccion_spf: deduccionSpf,
    neto_pagar_vef: netoPagarVef,
    total_deducciones: totalDeducciones
  };
};

export const fetchBcvRate = async (): Promise<number> => {
  try {
    const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
    const data = await response.json();
    return data.promedio || data.price || 36.5; 
  } catch (error) {
    console.error("Error fetching BCV rate:", error);
    return 36.5;
  }
};
