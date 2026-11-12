-- =============================================================================
-- INBESTIGA.TESIS - Transaccional: FASE 2 — LEADS (Conversión y Negociación IA)
-- Conforme a la Figura 3 (Modelo E-R de la Fase LEADS, pág. 18 del Informe)
-- Tablas: LEAD, PERFIL_NEGOCIACION, SERVICIO, REGLA_COMERCIAL, CONVERSACION,
--         MENSAJE, DIAGNOSTICO, PROPUESTA, OBJECION, SEGUIMIENTO
-- =============================================================================

USE inbestiga_db;
GO

-- 1. LEAD (Contacto calificado con score >= 70 puntos)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LEAD')
BEGIN
    CREATE TABLE dbo.LEAD (
        id NVARCHAR(50) PRIMARY KEY,
        buyerId NVARCHAR(50) NOT NULL UNIQUE FOREIGN KEY REFERENCES dbo.BUYER(id) ON DELETE CASCADE,
        scoreCalificado INT NOT NULL,
        prioridad NVARCHAR(20) NOT NULL DEFAULT 'MEDIA', -- ALTA, MEDIA, BAJA (Sección 4.3 del informe)
        fechaCalificacion DATETIME2 NOT NULL DEFAULT GETDATE(),
        umbralSuperado BIT NOT NULL DEFAULT 1,
        criterioCalificacion NVARCHAR(MAX) NULL -- Desglose JSON de ponderaciones
    );
    PRINT '✓ Tabla LEAD creada exitosamente.';
END
GO

-- 2. PERFIL_NEGOCIACION (Pantalla de Perfil de Negociación - Sección 4.2 del informe)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PERFIL_NEGOCIACION')
BEGIN
    CREATE TABLE dbo.PERFIL_NEGOCIACION (
        id NVARCHAR(50) PRIMARY KEY,
        buyerId NVARCHAR(50) NOT NULL UNIQUE FOREIGN KEY REFERENCES dbo.BUYER(id) ON DELETE CASCADE,
        presupuestoEstimado DECIMAL(10,2) NULL,
        urgenciaNivel NVARCHAR(50) NULL, -- ALTA, MEDIA, BAJA
        objecionPredominante NVARCHAR(50) NULL, -- PRECIO, TIEMPO, CONFIANZA
        scoreSensibilidadPrecio INT NULL DEFAULT 50, -- 0 a 100
        notas NVARCHAR(MAX) NULL
    );
    PRINT '✓ Tabla PERFIL_NEGOCIACION creada exitosamente.';
END
GO

-- 3. SERVICIO (Catálogo de asesorías: Tesis Integral, Plan de Tesis, Artículo Scopus)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SERVICIO')
BEGIN
    CREATE TABLE dbo.SERVICIO (
        id NVARCHAR(50) PRIMARY KEY,
        nombre NVARCHAR(150) NOT NULL,
        codigo NVARCHAR(50) NOT NULL UNIQUE, -- TESIS_INTEGRAL, PLAN_TESIS, ANALISIS_ESTADISTICO, ARTICULO
        descripcion NVARCHAR(MAX) NOT NULL,
        tipoInvestigacion NVARCHAR(50) NOT NULL, -- TESIS, PLAN_DE_TESIS, ARTICULO_CIENTIFICO
        precioBase DECIMAL(10,2) NOT NULL,
        precioMinimo DECIMAL(10,2) NOT NULL,
        precioMaximo DECIMAL(10,2) NOT NULL,
        plazoSemanasMin INT NOT NULL DEFAULT 4,
        plazoSemanasMax INT NOT NULL DEFAULT 16,
        maxCuotas INT NOT NULL DEFAULT 4,
        activo BIT NOT NULL DEFAULT 1
    );
    PRINT '✓ Tabla SERVICIO creada exitosamente.';
END
GO

-- 4. REGLA_COMERCIAL (Motor de Reglas Comerciales para límites de descuento y cuotas)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'REGLA_COMERCIAL')
BEGIN
    CREATE TABLE dbo.REGLA_COMERCIAL (
        id NVARCHAR(50) PRIMARY KEY,
        servicioId NVARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.SERVICIO(id) ON DELETE CASCADE,
        tipoInvestigacion NVARCHAR(50) NULL,
        descuentoMaximoPct DECIMAL(5,2) NOT NULL DEFAULT 15.00, -- Límite máximo 15%
        descuentoPagoUnicoPct DECIMAL(5,2) NOT NULL DEFAULT 10.00,
        cuotaMinima DECIMAL(10,2) NOT NULL DEFAULT 200.00,
        plazoMinimoDias INT NOT NULL DEFAULT 15,
        plazoMaximoDias INT NOT NULL DEFAULT 120,
        condicionesEspeciales NVARCHAR(MAX) NULL,
        activo BIT NOT NULL DEFAULT 1
    );
    PRINT '✓ Tabla REGLA_COMERCIAL creada exitosamente.';
END
GO

