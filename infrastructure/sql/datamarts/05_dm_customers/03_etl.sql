-- =============================================================================
-- INBESTIGA.TESIS - Procedimiento ETL: Data Mart dm_customers (inbestiga_dm_customers)
-- Extrae directamente de la base de datos transaccional (inbestiga_db)
-- y carga las tablas de dimensiones y hechos de inbestiga_dm_customers
-- =============================================================================

USE inbestiga_dm_customers;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE dbo.sp_etl_dm_customers
AS
BEGIN
    SET NOCOUNT ON;
    PRINT '>> [ETL dm_customers] Iniciando carga de Atención, Bitácora y Satisfacción...';

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

    -- 6. Poblar dbo.DIM_ASESOR
    MERGE INTO dbo.DIM_ASESOR AS Target
    USING inbestiga_db.dbo.ASESOR AS Source
    ON (Target.asesor_id_oltp = Source.id)
    WHEN MATCHED THEN
        UPDATE SET 
            Target.nombres_completos = Source.nombres + ' ' + Source.apellidos,
            Target.especialidad = Source.especialidad,
            Target.grado_academico = Source.gradoAcademico,
            Target.email = Source.email
    WHEN NOT MATCHED THEN
        INSERT (asesor_id_oltp, nombres_completos, especialidad, grado_academico, email)
        VALUES (Source.id, Source.nombres + ' ' + Source.apellidos, Source.especialidad, Source.gradoAcademico, Source.email);

    -- 7. Poblar dbo.DIM_ESTADO_SERVICIO
    INSERT INTO dbo.DIM_ESTADO_SERVICIO (estado_codigo, descripcion)
    SELECT val.codigo, val.descrip
    FROM (
        VALUES 
            ('ACTIVO', 'Servicio en marcha con sesiones regulares'),
            ('EN_CURSO', 'Avance de capítulos en desarrollo activo'),
            ('EN_RIESGO', 'Alerta temprana por falta de interacción o reprogramación'),
            ('PAUSADO', 'Servicio temporalmente detenido por solicitud del tesista'),
            ('FINALIZADO', 'Tesis o artículo culminado satisfactoriamente')
    ) AS val(codigo, descrip)
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.DIM_ESTADO_SERVICIO es WHERE es.estado_codigo = val.codigo
    );

    -- 8. Poblar dbo.FACT_ATENCION
    DELETE FROM dbo.FACT_ATENCION;
    INSERT INTO dbo.FACT_ATENCION (
        tiempo_key,
        estudiante_key,
        servicio_key,
        universidad_key,
        carrera_key,
        asesor_key,
        estado_servicio_key,
        horas_asignacion_asesor,
        horas_primera_sesion,
        primera_sesion_48h,
        sesiones_programadas,
        sesiones_realizadas,
        entregas_a_tiempo,
        dias_servicio_activo,
        porcentaje_avance_tesis,
        puntaje_satisfaccion_encuesta,
        alerta_riesgo_abandono
    )
    SELECT 
        COALESCE(dt.tiempo_key, 1),
        de.estudiante_key,
        COALESCE(ds.servicio_key, 1),
        du.universidad_key,
        dc.carrera_key,
        da.asesor_key,
        COALESCE(des.estado_servicio_key, (SELECT TOP 1 estado_servicio_key FROM dbo.DIM_ESTADO_SERVICIO WHERE estado_codigo = 'ACTIVO')),
        DATEDIFF(HOUR, p.fechaConfirmacion, asig.fechaAsignacion),
        DATEDIFF(HOUR, c.fechaInicioServicio, ses1.fechaHoraProgramada),
        CASE WHEN ses1.fechaHoraProgramada IS NOT NULL AND DATEDIFF(HOUR, c.fechaInicioServicio, ses1.fechaHoraProgramada) <= 48 THEN 1 ELSE 0 END,
        ISNULL((SELECT COUNT(1) FROM inbestiga_db.dbo.SESION s WHERE s.customerId = c.id), 0),
        ISNULL((SELECT COUNT(1) FROM inbestiga_db.dbo.SESION s WHERE s.customerId = c.id AND s.estado = 'REALIZADA'), 0),
        ISNULL((SELECT COUNT(1) FROM inbestiga_db.dbo.SESION s WHERE s.customerId = c.id AND s.estado = 'REALIZADA'), 0),
        ISNULL(DATEDIFF(DAY, c.fechaInicioServicio, GETDATE()), 0),
        CAST(
            CASE 
                WHEN (SELECT COUNT(1) FROM inbestiga_db.dbo.SESION s WHERE s.customerId = c.id) > 0 
                THEN (SELECT COUNT(1) * 1.0 FROM inbestiga_db.dbo.SESION s WHERE s.customerId = c.id AND s.estado = 'REALIZADA') 
                     / (SELECT COUNT(1) FROM inbestiga_db.dbo.SESION s WHERE s.customerId = c.id) * 60.0 + 20.0
                ELSE 20.0
            END AS DECIMAL(5,2)
        ),
        (SELECT AVG(e.calificacionGeneral) FROM inbestiga_db.dbo.ENCUESTA_SATISFACCION e WHERE e.customerId = c.id),
        CASE WHEN c.estadoServicio = 'PAUSADO' OR c.observaciones LIKE '%riesgo%' THEN 1 ELSE 0 END
    FROM inbestiga_db.dbo.CUSTOMER c
    JOIN dbo.DIM_ESTUDIANTE de ON de.buyer_id_oltp = c.buyerId
    LEFT JOIN inbestiga_db.dbo.BUYER b ON b.id = c.buyerId
    LEFT JOIN dbo.DIM_UNIVERSIDAD du ON du.universidad_id_oltp = b.universidadId
    LEFT JOIN dbo.DIM_CARRERA dc ON dc.carrera_id_oltp = b.carreraId
    LEFT JOIN dbo.DIM_SERVICIO ds ON ds.servicio_id_oltp = c.servicioId
    LEFT JOIN dbo.DIM_TIEMPO dt ON dt.fecha = CAST(c.fechaInicioServicio AS DATE)
    LEFT JOIN dbo.DIM_ASESOR da ON da.asesor_id_oltp = c.asesorId
    LEFT JOIN dbo.DIM_ESTADO_SERVICIO des ON des.estado_codigo = c.estadoServicio
    LEFT JOIN inbestiga_db.dbo.PAYER py ON py.id = c.payerId
    LEFT JOIN inbestiga_db.dbo.PAGO p ON p.id = py.primerPagoId
    OUTER APPLY (
        SELECT TOP 1 a.fechaAsignacion
        FROM inbestiga_db.dbo.ASIGNACION_ASESOR a
        WHERE a.customerId = c.id
        ORDER BY a.fechaAsignacion ASC
    ) asig
    OUTER APPLY (
        SELECT TOP 1 s.fechaHoraProgramada
        FROM inbestiga_db.dbo.SESION s
        WHERE s.customerId = c.id AND s.numeroSesion = 1
        ORDER BY s.fechaHoraProgramada ASC
    ) ses1;

    PRINT '✓ [ETL dm_customers] Carga completada en inbestiga_dm_customers. Filas procesadas: ' + CAST(@@ROWCOUNT AS NVARCHAR(10));
END;
GO
