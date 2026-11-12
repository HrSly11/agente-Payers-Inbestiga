/* ============================================================================
   SCRIPT 05: VISTAS ANALÍTICAS Y PROCEDIMIENTO ETL DEL REPORTE R-PAYERS
   Proyecto: INBESTIGA - Fase 3 PAYERS (Agente de Cobranza Automatizada)
   Descripción:
     1. Puebla las tablas complementarias de PAYERS en INBESTIGA_MART
        (DIM_ALERTA, DIM_CUOTA, FACT_ORDEN_COBRANZA, FACT_RECUPERACION_COBRANZA).
     2. Crea las vistas analíticas oficiales del Reporte R-PAYERS (Sección 5.9):
        - dbo.vw_rpayers_kpis (KPIs P01 a P06 con metas y semáforos)
        - dbo.vw_rpayers_vista_3_1_ordenes (Vista 3.1 por Modalidad de Pago)
        - dbo.vw_rpayers_vista_3_1_servicio (Vista 3.1 por Tipo de Servicio + P02)
        - dbo.vw_rpayers_vista_3_2_recuperacion (Vista 3.2 por Tipo de Alerta)
        - dbo.vw_rpayers_vista_3_3_medios (Vista 3.3 por Medio de Pago y Canal)
        - dbo.vw_rpayers_ordenes_detalle (Detalle operativo-analítico de las 104 órdenes)
============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

USE INBESTIGA_MART;
GO

-- 1. POBLAR DIM_ALERTA Y DIM_CUOTA COMPLEMENTARIAS
DELETE FROM dbo.FACT_RECUPERACION_COBRANZA;
DELETE FROM dbo.FACT_ORDEN_COBRANZA;
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

-- 2. POBLAR FACT_ORDEN_COBRANZA (Grano: 1 fila por ORDEN_PAGO con monto_comprometido)
INSERT INTO dbo.FACT_ORDEN_COBRANZA (
    KeyTiempo, KeyServicio, KeyModalidadPago, KeyPagador,
    orden_creada, orden_con_pago, monto_comprometido, monto_exigible, monto_cobrado, minutos_a_primer_pago
)
SELECT
    ISNULL(dt.KeyTiempo, 0),
    ISNULL(ds.KeyServicio, 0),
    ISNULL(dmp.KeyModalidadPago, 0),
    ISNULL(dpg.KeyPagador, 0),
    1 AS orden_creada,
    CASE WHEN pg.cantidad_pagos > 0 THEN 1 ELSE 0 END AS orden_con_pago,
    o.monto_comprometido,
    ISNULL(cp.monto_exigible, 0) AS monto_exigible,
    ISNULL(pg.monto_cobrado, 0) AS monto_cobrado,
    CASE
        WHEN pg.primera_confirmacion IS NOT NULL THEN DATEDIFF(MINUTE, o.fecha_creacion, pg.primera_confirmacion)
        ELSE NULL
    END AS minutos_a_primer_pago
FROM INBESTIGA_TESIS.dbo.ORDEN_PAGO o
INNER JOIN INBESTIGA_TESIS.dbo.PROPUESTA pr ON pr.propuesta_id = o.propuesta_id
LEFT JOIN dbo.DIM_TIEMPO dt ON dt.idFecha = CAST(o.fecha_creacion AS DATE)
LEFT JOIN dbo.DIM_SERVICIO ds ON ds.idServicio = pr.servicio_id
LEFT JOIN dbo.DIM_MODALIDAD_PAGO dmp ON dmp.idModalidadPago = o.modalidad_pago_id
LEFT JOIN dbo.DIM_PAGADOR dpg ON dpg.idResponsablePago = o.responsable_pago_id
LEFT JOIN (
    SELECT orden_pago_id, SUM(monto_programado) AS monto_exigible
    FROM INBESTIGA_TESIS.dbo.CUOTA_PAGO
    GROUP BY orden_pago_id
) cp ON cp.orden_pago_id = o.orden_pago_id
LEFT JOIN (
    SELECT
        orden_pago_id,
        COUNT(*) AS cantidad_pagos,
        MIN(fecha_confirmacion) AS primera_confirmacion,
        SUM(monto_pagado) AS monto_cobrado
    FROM INBESTIGA_TESIS.dbo.PAGO
    WHERE estado = 'CONFIRMADO'
    GROUP BY orden_pago_id
) pg ON pg.orden_pago_id = o.orden_pago_id;

-- 3. POBLAR FACT_RECUPERACION_COBRANZA (Grano: 1 fila por ALERTA_COBRANZA)
INSERT INTO dbo.FACT_RECUPERACION_COBRANZA (
    KeyTiempo, KeyAlerta, KeyServicio, KeyModalidadPago,
    pendiente_alertado, pendiente_recuperado
)
SELECT
    ISNULL(dt.KeyTiempo, 0),
    ISNULL(da.KeyAlerta, 0),
    ISNULL(ds.KeyServicio, 0),
    ISNULL(dmp.KeyModalidadPago, 0),
    1 AS pendiente_alertado,
    CASE WHEN ac.resultado = 'RECUPERADO' THEN 1 ELSE 0 END AS pendiente_recuperado
FROM INBESTIGA_TESIS.dbo.ALERTA_COBRANZA ac
INNER JOIN INBESTIGA_TESIS.dbo.ORDEN_PAGO o ON o.orden_pago_id = ac.orden_pago_id
INNER JOIN INBESTIGA_TESIS.dbo.PROPUESTA pr ON pr.propuesta_id = o.propuesta_id
LEFT JOIN dbo.DIM_TIEMPO dt ON dt.idFecha = CAST(ac.fecha_envio AS DATE)
LEFT JOIN dbo.DIM_ALERTA da ON da.idAlerta = ac.alerta_cobranza_id
LEFT JOIN dbo.DIM_SERVICIO ds ON ds.idServicio = pr.servicio_id
LEFT JOIN dbo.DIM_MODALIDAD_PAGO dmp ON dmp.idModalidadPago = o.modalidad_pago_id;
GO

/* ============================================================================
   VISTA 1: dbo.vw_rpayers_kpis (KPIs P01 a P06 del Agente de Cobranza PAYERS)
============================================================================ */
CREATE OR ALTER VIEW dbo.vw_rpayers_kpis AS
WITH CobranzaAgg AS (
    SELECT
        SUM(fc.orden_creada) AS total_ordenes,
        SUM(fc.orden_con_pago) AS ordenes_con_pago,
        CAST(AVG(CAST(fc.minutos_a_primer_pago AS DECIMAL(10,2))) AS DECIMAL(10,1)) AS p02_minutos,
        SUM(fc.pendiente_alertado) AS total_alertados,
        SUM(fc.pendiente_recuperado) AS total_recuperados,
        SUM(fc.monto_exigible) AS monto_exigible,
        SUM(fc.monto_cobrado) AS monto_cobrado
    FROM dbo.FACT_COBRANZA fc
),
PagoAgg AS (
    SELECT
        SUM(fp.pago_confirmado) AS total_pagos_confirmados,
        SUM(fp.pago_por_webhook) AS pagos_por_webhook,
        SUM(fp.monto_pagado) AS monto_pagado,
        SUM(fp.comision_pasarela) AS comision_pasarela
    FROM dbo.FACT_PAGO fp
)
SELECT
    1 AS orden,
    'P01' AS codigo,
    'Tasa de confirmación de pago' AS nombre,
    'Eficacia' AS tipo,
    CAST(ROUND((CAST(c.ordenes_con_pago AS DECIMAL(10,2)) * 100.0) / NULLIF(c.total_ordenes, 0), 1) AS DECIMAL(10,1)) AS valor,
    '%' AS unidad,
    80.0 AS meta_bueno,
    '65% - 79%' AS rango_regular,
    '< 65%' AS rango_malo,
    CASE
        WHEN (CAST(c.ordenes_con_pago AS DECIMAL(10,2)) * 100.0) / NULLIF(c.total_ordenes, 0) >= 80.0 THEN 'Bueno'
        WHEN (CAST(c.ordenes_con_pago AS DECIMAL(10,2)) * 100.0) / NULLIF(c.total_ordenes, 0) >= 65.0 THEN 'Regular'
        ELSE 'Malo'
    END AS estado_semaforo,
    CAST(c.ordenes_con_pago AS DECIMAL(18,2)) AS numerador,
    CAST(c.total_ordenes AS DECIMAL(18,2)) AS denominador,
    CONCAT(c.ordenes_con_pago, ' / ', c.total_ordenes, ' órdenes') AS detalle_formula,
    'Mensual' AS frecuencia
