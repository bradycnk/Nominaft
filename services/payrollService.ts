
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
 */
export const calculateDetailedShift = (entrada: string, salida: string, fecha: string) => {
  if (!entrada || !salida) return { normal: 0, extraDiurna: 0, extraNocturna: 0, descanso: 0 };

  const start = timeToDecimal(entrada);
  const end = timeToDecimal(salida);
  
  // Manejo de turno que cruza medianoche (simple)
  let duration = end - start;
  if (duration < 0) duration += 24; 

  const dateObj = new Date(fecha);
  // Ajuste de zona horaria simple para evitar problemas de día
  const day = dateObj.getDay(); // 0 Dom, 6 Sab
  const isWeekend = day === 0 || day === 6;

  // Si es fin de semana, TODO cuenta como horas de descanso (generalmente pagadas al 1.5x completo)
  if (isWeekend) {
    return { normal: 0, extraDiurna: 0, extraNocturna: 0, descanso: duration };
  }

  // Jornada Regular (Lunes a Viernes)
  let normal = 0;
  let extraDiurna = 0;
  let extraNocturna = 0;

  if (duration <= 8) {
    normal = duration;
  } else {
    normal = 8;
    const extraDuration = duration - 8;
    
    // Calcular a qué hora empezaron las extras
    // Si entró a las 8am (8.0), las extras empiezan a las 4pm (16.0)
    let extraStartTime = start + 8;
    if (extraStartTime >= 24) extraStartTime -= 24;

    let extraEndTime = end;
    
    // Definir límite nocturno (19:00 = 7 PM)
    const nightLimit = 19.0;

    // Analizamos el bloque de horas extras
    // Caso 1: Todo el bloque extra es antes de las 7pm (Ej: 16:00 a 18:00)
    if (extraEndTime <= nightLimit) {
      extraDiurna = extraDuration;
    }
    // Caso 2: Todo el bloque extra es después de las 7pm (Ej: 20:00 a 22:00)
    else if (extraStartTime >= nightLimit) {
      extraNocturna = extraDuration;
    }
    // Caso 3: Mixto (Ej: 18:00 a 20:00 -> 1h diurna, 1h nocturna)
    else {
      extraDiurna = nightLimit - extraStartTime;
      extraNocturna = extraEndTime - nightLimit;
    }
  }

  return { normal, extraDiurna, extraNocturna, descanso: 0 };
};

/**
 * Procesa un array de asistencias y devuelve los totales acumulados
 */
export const processAttendanceRecords = (asistencias: Asistencia[]) => {
  let totalNormal = 0;
  let totalExtraDiurna = 0;
  let totalExtraNocturna = 0;
  let totalDescanso = 0;
  let diasTrabajados = 0;

  asistencias.forEach(att => {
    if (att.estado === 'presente' && att.hora_entrada && att.hora_salida) {
      const breakdown = calculateDetailedShift(att.hora_entrada, att.hora_salida, att.fecha);
      totalNormal += breakdown.normal;
      totalExtraDiurna += breakdown.extraDiurna;
      totalExtraNocturna += breakdown.extraNocturna;
      totalDescanso += breakdown.descanso;
      diasTrabajados++;
    }
  });

  return { totalNormal, totalExtraDiurna, totalExtraNocturna, totalDescanso, diasTrabajados };
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
