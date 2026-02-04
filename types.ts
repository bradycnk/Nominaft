
export interface ConfigGlobal {
  id: string;
  tasa_bcv: number;
  cestaticket_usd: number;
  salario_minimo_vef: number;
  updated_at: string;
}

export interface Empleado {
  id: string;
  cedula: string;
  nombre: string;
  apellido: string;
  cargo: string;
  fecha_ingreso: string;
  salario_usd: number;
  activo: boolean;
  foto_url?: string;
}

export interface Nomina {
  id: string;
  empleado_id: string;
  mes: number;
  anio: number;
  dias_trabajados: number;
  tasa_aplicada: number;
  sueldo_base_vef: number;
  bono_alimentacion_vef: number;
  deduccion_ivss: number;
  deduccion_faov: number;
  deduccion_spf: number;
  neto_pagar_vef: number;
  pagado: boolean;
  empleados?: Empleado;
}

export interface Asistencia {
  id: string;
  empleado_id: string;
  fecha: string;
  estado: 'presente' | 'falta' | 'reposo' | 'vacaciones';
  observaciones?: string;
}