FROM CobranzaAgg c
UNION ALL
SELECT
    2 AS orden,
    'P02' AS codigo,
    'Tiempo hasta el primer pago' AS nombre,
    'Eficiencia' AS tipo,
    c.p02_minutos AS valor,
    'min' AS unidad,
    10.0 AS meta_bueno,
    '10 - 30 min' AS rango_regular,
    '> 30 min' AS rango_malo,
    CASE
        WHEN c.p02_minutos <= 10.0 THEN 'Bueno'
        WHEN c.p02_minutos <= 30.0 THEN 'Regular'
        ELSE 'Malo'
    END AS estado_semaforo,
    c.p02_minutos AS numerador,
    CAST(c.ordenes_con_pago AS DECIMAL(18,2)) AS denominador,
    CONCAT(c.p02_minutos, ' min promedio (', c.ordenes_con_pago, ' órdenes activadas)') AS detalle_formula,
    'Semanal' AS frecuencia
FROM CobranzaAgg c
UNION ALL
SELECT
    3 AS orden,
    'P03' AS codigo,
    'Tasa de recuperación de pago pendiente' AS nombre,
    'Eficacia' AS tipo,
    CAST(ROUND((CAST(c.total_recuperados AS DECIMAL(10,2)) * 100.0) / NULLIF(c.total_alertados, 0), 1) AS DECIMAL(10,1)) AS valor,
    '%' AS unidad,
    25.0 AS meta_bueno,
    '15% - 24%' AS rango_regular,
    '< 15%' AS rango_malo,
    CASE
        WHEN (CAST(c.total_recuperados AS DECIMAL(10,2)) * 100.0) / NULLIF(c.total_alertados, 0) >= 25.0 THEN 'Bueno'
        WHEN (CAST(c.total_recuperados AS DECIMAL(10,2)) * 100.0) / NULLIF(c.total_alertados, 0) >= 15.0 THEN 'Regular'
        ELSE 'Malo'
    END AS estado_semaforo,
    CAST(c.total_recuperados AS DECIMAL(18,2)) AS numerador,
    CAST(c.total_alertados AS DECIMAL(18,2)) AS denominador,
    CONCAT(c.total_recuperados, ' / ', c.total_alertados, ' alertados recuperados (≤72h)') AS detalle_formula,
    'Semanal' AS frecuencia
