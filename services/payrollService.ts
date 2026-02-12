
import { ConfigGlobal, Empleado, Asistencia } from '../types.ts';

// Constantes Legales
const TOPE_IVSS_SALARIOS_MINIMOS = 5;
const TOPE_SPF_SALARIOS_MINIMOS = 10; 

/**
 * Convierte formato HH:MM a decimal (Ej: "08:30" -> 8.5)
 */
export const timeToDecimal = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h + (m / 60);
};

/**
 * Analiza un turno individual para desglosar tipos de horas.
 * Regla: Primeras 8h son normales. El resto son extras.
 * Extras > 19:00 (7PM) son Nocturnas.
 * nightHours: Total de horas para Bono Nocturno. Si la jornada tiene > 4 horas nocturnas reales, toda la jornada se considera nocturna (LOTTT).
 */
export const calculateDetailedShift = (entrada: string, salida: string, fecha: string) => {
  if (!entrada || !salida) return { normal: 0, extraDiurna: 0, extraNocturna: 0, descanso: 0, nightHours: 0 };

  const start = timeToDecimal(entrada);
  let end = timeToDecimal(salida);
  
  // Manejo de turno que cruza medianoche (Ej: 17:00 a 02:00 -> 17 a 26)
  if (end < start) end += 24; 

  const duration = end - start;
  const dateObj = new Date(fecha);
  const day = dateObj.getDay(); // 0 Dom, 6 Sab
  const isWeekend = day === 0 || day === 6;

  // --- CÁLCULO DE HORAS NOCTURNAS REALES (19:00 - 05:00) ---
  // Definimos los bloques nocturnos en la línea de tiempo lineal (0 a 29 horas)
  // Bloque 1: Madrugada del mismo día (00:00 - 05:00) -> [0, 5]
  // Bloque 2: Noche del mismo día (19:00 - 24:00) -> [19, 24]
  // Bloque 3: Madrugada del día siguiente (24:00 - 29:00) -> [24, 29]
  
  const overlap = (s1: number, e1: number, s2: number, e2: number) => {
    return Math.max(0, Math.min(e1, e2) - Math.max(s1, s2));
  };

  const nightPart1 = overlap(start, end, 0, 5);   // Si entra de madrugada (ej: 4am)
  const nightPart2 = overlap(start, end, 19, 24); // Si trabaja de noche (ej: 7pm a 12am)
  const nightPart3 = overlap(start, end, 24, 29); // Si cruza medianoche (ej: 12am a 2am)

  const realNightHours = nightPart1 + nightPart2 + nightPart3;

  // --- REGLA JORNADA NOCTURNA (ART 173 LOTTT) ---
  // Si se laboran 4 o más horas en periodo nocturno, se considera toda la jornada como nocturna.
  let paidNightHours = realNightHours;
  if (realNightHours > 4) {
    paidNightHours = duration; // Se paga el bono sobre TODAS las horas trabajadas
  }

  // Si es fin de semana, TODO cuenta como horas de descanso para efectos de cálculo base
  if (isWeekend) {
    return { normal: 0, extraDiurna: 0, extraNocturna: 0, descanso: duration, nightHours: paidNightHours };
  }

  // --- DESGLOSE NORMAL VS EXTRA ---
  let normal = 0;
  let extraDiurna = 0;
  let extraNocturna = 0;

  if (duration <= 8) {
    normal = duration;
  } else {
    normal = 8;
    const extraDuration = duration - 8;
    
    // Clasificación aproximada de extras (para recargo 1.5x)
    // Usamos el límite de 19:00 para dividir extras diurnas de nocturnas
    const nightLimit = 19.0;
    
    // Asumimos que las extras ocurren al final del turno
    // Calculamos el inicio de las extras
    const extraStartTime = start + 8; 
    const extraEndTime = end;

    // Calculamos cuántas de esas horas extras cayeron en periodo nocturno
    // (Simplificado: > 19:00 o < 05:00)
    // Reutilizamos lógica de overlap para el bloque extra
    const extraNight1 = overlap(extraStartTime, extraEndTime, 0, 5);
    const extraNight2 = overlap(extraStartTime, extraEndTime, 19, 24);
    const extraNight3 = overlap(extraStartTime, extraEndTime, 24, 29);
    
    const extraNightTotal = extraNight1 + extraNight2 + extraNight3;

    extraNocturna = extraNightTotal;
    extraDiurna = Math.max(0, extraDuration - extraNocturna);
  }

  return { normal, extraDiurna, extraNocturna, descanso: 0, nightHours: paidNightHours };
};

/**
 * Procesa un array de asistencias y devuelve los totales acumulados
 */
export const processAttendanceRecords = (asistencias: Asistencia[]) => {
  let totalNormal = 0;
  let totalExtraDiurna = 0;
  let totalExtraNocturna = 0;
  let totalDescanso = 0;
  let totalNightHours = 0; // Para bono nocturno
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
  
  // 1. Salario Normal
  const sueldoMensualVef = (empleado.salario_usd * tasa);
  const salarioDiarioNormal = sueldoMensualVef / 30;
  const sueldoPeriodoVef = salarioDiarioNormal * diasTrabajados;

  // 2. Cálculo de Alícuotas para Salario Integral (Art 104 LOTTT)
  const aniosServicio = calculateSeniorityYears(empleado.fecha_ingreso);
  const diasBonoVacacional = Math.min(30, config.dias_bono_vacacional_base + Math.max(0, aniosServicio - 1));
  const diasUtilidades = config.dias_utilidades;

  const alicuotaBonoVacacionalDiaria = (salarioDiarioNormal * diasBonoVacacional) / 360;
  const alicuotaUtilidadesDiaria = (salarioDiarioNormal * diasUtilidades) / 360;
  
  const salarioDiarioIntegral = salarioDiarioNormal + alicuotaBonoVacacionalDiaria + alicuotaUtilidadesDiaria;

  // 3. Deducciones de Ley
  const salarioMinimo = config.salario_minimo_vef;
  const topeIvss = salarioMinimo * TOPE_IVSS_SALARIOS_MINIMOS;
  const baseImponiblePeriodo = Math.min(sueldoPeriodoVef, (topeIvss / 30) * diasTrabajados);

  const deduccionIvss = baseImponiblePeriodo * 0.04; 
  const deduccionSpf = baseImponiblePeriodo * 0.005; 
  const deduccionFaov = sueldoPeriodoVef * 0.01; 

  // 4. Cestaticket
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

export const calculateWorkedHours = (entrada?: string, salida?: string): number => {
  if (!entrada || !salida) return 0;
  const [h1, m1] = entrada.split(':').map(Number);
  const [h2, m2] = salida.split(':').map(Number);
  const date1 = new Date(0, 0, 0, h1, m1);
  const date2 = new Date(0, 0, 0, h2, m2);
  let diff = (date2.getTime() - date1.getTime()) / 1000 / 60 / 60; 
  return diff > 0 ? diff : 0;
};

export const isWeekend = (dateString: string): boolean => {
  const date = new Date(dateString);
  const day = date.getDay(); 
  return day === 0 || day === 6; 
};
