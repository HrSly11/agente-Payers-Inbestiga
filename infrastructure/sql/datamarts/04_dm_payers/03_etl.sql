-- =============================================================================
-- INBESTIGA.TESIS - Procedimiento ETL: Data Mart dm_payers (inbestiga_dm_payers)
-- Extrae directamente de la base de datos transaccional (inbestiga_db)
-- y carga las tablas de dimensiones y hechos de inbestiga_dm_payers
-- =============================================================================

USE inbestiga_dm_payers;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE dbo.sp_etl_dm_payers
AS
BEGIN
    SET NOCOUNT ON;
    PRINT '>> [ETL dm_payers] Iniciando carga de Cobranza y Pasarela Culqi...';

    -- 1. Poblar dbo.DIM_TIEMPO (-30 días a +60 días)
    DECLARE @FechaActual DATE = DATEADD(DAY, -30, CAST(GETDATE() AS DATE));
    DECLARE @FechaFin DATE = DATEADD(DAY, 60, CAST(GETDATE() AS DATE));

    WHILE @FechaActual <= @FechaFin
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.DIM_TIEMPO WHERE fecha = @FechaActual)
        BEGIN
            INSERT INTO dbo.DIM_TIEMPO (fecha, año, mes, nombre_mes, trimestre, dia, dia_semana, es_fin_semana)
            VALUES (
                @FechaActual,
                YEAR(@FechaActual),
                MONTH(@FechaActual),
                DATENAME(MONTH, @FechaActual),
                DATEPART(QUARTER, @FechaActual),
                DAY(@FechaActual),
                DATENAME(WEEKDAY, @FechaActual),
                CASE WHEN DATEPART(WEEKDAY, @FechaActual) IN (1, 7) THEN 1 ELSE 0 END
            );
        END
        SET @FechaActual = DATEADD(DAY, 1, @FechaActual);
    END;

    -- 2. Poblar dbo.DIM_UNIVERSIDAD
    MERGE INTO dbo.DIM_UNIVERSIDAD AS Target
    USING inbestiga_db.dbo.UNIVERSIDAD AS Source
    ON (Target.universidad_id_oltp = Source.id)
    WHEN MATCHED THEN
        UPDATE SET Target.nombre = Source.nombre, Target.siglas = Source.siglas, Target.ciudad = Source.ciudad, Target.tipo = Source.tipo
    WHEN NOT MATCHED THEN
        INSERT (universidad_id_oltp, nombre, siglas, ciudad, tipo)
        VALUES (Source.id, Source.nombre, Source.siglas, Source.ciudad, Source.tipo);

    -- 3. Poblar dbo.DIM_CARRERA
    MERGE INTO dbo.DIM_CARRERA AS Target
    USING inbestiga_db.dbo.CARRERA AS Source
    ON (Target.carrera_id_oltp = Source.id)
    WHEN MATCHED THEN
        UPDATE SET Target.nombre = Source.nombre, Target.facultad = Source.facultad, Target.area_conocimiento = Source.areaConocimiento
    WHEN NOT MATCHED THEN
        INSERT (carrera_id_oltp, nombre, facultad, area_conocimiento)
        VALUES (Source.id, Source.nombre, Source.facultad, Source.areaConocimiento);

    -- 4. Poblar dbo.DIM_ESTUDIANTE
    MERGE INTO dbo.DIM_ESTUDIANTE AS Target
    USING inbestiga_db.dbo.BUYER AS Source
    ON (Target.buyer_id_oltp = Source.id)
    WHEN MATCHED THEN
        UPDATE SET 
            Target.nombres = Source.nombres,
            Target.apellidos = Source.apellidos,
            Target.whatsapp = Source.whatsapp,
            Target.email = Source.email,
            Target.situacion_laboral = Source.situacionLaboral,
            Target.fecha_registro_oltp = Source.fechaRegistro
    WHEN NOT MATCHED THEN
        INSERT (buyer_id_oltp, nombres, apellidos, whatsapp, email, situacion_laboral, fecha_registro_oltp)
        VALUES (Source.id, Source.nombres, Source.apellidos, Source.whatsapp, Source.email, Source.situacionLaboral, Source.fechaRegistro);

    -- 5. Poblar dbo.DIM_SERVICIO
    MERGE INTO dbo.DIM_SERVICIO AS Target
    USING inbestiga_db.dbo.SERVICIO AS Source
    ON (Target.servicio_id_oltp = Source.id)
    WHEN MATCHED THEN
        UPDATE SET 
            Target.nombre = Source.nombre,
            Target.codigo = Source.codigo,
            Target.tipo_investigacion = Source.tipoInvestigacion,
            Target.precio_base = Source.precioBase,
            Target.precio_minimo = Source.precioMinimo,
            Target.plazo_semanas_estandar = Source.plazoSemanasMin
    WHEN NOT MATCHED THEN
        INSERT (servicio_id_oltp, nombre, codigo, tipo_investigacion, precio_base, precio_minimo, plazo_semanas_estandar)
        VALUES (Source.id, Source.nombre, Source.codigo, Source.tipoInvestigacion, Source.precioBase, Source.precioMinimo, Source.plazoSemanasMin);

    -- 6. Poblar dbo.DIM_METODO_PAGO
    INSERT INTO dbo.DIM_METODO_PAGO (metodo, gateway, tipo_financiamiento)
    SELECT DISTINCT 
        p.metodoPago, 
        p.gatewayProveedor,
        CASE 
            WHEN ISNULL(cot.cuotas, 1) = 1 THEN 'CONTADO_1_CUOTA'
            ELSE 'FINANCIADO_' + CAST(ISNULL(cot.cuotas, 2) AS NVARCHAR(10)) + '_CUOTAS'
        END
    FROM inbestiga_db.dbo.PAGO p
    LEFT JOIN inbestiga_db.dbo.COTIZACION cot ON cot.id = p.cotizacionId
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.DIM_METODO_PAGO dmp 
        WHERE dmp.metodo = p.metodoPago 
          AND dmp.gateway = p.gatewayProveedor
          AND dmp.tipo_financiamiento = CASE 
                WHEN ISNULL(cot.cuotas, 1) = 1 THEN 'CONTADO_1_CUOTA'
                ELSE 'FINANCIADO_' + CAST(ISNULL(cot.cuotas, 2) AS NVARCHAR(10)) + '_CUOTAS'
              END
    );

    -- 7. Poblar dbo.DIM_CANAL_PAGO
    IF NOT EXISTS (SELECT 1 FROM dbo.DIM_CANAL_PAGO WHERE tipo_interfaz = 'CHECKOUT_WEB_DIRECTO')
    BEGIN
        INSERT INTO dbo.DIM_CANAL_PAGO (tipo_interfaz, descripcion)
        VALUES ('CHECKOUT_WEB_DIRECTO', 'Pasarela Culqi integrada en la plataforma web');
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.DIM_CANAL_PAGO WHERE tipo_interfaz = 'LINK_WHATSAPP')
    BEGIN
        INSERT INTO dbo.DIM_CANAL_PAGO (tipo_interfaz, descripcion)
        VALUES ('LINK_WHATSAPP', 'Enlace dinámico de checkout enviado por el Agente IA a WhatsApp');
    END

    -- 8. Poblar dbo.FACT_COBRANZA
    DELETE FROM dbo.FACT_COBRANZA;
    INSERT INTO dbo.FACT_COBRANZA (
        tiempo_key,
        estudiante_key,
        servicio_key,
        universidad_key,
        carrera_key,
        metodo_pago_key,
        canal_pago_key,
        monto_pagado,
        monto_descuento,
        cuota_numero,
        total_cuotas,
        tiempo_confirmacion_seg,
        pago_confirmado,
        pago_tras_alerta_cobranza
    )
    SELECT 
        COALESCE(dt.tiempo_key, 1),
        de.estudiante_key,
        COALESCE(ds.servicio_key, 1),
        du.universidad_key,
        dc.carrera_key,
        COALESCE(dmp.metodo_pago_key, (SELECT TOP 1 metodo_pago_key FROM dbo.DIM_METODO_PAGO)),
        COALESCE(
            (SELECT TOP 1 canal_pago_key FROM dbo.DIM_CANAL_PAGO WHERE tipo_interfaz = CASE WHEN p.leadId IS NOT NULL THEN 'LINK_WHATSAPP' ELSE 'CHECKOUT_WEB_DIRECTO' END),
            (SELECT TOP 1 canal_pago_key FROM dbo.DIM_CANAL_PAGO WHERE tipo_interfaz = 'CHECKOUT_WEB_DIRECTO')
        ),
        p.monto,
        ISNULL(cot.descuento, 0.00),
        1,
        ISNULL(cot.cuotas, 1),
        DATEDIFF(SECOND, p.fechaCreacion, p.fechaConfirmacion),
        CASE WHEN p.estado = 'CONFIRMADO' THEN 1 ELSE 0 END,
        CASE WHEN EXISTS (
            SELECT 1 FROM inbestiga_db.dbo.NOTIFICACION n 
            WHERE (n.metadata LIKE '%"buyerId":"' + p.buyerId + '"%' OR n.metadata LIKE '%' + p.buyerId + '%')
              AND n.tipo IN ('ALERTA_COBRANZA_4H', 'ALERTA_COBRANZA_12H', 'ESCALAMIENTO_COBRANZA_HUMANA')
              AND n.fechaCreacion < p.fechaConfirmacion
        ) THEN 1 ELSE 0 END
    FROM inbestiga_db.dbo.PAGO p
    JOIN dbo.DIM_ESTUDIANTE de ON de.buyer_id_oltp = p.buyerId
    LEFT JOIN inbestiga_db.dbo.BUYER b ON b.id = p.buyerId
    LEFT JOIN dbo.DIM_UNIVERSIDAD du ON du.universidad_id_oltp = b.universidadId
    LEFT JOIN dbo.DIM_CARRERA dc ON dc.carrera_id_oltp = b.carreraId
    LEFT JOIN inbestiga_db.dbo.COTIZACION cot ON cot.id = p.cotizacionId
    LEFT JOIN dbo.DIM_SERVICIO ds ON ds.servicio_id_oltp = cot.servicioId
    LEFT JOIN dbo.DIM_TIEMPO dt ON dt.fecha = CAST(p.fechaCreacion AS DATE)
    LEFT JOIN dbo.DIM_METODO_PAGO dmp ON dmp.metodo = p.metodoPago 
                                       AND dmp.gateway = p.gatewayProveedor;

    PRINT '✓ [ETL dm_payers] Carga completada en inbestiga_dm_payers. Filas procesadas: ' + CAST(@@ROWCOUNT AS NVARCHAR(10));
END;
GO
