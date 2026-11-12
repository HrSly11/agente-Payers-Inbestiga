-- =============================================================================
-- INBESTIGA.TESIS - Data Mart 3: Cobranza y Pasarela Culqi (inbestiga_dm_payers)
-- Metodología Ralph Kimball: Esquema Estrella Atómico Separado
-- =============================================================================

USE inbestiga_dm_payers;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- 1. DIMENSIONES CONFORMADAS (Instanciadas localmente en inbestiga_dm_payers)
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

-- 2. DIMENSIONES ESPECÍFICAS DE PAYERS
IF OBJECT_ID('dbo.DIM_METODO_PAGO', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.DIM_METODO_PAGO (
        metodo_pago_key INT IDENTITY(1,1) PRIMARY KEY,
        metodo NVARCHAR(50) NOT NULL, -- YAPE, CARD, PAGOEFECTIVO, TRANSFER
        gateway NVARCHAR(50) NOT NULL, -- CULQI, STRIPE
        tipo_financiamiento NVARCHAR(50) NOT NULL -- CONTADO_1_CUOTA, FINANCIADO_2_CUOTAS, FINANCIADO_3_CUOTAS
    );
END
GO

IF OBJECT_ID('dbo.DIM_CANAL_PAGO', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.DIM_CANAL_PAGO (
        canal_pago_key INT IDENTITY(1,1) PRIMARY KEY,
        tipo_interfaz NVARCHAR(50) NOT NULL, -- CHECKOUT_WEB_DIRECTO, LINK_WHATSAPP
        descripcion NVARCHAR(100) NULL
    );
END
GO

-- 3. TABLA DE HECHOS: FACT_COBRANZA
IF OBJECT_ID('dbo.FACT_COBRANZA', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.FACT_COBRANZA (
        fact_id INT IDENTITY(1,1) PRIMARY KEY,
        tiempo_key INT NOT NULL FOREIGN KEY REFERENCES dbo.DIM_TIEMPO(tiempo_key),
        estudiante_key INT NOT NULL FOREIGN KEY REFERENCES dbo.DIM_ESTUDIANTE(estudiante_key),
        servicio_key INT NOT NULL FOREIGN KEY REFERENCES dbo.DIM_SERVICIO(servicio_key),
        universidad_key INT NULL FOREIGN KEY REFERENCES dbo.DIM_UNIVERSIDAD(universidad_key),
        carrera_key INT NULL FOREIGN KEY REFERENCES dbo.DIM_CARRERA(carrera_key),
        metodo_pago_key INT NOT NULL FOREIGN KEY REFERENCES dbo.DIM_METODO_PAGO(metodo_pago_key),
        canal_pago_key INT NULL FOREIGN KEY REFERENCES dbo.DIM_CANAL_PAGO(canal_pago_key),
        
        -- Medidas Monetarias y Operativas
        monto_pagado DECIMAL(10,2) NOT NULL,
        monto_descuento DECIMAL(10,2) NOT NULL DEFAULT 0,
        cuota_numero INT NOT NULL DEFAULT 1,
        total_cuotas INT NOT NULL DEFAULT 1,
        tiempo_confirmacion_seg INT NULL,
        pago_confirmado BIT NOT NULL DEFAULT 1,
        pago_tras_alerta_cobranza BIT NOT NULL DEFAULT 0
    );

    CREATE NONCLUSTERED INDEX IX_FACT_COBRANZA_tiempo ON dbo.FACT_COBRANZA(tiempo_key);
    CREATE NONCLUSTERED INDEX IX_FACT_COBRANZA_estudiante ON dbo.FACT_COBRANZA(estudiante_key);
    CREATE NONCLUSTERED INDEX IX_FACT_COBRANZA_metodo ON dbo.FACT_COBRANZA(metodo_pago_key);
    PRINT '✓ inbestiga_dm_payers.dbo.FACT_COBRANZA creada exitosamente.';
END
ELSE
BEGIN
    ALTER TABLE dbo.FACT_COBRANZA ALTER COLUMN tiempo_confirmacion_seg INT NULL;
    PRINT '✓ Columna tiempo_confirmacion_seg modificada a INT NULL en dbo.FACT_COBRANZA.';
END
GO
