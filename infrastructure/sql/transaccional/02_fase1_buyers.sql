-- =============================================================================
-- INBESTIGA.TESIS - Transaccional: FASE 1 — BUYERS (Captación y Marketing)
-- Conforme a la Figura 1 (Modelo E-R de la Fase BUYERS, pág. 11 del Informe)
-- Tablas: CANAL, CAMPAÑA, CONTENIDO, BUYER, FORMULARIO, INTERACCION
-- =============================================================================

USE inbestiga_db;
GO

-- 1. CANAL (Canales de tráfico: TikTok, Meta Ads, Orgánico, Convenios)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CANAL')
BEGIN
    CREATE TABLE dbo.CANAL (
        id NVARCHAR(50) PRIMARY KEY,
        nombre NVARCHAR(100) NOT NULL,
        codigo NVARCHAR(50) NOT NULL UNIQUE, -- TIKTOK, META_ADS, ORGANICO, GOOGLE, REFERIDO, CONVENIO
        tipo NVARCHAR(50) NOT NULL,
        descripcion NVARCHAR(MAX) NULL
    );
    PRINT '✓ Tabla CANAL creada exitosamente.';
END
GO

-- 2. CAMPAÑA (Campañas publicitarias con presupuesto asignado para cálculo de CPL)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CAMPAÑA')
BEGIN
    CREATE TABLE dbo.CAMPAÑA (
        id NVARCHAR(50) PRIMARY KEY,
        canalId NVARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.CANAL(id),
        nombre NVARCHAR(150) NOT NULL,
        presupuesto DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        fechaInicio DATETIME2 NOT NULL,
        fechaFin DATETIME2 NULL,
        activo BIT NOT NULL DEFAULT 1
    );
    PRINT '✓ Tabla CAMPAÑA creada exitosamente.';
END
GO

-- 3. CONTENIDO (Piezas educativas y Lead Magnets: Guías APA, Esquema Cap I)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CONTENIDO')
BEGIN
    CREATE TABLE dbo.CONTENIDO (
        id NVARCHAR(50) PRIMARY KEY,
        campanaId NVARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.CAMPAÑA(id),
        titulo NVARCHAR(200) NOT NULL,
        tipo NVARCHAR(50) NOT NULL, -- VIDEO_REEL, POST, LANDING, GUIA_PDF
        url NVARCHAR(500) NULL,
        leadMagnet BIT NOT NULL DEFAULT 0,
        activo BIT NOT NULL DEFAULT 1
    );
    PRINT '✓ Tabla CONTENIDO creada exitosamente.';
END
GO

-- 4. BUYER (Entidad central de captación: datos de contacto y perfil académico)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'BUYER')
BEGIN
    CREATE TABLE dbo.BUYER (
        id NVARCHAR(50) PRIMARY KEY,
        nombres NVARCHAR(100) NOT NULL,
        apellidos NVARCHAR(100) NOT NULL,
        whatsapp NVARCHAR(50) NOT NULL,
        email NVARCHAR(150) NOT NULL,
        universidadId NVARCHAR(50) NULL FOREIGN KEY REFERENCES dbo.UNIVERSIDAD(id),
        carreraId NVARCHAR(50) NULL FOREIGN KEY REFERENCES dbo.CARRERA(id),
        ubicacionId NVARCHAR(50) NULL FOREIGN KEY REFERENCES dbo.UBICACION(id),
        canalId NVARCHAR(50) NULL FOREIGN KEY REFERENCES dbo.CANAL(id),
        campanaId NVARCHAR(50) NULL FOREIGN KEY REFERENCES dbo.CAMPAÑA(id),
        ciclo NVARCHAR(50) NULL, -- 9no, 10mo, EGRESADO, BACHILLER
        tipoInvestigacion NVARCHAR(50) NULL, -- TESIS, PLAN_DE_TESIS, ARTICULO_CIENTIFICO
        situacionLaboral NVARCHAR(50) NULL, -- PRACTICANTE, DEPENDIENTE, SOLO_ESTUDIA
        presupuestoAprox DECIMAL(10,2) NULL,
        dolorPrincipal NVARCHAR(100) NULL, -- METODOLOGIA, ESTADISTICA, FALTA_TIEMPO
        softwareRequerido NVARCHAR(50) NULL, -- SPSS, PYTHON, STATA, ATLAS_TI
        plazoDefinidoDias INT NULL,
        leadScore INT NOT NULL DEFAULT 0,
        estadoFunnel NVARCHAR(50) NOT NULL DEFAULT 'BUYER', -- BUYER, LEAD, PAYER, CUSTOMER
        consentimientoWhatsapp BIT NOT NULL DEFAULT 1,
        fechaRegistro DATETIME2 NOT NULL DEFAULT GETDATE(),
        fechaConversionLead DATETIME2 NULL
    );
    PRINT '✓ Tabla BUYER creada exitosamente.';
END
GO

-- 5. FORMULARIO (Auditoría de envío de datos JSON, IP y User-Agent)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FORMULARIO')
BEGIN
    CREATE TABLE dbo.FORMULARIO (
        id NVARCHAR(50) PRIMARY KEY,
        buyerId NVARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.BUYER(id) ON DELETE CASCADE,
        datosJson NVARCHAR(MAX) NOT NULL,
        ip NVARCHAR(50) NULL,
        userAgent NVARCHAR(500) NULL,
        fechaEnvio DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    PRINT '✓ Tabla FORMULARIO creada exitosamente.';
END
GO

-- 6. INTERACCION (Rastro de comportamiento: visitas, clics, descargas)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'INTERACCION')
BEGIN
    CREATE TABLE dbo.INTERACCION (
        id NVARCHAR(50) PRIMARY KEY,
        buyerId NVARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.BUYER(id) ON DELETE CASCADE,
        tipo NVARCHAR(50) NOT NULL, -- VISITA, DESCARGA_LEAD_MAGNET, CLIC_ANUNCIO, MENSAJE_WHATSAPP
        detalle NVARCHAR(MAX) NULL,
        fechaHora DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    PRINT '✓ Tabla INTERACCION creada exitosamente.';
END
GO
