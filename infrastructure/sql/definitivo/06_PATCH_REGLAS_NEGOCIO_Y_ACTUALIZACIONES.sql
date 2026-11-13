-- ======================================================================
-- INBESTIGA.TESIS - Patch de Reglas de Negocio, Modalidades y Bitácora
-- Ejecutar sobre INBESTIGA_TESIS para actualizar a la versión v2.0
-- ======================================================================
USE INBESTIGA_TESIS;
GO

-- 1. Tabla REGLA_NEGOCIO
IF OBJECT_ID('dbo.REGLA_NEGOCIO', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.REGLA_NEGOCIO (
        id INT IDENTITY(1,1) PRIMARY KEY,
        codigo NVARCHAR(60) NOT NULL UNIQUE,
        nombre NVARCHAR(150) NOT NULL,
        modulo NVARCHAR(50) NOT NULL,
        tipo_dato NVARCHAR(20) NOT NULL,
        valor NVARCHAR(MAX) NOT NULL,
        descripcion NVARCHAR(MAX) NULL,
        activo BIT NOT NULL DEFAULT 1,
        fecha_creacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        fecha_actualizacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

-- 2. Población de Reglas de Negocio Oficiales
MERGE dbo.REGLA_NEGOCIO AS target
USING (VALUES
    ('RN_01_PROMPT_INJECTION', 'Guardrail Anti-Prompt Injection', 'SEGURIDAD', 'BOOLEAN', 'true', 'Bloqueo estricto de prompt injection y confirmación falsa de pagos vía chat.', 1),
    ('RN_02_MAX_DESCUENTO_PCT', 'Descuento Comercial Máximo (%)', 'FINANCIERO', 'PERCENT', '15.0', 'Porcentaje máximo de descuento aplicable en negociación comercial antes de requerir escalamiento a LEADS.', 1),
    ('RN_03_MAX_CUOTAS_INICIAL', 'Máximo Cuotas en Acuerdo Inicial', 'FINANCIERO', 'NUMBER', '3', 'Límite de cuotas en apertura de contrato según política comercial estándar.', 1),
    ('RN_03_MAX_CUOTAS_REESTRUCTURACION', 'Máximo Cuotas en Reestructuración', 'FINANCIERO', 'NUMBER', '6', 'Tope máximo de cuotas permitidas al reestructurar saldo pendiente por hitos académicos.', 1),
    ('RN_04_SLA_ASIGNACION_ASESOR_HRS', 'SLA de Asignación de Asesor (Horas)', 'ACADEMICO', 'NUMBER', '24', 'Tiempo máximo comprometido para vincular al especialista metodológico tras confirmación del pago inicial.', 1),
    ('RN_05_TOPE_YAPE_PLIN_PEN', 'Tope Máximo Yape / Plin (S/)', 'PASARELA', 'NUMBER', '500.00', 'Límite operativo de billeteras digitales por transacción en pasarela Mercado Pago.', 1),
    ('RN_06_VERIFICACION_VOUCHER_CAJA', 'Validación Obligatoria de Voucher por Caja', 'FINANCIERO', 'BOOLEAN', 'true', 'Los pagos por transferencia manual requieren conciliación humana antes de marcarse como CONFIRMADO.', 1),
    ('RN_07_UMBRAL_TURNITIN_MAX_PCT', 'Umbral Máximo de Similitud Turnitin (%)', 'ACADEMICO', 'PERCENT', '15.0', 'Porcentaje máximo admisible de coincidencia en Turnitin para aprobación de entregables según SUNEDU.', 1),
    ('RN_08_ALERTA_RECORDATORIO_HRS', 'Frecuencia de Recordatorio de Cuota (Horas)', 'COBRANZA', 'NUMBER', '4', 'Espaciado mínimo entre alertas automáticas de cobranza para no saturar al tesista.', 1),
    ('RN_09_EXPIRACION_LINK_PAGO_HRS', 'Vigencia de Enlaces de Pago (Horas)', 'PASARELA', 'NUMBER', '72', 'Vigencia máxima de los enlaces generados en Checkout Pro antes de caducar.', 1),
    ('RN_10_BLOQUEO_SUSTENTACION', 'Candado Financiero para Sustentación', 'ACADEMICO', 'BOOLEAN', 'true', 'Requisito mandatorio de saldo S/ 0.00 para emitir el acta final y fecha de sustentación.', 1)
) AS source (codigo, nombre, modulo, tipo_dato, valor, descripcion, activo)
ON target.codigo = source.codigo
WHEN MATCHED THEN
    UPDATE SET nombre = source.nombre, modulo = source.modulo, tipo_dato = source.tipo_dato, valor = source.valor, descripcion = source.descripcion, activo = source.activo, fecha_actualizacion = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
    INSERT (codigo, nombre, modulo, tipo_dato, valor, descripcion, activo)
    VALUES (source.codigo, source.nombre, source.modulo, source.tipo_dato, source.valor, source.descripcion, source.activo);
GO

-- 3. Modalidad de Pago: 4 Cuotas (Reestructurado)
SET IDENTITY_INSERT dbo.MODALIDAD_PAGO ON;
IF NOT EXISTS (SELECT 1 FROM dbo.MODALIDAD_PAGO WHERE modalidad_pago_id = 4)
BEGIN
    INSERT INTO dbo.MODALIDAD_PAGO (modalidad_pago_id, nombre, tipo_modalidad, numero_cuotas, es_contado, condicion, porcentajes_json, activo)
    VALUES (4, '4 cuotas reestructurado', '4 cuotas', 4, 0, '4 cuotas (reestructurado en 2 cuotas por hito)', '[20,30,25,25]', 1);
END;
SET IDENTITY_INSERT dbo.MODALIDAD_PAGO OFF;
GO

-- 4. Tabla BITACORA_TESIS en INBESTIGA_TESIS
IF OBJECT_ID('dbo.BITACORA_TESIS', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.BITACORA_TESIS (
        id NVARCHAR(50) PRIMARY KEY DEFAULT NEWID(),
        customerId NVARCHAR(50) NOT NULL,
        asesorId NVARCHAR(50) NULL,
        fechaRegistro DATETIME NOT NULL DEFAULT GETDATE(),
        hito NVARCHAR(50) NOT NULL,
        titulo NVARCHAR(200) NOT NULL,
        porcentajeAvance INT NOT NULL DEFAULT 50,
        estadoRevision NVARCHAR(50) NOT NULL DEFAULT 'EN_REVISION',
        observaciones NVARCHAR(MAX) NULL,
        turnitinPct DECIMAL(6,2) NULL,
        proximaEntrega NVARCHAR(200) NULL,
        registradoPor NVARCHAR(200) NULL
    );
END
GO

PRINT '✓ Patch de Reglas de Negocio, Modalidad 4 y Bitácora aplicado exitosamente.';
GO
