
# Implementación de Auth en Supabase

Para este proyecto de Nómina Farmacéutica, el flujo de autenticación es el siguiente:

## 1. Vinculación Auth -> Base de Datos
He configurado un **Trigger en PostgreSQL** (ver `database.sql`) que se dispara cada vez que un usuario se registra en `auth.users`. 
Este trigger inserta automáticamente el `user_id` en la tabla `perfiles_admin`. 

## 2. Flujo de Login
En el frontend, utiliza el método estándar:
```javascript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'admin@farmacia.com',
  password: 'password123',
})
```

## 3. Seguridad de Datos (RLS)
Las políticas de Seguridad de Nivel de Fila (RLS) aseguran que solo los usuarios cuya ID esté presente en `perfiles_admin` puedan leer la tabla de `empleados` y procesar la `nominas_mensuales`.

## 4. Gestión de Expedientes (Storage)
El bucket `expedientes` debe crearse con visibilidad privada. Las políticas de acceso deben validar que el `auth.uid()` pertenezca a un administrador activo para permitir la descarga de contratos y fotos.