FROM CobranzaAgg c
UNION ALL
SELECT
    4 AS orden,
    'P04' AS codigo,
    'Tasa de cobranza efectiva' AS nombre,
    'Eficacia' AS tipo,
    CAST(ROUND((c.monto_cobrado * 100.0) / NULLIF(c.monto_exigible, 0), 1) AS DECIMAL(10,1)) AS valor,
    '%' AS unidad,
    90.0 AS meta_bueno,
    '80% - 89%' AS rango_regular,
    '< 80%' AS rango_malo,
    CASE
        WHEN (c.monto_cobrado * 100.0) / NULLIF(c.monto_exigible, 0) >= 90.0 THEN 'Bueno'
        WHEN (c.monto_cobrado * 100.0) / NULLIF(c.monto_exigible, 0) >= 80.0 THEN 'Regular'
        ELSE 'Malo'
    END AS estado_semaforo,
    c.monto_cobrado AS numerador,
    c.monto_exigible AS denominador,
    CONCAT('S/ ', FORMAT(c.monto_cobrado, 'N2'), ' / S/ ', FORMAT(c.monto_exigible, 'N2')) AS detalle_formula,
    'Mensual' AS frecuencia
FROM CobranzaAgg c
UNION ALL
SELECT
    5 AS orden,
    'P05' AS codigo,
    'Tasa de confirmación automática por webhook' AS nombre,
    'Eficiencia' AS tipo,
    CAST(ROUND((CAST(p.pagos_por_webhook AS DECIMAL(10,2)) * 100.0) / NULLIF(p.total_pagos_confirmados, 0), 1) AS DECIMAL(10,1)) AS valor,
    '%' AS unidad,
    80.0 AS meta_bueno,
    '60% - 79%' AS rango_regular,
    '< 60%' AS rango_malo,
    CASE
        WHEN (CAST(p.pagos_por_webhook AS DECIMAL(10,2)) * 100.0) / NULLIF(p.total_pagos_confirmados, 0) >= 80.0 THEN 'Bueno'
        WHEN (CAST(p.pagos_por_webhook AS DECIMAL(10,2)) * 100.0) / NULLIF(p.total_pagos_confirmados, 0) >= 60.0 THEN 'Regular'
        ELSE 'Malo'
    END AS estado_semaforo,
    CAST(p.pagos_por_webhook AS DECIMAL(18,2)) AS numerador,
    CAST(p.total_pagos_confirmados AS DECIMAL(18,2)) AS denominador,
    CONCAT(p.pagos_por_webhook, ' / ', p.total_pagos_confirmados, ' pagos confirmados') AS detalle_formula,
    'Semanal' AS frecuencia
