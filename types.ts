
export interface ConfigGlobal {
  id: string;
  tasa_bcv: number;
  cestaticket_usd: number;
  salario_minimo_vef: number;
  updated_at: string;
}

export interface CargaFamiliar {
  id?: string;
  nombre_completo: string;
  parentesco: 'Hijo' | 'Hija' | 'Cónyuge' | 'Padre' | 'Madre';
  fecha_nacimiento: string;
  es_menor: boolean;
}

export interface Empleado {
  id: string;
  cedula: string;
  rif: string;
  nombre: string;
  apellido: string;
  cargo: string;
  fecha_ingreso: string;
  fecha_inicio_contrato?: string;
  salario_usd: number;
  salario_base_vef: number;
  activo: boolean;
  foto_url?: string;
  cv_url?: string;
  sucursal_id?: string;
  
  // Nuevos campos Legales/Personales
  fecha_nacimiento?: string;
  lugar_nacimiento?: string;
  nacionalidad?: string;
  sexo?: 'M' | 'F' | 'Otro';
  estado_civil?: 'Soltero' | 'Casado' | 'Divorciado' | 'Viudo' | 'Concubinato';
  direccion_habitacion?: string;
  telefono_movil?: string;
  telefono_fijo?: string;
  email_personal?: string;
  contacto_emergencia_nombre?: string;
  contacto_emergencia_telefono?: string;
  tipo_contrato?: string;
  departamento?: string;
  tipo_jornada?: string;
  bono_alimentacion_frecuencia?: string;

  sucursales?: {
    nombre_id: string;
  };
  cargas_familiares?: CargaFamiliar[];
}

export interface Sucursal {
  id: string;
  nombre_id: string;
  direccion: string;
  administrador: string;
  correo_admin: string;
  logo_url?: string;
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
  hora_entrada?: string;
  hora_salida?: string;
  observaciones?: string;
}
