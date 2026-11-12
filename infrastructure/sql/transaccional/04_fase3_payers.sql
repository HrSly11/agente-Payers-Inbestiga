-- =============================================================================
-- INBESTIGA.TESIS - Transaccional: FASE 3 — PAYERS (Cobranza y Pasarela Culqi)
-- Conforme a la Sección 5 del Informe Académico (pág. 20-23)
-- Tablas: COTIZACION, PAGO, PAYER
-- =============================================================================

USE inbestiga_db;
GO

-- 1. COTIZACION (Orden formal emitida antes de abrir el Checkout de pago)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'COTIZACION')
BEGIN
    CREATE TABLE dbo.COTIZACION (
        id NVARCHAR(50) PRIMARY KEY,
        leadId NVARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.LEAD(id),
        propuestaId NVARCHAR(50) NULL FOREIGN KEY REFERENCES dbo.PROPUESTA(id),
        servicioId NVARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.SERVICIO(id),
        codigoCotizacion NVARCHAR(50) NOT NULL UNIQUE, -- Ej: COT-2026-0001
        subtotal DECIMAL(10,2) NOT NULL,
        descuento DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        total DECIMAL(10,2) NOT NULL,
        cuotas INT NOT NULL DEFAULT 1,
        plazoEntregaDias INT NOT NULL DEFAULT 30,
        fechaEmision DATETIME2 NOT NULL DEFAULT GETDATE(),
        fechaExpiracion DATETIME2 NOT NULL,
        estado NVARCHAR(50) NOT NULL DEFAULT 'ACTIVA' -- ACTIVA, ACEPTADA, CANCELADA, EXPIRADA
    );
    PRINT '✓ Tabla COTIZACION creada exitosamente.';
END
GO

-- 2. PAGO (Transacciones bancarias procesadas vía Culqi Express o Stripe)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PAGO')
BEGIN
    CREATE TABLE dbo.PAGO (
        id NVARCHAR(50) PRIMARY KEY,
        cotizacionId NVARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.COTIZACION(id),
        buyerId NVARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.BUYER(id),
        leadId NVARCHAR(50) NULL FOREIGN KEY REFERENCES dbo.LEAD(id),
        gatewayProveedor NVARCHAR(50) NOT NULL, -- CULQI, STRIPE, YAPE
        gatewayTransactionId NVARCHAR(150) NULL UNIQUE,
        monto DECIMAL(10,2) NOT NULL,
        moneda NVARCHAR(10) NOT NULL DEFAULT 'PEN',
        metodoPago NVARCHAR(50) NOT NULL DEFAULT 'CARD', -- CARD, YAPE, TRANSFER, PAGOEFECTIVO
        estado NVARCHAR(50) NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE, CONFIRMADO, FALLIDO, REEMBOLSADO
        fechaCreacion DATETIME2 NOT NULL DEFAULT GETDATE(),
        fechaConfirmacion DATETIME2 NULL,
        gatewayPayload NVARCHAR(MAX) NULL,
        comprobanteUrl NVARCHAR(500) NULL
    );
    PRINT '✓ Tabla PAGO creada exitosamente.';
END
GO

-- 3. PAYER (Cliente con primer pago confirmado que transiciona el embudo)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PAYER')
BEGIN
    CREATE TABLE dbo.PAYER (
        id NVARCHAR(50) PRIMARY KEY,
        buyerId NVARCHAR(50) NOT NULL UNIQUE FOREIGN KEY REFERENCES dbo.BUYER(id) ON DELETE CASCADE,
        leadId NVARCHAR(50) NULL UNIQUE FOREIGN KEY REFERENCES dbo.LEAD(id),
        primerPagoId NVARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.PAGO(id),
        montoTotalPagado DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        metodoPrincipal NVARCHAR(50) NOT NULL DEFAULT 'CARD',
        fechaConversionPayer DATETIME2 NOT NULL DEFAULT GETDATE(),
        estado NVARCHAR(50) NOT NULL DEFAULT 'ACTIVO' -- ACTIVO, CONCLUIDO, REEMBOLSADO
    );
    PRINT '✓ Tabla PAYER creada exitosamente.';
END
GO