FROM PagoAgg p
UNION ALL
SELECT
    6 AS orden,
    'P06' AS codigo,
    'Costo de cobro sobre ingresos' AS nombre,
    'Economía' AS tipo,
    CAST(ROUND((p.comision_pasarela * 100.0) / NULLIF(p.monto_pagado, 0), 2) AS DECIMAL(10,2)) AS valor,
    '%' AS unidad,
    3.5 AS meta_bueno,
    '3.5% - 4.5%' AS rango_regular,
    '> 4.5%' AS rango_malo,
    CASE
        WHEN (p.comision_pasarela * 100.0) / NULLIF(p.monto_pagado, 0) <= 3.5 THEN 'Bueno'
        WHEN (p.comision_pasarela * 100.0) / NULLIF(p.monto_pagado, 0) <= 4.5 THEN 'Regular'
        ELSE 'Malo'
    END AS estado_semaforo,
    p.comision_pasarela AS numerador,
    p.monto_pagado AS denominador,
    CONCAT('S/ ', FORMAT(p.comision_pasarela, 'N2'), ' / S/ ', FORMAT(p.monto_pagado, 'N2')) AS detalle_formula,
    'Mensual' AS frecuencia
FROM PagoAgg p;
GO

/* ============================================================================
   VISTA 2: dbo.vw_rpayers_vista_3_1_ordenes
   Vista 3.1 — Cobranza por orden de pago y modalidad (P01, P02 y P04)
============================================================================ */
CREATE OR ALTER VIEW dbo.vw_rpayers_vista_3_1_ordenes AS
WITH BaseModalidad AS (
    SELECT
        dmp.idModalidadPago AS orden_fila,
        dmp.Condicion AS modalidad_pago,
        dmp.TipoModalidad AS tipo_modalidad,
        dmp.NumeroCuotas AS numero_cuotas,
        SUM(foc.orden_creada) AS ordenes_creadas,
        SUM(foc.orden_con_pago) AS ordenes_con_pago,
        SUM(foc.monto_comprometido) AS monto_comprometido,
        SUM(foc.monto_exigible) AS monto_exigible,
        SUM(foc.monto_cobrado) AS monto_cobrado,
        CAST(AVG(CAST(foc.minutos_a_primer_pago AS DECIMAL(10,2))) AS DECIMAL(10,1)) AS minutos_primer_pago
    FROM dbo.FACT_ORDEN_COBRANZA foc
    INNER JOIN dbo.DIM_MODALIDAD_PAGO dmp ON dmp.KeyModalidadPago = foc.KeyModalidadPago
    GROUP BY dmp.idModalidadPago, dmp.Condicion, dmp.TipoModalidad, dmp.NumeroCuotas
)
SELECT
    orden_fila,
    modalidad_pago,
    tipo_modalidad,
    numero_cuotas,
    ordenes_creadas,
    ordenes_con_pago,
    CAST(ROUND((CAST(ordenes_con_pago AS DECIMAL(10,2)) * 100.0) / NULLIF(ordenes_creadas, 0), 1) AS DECIMAL(10,1)) AS pct_confirmacion_p01,
    monto_comprometido,
    monto_exigible,
    monto_cobrado,
    CAST(ROUND((monto_cobrado * 100.0) / NULLIF(monto_exigible, 0), 1) AS DECIMAL(10,1)) AS pct_cobranza_efectiva_p04,
    minutos_primer_pago
