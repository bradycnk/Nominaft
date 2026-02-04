
-- 1. Tablas Principales
CREATE TABLE IF NOT EXISTS configuracion_global (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tasa_bcv NUMERIC(10, 4) DEFAULT 36.00,
    cestaticket_usd NUMERIC(10, 2) DEFAULT 40.00,
    salario_minimo_vef NUMERIC(15, 2) DEFAULT 130.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar configuración inicial
INSERT INTO configuracion_global (tasa_bcv, cestaticket_usd, salario_minimo_vef) 
VALUES (36.50, 40.00, 130.00)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS perfiles_admin (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    role TEXT DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS empleados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cedula TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    cargo TEXT,
    fecha_ingreso DATE NOT NULL,
    salario_usd NUMERIC(15, 2) DEFAULT 0.00,
    activo BOOLEAN DEFAULT TRUE,
    foto_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asistencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empleado_id UUID REFERENCES empleados(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    estado TEXT CHECK (estado IN ('presente', 'falta', 'reposo', 'vacaciones')),
    observaciones TEXT,
    UNIQUE(empleado_id, fecha)
);

CREATE TABLE IF NOT EXISTS nominas_mensuales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empleado_id UUID REFERENCES empleados(id),
    mes INTEGER NOT NULL,
    anio INTEGER NOT NULL,
    dias_trabajados INTEGER DEFAULT 30,
    tasa_aplicada NUMERIC(10, 4),
    sueldo_base_vef NUMERIC(15, 2),
    bono_alimentacion_vef NUMERIC(15, 2),
    deduccion_ivss NUMERIC(15, 2),
    deduccion_faov NUMERIC(15, 2),
    deduccion_spf NUMERIC(15, 2),
    neto_pagar_vef NUMERIC(15, 2),
    pagado BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Seguridad (RLS)
ALTER TABLE perfiles_admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;
ALTER TABLE nominas_mensuales ENABLE ROW LEVEL SECURITY;
ALTER TABLE asistencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion_global ENABLE ROW LEVEL SECURITY;

-- Políticas: Solo administradores autenticados pueden operar
CREATE POLICY "Admin full access" ON perfiles_admin 
    FOR ALL TO authenticated USING (auth.uid() = id);

CREATE POLICY "Admin manage employees" ON empleados 
    FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM perfiles_admin WHERE id = auth.uid()));

CREATE POLICY "Admin manage payroll" ON nominas_mensuales 
    FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM perfiles_admin WHERE id = auth.uid()));

CREATE POLICY "Admin manage attendance" ON asistencias 
    FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM perfiles_admin WHERE id = auth.uid()));

CREATE POLICY "Admin view config" ON configuracion_global 
    FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Admin update config" ON configuracion_global 
    FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM perfiles_admin WHERE id = auth.uid()));

-- 3. Trigger para crear perfil automáticamente al registrarse en Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.perfiles_admin (id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. Storage Buckets
-- (Nota: Estos se suelen crear vía UI o API de Supabase, pero aquí definimos la lógica)
-- bucket: 'expedientes'
-- Políticas de Storage:
-- CREATE POLICY "Admin Storage Access" ON storage.objects FOR ALL TO authenticated 
-- USING (bucket_id = 'expedientes' AND EXISTS (SELECT 1 FROM public.perfiles_admin WHERE id = auth.uid()));
