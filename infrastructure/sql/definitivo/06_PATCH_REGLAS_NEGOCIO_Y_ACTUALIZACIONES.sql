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

-- 2. Población de Reglas de Negocio Oficiales (Literales Unicode N'...' sin mojibake)
MERGE dbo.REGLA_NEGOCIO AS target
USING (VALUES
    ('RN_01_PROMPT_INJECTION', N'Guardrail Anti-Prompt Injection', 'SEGURIDAD', 'BOOLEAN', 'true', N'Bloqueo estricto de prompt injection y confirmación falsa de pagos vía chat.', 1),
    ('RN_02_MAX_DESCUENTO_PCT', N'Descuento Comercial Máximo (%)', 'FINANCIERO', 'PERCENT', '15.0', N'Porcentaje máximo de descuento aplicable en negociación comercial antes de requerir escalamiento a LEADS.', 1),
    ('RN_03_MAX_CUOTAS_INICIAL', N'Máximo Cuotas en Acuerdo Inicial', 'FINANCIERO', 'NUMBER', '3', N'Límite de cuotas en apertura de contrato según política comercial estándar.', 1),
    ('RN_03_MAX_CUOTAS_REESTRUCTURACION', N'Máximo Cuotas en Reestructuración', 'FINANCIERO', 'NUMBER', '6', N'Tope máximo de cuotas permitidas al reestructurar saldo pendiente por hitos académicos.', 1),
    ('RN_04_SLA_ASIGNACION_ASESOR_HRS', N'SLA de Asignación de Asesor (Horas)', 'ACADEMICO', 'NUMBER', '24', N'Tiempo máximo comprometido para vincular al especialista metodológico tras confirmación del pago inicial.', 1),
    ('RN_05_TOPE_YAPE_PLIN_PEN', N'Tope Máximo Yape / Plin (S/)', 'PASARELA', 'NUMBER', '500.00', N'Límite operativo de billeteras digitales por transacción en pasarela Mercado Pago.', 1),
    ('RN_06_VERIFICACION_VOUCHER_CAJA', N'Validación Obligatoria de Voucher por Caja', 'FINANCIERO', 'BOOLEAN', 'true', N'Los pagos por transferencia manual requieren conciliación humana antes de marcarse como CONFIRMADO.', 1),
    ('RN_07_UMBRAL_TURNITIN_MAX_PCT', N'Umbral Máximo de Similitud Turnitin (%)', 'ACADEMICO', 'PERCENT', '15.0', N'Porcentaje máximo admisible de coincidencia en Turnitin para aprobación de entregables según SUNEDU.', 1),
    ('RN_08_ALERTA_RECORDATORIO_HRS', N'Frecuencia de Recordatorio de Cuota (Horas)', 'COBRANZA', 'NUMBER', '4', N'Espaciado mínimo entre alertas automáticas de cobranza para no saturar al tesista.', 1),
    ('RN_09_EXPIRACION_LINK_PAGO_HRS', N'Vigencia de Enlaces de Pago (Horas)', 'PASARELA', 'NUMBER', '72', N'Vigencia máxima de los enlaces generados en Checkout Pro antes de caducar.', 1),
    ('RN_10_BLOQUEO_SUSTENTACION', N'Candado Financiero para Sustentación', 'ACADEMICO', 'BOOLEAN', 'true', N'Requisito mandatorio de saldo S/ 0.00 para emitir el acta final y fecha de sustentación.', 1),
    ('RN_11_PERMITIR_ANULACION_PAGO', N'Permitir Anulación de Pagos Confirmados', 'FINANCIERO', 'BOOLEAN', 'true', N'Habilita al administrador o asesor de Caja anular un pago confirmado (reversa contable), revirtiendo la cuota a exigible y recalculando la orden y el Data Mart.', 1),
    ('RN_12_CANCELAR_CUOTAS_PENDIENTES', N'Permitir Cancelación de Cuotas Pendientes', 'FINANCIERO', 'BOOLEAN', 'true', N'Habilita cancelar o anular cuotas pendientes futuras (EXIGIBLE, ESPERA_HITO, ENLACE_ENVIADO, VENCIDA) cuando el estudiante desiste o lo solicita administración, deteniendo enlaces y recordatorios sin revertir pagos ya confirmados.', 1)
) AS source (codigo, nombre, modulo, tipo_dato, valor, descripcion, activo)
ON target.codigo = source.codigo
WHEN MATCHED THEN
    UPDATE SET nombre = source.nombre, modulo = source.modulo, tipo_dato = source.tipo_dato, valor = source.valor, descripcion = source.descripcion, activo = source.activo, fecha_actualizacion = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
    INSERT (codigo, nombre, modulo, tipo_dato, valor, descripcion, activo)
    VALUES (source.codigo, source.nombre, source.modulo, source.tipo_dato, source.valor, source.descripcion, source.activo);
