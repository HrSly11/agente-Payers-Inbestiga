-- =============================================================================
-- INBESTIGA.TESIS - Data Mart 1: Captación y Marketing (inbestiga_dm_buyers)
-- Metodología Ralph Kimball: Esquema Estrella Atómico
-- =============================================================================

USE inbestiga_dm_buyers;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- 1. DIMENSIONES CONFORMADAS (Transversales compartidas)
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
        tipo NVARCHAR(20) NOT NULL -- PUBLICA, PRIVADA
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

-- 2. DIMENSIONES ESPECÍFICAS DE BUYERS
IF OBJECT_ID('dbo.DIM_CANAL', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.DIM_CANAL (
        canal_key INT IDENTITY(1,1) PRIMARY KEY,
        canal_id_oltp NVARCHAR(50) NOT NULL UNIQUE,
        nombre NVARCHAR(100) NOT NULL,
        codigo NVARCHAR(50) NOT NULL,
        tipo NVARCHAR(50) NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.DIM_CAMPANA', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.DIM_CAMPANA (
        campana_key INT IDENTITY(1,1) PRIMARY KEY,
        campana_id_oltp NVARCHAR(50) NOT NULL UNIQUE,
        nombre NVARCHAR(150) NOT NULL,
        presupuesto_total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        fecha_inicio DATE NOT NULL,
        fecha_fin DATE NULL
    );
END
GO

IF OBJECT_ID('dbo.DIM_UBICACION', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.DIM_UBICACION (
        ubicacion_key INT IDENTITY(1,1) PRIMARY KEY,
        ubicacion_id_oltp NVARCHAR(50) NOT NULL UNIQUE,
        departamento NVARCHAR(100) NOT NULL,
        provincia NVARCHAR(100) NOT NULL,
        distrito NVARCHAR(100) NOT NULL
    );
END
GO

-- 3. TABLA DE HECHOS: FACT_CAPTACION
IF OBJECT_ID('dbo.FACT_CAPTACION', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.FACT_CAPTACION (
        captacion_key BIGINT IDENTITY(1,1) PRIMARY KEY,
        tiempo_key INT NOT NULL FOREIGN KEY REFERENCES dbo.DIM_TIEMPO(tiempo_key),
        estudiante_key INT NOT NULL FOREIGN KEY REFERENCES dbo.DIM_ESTUDIANTE(estudiante_key),
        universidad_key INT NULL FOREIGN KEY REFERENCES dbo.DIM_UNIVERSIDAD(universidad_key),
        carrera_key INT NULL FOREIGN KEY REFERENCES dbo.DIM_CARRERA(carrera_key),
        canal_key INT NULL FOREIGN KEY REFERENCES dbo.DIM_CANAL(canal_key),
        campana_key INT NULL FOREIGN KEY REFERENCES dbo.DIM_CAMPANA(campana_key),
        ubicacion_key INT NULL FOREIGN KEY REFERENCES dbo.DIM_UBICACION(ubicacion_key),
        
        -- Métricas del Negocio (Hechos)
        lead_score INT NOT NULL,
        es_lead_calificado BIT NOT NULL,
        tiempo_primera_respuesta_seg INT NULL,
        interacciones_acumuladas INT NOT NULL DEFAULT 0,
        descargo_lead_magnet BIT NOT NULL DEFAULT 0,
        presupuesto_estimado_pen DECIMAL(10,2) NULL,
        dias_hasta_calificacion INT NULL
    );

    CREATE NONCLUSTERED INDEX IX_FACT_CAPTACION_tiempo ON dbo.FACT_CAPTACION(tiempo_key);
    CREATE NONCLUSTERED INDEX IX_FACT_CAPTACION_univ ON dbo.FACT_CAPTACION(universidad_key);
    CREATE NONCLUSTERED INDEX IX_FACT_CAPTACION_canal ON dbo.FACT_CAPTACION(canal_key);
    PRINT '✓ inbestiga_dm_buyers.dbo.FACT_CAPTACION creada exitosamente.';
END
GO
