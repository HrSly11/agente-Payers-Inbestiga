-- =============================================================================
-- INBESTIGA.TESIS - Transaccional: Catálogos Transversales y Seguridad
-- Tablas: USUARIO, UNIVERSIDAD, CARRERA, UBICACION, CONFIGURACION_AGENTE, NOTIFICACION
-- =============================================================================

USE inbestiga_db;
GO

-- 1. USUARIO (Gestión de acceso: administradores, asesores y supervisores)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'USUARIO')
BEGIN
    CREATE TABLE dbo.USUARIO (
        id NVARCHAR(50) PRIMARY KEY,
        username NVARCHAR(100) NOT NULL UNIQUE,
        email NVARCHAR(150) NOT NULL UNIQUE,
        passwordHash NVARCHAR(255) NOT NULL,
        rol NVARCHAR(50) NOT NULL DEFAULT 'ADMIN', -- ADMIN, ASESOR, SUPERVISOR
        activo BIT NOT NULL DEFAULT 1,
        fechaCreacion DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    PRINT '✓ Tabla USUARIO creada exitosamente.';
END
GO

-- 2. UNIVERSIDAD (Catálogo de universidades peruanas)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UNIVERSIDAD')
BEGIN
    CREATE TABLE dbo.UNIVERSIDAD (
        id NVARCHAR(50) PRIMARY KEY,
        nombre NVARCHAR(200) NOT NULL,
        siglas NVARCHAR(20) NOT NULL UNIQUE,
        ciudad NVARCHAR(100) NOT NULL,
        tipo NVARCHAR(20) NOT NULL, -- PUBLICA, PRIVADA
        activo BIT NOT NULL DEFAULT 1
    );
    PRINT '✓ Tabla UNIVERSIDAD creada exitosamente.';
END
GO

-- 3. CARRERA (Especialidades académicas agrupadas por facultad y área)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CARRERA')
BEGIN
    CREATE TABLE dbo.CARRERA (
        id NVARCHAR(50) PRIMARY KEY,
        universidadId NVARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.UNIVERSIDAD(id),
        nombre NVARCHAR(150) NOT NULL,
        facultad NVARCHAR(150) NOT NULL,
        areaConocimiento NVARCHAR(50) NOT NULL, -- INGENIERIA, SOCIALES, NEGOCIOS, DERECHO, CIENCIAS_SALUD
        activo BIT NOT NULL DEFAULT 1
    );
    PRINT '✓ Tabla CARRERA creada exitosamente.';
END
GO

-- 4. UBICACION (Georreferenciación distrital y provincial de la demanda)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UBICACION')
BEGIN
    CREATE TABLE dbo.UBICACION (
        id NVARCHAR(50) PRIMARY KEY,
        departamento NVARCHAR(100) NOT NULL,
        provincia NVARCHAR(100) NOT NULL,
        distrito NVARCHAR(100) NOT NULL
    );
    PRINT '✓ Tabla UBICACION creada exitosamente.';
END
GO

-- 5. CONFIGURACION_AGENTE (Parámetros de negociación y prompts del Agente IA)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CONFIGURACION_AGENTE')
BEGIN
    CREATE TABLE dbo.CONFIGURACION_AGENTE (
        id NVARCHAR(50) PRIMARY KEY,
        proveedorIA NVARCHAR(50) NOT NULL DEFAULT 'GEMINI', -- GEMINI, GROK, GROQ
        modelo NVARCHAR(100) NOT NULL DEFAULT 'gemini-1.5-flash',
        promptSistema NVARCHAR(MAX) NOT NULL,
        tono NVARCHAR(100) NOT NULL DEFAULT 'Profesional, empático, académico y resolutivo',
        estilo NVARCHAR(100) NOT NULL DEFAULT 'Consultor experto en investigación universitaria',
        permitirNegociacion BIT NOT NULL DEFAULT 1,
        maxDescuentoNegociablePct DECIMAL(5,2) NOT NULL DEFAULT 15.00,
        maxCuotasNegociables INT NOT NULL DEFAULT 3,
        reglasObjecionesJson NVARCHAR(MAX) NULL,
        horarioInicio NVARCHAR(10) NOT NULL DEFAULT '08:00',
        horarioFin NVARCHAR(10) NOT NULL DEFAULT '22:00',
        activo BIT NOT NULL DEFAULT 1
    );
    PRINT '✓ Tabla CONFIGURACION_AGENTE creada exitosamente.';
END
GO

-- 6. NOTIFICACION (Alertas operativas de cobranza, scoring y supervisión)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'NOTIFICACION')
BEGIN
    CREATE TABLE dbo.NOTIFICACION (
        id NVARCHAR(50) PRIMARY KEY,
        usuarioId NVARCHAR(50) NULL FOREIGN KEY REFERENCES dbo.USUARIO(id),
        tipo NVARCHAR(50) NOT NULL, -- LEAD_CALIFICADO, NEGOCIACION_INICIADA, PAGO_CONFIRMADO, SESION_PROGRAMADA, ESCALACION_HUMANA
        titulo NVARCHAR(200) NOT NULL,
        mensaje NVARCHAR(MAX) NOT NULL,
        leido BIT NOT NULL DEFAULT 0,
        fechaCreacion DATETIME2 NOT NULL DEFAULT GETDATE(),
        metadata NVARCHAR(MAX) NULL
    );
    PRINT '✓ Tabla NOTIFICACION creada exitosamente.';
END
GO