GO

-- 2.1 Permitir estado ANULADO en PAGO (para cumplimiento de RN_11_PERMITIR_ANULACION_PAGO)
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_PAGO_ESTADO' AND parent_object_id = OBJECT_ID('dbo.PAGO'))
BEGIN
    ALTER TABLE dbo.PAGO DROP CONSTRAINT CK_PAGO_ESTADO;
END;
ALTER TABLE dbo.PAGO WITH CHECK ADD CONSTRAINT CK_PAGO_ESTADO
    CHECK (estado IN ('INICIADO', 'POR_VERIFICAR', 'CONFIRMADO', 'RECHAZADO', 'OBSERVADO', 'REEMBOLSADO', 'ANULADO'));
GO

-- 2.2 Alinear CONFIGURACION_AGENTE (solo comportamiento conversacional + proveedor real OpenAI con fallback Gemini; sin reglas hardcoded)
IF EXISTS (SELECT 1 FROM sys.databases WHERE name = 'inbestiga_db')
   AND OBJECT_ID('inbestiga_db.dbo.CONFIGURACION_AGENTE', 'U') IS NOT NULL
BEGIN
    UPDATE inbestiga_db.dbo.CONFIGURACION_AGENTE
    SET
        proveedorIA = 'OPENAI',
        modelo = 'gpt-4o-mini',
        promptSistema = N'Eres el Asesor Virtual Especialista de Cobranza y Activación Académica de INBESTIGA.TESIS. Tu misión es acompañar cordialmente al estudiante que ya aceptó su cotización, guiarlo a completar su pago por los canales oficiales (Mercado Pago Checkout Pro o transferencia bancaria verificada), explicarle con claridad sus facilidades de pago y acompañar la activación de su servicio académico. Comunícate siempre con calidez humana, claridad ejecutiva y respeto estricto de las políticas y reglas vigentes configuradas en el sistema.',
        tono = N'Profesional, empático, financiero-académico y determinístico',
        estilo = N'Especialista de Cobranza y Activación PAYERS v2.0',
        permitirNegociacion = 0,
        maxDescuentoNegociablePct = 0.00,
        maxCuotasNegociables = 6
    WHERE activo = 1;
END;
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

-- 5. Stored Procedure para sincronizar INBESTIGA_MART desde INBESTIGA_TESIS en vivo
USE INBESTIGA_MART;
GO

