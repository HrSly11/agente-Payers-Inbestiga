-- =============================================================================
-- INBESTIGA.TESIS - Procedimiento ETL: Data Mart dm_leads (inbestiga_dm_leads)
-- Extrae directamente de la base de datos transaccional (inbestiga_db)
-- y carga las tablas de dimensiones y hechos de inbestiga_dm_leads
-- =============================================================================

USE inbestiga_dm_leads;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE dbo.sp_etl_dm_leads
AS
BEGIN
    SET NOCOUNT ON;
    PRINT '>> [ETL dm_leads] Iniciando carga de Negociación y Conversión con IA...';

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

    -- 6. Poblar dbo.DIM_LEAD
    MERGE INTO dbo.DIM_LEAD AS Target
    USING inbestiga_db.dbo.LEAD AS Source
    ON (Target.lead_id_oltp = Source.id)
    WHEN MATCHED THEN
        UPDATE SET 
            Target.score_inicial = Source.scoreCalificado,
            Target.prioridad = ISNULL(Source.prioridad, CASE WHEN Source.scoreCalificado >= 70 THEN 'ALTA' WHEN Source.scoreCalificado >= 40 THEN 'MEDIA' ELSE 'BAJA' END),
            Target.fecha_calificacion = CAST(Source.fechaCalificacion AS DATE),
            Target.umbral_superado = Source.umbralSuperado
    WHEN NOT MATCHED THEN
        INSERT (lead_id_oltp, score_inicial, prioridad, fecha_calificacion, umbral_superado)
        VALUES (
            Source.id, 
            Source.scoreCalificado, 
            ISNULL(Source.prioridad, CASE WHEN Source.scoreCalificado >= 70 THEN 'ALTA' WHEN Source.scoreCalificado >= 40 THEN 'MEDIA' ELSE 'BAJA' END),
            CAST(Source.fechaCalificacion AS DATE),
            Source.umbralSuperado
        );

    -- 7. Poblar dbo.DIM_OBJECION
    INSERT INTO dbo.DIM_OBJECION (tipo_objecion)
    SELECT DISTINCT tipo FROM inbestiga_db.dbo.OBJECION
    WHERE tipo NOT IN (SELECT tipo_objecion FROM dbo.DIM_OBJECION);

    IF NOT EXISTS (SELECT 1 FROM dbo.DIM_OBJECION WHERE tipo_objecion = 'NINGUNA')
    BEGIN
        INSERT INTO dbo.DIM_OBJECION (tipo_objecion) VALUES ('NINGUNA');
    END

    -- 8. Poblar dbo.DIM_MODALIDAD_NEGOCIADA
    INSERT INTO dbo.DIM_MODALIDAD_NEGOCIADA (cuotas_pactadas, codigo_modalidad)
    SELECT DISTINCT 
        p.numeroCuotas, 
        CASE 
            WHEN p.numeroCuotas = 1 THEN 'CONTADO_1_CUOTA' 
            ELSE 'FINANCIADO_' + CAST(p.numeroCuotas AS NVARCHAR(10)) + '_CUOTAS' 
        END
    FROM inbestiga_db.dbo.PROPUESTA p
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.DIM_MODALIDAD_NEGOCIADA mn 
        WHERE mn.cuotas_pactadas = p.numeroCuotas
    );

    IF NOT EXISTS (SELECT 1 FROM dbo.DIM_MODALIDAD_NEGOCIADA WHERE cuotas_pactadas = 1)
    BEGIN
        INSERT INTO dbo.DIM_MODALIDAD_NEGOCIADA (cuotas_pactadas, codigo_modalidad) VALUES (1, 'CONTADO_1_CUOTA');
    END

    -- 9. Poblar dbo.FACT_NEGOCIACION
    DELETE FROM dbo.FACT_NEGOCIACION;
    INSERT INTO dbo.FACT_NEGOCIACION (
        tiempo_key,
        estudiante_key,
        lead_key,
        universidad_key,
        carrera_key,
        servicio_key,
        objecion_key,
        modalidad_key,
        mensajes_totales,
        mensajes_cliente,
        mensajes_agente_ia,
        tiempo_negociacion_min,
        precio_lista_pen,
        precio_final_acordado_pen,
        descuento_aplicado_pct,
        monto_descuento_pen,
        convertido_a_pago,
        propuesta_aceptada,
        escalado_a_humano,
        tuvo_objecion
    )
    SELECT 
        COALESCE(dt.tiempo_key, 1),
        de.estudiante_key,
        dl.lead_key,
        du.universidad_key,
        dc.carrera_key,
        COALESCE(ds.servicio_key, 1),
        COALESCE(do.objecion_key, (SELECT objecion_key FROM dbo.DIM_OBJECION WHERE tipo_objecion = 'NINGUNA')),
        COALESCE(dmn.modalidad_key, (SELECT TOP 1 modalidad_key FROM dbo.DIM_MODALIDAD_NEGOCIADA WHERE cuotas_pactadas = 1)),
        ISNULL((SELECT COUNT(1) FROM inbestiga_db.dbo.MENSAJE m WHERE m.conversacionId = c.id), 0),
        ISNULL((SELECT COUNT(1) FROM inbestiga_db.dbo.MENSAJE m WHERE m.conversacionId = c.id AND m.direccion = 'INCOMING'), 0),
        ISNULL((SELECT COUNT(1) FROM inbestiga_db.dbo.MENSAJE m WHERE m.conversacionId = c.id AND m.direccion = 'OUTGOING'), 0),
        DATEDIFF(MINUTE, c.fechaInicio, c.fechaUltimaActividad),
        ISNULL(prop.precioOriginal, 0.00),
        ISNULL(prop.precioPropuesto, 0.00),
        ISNULL(prop.descuentoAplicadoPct, 0.00),
        ISNULL(prop.precioOriginal - prop.precioPropuesto, 0.00),
        CASE WHEN c.estadoEtapa IN ('PAYMENT', 'PAYMENT_PENDING', 'CONVERTED') THEN 1 ELSE 0 END,
        CASE WHEN prop.estado = 'ACEPTADA' OR c.estadoEtapa IN ('PAYMENT', 'PAYMENT_PENDING', 'CONVERTED') THEN 1 ELSE 0 END,
        CASE WHEN c.estadoEtapa = 'HUMAN_ESCALATION' THEN 1 ELSE 0 END,
        CASE WHEN obj.tipo IS NOT NULL AND obj.tipo <> 'NINGUNA' THEN 1 ELSE 0 END
    FROM inbestiga_db.dbo.CONVERSACION c
    JOIN inbestiga_db.dbo.LEAD l ON l.id = c.leadId
    JOIN dbo.DIM_LEAD dl ON dl.lead_id_oltp = l.id
    JOIN inbestiga_db.dbo.BUYER b ON b.id = l.buyerId
    JOIN dbo.DIM_ESTUDIANTE de ON de.buyer_id_oltp = b.id
    LEFT JOIN dbo.DIM_UNIVERSIDAD du ON du.universidad_id_oltp = b.universidadId
    LEFT JOIN dbo.DIM_CARRERA dc ON dc.carrera_id_oltp = b.carreraId
    LEFT JOIN dbo.DIM_TIEMPO dt ON dt.fecha = CAST(c.fechaInicio AS DATE)
    OUTER APPLY (
        SELECT TOP 1 p.servicioId, p.precioOriginal, p.precioPropuesto, p.descuentoAplicadoPct, p.numeroCuotas, p.estado
        FROM inbestiga_db.dbo.PROPUESTA p
        WHERE p.conversacionId = c.id
        ORDER BY p.fechaCreacion DESC
    ) prop
    LEFT JOIN dbo.DIM_SERVICIO ds ON ds.servicio_id_oltp = prop.servicioId
    LEFT JOIN dbo.DIM_MODALIDAD_NEGOCIADA dmn ON dmn.cuotas_pactadas = prop.numeroCuotas
    OUTER APPLY (
        SELECT TOP 1 o.tipo
        FROM inbestiga_db.dbo.OBJECION o
        WHERE o.conversacionId = c.id
        ORDER BY o.fechaRegistro DESC
    ) obj
    LEFT JOIN dbo.DIM_OBJECION do ON do.tipo_objecion = obj.tipo;

    PRINT '✓ [ETL dm_leads] Carga completada en inbestiga_dm_leads. Filas procesadas: ' + CAST(@@ROWCOUNT AS NVARCHAR(10));
END;
GO