FROM BaseModalidad
UNION ALL
SELECT
    99 AS orden_fila,
    'TOTAL' AS modalidad_pago,
    'TOTAL' AS tipo_modalidad,
    0 AS numero_cuotas,
    SUM(foc.orden_creada) AS ordenes_creadas,
    SUM(foc.orden_con_pago) AS ordenes_con_pago,
    CAST(ROUND((CAST(SUM(foc.orden_con_pago) AS DECIMAL(10,2)) * 100.0) / NULLIF(SUM(foc.orden_creada), 0), 1) AS DECIMAL(10,1)) AS pct_confirmacion_p01,
    SUM(foc.monto_comprometido) AS monto_comprometido,
    SUM(foc.monto_exigible) AS monto_exigible,
    SUM(foc.monto_cobrado) AS monto_cobrado,
    CAST(ROUND((SUM(foc.monto_cobrado) * 100.0) / NULLIF(SUM(foc.monto_exigible), 0), 1) AS DECIMAL(10,1)) AS pct_cobranza_efectiva_p04,
    CAST(AVG(CAST(foc.minutos_a_primer_pago AS DECIMAL(10,2))) AS DECIMAL(10,1)) AS minutos_primer_pago
FROM dbo.FACT_ORDEN_COBRANZA foc;
GO

/* ============================================================================
   VISTA 3: dbo.vw_rpayers_vista_3_1_servicio
   Desglose por Tipo de Servicio (P01, P02 y P04)
============================================================================ */
CREATE OR ALTER VIEW dbo.vw_rpayers_vista_3_1_servicio AS
SELECT
    ds.idServicio AS orden_fila,
    ds.Servicio AS servicio,
    ds.TipoServicio AS linea_servicio,
    SUM(fc.orden_creada) AS ordenes_creadas,
    SUM(fc.orden_con_pago) AS ordenes_con_pago,
    CAST(ROUND((CAST(SUM(fc.orden_con_pago) AS DECIMAL(10,2)) * 100.0) / NULLIF(SUM(fc.orden_creada), 0), 1) AS DECIMAL(10,1)) AS pct_confirmacion_p01,
    CAST(AVG(CAST(fc.minutos_a_primer_pago AS DECIMAL(10,2))) AS DECIMAL(10,1)) AS minutos_primer_pago_p02,
    SUM(fc.monto_exigible) AS monto_exigible,
    SUM(fc.monto_cobrado) AS monto_cobrado,
    CAST(ROUND((SUM(fc.monto_cobrado) * 100.0) / NULLIF(SUM(fc.monto_exigible), 0), 1) AS DECIMAL(10,1)) AS pct_cobranza_efectiva_p04
FROM dbo.FACT_COBRANZA fc
INNER JOIN dbo.DIM_SERVICIO ds ON ds.KeyServicio = fc.KeyServicio
GROUP BY ds.idServicio, ds.Servicio, ds.TipoServicio;
GO

