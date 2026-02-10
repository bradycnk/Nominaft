
import { ConfigGlobal, Empleado } from '../types.ts';

// Constantes Legales
const TOPE_IVSS_SALARIOS_MINIMOS = 5;
const TOPE_SPF_SALARIOS_MINIMOS = 10; // Aunque comúnmente se usa 5 o 10 dependiendo de la interpretación, usaremos 5 para estándar seguro o base total. Usualmente IVSS y SPF tienen tope 5 SM.

/**
 * Calcula la antigüedad del empleado en años.
 */
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

/**
 * Calcula la nómina detallada (Normal e Integral) para un periodo específico.
 */
export const calculatePayroll = (
  empleado: Empleado,
  config: ConfigGlobal,
  diasTrabajados: number = 15 // Por defecto quincenal
) => {
  const tasa = config.tasa_bcv;
  
  // 1. Salario Normal
  const sueldoMensualVef = (empleado.salario_usd * tasa);
  const salarioDiarioNormal = sueldoMensualVef / 30;
  const sueldoPeriodoVef = salarioDiarioNormal * diasTrabajados;

  // 2. Cálculo de Alícuotas para Salario Integral (Art 104 LOTTT)
  const aniosServicio = calculateSeniorityYears(empleado.fecha_ingreso);
  
  // Bono Vacacional: 15 días + 1 por año de servicio (Max 30)
  const diasBonoVacacional = Math.min(30, config.dias_bono_vacacional_base + Math.max(0, aniosServicio - 1));
  
  // Utilidades: Según configuración (Mínimo 30 días)
  const diasUtilidades = config.dias_utilidades;

  // Alícuotas Diarias
  const alicuotaBonoVacacionalDiaria = (salarioDiarioNormal * diasBonoVacacional) / 360;
  const alicuotaUtilidadesDiaria = (salarioDiarioNormal * diasUtilidades) / 360;
  
  const salarioDiarioIntegral = salarioDiarioNormal + alicuotaBonoVacacionalDiaria + alicuotaUtilidadesDiaria;

  // 3. Deducciones de Ley (Sobre Salario Normal, con topes si aplica, simplificado a base total por ahora o tope de ley)
  // Nota: Para IVSS y SPF se suele usar el Salario Normal Mensual con Tope de 5 Salarios Mínimos
  const salarioMinimo = config.salario_minimo_vef;
  const topeIvss = salarioMinimo * TOPE_IVSS_SALARIOS_MINIMOS;
  
  // Base imponible para IVSS/SPF (Mensual acotada)
  const baseImponibleMensual = Math.min(sueldoMensualVef, topeIvss);
  
  // Lógica de Lunes del IVSS (Variable por mes, promediamos a semanas estándar para recibo quincenal o usamos la formula: (Sueldo * 12 / 52) * lunes_periodo)
  // Para simplificación quincenal estándar: (SueldoMensual * 4% * Lunes) / 2 o Directo 4% del devengado.
  // La práctica más común en sistemas simplificados es 4% del Salario Normal del Periodo (respetando tope).
  const baseImponiblePeriodo = Math.min(sueldoPeriodoVef, (topeIvss / 30) * diasTrabajados);

  const deduccionIvss = baseImponiblePeriodo * 0.04; // 4%
  const deduccionSpf = baseImponiblePeriodo * 0.005; // 0.5%
  const deduccionFaov = sueldoPeriodoVef * 0.01; // 1% (Sin tope)

  // 4. Cestaticket (Bono de Alimentación)
  const cestaticketMensualVef = config.cestaticket_usd * tasa;
  const bonoAlimentacionVef = (cestaticketMensualVef / 30) * diasTrabajados;

  const totalDeducciones = deduccionIvss + deduccionSpf + deduccionFaov;
  const netoPagarVef = sueldoPeriodoVef + bonoAlimentacionVef - totalDeducciones;

  // 5. Garantía de Prestaciones (Informativo)
  // 15 días por trimestre -> aprox 5 días por mes -> 2.5 días por quincena (Estimado para mostrar acumulación)
  const garantiaQuincenal = salarioDiarioIntegral * 2.5;

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
    total_deducciones: totalDeducciones,
    
    garantia_prestaciones_estimada: garantiaQuincenal
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
