-- =============================================================================
-- INBESTIGA.TESIS - Procedimiento ETL: Data Mart dm_buyers (inbestiga_dm_buyers)
-- Extrae directamente de la base de datos transaccional (inbestiga_db)
-- y carga las tablas de dimensiones y hechos de inbestiga_dm_buyers
-- =============================================================================

USE inbestiga_dm_buyers;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE dbo.sp_etl_dm_buyers
AS
BEGIN
    SET NOCOUNT ON;
    PRINT '>> [ETL dm_buyers] Iniciando carga de Captación y Marketing...';

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

    -- 5. Poblar dbo.DIM_CANAL
    MERGE INTO dbo.DIM_CANAL AS Target
    USING inbestiga_db.dbo.CANAL AS Source
    ON (Target.canal_id_oltp = Source.id)
    WHEN MATCHED THEN
        UPDATE SET Target.nombre = Source.nombre, Target.codigo = Source.codigo, Target.tipo = Source.tipo
    WHEN NOT MATCHED THEN
        INSERT (canal_id_oltp, nombre, codigo, tipo)
        VALUES (Source.id, Source.nombre, Source.codigo, Source.tipo);

    -- 6. Poblar dbo.DIM_CAMPANA
    MERGE INTO dbo.DIM_CAMPANA AS Target
    USING inbestiga_db.dbo.CAMPAÑA AS Source
    ON (Target.campana_id_oltp = Source.id)
    WHEN MATCHED THEN
        UPDATE SET Target.nombre = Source.nombre, Target.presupuesto_total = Source.presupuesto, Target.fecha_inicio = CAST(Source.fechaInicio AS DATE), Target.fecha_fin = CAST(Source.fechaFin AS DATE)
    WHEN NOT MATCHED THEN
        INSERT (campana_id_oltp, nombre, presupuesto_total, fecha_inicio, fecha_fin)
        VALUES (Source.id, Source.nombre, Source.presupuesto, CAST(Source.fechaInicio AS DATE), CAST(Source.fechaFin AS DATE));

    -- 7. Poblar dbo.DIM_UBICACION
    MERGE INTO dbo.DIM_UBICACION AS Target
    USING inbestiga_db.dbo.UBICACION AS Source
    ON (Target.ubicacion_id_oltp = Source.id)
    WHEN MATCHED THEN
        UPDATE SET Target.departamento = Source.departamento, Target.provincia = Source.provincia, Target.distrito = Source.distrito
    WHEN NOT MATCHED THEN
        INSERT (ubicacion_id_oltp, departamento, provincia, distrito)
        VALUES (Source.id, Source.departamento, Source.provincia, Source.distrito);

    -- 8. Poblar dbo.FACT_CAPTACION
    DELETE FROM dbo.FACT_CAPTACION;
    INSERT INTO dbo.FACT_CAPTACION (
        tiempo_key,
        estudiante_key,
        universidad_key,
        carrera_key,
        canal_key,
        campana_key,
        ubicacion_key,
        lead_score,
        es_lead_calificado,
        tiempo_primera_respuesta_seg,
        interacciones_acumuladas,
        descargo_lead_magnet,
        presupuesto_estimado_pen,
        dias_hasta_calificacion
    )
    SELECT 
        COALESCE(dt.tiempo_key, 1),
        de.estudiante_key,
        du.universidad_key,
        dc.carrera_key,
        dcn.canal_key,
        dcm.campana_key,
        dub.ubicacion_key,
        b.leadScore,
        CASE WHEN b.estadoFunnel IN ('LEAD', 'PAYER', 'CUSTOMER') OR b.leadScore >= 70 THEN 1 ELSE 0 END,
        (
            SELECT TOP 1 DATEDIFF(SECOND, mIn.fechaHora, mOut.fechaHora)
            FROM inbestiga_db.dbo.CONVERSACION c
            JOIN inbestiga_db.dbo.MENSAJE mIn ON mIn.conversacionId = c.id AND mIn.direccion = 'INCOMING'
            JOIN inbestiga_db.dbo.MENSAJE mOut ON mOut.conversacionId = c.id AND mOut.direccion = 'OUTGOING' AND mOut.fechaHora >= mIn.fechaHora
            WHERE c.buyerId = b.id
            ORDER BY mIn.fechaHora ASC
        ),
        ISNULL((SELECT COUNT(1) FROM inbestiga_db.dbo.INTERACCION i WHERE i.buyerId = b.id), 0),
        CASE WHEN EXISTS (SELECT 1 FROM inbestiga_db.dbo.INTERACCION i WHERE i.buyerId = b.id AND i.tipo = 'DESCARGA_LEAD_MAGNET') THEN 1 ELSE 0 END,
        ISNULL(b.presupuestoAprox, 0.00),
        CASE WHEN b.fechaConversionLead IS NOT NULL THEN DATEDIFF(DAY, b.fechaRegistro, b.fechaConversionLead) ELSE NULL END
    FROM inbestiga_db.dbo.BUYER b
    JOIN dbo.DIM_ESTUDIANTE de ON de.buyer_id_oltp = b.id
    LEFT JOIN dbo.DIM_TIEMPO dt ON dt.fecha = CAST(b.fechaRegistro AS DATE)
    LEFT JOIN dbo.DIM_UNIVERSIDAD du ON du.universidad_id_oltp = b.universidadId
    LEFT JOIN dbo.DIM_CARRERA dc ON dc.carrera_id_oltp = b.carreraId
    LEFT JOIN dbo.DIM_CANAL dcn ON dcn.canal_id_oltp = b.canalId
    LEFT JOIN dbo.DIM_CAMPANA dcm ON dcm.campana_id_oltp = b.campanaId
    LEFT JOIN dbo.DIM_UBICACION dub ON dub.ubicacion_id_oltp = b.ubicacionId;

    PRINT '✓ [ETL dm_buyers] Carga completada en inbestiga_dm_buyers. Filas procesadas: ' + CAST(@@ROWCOUNT AS NVARCHAR(10));
END;
GO
