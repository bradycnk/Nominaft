
import { ConfigGlobal, Empleado } from '../types.ts';

/**
 * Calcula la nómina de un empleado basándose en la tasa BCV actual y las leyes venezolanas.
 */
export const calculatePayroll = (
  empleado: Empleado,
  config: ConfigGlobal,
  diasTrabajados: number = 30
) => {
  const tasa = config.tasa_bcv;
  const sueldoBaseVef = (empleado.salario_usd * tasa);
  
  // Deducciones de Ley (Sobre Sueldo Base en VEF)
  // IVSS: 4%
  const deduccionIvss = sueldoBaseVef * 0.04;
  // Paro Forzoso (SPF): 0.5%
  const deduccionSpf = sueldoBaseVef * 0.005;
  // FAOV: 1%
  const deduccionFaov = sueldoBaseVef * 0.01;

  // Cestaticket (Bono de Alimentación)
  // Se calcula proporcional a los días trabajados sobre la base mensual indexada
  const cestaticketMensualVef = config.cestaticket_usd * tasa;
  const bonoAlimentacionVef = (cestaticketMensualVef / 30) * diasTrabajados;

  const totalDeducciones = deduccionIvss + deduccionSpf + deduccionFaov;
  const netoPagarVef = sueldoBaseVef + bonoAlimentacionVef - totalDeducciones;

  return {
    tasa_aplicada: tasa,
    sueldo_base_vef: sueldoBaseVef,
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
