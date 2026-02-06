
-- 1. Tabla de Sucursales
CREATE TABLE IF NOT EXISTS sucursales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_id TEXT NOT NULL, -- Nombre o ID de la sucursal
    direccion TEXT NOT NULL,
    administrador TEXT NOT NULL,
    correo_admin TEXT NOT NULL,
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Habilitar RLS
ALTER TABLE sucursales ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Seguridad
CREATE POLICY "Admins pueden gestionar sucursales" 
ON sucursales FOR ALL 
TO authenticated 
USING (EXISTS (SELECT 1 FROM perfiles_admin WHERE id = auth.uid()));

-- 4. Bucket para Logos (si no se usa el de expedientes)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true) ON CONFLICT DO NOTHING;

-- 5. Política de Storage para Logos
CREATE POLICY "Logos acceso público"
ON storage.objects FOR SELECT
USING (bucket_id = 'expedientes'); -- Reutilizamos el bucket configurado previamente por simplicidad o creamos uno nuevo

CREATE POLICY "Admins pueden subir logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'expedientes');