CREATE OR ALTER PROCEDURE dbo.sp_etl_sync_inbestiga_mart
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- 5.1 Asegurar fechas faltantes en DIM_TIEMPO
    ;WITH Fechas AS (
        SELECT DISTINCT CAST(fecha_creacion AS DATE) AS dt FROM INBESTIGA_TESIS.dbo.ORDEN_PAGO WHERE fecha_creacion IS NOT NULL
        UNION
        SELECT DISTINCT CAST(fecha_confirmacion AS DATE) FROM INBESTIGA_TESIS.dbo.PAGO WHERE fecha_confirmacion IS NOT NULL
        UNION
        SELECT DISTINCT CAST(fecha_envio AS DATE) FROM INBESTIGA_TESIS.dbo.ALERTA_COBRANZA WHERE fecha_envio IS NOT NULL
        UNION
        SELECT CAST(GETDATE() AS DATE)
    )
    INSERT INTO dbo.DIM_TIEMPO (Anio, Trimestre, NroMes, Mes, Semana, DiaSemana, Dia, idFecha)
    SELECT
        YEAR(f.dt),
        CONCAT(YEAR(f.dt), '-T', DATEPART(QUARTER, f.dt)),
        MONTH(f.dt),
        DATENAME(MONTH, f.dt),
        DATEPART(ISO_WEEK, f.dt),
        DATENAME(WEEKDAY, f.dt),
        DAY(f.dt),
        f.dt
    FROM Fechas f
    WHERE NOT EXISTS (SELECT 1 FROM dbo.DIM_TIEMPO d WHERE d.idFecha = f.dt);

    -- 5.2 Sincronizar DIM_MODALIDAD_PAGO (incluyendo modalidad reestructurada id=4)
    MERGE dbo.DIM_MODALIDAD_PAGO AS d
    USING (
        SELECT
            tipo_modalidad AS TipoModalidad,
            numero_cuotas AS NumeroCuotas,
            condicion AS Condicion,
            modalidad_pago_id AS idModalidadPago
        FROM INBESTIGA_TESIS.dbo.MODALIDAD_PAGO
    ) AS s
    ON d.idModalidadPago = s.idModalidadPago
    WHEN MATCHED THEN
        UPDATE SET
            d.TipoModalidad = s.TipoModalidad,
            d.NumeroCuotas = s.NumeroCuotas,
            d.Condicion = s.Condicion
    WHEN NOT MATCHED THEN
        INSERT (TipoModalidad, NumeroCuotas, Condicion, idModalidadPago)
        VALUES (s.TipoModalidad, s.NumeroCuotas, s.Condicion, s.idModalidadPago);

    -- 5.3 Refrescar dimensiones complementarias de alertas y cuotas
    DELETE FROM dbo.FACT_RECUPERACION_COBRANZA;
    DELETE FROM dbo.FACT_ORDEN_COBRANZA;
    DELETE FROM dbo.FACT_COBRANZA;
    DELETE FROM dbo.FACT_PAGO;
    DELETE FROM dbo.DIM_ALERTA WHERE KeyAlerta NOT IN (0, -1);
    DELETE FROM dbo.DIM_CUOTA WHERE KeyCuota NOT IN (0, -1);

    INSERT INTO dbo.DIM_ALERTA (TipoAlerta, Secuencia, Escalado, idAlerta)
    SELECT
        ISNULL(ac.tipo, 'SIN CLASIFICAR'),
        ISNULL(ac.secuencia, 'SIN CLASIFICAR'),
        ISNULL(ac.escalado, 0),
        ac.alerta_cobranza_id
    FROM INBESTIGA_TESIS.dbo.ALERTA_COBRANZA ac;

    INSERT INTO dbo.DIM_CUOTA (CondicionCuota, NumeroCuota, idCuota)
    SELECT
        ISNULL(cp.condicion, 'SIN CLASIFICAR'),
        ISNULL(cp.numero_cuota, 1),
        cp.cuota_id
    FROM INBESTIGA_TESIS.dbo.CUOTA_PAGO cp;

    -- 5.4 Recargar FACT_COBRANZA (Grano: 1 fila por ORDEN_PAGO)
    INSERT INTO dbo.FACT_COBRANZA (
        KeyTiempo, KeyServicio, KeyModalidadPago, KeyPagador,
        orden_creada, orden_con_pago, minutos_a_primer_pago,
        pendiente_alertado, pendiente_recuperado, monto_exigible, monto_cobrado
    )
    SELECT
        ISNULL(dt.KeyTiempo, 0),
        ISNULL(ds.KeyServicio, 0),
        ISNULL(dmp.KeyModalidadPago, 0),
        ISNULL(dpg.KeyPagador, 0),
        1,
        CASE WHEN pg.cantidad_pagos > 0 THEN 1 ELSE 0 END,
        CASE WHEN pg.primera_confirmacion IS NULL THEN NULL ELSE DATEDIFF(MINUTE, o.fecha_creacion, pg.primera_confirmacion) END,
        CASE WHEN ac.cantidad_alertas > 0 THEN 1 ELSE 0 END,
        ISNULL(ac.recuperado, 0),
        ISNULL(cp.monto_exigible, 0),
        ISNULL(pg.monto_cobrado, 0)
    FROM INBESTIGA_TESIS.dbo.ORDEN_PAGO o
    INNER JOIN INBESTIGA_TESIS.dbo.PROPUESTA pr ON pr.propuesta_id = o.propuesta_id
    LEFT JOIN dbo.DIM_TIEMPO dt ON dt.idFecha = CAST(o.fecha_creacion AS DATE)
    LEFT JOIN dbo.DIM_SERVICIO ds ON ds.idServicio = pr.servicio_id
    LEFT JOIN dbo.DIM_MODALIDAD_PAGO dmp ON dmp.idModalidadPago = o.modalidad_pago_id
    LEFT JOIN dbo.DIM_PAGADOR dpg ON dpg.idResponsablePago = o.responsable_pago_id
    LEFT JOIN (
        SELECT orden_pago_id, SUM(monto_programado) AS monto_exigible
        FROM INBESTIGA_TESIS.dbo.CUOTA_PAGO
        WHERE estado <> 'ANULADA'
        GROUP BY orden_pago_id
    ) cp ON cp.orden_pago_id = o.orden_pago_id
    LEFT JOIN (
        SELECT orden_pago_id, COUNT(*) AS cantidad_pagos, MIN(fecha_confirmacion) AS primera_confirmacion, SUM(monto_pagado) AS monto_cobrado
        FROM INBESTIGA_TESIS.dbo.PAGO
        WHERE estado = 'CONFIRMADO'
        GROUP BY orden_pago_id
    ) pg ON pg.orden_pago_id = o.orden_pago_id
    LEFT JOIN (
        SELECT orden_pago_id, COUNT(*) AS cantidad_alertas, MAX(CASE WHEN resultado = 'RECUPERADO' THEN 1 ELSE 0 END) AS recuperado
        FROM INBESTIGA_TESIS.dbo.ALERTA_COBRANZA
        GROUP BY orden_pago_id
    ) ac ON ac.orden_pago_id = o.orden_pago_id;

    -- 5.5 Recargar FACT_ORDEN_COBRANZA (Grano: 1 fila por ORDEN_PAGO con modalidad vigente)
    INSERT INTO dbo.FACT_ORDEN_COBRANZA (
        KeyTiempo, KeyServicio, KeyModalidadPago, KeyPagador,
        orden_creada, orden_con_pago, monto_comprometido, monto_exigible, monto_cobrado, minutos_a_primer_pago
    )
    SELECT
        ISNULL(dt.KeyTiempo, 0),
        ISNULL(ds.KeyServicio, 0),
        ISNULL(dmp.KeyModalidadPago, 0),
        ISNULL(dpg.KeyPagador, 0),
        1,
        CASE WHEN pg.cantidad_pagos > 0 THEN 1 ELSE 0 END,
        o.monto_comprometido,
        ISNULL(cp.monto_exigible, 0),
        ISNULL(pg.monto_cobrado, 0),
        CASE WHEN pg.primera_confirmacion IS NOT NULL THEN DATEDIFF(MINUTE, o.fecha_creacion, pg.primera_confirmacion) ELSE NULL END
    FROM INBESTIGA_TESIS.dbo.ORDEN_PAGO o
    INNER JOIN INBESTIGA_TESIS.dbo.PROPUESTA pr ON pr.propuesta_id = o.propuesta_id
    LEFT JOIN dbo.DIM_TIEMPO dt ON dt.idFecha = CAST(o.fecha_creacion AS DATE)
    LEFT JOIN dbo.DIM_SERVICIO ds ON ds.idServicio = pr.servicio_id
    LEFT JOIN dbo.DIM_MODALIDAD_PAGO dmp ON dmp.idModalidadPago = o.modalidad_pago_id
    LEFT JOIN dbo.DIM_PAGADOR dpg ON dpg.idResponsablePago = o.responsable_pago_id
    LEFT JOIN (
        SELECT orden_pago_id, SUM(monto_programado) AS monto_exigible
        FROM INBESTIGA_TESIS.dbo.CUOTA_PAGO
        WHERE estado <> 'ANULADA'
        GROUP BY orden_pago_id
    ) cp ON cp.orden_pago_id = o.orden_pago_id
    LEFT JOIN (
        SELECT orden_pago_id, COUNT(*) AS cantidad_pagos, MIN(fecha_confirmacion) AS primera_confirmacion, SUM(monto_pagado) AS monto_cobrado
        FROM INBESTIGA_TESIS.dbo.PAGO
        WHERE estado = 'CONFIRMADO'
        GROUP BY orden_pago_id
    ) pg ON pg.orden_pago_id = o.orden_pago_id;

    -- 5.6 Recargar FACT_PAGO (Grano: 1 fila por PAGO confirmado)
    INSERT INTO dbo.FACT_PAGO (
        KeyTiempo, KeyServicio, KeyModalidadPago, KeyMedioPago,
        pago_por_webhook, pago_confirmado, comision_pasarela, monto_pagado
    )
    SELECT
        ISNULL(dt.KeyTiempo, 0),
        ISNULL(ds.KeyServicio, 0),
        ISNULL(dmp.KeyModalidadPago, 0),
        ISNULL(dmed.KeyMedioPago, 0),
        CASE WHEN ew.eventos > 0 THEN 1 ELSE 0 END,
        1,
        ISNULL(p.comision_pasarela, 0),
        p.monto_pagado
    FROM INBESTIGA_TESIS.dbo.PAGO p
    INNER JOIN INBESTIGA_TESIS.dbo.ORDEN_PAGO o ON o.orden_pago_id = p.orden_pago_id
    INNER JOIN INBESTIGA_TESIS.dbo.PROPUESTA pr ON pr.propuesta_id = o.propuesta_id
    LEFT JOIN dbo.DIM_TIEMPO dt ON dt.idFecha = CAST(p.fecha_confirmacion AS DATE)
    LEFT JOIN dbo.DIM_SERVICIO ds ON ds.idServicio = pr.servicio_id
    LEFT JOIN dbo.DIM_MODALIDAD_PAGO dmp ON dmp.idModalidadPago = o.modalidad_pago_id
    LEFT JOIN dbo.DIM_MEDIO_PAGO dmed ON dmed.idMedioPago = p.medio_pago_id
    LEFT JOIN (
        SELECT pago_id, COUNT(*) AS eventos
        FROM INBESTIGA_TESIS.dbo.EVENTO_WEBHOOK
        WHERE procesado = 1
        GROUP BY pago_id
    ) ew ON ew.pago_id = p.pago_id
    WHERE p.estado = 'CONFIRMADO'
      AND p.fecha_confirmacion IS NOT NULL;

    -- 5.7 Recargar FACT_RECUPERACION_COBRANZA (Grano: 1 fila por ALERTA_COBRANZA)
    INSERT INTO dbo.FACT_RECUPERACION_COBRANZA (
        KeyTiempo, KeyAlerta, KeyServicio, KeyModalidadPago,
        pendiente_alertado, pendiente_recuperado
    )
    SELECT
        ISNULL(dt.KeyTiempo, 0),
        ISNULL(da.KeyAlerta, 0),
        ISNULL(ds.KeyServicio, 0),
        ISNULL(dmp.KeyModalidadPago, 0),
        1,
        CASE WHEN ac.resultado = 'RECUPERADO' THEN 1 ELSE 0 END
    FROM INBESTIGA_TESIS.dbo.ALERTA_COBRANZA ac
    INNER JOIN INBESTIGA_TESIS.dbo.ORDEN_PAGO o ON o.orden_pago_id = ac.orden_pago_id
    INNER JOIN INBESTIGA_TESIS.dbo.PROPUESTA pr ON pr.propuesta_id = o.propuesta_id
    LEFT JOIN dbo.DIM_TIEMPO dt ON dt.idFecha = CAST(ac.fecha_envio AS DATE)
    LEFT JOIN dbo.DIM_ALERTA da ON da.idAlerta = ac.alerta_cobranza_id
    LEFT JOIN dbo.DIM_SERVICIO ds ON ds.idServicio = pr.servicio_id
    LEFT JOIN dbo.DIM_MODALIDAD_PAGO dmp ON dmp.idModalidadPago = o.modalidad_pago_id;