/* ============================================================================
   VISTA 4: dbo.vw_rpayers_vista_3_2_recuperacion
   Vista 3.2 — Recuperación de pagos pendientes y alertas (P03)
============================================================================ */
CREATE OR ALTER VIEW dbo.vw_rpayers_vista_3_2_recuperacion AS
WITH OrdenAlerta AS (
    SELECT
        ac.orden_pago_id,
        ac.secuencia,
        ac.tipo,
        ac.resultado,
        ac.escalado,
        ISNULL(pg.monto_cobrado, 0) AS monto_recuperado
    FROM INBESTIGA_TESIS.dbo.ALERTA_COBRANZA ac
    LEFT JOIN (
        SELECT orden_pago_id, SUM(monto_pagado) AS monto_cobrado
        FROM INBESTIGA_TESIS.dbo.PAGO
        WHERE estado = 'CONFIRMADO'
        GROUP BY orden_pago_id
    ) pg ON pg.orden_pago_id = ac.orden_pago_id
),
BaseAlertas AS (
    SELECT
        CASE oa.secuencia
            WHEN 'Recordatorio 4 h' THEN 1
            WHEN 'Recordatorio 24 h' THEN 2
            WHEN 'Escalado al administrador' THEN 3
            ELSE 4
        END AS orden_fila,
        oa.tipo AS tipo_alerta,
        oa.secuencia,
        COUNT(*) AS payers_alertados,
        SUM(CASE WHEN oa.resultado = 'RECUPERADO' THEN 1 ELSE 0 END) AS payers_recuperados_72h,
        SUM(CASE WHEN oa.escalado = 1 THEN 1 ELSE 0 END) AS escalamientos_humano,
        SUM(CASE WHEN oa.resultado = 'RECUPERADO' THEN oa.monto_recuperado ELSE 0 END) AS monto_recuperado
    FROM OrdenAlerta oa
    GROUP BY oa.tipo, oa.secuencia
)
SELECT
    orden_fila,
    tipo_alerta,
    secuencia,
    payers_alertados,
    payers_recuperados_72h,
    CAST(ROUND((CAST(payers_recuperados_72h AS DECIMAL(10,2)) * 100.0) / NULLIF(payers_alertados, 0), 1) AS DECIMAL(10,1)) AS pct_recuperacion_p03,
    escalamientos_humano,
    monto_recuperado
FROM BaseAlertas
UNION ALL
SELECT
    99 AS orden_fila,
    'TOTAL' AS tipo_alerta,
    'TOTAL' AS secuencia,
    COUNT(*) AS payers_alertados,
    SUM(CASE WHEN oa.resultado = 'RECUPERADO' THEN 1 ELSE 0 END) AS payers_recuperados_72h,
    CAST(ROUND((CAST(SUM(CASE WHEN oa.resultado = 'RECUPERADO' THEN 1 ELSE 0 END) AS DECIMAL(10,2)) * 100.0) / NULLIF(COUNT(*), 0), 1) AS DECIMAL(10,1)) AS pct_recuperacion_p03,
    SUM(CASE WHEN oa.escalado = 1 THEN 1 ELSE 0 END) AS escalamientos_humano,
    SUM(CASE WHEN oa.resultado = 'RECUPERADO' THEN oa.monto_recuperado ELSE 0 END) AS monto_recuperado
FROM OrdenAlerta oa;
GO

