-- =============================================================================
-- INBESTIGA.TESIS - Data Mart 4: CUSTOMERS (Atención, Bitácora y Satisfacción)
-- Metodología Ralph Kimball: Esquema Estrella Atómico Separado
-- =============================================================================

USE inbestiga_dm_customers;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- 1. DIMENSIONES CONFORMADAS (Instanciadas localmente en inbestiga_dm_customers)
IF OBJECT_ID('dbo.DIM_TIEMPO', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.DIM_TIEMPO (
        tiempo_key INT IDENTITY(1,1) PRIMARY KEY,
        fecha DATE NOT NULL UNIQUE,
        año INT NOT NULL,
        mes INT NOT NULL,
        nombre_mes NVARCHAR(20) NOT NULL,
        trimestre INT NOT NULL,
        dia INT NOT NULL,
        dia_semana NVARCHAR(20) NOT NULL,
        es_fin_semana BIT NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.DIM_UNIVERSIDAD', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.DIM_UNIVERSIDAD (
        universidad_key INT IDENTITY(1,1) PRIMARY KEY,
        universidad_id_oltp NVARCHAR(50) NOT NULL UNIQUE,
        nombre NVARCHAR(200) NOT NULL,
        siglas NVARCHAR(20) NOT NULL,
        ciudad NVARCHAR(100) NOT NULL,
        tipo NVARCHAR(20) NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.DIM_CARRERA', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.DIM_CARRERA (
        carrera_key INT IDENTITY(1,1) PRIMARY KEY,
        carrera_id_oltp NVARCHAR(50) NOT NULL UNIQUE,
        nombre NVARCHAR(150) NOT NULL,
        facultad NVARCHAR(150) NOT NULL,
        area_conocimiento NVARCHAR(50) NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.DIM_ESTUDIANTE', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.DIM_ESTUDIANTE (
        estudiante_key INT IDENTITY(1,1) PRIMARY KEY,
        buyer_id_oltp NVARCHAR(50) NOT NULL UNIQUE,
        nombres NVARCHAR(100) NOT NULL,
        apellidos NVARCHAR(100) NOT NULL,
        whatsapp NVARCHAR(50) NOT NULL,
        email NVARCHAR(150) NOT NULL,
        situacion_laboral NVARCHAR(50) NULL,
        fecha_registro_oltp DATETIME2 NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.DIM_SERVICIO', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.DIM_SERVICIO (
        servicio_key INT IDENTITY(1,1) PRIMARY KEY,
        servicio_id_oltp NVARCHAR(50) NOT NULL UNIQUE,
        nombre NVARCHAR(150) NOT NULL,
        codigo NVARCHAR(50) NOT NULL,
        tipo_investigacion NVARCHAR(50) NOT NULL,
        precio_base DECIMAL(10,2) NOT NULL,
        precio_minimo DECIMAL(10,2) NOT NULL,
        plazo_semanas_estandar INT NOT NULL
    );
END
GO

-- 2. DIMENSIONES ESPECÍFICAS DE CUSTOMERS
IF OBJECT_ID('dbo.DIM_ASESOR', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.DIM_ASESOR (
        asesor_key INT IDENTITY(1,1) PRIMARY KEY,
        asesor_id_oltp NVARCHAR(50) NOT NULL UNIQUE,
        nombres_completos NVARCHAR(200) NOT NULL,
        especialidad NVARCHAR(200) NOT NULL,
        grado_academico NVARCHAR(50) NOT NULL,
        email NVARCHAR(150) NULL
    );
END
GO

IF OBJECT_ID('dbo.DIM_ESTADO_SERVICIO', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.DIM_ESTADO_SERVICIO (
        estado_servicio_key INT IDENTITY(1,1) PRIMARY KEY,
        estado_codigo NVARCHAR(50) NOT NULL UNIQUE, -- ACTIVO, EN_CURSO, EN_RIESGO, PAUSADO, FINALIZADO
        descripcion NVARCHAR(150) NOT NULL
    );
END
GO

-- 3. TABLA DE HECHOS: FACT_ATENCION
IF OBJECT_ID('dbo.FACT_ATENCION', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.FACT_ATENCION (
        fact_id INT IDENTITY(1,1) PRIMARY KEY,
        tiempo_key INT NOT NULL FOREIGN KEY REFERENCES dbo.DIM_TIEMPO(tiempo_key),
        estudiante_key INT NOT NULL FOREIGN KEY REFERENCES dbo.DIM_ESTUDIANTE(estudiante_key),
        servicio_key INT NOT NULL FOREIGN KEY REFERENCES dbo.DIM_SERVICIO(servicio_key),
        universidad_key INT NULL FOREIGN KEY REFERENCES dbo.DIM_UNIVERSIDAD(universidad_key),
        carrera_key INT NULL FOREIGN KEY REFERENCES dbo.DIM_CARRERA(carrera_key),
        asesor_key INT NOT NULL FOREIGN KEY REFERENCES dbo.DIM_ASESOR(asesor_key),
        estado_servicio_key INT NOT NULL FOREIGN KEY REFERENCES dbo.DIM_ESTADO_SERVICIO(estado_servicio_key),
        
        -- Medidas Cuantitativas y de Cumplimiento
        horas_asignacion_asesor INT NULL,
        horas_primera_sesion INT NULL,
        primera_sesion_48h BIT NOT NULL DEFAULT 0,
        sesiones_programadas INT NOT NULL DEFAULT 0,
        sesiones_realizadas INT NOT NULL DEFAULT 0,
        entregas_a_tiempo INT NOT NULL DEFAULT 0,
        dias_servicio_activo INT NOT NULL DEFAULT 0,
        porcentaje_avance_tesis DECIMAL(5,2) NOT NULL DEFAULT 0.0,
        puntaje_satisfaccion_encuesta DECIMAL(3,2) NULL,
        alerta_riesgo_abandono BIT NOT NULL DEFAULT 0
    );

    CREATE NONCLUSTERED INDEX IX_FACT_ATENCION_tiempo ON dbo.FACT_ATENCION(tiempo_key);
    CREATE NONCLUSTERED INDEX IX_FACT_ATENCION_estudiante ON dbo.FACT_ATENCION(estudiante_key);
    CREATE NONCLUSTERED INDEX IX_FACT_ATENCION_asesor ON dbo.FACT_ATENCION(asesor_key);
    PRINT '✓ inbestiga_dm_customers.dbo.FACT_ATENCION creada exitosamente.';
END
ELSE
BEGIN
    ALTER TABLE dbo.FACT_ATENCION ALTER COLUMN horas_asignacion_asesor INT NULL;
    ALTER TABLE dbo.FACT_ATENCION ALTER COLUMN horas_primera_sesion INT NULL;
    PRINT '✓ Columnas de horas modificadas a INT NULL en dbo.FACT_ATENCION.';
END
GO
