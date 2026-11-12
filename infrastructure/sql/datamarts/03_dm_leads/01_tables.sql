-- =============================================================================
-- INBESTIGA.TESIS - Data Mart 2: Conversión y Negociación IA (inbestiga_dm_leads)
-- Metodología Ralph Kimball: Esquema Estrella Atómico
-- =============================================================================

USE inbestiga_dm_leads;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- 1. DIMENSIONES CONFORMADAS
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

-- 2. DIMENSIONES ESPECÍFICAS DE LEADS
IF OBJECT_ID('dbo.DIM_LEAD', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.DIM_LEAD (
        lead_key INT IDENTITY(1,1) PRIMARY KEY,
        lead_id_oltp NVARCHAR(50) NOT NULL UNIQUE,
        score_inicial INT NOT NULL,
        prioridad NVARCHAR(20) NOT NULL, -- ALTA, MEDIA, BAJA
        fecha_calificacion DATE NOT NULL,
        umbral_superado BIT NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.DIM_OBJECION', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.DIM_OBJECION (
        objecion_key INT IDENTITY(1,1) PRIMARY KEY,
        tipo_objecion NVARCHAR(50) NOT NULL UNIQUE -- PRECIO, TIEMPO, CONFIANZA, COMPARACION, METODO_PAGO, NINGUNA
    );
END
GO

IF OBJECT_ID('dbo.DIM_MODALIDAD_NEGOCIADA', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.DIM_MODALIDAD_NEGOCIADA (
        modalidad_key INT IDENTITY(1,1) PRIMARY KEY,
        cuotas_pactadas INT NOT NULL,
        codigo_modalidad NVARCHAR(50) NOT NULL UNIQUE -- CONTADO_1_CUOTA, FINANCIADO_2_CUOTAS, FINANCIADO_3_CUOTAS
    );
END
GO

-- 3. TABLA DE HECHOS: FACT_NEGOCIACION
IF OBJECT_ID('dbo.FACT_NEGOCIACION', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.FACT_NEGOCIACION (
        negociacion_key BIGINT IDENTITY(1,1) PRIMARY KEY,
        tiempo_key INT NOT NULL FOREIGN KEY REFERENCES dbo.DIM_TIEMPO(tiempo_key),
        estudiante_key INT NOT NULL FOREIGN KEY REFERENCES dbo.DIM_ESTUDIANTE(estudiante_key),
        lead_key INT NOT NULL FOREIGN KEY REFERENCES dbo.DIM_LEAD(lead_key),
        universidad_key INT NULL FOREIGN KEY REFERENCES dbo.DIM_UNIVERSIDAD(universidad_key),
        carrera_key INT NULL FOREIGN KEY REFERENCES dbo.DIM_CARRERA(carrera_key),
        servicio_key INT NULL FOREIGN KEY REFERENCES dbo.DIM_SERVICIO(servicio_key),
        objecion_key INT NULL FOREIGN KEY REFERENCES dbo.DIM_OBJECION(objecion_key),
        modalidad_key INT NULL FOREIGN KEY REFERENCES dbo.DIM_MODALIDAD_NEGOCIADA(modalidad_key),

        -- Métricas del Negocio (Hechos)
        mensajes_totales INT NOT NULL DEFAULT 0,
        mensajes_cliente INT NOT NULL DEFAULT 0,
        mensajes_agente_ia INT NOT NULL DEFAULT 0,
        tiempo_negociacion_min INT NULL,
        precio_lista_pen DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        precio_final_acordado_pen DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        descuento_aplicado_pct DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        monto_descuento_pen DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        convertido_a_pago BIT NOT NULL DEFAULT 0,
        propuesta_aceptada BIT NOT NULL DEFAULT 0,
        escalado_a_humano BIT NOT NULL DEFAULT 0,
        tuvo_objecion BIT NOT NULL DEFAULT 0
    );

    CREATE NONCLUSTERED INDEX IX_FACT_NEG_tiempo ON dbo.FACT_NEGOCIACION(tiempo_key);
    CREATE NONCLUSTERED INDEX IX_FACT_NEG_lead ON dbo.FACT_NEGOCIACION(lead_key);
    CREATE NONCLUSTERED INDEX IX_FACT_NEG_univ ON dbo.FACT_NEGOCIACION(universidad_key);
    PRINT '✓ inbestiga_dm_leads.dbo.FACT_NEGOCIACION creada exitosamente.';
END
ELSE
BEGIN
    IF COL_LENGTH('dbo.FACT_NEGOCIACION', 'propuesta_aceptada') IS NULL
    BEGIN
        ALTER TABLE dbo.FACT_NEGOCIACION ADD propuesta_aceptada BIT NOT NULL DEFAULT 0;
        PRINT '✓ Columna propuesta_aceptada agregada a dbo.FACT_NEGOCIACION.';
    END
END
GO