/* ============================================================================
   VISTA 5: dbo.vw_rpayers_vista_3_3_medios
   Vista 3.3 — Confirmación automática y costo por medio de pago (P05 y P06)
============================================================================ */
CREATE OR ALTER VIEW dbo.vw_rpayers_vista_3_3_medios AS
WITH BaseMedios AS (
    SELECT
        dm.idMedioPago AS orden_fila,
        dm.MedioPago AS medio_pago,
        dm.TipoMedio AS tipo_medio,
        dm.Proveedor AS proveedor,
        CASE
            WHEN dm.TipoMedio LIKE '%Pasarela%' OR dm.Proveedor IN ('Culqi', 'Izipay', 'Niubiz') THEN CONCAT('Webhook ', dm.Proveedor)
            ELSE 'VOUCHER_OCR + Asesor'
        END AS canal_confirmacion,
        SUM(fp.pago_confirmado) AS pagos_confirmados,
        SUM(fp.pago_por_webhook) AS pagos_por_webhook,
        SUM(fp.monto_pagado) AS monto_cobrado,
        SUM(fp.comision_pasarela) AS comision_pasarela
    FROM dbo.FACT_PAGO fp
    INNER JOIN dbo.DIM_MEDIO_PAGO dm ON dm.KeyMedioPago = fp.KeyMedioPago
    GROUP BY dm.idMedioPago, dm.MedioPago, dm.TipoMedio, dm.Proveedor
)
SELECT
    orden_fila,
    medio_pago,
    tipo_medio,
    proveedor,
    canal_confirmacion,
    pagos_confirmados,
    pagos_por_webhook,
    CAST(ROUND((CAST(pagos_por_webhook AS DECIMAL(10,2)) * 100.0) / NULLIF(pagos_confirmados, 0), 1) AS DECIMAL(10,1)) AS pct_confirmacion_auto_p05,
    monto_cobrado,
    comision_pasarela,
    CAST(ROUND((comision_pasarela * 100.0) / NULLIF(monto_cobrado, 0), 2) AS DECIMAL(10,2)) AS pct_costo_cobro_p06
FROM BaseMedios
UNION ALL
SELECT
    99 AS orden_fila,
    'TOTAL' AS medio_pago,
    'TOTAL' AS tipo_medio,
    'TOTAL' AS proveedor,
    'Automático (123) + Manual (27)' AS canal_confirmacion,
    SUM(fp.pago_confirmado) AS pagos_confirmados,
    SUM(fp.pago_por_webhook) AS pagos_por_webhook,
    CAST(ROUND((CAST(SUM(fp.pago_por_webhook) AS DECIMAL(10,2)) * 100.0) / NULLIF(SUM(fp.pago_confirmado), 0), 1) AS DECIMAL(10,1)) AS pct_confirmacion_auto_p05,
    SUM(fp.monto_pagado) AS monto_cobrado,
    SUM(fp.comision_pasarela) AS comision_pasarela,
    CAST(ROUND((SUM(fp.comision_pasarela) * 100.0) / NULLIF(SUM(fp.monto_pagado), 0), 2) AS DECIMAL(10,2)) AS pct_costo_cobro_p06
FROM dbo.FACT_PAGO fp;
GO

/* ============================================================================
   VISTA 6: dbo.vw_rpayers_ordenes_detalle
   Vista operativa y analítica de las 104 órdenes de pago de PAYERS
============================================================================ */
CREATE OR ALTER VIEW dbo.vw_rpayers_ordenes_detalle AS
SELECT
    o.orden_pago_id AS id_orden_pago,
    o.codigo_orden,
    CONCAT('CTR-2026-', RIGHT(CONCAT('0000', o.contrato_id), 4)) AS codigo_contrato,
    ISNULL(c.estado, 'CONFIRMADO') AS estado_contrato,
    ct.contacto_id AS id_estudiante,
    CONCAT(ct.nombres, ' ', ct.apellidos) AS estudiante,
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
    CASE WHEN al.resultado = 'RECUPERADO' THEN 1 ELSE 0 END AS alerta_recuperada,
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
) cuo
OUTER APPLY (
    SELECT
        SUM(CASE WHEN p.estado = 'CONFIRMADO' THEN p.monto_pagado ELSE 0 END) AS monto_cobrado,
        SUM(CASE WHEN p.estado = 'CONFIRMADO' THEN 1 ELSE 0 END) AS pagos_confirmados,
        SUM(CASE WHEN p.estado = 'CONFIRMADO' THEN p.comision_pasarela ELSE 0 END) AS comision_total,
        MIN(CASE WHEN p.estado = 'CONFIRMADO' THEN p.fecha_confirmacion END) AS primer_pago_en
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
GO

PRINT 'VISTAS ANALITICAS R-PAYERS CREADAS EXITOSAMENTE EN INBESTIGA_MART.';
GO