-- 5. CONVERSACION (Sesión de chat interactiva en WhatsApp administrada por el Agente IA)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CONVERSACION')
BEGIN
    CREATE TABLE dbo.CONVERSACION (
        id NVARCHAR(50) PRIMARY KEY,
        buyerId NVARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.BUYER(id) ON DELETE CASCADE,
        leadId NVARCHAR(50) NULL FOREIGN KEY REFERENCES dbo.LEAD(id),
        canal NVARCHAR(50) NOT NULL DEFAULT 'WHATSAPP',
        estadoEtapa NVARCHAR(50) NOT NULL DEFAULT 'DISCOVERY', -- DISCOVERY, DIAGNOSTIC, PROPOSAL, OBJECTION_HANDLING, NEGOTIATION, CLOSING, PAYMENT, PAYMENT_PENDING, CONVERTED, HUMAN_ESCALATION, ABANDONED
        fechaInicio DATETIME2 NOT NULL DEFAULT GETDATE(),
        fechaUltimaActividad DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    PRINT '✓ Tabla CONVERSACION creada exitosamente.';
END
GO

-- 6. MENSAJE (Historial atómico de mensajes enviados y recibidos)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MENSAJE')
BEGIN
    CREATE TABLE dbo.MENSAJE (
        id NVARCHAR(50) PRIMARY KEY,
        conversacionId NVARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.CONVERSACION(id) ON DELETE CASCADE,
        direccion NVARCHAR(20) NOT NULL, -- INCOMING, OUTGOING
        remitente NVARCHAR(50) NOT NULL, -- CLIENTE, AGENTE_IA, ASESOR_HUMANO
        contenido NVARCHAR(MAX) NOT NULL,
        tipoMensaje NVARCHAR(50) NOT NULL DEFAULT 'TEXT', -- TEXT, PAYMENT_LINK, QUOTE, DOCUMENT
        fechaHora DATETIME2 NOT NULL DEFAULT GETDATE(),
        estadoEntrega NVARCHAR(50) NOT NULL DEFAULT 'SENT', -- SENT, DELIVERED, READ, FAILED
        respuestaA NVARCHAR(50) NULL,
        metadata NVARCHAR(MAX) NULL -- JSON de herramientas invocadas (Function Calling)
    );
    PRINT '✓ Tabla MENSAJE creada exitosamente.';
END
GO

-- 7. DIAGNOSTICO (Evaluación gratuita del estado metodológico de la tesis)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DIAGNOSTICO')
BEGIN
    CREATE TABLE dbo.DIAGNOSTICO (
        id NVARCHAR(50) PRIMARY KEY,
        conversacionId NVARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.CONVERSACION(id) ON DELETE CASCADE,
        leadId NVARCHAR(50) NULL FOREIGN KEY REFERENCES dbo.LEAD(id),
        temaInvestigacion NVARCHAR(500) NULL,
        avanceActualPct INT NOT NULL DEFAULT 0, -- 0 a 100%
        principalesDificultades NVARCHAR(MAX) NULL,
        resumenIA NVARCHAR(MAX) NULL,
        fechaDiagnostico DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    PRINT '✓ Tabla DIAGNOSTICO creada exitosamente.';
END
GO

-- 8. PROPUESTA (Cotización dinámica emitida según alcance y capítulos solicitados)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PROPUESTA')
BEGIN
    CREATE TABLE dbo.PROPUESTA (
        id NVARCHAR(50) PRIMARY KEY,
        conversacionId NVARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.CONVERSACION(id) ON DELETE CASCADE,
        leadId NVARCHAR(50) NULL FOREIGN KEY REFERENCES dbo.LEAD(id),
        servicioId NVARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.SERVICIO(id),
        precioOriginal DECIMAL(10,2) NOT NULL,
        precioPropuesto DECIMAL(10,2) NOT NULL,
        descuentoAplicadoPct DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        numeroCuotas INT NOT NULL DEFAULT 1,
        montoPorCuota DECIMAL(10,2) NOT NULL,
        plazoDias INT NOT NULL DEFAULT 30,
        justificacion NVARCHAR(MAX) NULL,
        estado NVARCHAR(50) NOT NULL DEFAULT 'BORRADOR', -- BORRADOR, ENVIADA, ACEPTADA, RECHAZADA
        fechaCreacion DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    PRINT '✓ Tabla PROPUESTA creada exitosamente.';
END
GO

-- 9. OBJECION (Objeciones registradas por el Agente IA y contraofertas validadas)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OBJECION')
BEGIN
    CREATE TABLE dbo.OBJECION (
        id NVARCHAR(50) PRIMARY KEY,
        conversacionId NVARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.CONVERSACION(id) ON DELETE CASCADE,
        leadId NVARCHAR(50) NULL FOREIGN KEY REFERENCES dbo.LEAD(id),
        tipo NVARCHAR(50) NOT NULL, -- PRECIO, TIEMPO, CONFIANZA, COMPARACION, METODO_PAGO, OTRO
        descripcion NVARCHAR(MAX) NOT NULL,
        respuestaAgente NVARCHAR(MAX) NULL,
        resuelta BIT NOT NULL DEFAULT 0,
        fechaRegistro DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    PRINT '✓ Tabla OBJECION creada exitosamente.';
END
GO

-- 10. SEGUIMIENTO (Planificación y ejecución de recordatorios en la negociación)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SEGUIMIENTO')
BEGIN
    CREATE TABLE dbo.SEGUIMIENTO (
        id NVARCHAR(50) PRIMARY KEY,
        conversacionId NVARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.CONVERSACION(id) ON DELETE CASCADE,
        leadId NVARCHAR(50) NULL FOREIGN KEY REFERENCES dbo.LEAD(id),
        tipo NVARCHAR(50) NOT NULL, -- RECORDATORIO, CONSULTA_DUDA, OFERTA_LIMITADA
        fechaProgramada DATETIME2 NOT NULL,
        fechaEjecutada DATETIME2 NULL,
        estado NVARCHAR(50) NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE, EJECUTADO, CANCELADO
        resultado NVARCHAR(MAX) NULL
    );
    PRINT '✓ Tabla SEGUIMIENTO creada exitosamente.';
END
GO