END;
GO

-- 5.8 Actualizar vista analítica para excluir cuotas ANULADA en monto_exigible
IF OBJECT_ID('dbo.vw_rpayers_ordenes_detalle', 'V') IS NOT NULL
BEGIN
    EXEC('
    ALTER VIEW dbo.vw_rpayers_ordenes_detalle AS
    SELECT
        o.orden_pago_id AS id_orden_pago,
        o.codigo_orden,
        CONCAT(''CTR-2026-'', RIGHT(CONCAT(''0000'', o.contrato_id), 4)) AS codigo_contrato,
        ISNULL(c.estado, ''CONFIRMADO'') AS estado_contrato,
        ct.contacto_id AS id_estudiante,
        CONCAT(ct.nombres, '' '', ct.apellidos) AS estudiante,
        ct.telefono,
        ct.email,
        ca.nombre AS carrera,
        ca.facultad AS facultad,
        u.nombre AS universidad,
        s.nombre AS servicio,
        s.tipo_servicio AS linea_servicio,
        mp.condicion AS modalidad_pago,
        mp.numero_cuotas,
        rp.tipo_responsable,
        rp.segmento AS segmento_pagador,
        o.monto_comprometido,
        ISNULL(cuo.monto_exigible, 0) AS monto_exigible,
        ISNULL(pag.monto_cobrado, 0) AS monto_cobrado,
        ISNULL(pag.pagos_confirmados, 0) AS pagos_confirmados,
        ISNULL(pag.comision_total, 0) AS comision_pasarela,
        o.estado AS estado_orden,
        o.fecha_creacion,
        pag.primer_pago_en,
        CASE
            WHEN pag.primer_pago_en IS NOT NULL THEN DATEDIFF(MINUTE, o.fecha_creacion, pag.primer_pago_en)
            ELSE NULL
        END AS minutos_a_primer_pago,
        al.tipo AS tipo_alerta,
        al.secuencia AS secuencia_alerta,
        CASE WHEN al.resultado = ''RECUPERADO'' THEN 1 ELSE 0 END AS alerta_recuperada,
        ISNULL(al.escalado, 0) AS alerta_escalada
    FROM INBESTIGA_TESIS.dbo.ORDEN_PAGO o
    INNER JOIN INBESTIGA_TESIS.dbo.PROPUESTA pr ON pr.propuesta_id = o.propuesta_id
    INNER JOIN INBESTIGA_TESIS.dbo.LEAD l ON l.lead_id = pr.lead_id
    INNER JOIN INBESTIGA_TESIS.dbo.BUYER b ON b.buyer_id = l.buyer_id
    INNER JOIN INBESTIGA_TESIS.dbo.CONTACTO ct ON ct.contacto_id = b.contacto_id
    INNER JOIN INBESTIGA_TESIS.dbo.PERFIL_ACADEMICO pa ON pa.contacto_id = ct.contacto_id
    INNER JOIN INBESTIGA_TESIS.dbo.CARRERA ca ON ca.carrera_id = pa.carrera_id
    INNER JOIN INBESTIGA_TESIS.dbo.UNIVERSIDAD u ON u.universidad_id = ca.universidad_id
    INNER JOIN INBESTIGA_TESIS.dbo.SERVICIO s ON s.servicio_id = pr.servicio_id
    INNER JOIN INBESTIGA_TESIS.dbo.MODALIDAD_PAGO mp ON mp.modalidad_pago_id = o.modalidad_pago_id
    LEFT JOIN INBESTIGA_TESIS.dbo.CONTRATO c ON c.contrato_id = o.contrato_id
    LEFT JOIN INBESTIGA_TESIS.dbo.RESPONSABLE_PAGO rp ON rp.responsable_pago_id = o.responsable_pago_id
    OUTER APPLY (
        SELECT SUM(cp.monto_programado) AS monto_exigible
        FROM INBESTIGA_TESIS.dbo.CUOTA_PAGO cp
        WHERE cp.orden_pago_id = o.orden_pago_id
          AND cp.estado <> ''ANULADA''
    ) cuo
    OUTER APPLY (
        SELECT
            SUM(CASE WHEN p.estado = ''CONFIRMADO'' THEN p.monto_pagado ELSE 0 END) AS monto_cobrado,
            SUM(CASE WHEN p.estado = ''CONFIRMADO'' THEN 1 ELSE 0 END) AS pagos_confirmados,
            SUM(CASE WHEN p.estado = ''CONFIRMADO'' THEN p.comision_pasarela ELSE 0 END) AS comision_total,
            MIN(CASE WHEN p.estado = ''CONFIRMADO'' THEN p.fecha_confirmacion END) AS primer_pago_en
        FROM INBESTIGA_TESIS.dbo.PAGO p
        WHERE p.orden_pago_id = o.orden_pago_id
    ) pag
    OUTER APPLY (
        SELECT TOP 1
            ac.tipo,
            ac.secuencia,
            ac.resultado,
            ac.escalado
        FROM INBESTIGA_TESIS.dbo.ALERTA_COBRANZA ac
        WHERE ac.orden_pago_id = o.orden_pago_id
        ORDER BY ac.alerta_cobranza_id DESC
    ) al;
    ');
END;
GO

EXEC INBESTIGA_MART.dbo.sp_etl_sync_inbestiga_mart;
GO
USE INBESTIGA_TESIS;
GO
