/* ============================================================================
   02_DDL_INBESTIGA_MART.sql
   DataMart Dimensional Consolidado - INBESTIGA_MART
   Alineado 100% con:
     - 04_ETL_POBLAR_DATAMART_DEFINITIVO.sql (18 Dimensiones + 13 Hechos)
     - Especificación v2 del Agente de Cobranza PAYERS (payers.docx)
     - Todos los miembros especiales 0 (NO APLICA) y -1 (SIN CLASIFICAR)
============================================================================ */

USE master;
GO

IF DB_ID('INBESTIGA_MART') IS NULL
BEGIN
    CREATE DATABASE INBESTIGA_MART COLLATE Modern_Spanish_CI_AS;
END
GO

USE INBESTIGA_MART;
GO

SET NOCOUNT ON;
GO

/* ============================================================================
   LIMPIEZA ORDENADA DE VISTAS Y TABLAS
============================================================================ */
DECLARE @dropViews NVARCHAR(MAX) = N'';
SELECT @dropViews += N'DROP VIEW ' + QUOTENAME(SCHEMA_NAME(schema_id)) + '.' + QUOTENAME(name) + ';' + CHAR(13)
FROM sys.views
WHERE is_ms_shipped = 0;
IF @dropViews <> N'' EXEC sp_executesql @dropViews;
GO

DECLARE @sql NVARCHAR(MAX) = N'';
SELECT @sql += N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(parent_object_id))
    + '.' + QUOTENAME(OBJECT_NAME(parent_object_id)) 
    + ' DROP CONSTRAINT ' + QUOTENAME(name) + ';' + CHAR(13)
FROM sys.foreign_keys;
IF @sql <> N'' EXEC sp_executesql @sql;
GO

DECLARE @dropTables NVARCHAR(MAX) = N'';
SELECT @dropTables += N'DROP TABLE ' + QUOTENAME(SCHEMA_NAME(schema_id)) + '.' + QUOTENAME(name) + ';' + CHAR(13)
FROM sys.tables
WHERE is_ms_shipped = 0;
IF @dropTables <> N'' EXEC sp_executesql @dropTables;
GO

/* ============================================================================
   18 DIMENSIONES OFICIALES (CON MIEMBROS 0 Y -1 PRECARGADOS)
============================================================================ */

-- 1. DIM_TIEMPO
CREATE TABLE dbo.DIM_TIEMPO (
    KeyTiempo INT IDENTITY(1,1) PRIMARY KEY,
    Anio INT NOT NULL,
    Trimestre VARCHAR(20) NOT NULL,
    NroMes INT NOT NULL,
    Mes VARCHAR(30) NOT NULL,
    Semana INT NOT NULL,
    DiaSemana VARCHAR(30) NOT NULL,
    Dia INT NOT NULL,
    idFecha DATE NOT NULL UNIQUE
);
SET IDENTITY_INSERT dbo.DIM_TIEMPO ON;
INSERT INTO dbo.DIM_TIEMPO (KeyTiempo, Anio, Trimestre, NroMes, Mes, Semana, DiaSemana, Dia, idFecha)
VALUES (0, 1900, '1900-T1', 1, 'NO APLICA', 1, 'NO APLICA', 1, '1900-01-01'),
       (-1, 1900, '1900-T1', 1, 'SIN CLASIFICAR', 1, 'SIN CLASIFICAR', 2, '1900-01-02');
SET IDENTITY_INSERT dbo.DIM_TIEMPO OFF;
GO

-- 2. DIM_ESTUDIANTE
CREATE TABLE dbo.DIM_ESTUDIANTE (
    KeyEstudiante INT IDENTITY(1,1) PRIMARY KEY,
    Sede VARCHAR(100) NOT NULL,
    EtapaAcademica VARCHAR(80) NOT NULL,
    Ciclo VARCHAR(50) NOT NULL,
    idPerfilAcademico INT NOT NULL
);
SET IDENTITY_INSERT dbo.DIM_ESTUDIANTE ON;
INSERT INTO dbo.DIM_ESTUDIANTE (KeyEstudiante, Sede, EtapaAcademica, Ciclo, idPerfilAcademico)
VALUES (0, 'NO APLICA', 'NO APLICA', 'NO APLICA', 0),
       (-1, 'SIN CLASIFICAR', 'SIN CLASIFICAR', 'SIN CLASIFICAR', -1);
SET IDENTITY_INSERT dbo.DIM_ESTUDIANTE OFF;
GO

-- 3. DIM_CARRERA
CREATE TABLE dbo.DIM_CARRERA (
    KeyCarrera INT IDENTITY(1,1) PRIMARY KEY,
    TipoUniversidad VARCHAR(50) NOT NULL,
    Universidad VARCHAR(200) NOT NULL,
    Facultad VARCHAR(150) NOT NULL,
    Carrera VARCHAR(150) NOT NULL,
    idCarrera INT NOT NULL
);
SET IDENTITY_INSERT dbo.DIM_CARRERA ON;
INSERT INTO dbo.DIM_CARRERA (KeyCarrera, TipoUniversidad, Universidad, Facultad, Carrera, idCarrera)
VALUES (0, 'NO APLICA', 'NO APLICA', 'NO APLICA', 'NO APLICA', 0),
       (-1, 'SIN CLASIFICAR', 'SIN CLASIFICAR', 'SIN CLASIFICAR', 'SIN CLASIFICAR', -1);
SET IDENTITY_INSERT dbo.DIM_CARRERA OFF;
GO

-- 4. DIM_CANAL_CAPTACION
CREATE TABLE dbo.DIM_CANAL_CAPTACION (
    KeyCanalCaptacion INT IDENTITY(1,1) PRIMARY KEY,
    TipoCanal VARCHAR(80) NOT NULL,
    Plataforma VARCHAR(80) NOT NULL,
    Canal VARCHAR(120) NOT NULL,
    Campania VARCHAR(150) NOT NULL,
    idCanal INT NOT NULL,
    idCampania INT NOT NULL
);
SET IDENTITY_INSERT dbo.DIM_CANAL_CAPTACION ON;
INSERT INTO dbo.DIM_CANAL_CAPTACION (KeyCanalCaptacion, TipoCanal, Plataforma, Canal, Campania, idCanal, idCampania)
VALUES (0, 'NO APLICA', 'NO APLICA', 'NO APLICA', 'NO APLICA', 0, 0),
       (-1, 'SIN CLASIFICAR', 'SIN CLASIFICAR', 'SIN CLASIFICAR', 'SIN CLASIFICAR', -1, -1);
SET IDENTITY_INSERT dbo.DIM_CANAL_CAPTACION OFF;
GO

-- 5. DIM_CONTENIDO
CREATE TABLE dbo.DIM_CONTENIDO (
    KeyContenido INT IDENTITY(1,1) PRIMARY KEY,
    TipoContenido VARCHAR(80) NOT NULL,
    Tema VARCHAR(120) NOT NULL,
    Titulo VARCHAR(200) NOT NULL,
    idContenido INT NOT NULL
);
SET IDENTITY_INSERT dbo.DIM_CONTENIDO ON;
INSERT INTO dbo.DIM_CONTENIDO (KeyContenido, TipoContenido, Tema, Titulo, idContenido)
VALUES (0, 'NO APLICA', 'NO APLICA', 'NO APLICA', 0),
       (-1, 'SIN CLASIFICAR', 'SIN CLASIFICAR', 'SIN CLASIFICAR', -1);
SET IDENTITY_INSERT dbo.DIM_CONTENIDO OFF;
GO

-- 6. DIM_SERVICIO
CREATE TABLE dbo.DIM_SERVICIO (
    KeyServicio INT IDENTITY(1,1) PRIMARY KEY,
    Familia VARCHAR(80) NOT NULL,
    TipoServicio VARCHAR(100) NOT NULL,
    Servicio VARCHAR(150) NOT NULL,
    idServicio INT NOT NULL
);
SET IDENTITY_INSERT dbo.DIM_SERVICIO ON;
INSERT INTO dbo.DIM_SERVICIO (KeyServicio, Familia, TipoServicio, Servicio, idServicio)
VALUES (0, 'NO APLICA', 'NO APLICA', 'NO APLICA', 0),
       (-1, 'SIN CLASIFICAR', 'SIN CLASIFICAR', 'SIN CLASIFICAR', -1);
SET IDENTITY_INSERT dbo.DIM_SERVICIO OFF;
GO

-- 7. DIM_SEGUIMIENTO
CREATE TABLE dbo.DIM_SEGUIMIENTO (
    KeySeguimiento INT IDENTITY(1,1) PRIMARY KEY,
    TipoSeguimiento VARCHAR(80) NOT NULL,
    Resultado VARCHAR(50) NOT NULL,
    idSeguimientoBuyer INT NOT NULL
);
SET IDENTITY_INSERT dbo.DIM_SEGUIMIENTO ON;
INSERT INTO dbo.DIM_SEGUIMIENTO (KeySeguimiento, TipoSeguimiento, Resultado, idSeguimientoBuyer)
VALUES (0, 'NO APLICA', 'NO APLICA', 0),
       (-1, 'SIN CLASIFICAR', 'SIN CLASIFICAR', -1);
SET IDENTITY_INSERT dbo.DIM_SEGUIMIENTO OFF;
GO

-- 8. DIM_INVESTIGACION
CREATE TABLE dbo.DIM_INVESTIGACION (
    KeyInvestigacion INT IDENTITY(1,1) PRIMARY KEY,
    TipoInvestigacion VARCHAR(100) NOT NULL,
    RangoAvance VARCHAR(80) NOT NULL,
    EmpresaAplicacion VARCHAR(120) NOT NULL,
    idDiagnostico INT NOT NULL
);
SET IDENTITY_INSERT dbo.DIM_INVESTIGACION ON;
INSERT INTO dbo.DIM_INVESTIGACION (KeyInvestigacion, TipoInvestigacion, RangoAvance, EmpresaAplicacion, idDiagnostico)
VALUES (0, 'NO APLICA', 'NO APLICA', 'NO APLICA', 0),
       (-1, 'SIN CLASIFICAR', 'SIN CLASIFICAR', 'SIN CLASIFICAR', -1);
SET IDENTITY_INSERT dbo.DIM_INVESTIGACION OFF;
GO

-- 9. DIM_ASESOR
CREATE TABLE dbo.DIM_ASESOR (
    KeyAsesor INT IDENTITY(1,1) PRIMARY KEY,
    Equipo VARCHAR(80) NOT NULL,
    Rol VARCHAR(80) NOT NULL,
    Especialidad VARCHAR(120) NOT NULL,
    Asesor VARCHAR(150) NOT NULL,
    idAsesor INT NOT NULL
);
SET IDENTITY_INSERT dbo.DIM_ASESOR ON;
INSERT INTO dbo.DIM_ASESOR (KeyAsesor, Equipo, Rol, Especialidad, Asesor, idAsesor)
VALUES (0, 'NO APLICA', 'NO APLICA', 'NO APLICA', 'NO APLICA', 0),
       (-1, 'SIN CLASIFICAR', 'SIN CLASIFICAR', 'SIN CLASIFICAR', 'SIN CLASIFICAR', -1);
SET IDENTITY_INSERT dbo.DIM_ASESOR OFF;
GO

-- 10. DIM_OBJECION
CREATE TABLE dbo.DIM_OBJECION (
    KeyObjecion INT IDENTITY(1,1) PRIMARY KEY,
    Grupo VARCHAR(80) NOT NULL,
    Tipo VARCHAR(100) NOT NULL,
    Estado VARCHAR(50) NOT NULL,
    idObjecion INT NOT NULL
);
SET IDENTITY_INSERT dbo.DIM_OBJECION ON;
INSERT INTO dbo.DIM_OBJECION (KeyObjecion, Grupo, Tipo, Estado, idObjecion)
VALUES (0, 'NO APLICA', 'NO APLICA', 'NO APLICA', 0),
       (-1, 'SIN CLASIFICAR', 'SIN CLASIFICAR', 'SIN CLASIFICAR', -1);
SET IDENTITY_INSERT dbo.DIM_OBJECION OFF;
GO

-- 11. DIM_ORIGEN_PROPUESTA
CREATE TABLE dbo.DIM_ORIGEN_PROPUESTA (
    KeyOrigenPropuesta INT IDENTITY(1,1) PRIMARY KEY,
    GeneradaPor VARCHAR(50) NOT NULL
);
SET IDENTITY_INSERT dbo.DIM_ORIGEN_PROPUESTA ON;
INSERT INTO dbo.DIM_ORIGEN_PROPUESTA (KeyOrigenPropuesta, GeneradaPor)
VALUES (0, 'NO APLICA'),
       (-1, 'SIN CLASIFICAR');
SET IDENTITY_INSERT dbo.DIM_ORIGEN_PROPUESTA OFF;
GO

-- 12. DIM_MODALIDAD_PAGO
CREATE TABLE dbo.DIM_MODALIDAD_PAGO (
    KeyModalidadPago INT IDENTITY(1,1) PRIMARY KEY,
    TipoModalidad VARCHAR(50) NOT NULL,
    NumeroCuotas INT NOT NULL,
    Condicion VARCHAR(120) NOT NULL,
    idModalidadPago INT NOT NULL
);
SET IDENTITY_INSERT dbo.DIM_MODALIDAD_PAGO ON;
INSERT INTO dbo.DIM_MODALIDAD_PAGO (KeyModalidadPago, TipoModalidad, NumeroCuotas, Condicion, idModalidadPago)
VALUES (0, 'NO APLICA', 0, 'NO APLICA', 0),
       (-1, 'SIN CLASIFICAR', 0, 'SIN CLASIFICAR', -1);
SET IDENTITY_INSERT dbo.DIM_MODALIDAD_PAGO OFF;
GO

-- 13. DIM_MEDIO_PAGO
CREATE TABLE dbo.DIM_MEDIO_PAGO (
    KeyMedioPago INT IDENTITY(1,1) PRIMARY KEY,
    TipoMedio VARCHAR(80) NOT NULL,
    Proveedor VARCHAR(80) NOT NULL,
    MedioPago VARCHAR(80) NOT NULL,
    idMedioPago INT NOT NULL
);
SET IDENTITY_INSERT dbo.DIM_MEDIO_PAGO ON;
INSERT INTO dbo.DIM_MEDIO_PAGO (KeyMedioPago, TipoMedio, Proveedor, MedioPago, idMedioPago)
VALUES (0, 'NO APLICA', 'NO APLICA', 'NO APLICA', 0),
       (-1, 'SIN CLASIFICAR', 'SIN CLASIFICAR', 'SIN CLASIFICAR', -1);
SET IDENTITY_INSERT dbo.DIM_MEDIO_PAGO OFF;
GO

-- 14. DIM_PAGADOR
CREATE TABLE dbo.DIM_PAGADOR (
    KeyPagador INT IDENTITY(1,1) PRIMARY KEY,
    Segmento VARCHAR(80) NOT NULL,
    TipoResponsable VARCHAR(80) NOT NULL,
    Relacion VARCHAR(100) NOT NULL,
    idResponsablePago INT NOT NULL
);
SET IDENTITY_INSERT dbo.DIM_PAGADOR ON;
INSERT INTO dbo.DIM_PAGADOR (KeyPagador, Segmento, TipoResponsable, Relacion, idResponsablePago)
VALUES (0, 'NO APLICA', 'NO APLICA', 'NO APLICA', 0),
       (-1, 'SIN CLASIFICAR', 'SIN CLASIFICAR', 'SIN CLASIFICAR', -1);
SET IDENTITY_INSERT dbo.DIM_PAGADOR OFF;
GO

-- 15. DIM_SESION
CREATE TABLE dbo.DIM_SESION (
    KeySesion INT IDENTITY(1,1) PRIMARY KEY,
    TipoSesion VARCHAR(80) NOT NULL,
    Modalidad VARCHAR(60) NOT NULL,
    EstadoSesion VARCHAR(40) NOT NULL,
    idSesion INT NOT NULL
);
SET IDENTITY_INSERT dbo.DIM_SESION ON;
INSERT INTO dbo.DIM_SESION (KeySesion, TipoSesion, Modalidad, EstadoSesion, idSesion)
VALUES (0, 'NO APLICA', 'NO APLICA', 'NO APLICA', 0),
       (-1, 'SIN CLASIFICAR', 'SIN CLASIFICAR', 'SIN CLASIFICAR', -1);
SET IDENTITY_INSERT dbo.DIM_SESION OFF;
GO

-- 16. DIM_HITO
CREATE TABLE dbo.DIM_HITO (
    KeyHito INT IDENTITY(1,1) PRIMARY KEY,
    TipoEntregable VARCHAR(100) NOT NULL,
    Entregable VARCHAR(150) NOT NULL,
    Capitulo VARCHAR(120) NOT NULL,
    idHito INT NOT NULL
);
SET IDENTITY_INSERT dbo.DIM_HITO ON;
INSERT INTO dbo.DIM_HITO (KeyHito, TipoEntregable, Entregable, Capitulo, idHito)
VALUES (0, 'NO APLICA', 'NO APLICA', 'NO APLICA', 0),
       (-1, 'SIN CLASIFICAR', 'SIN CLASIFICAR', 'SIN CLASIFICAR', -1);
SET IDENTITY_INSERT dbo.DIM_HITO OFF;
GO

-- 17. DIM_MOTIVO_ESCALAMIENTO
CREATE TABLE dbo.DIM_MOTIVO_ESCALAMIENTO (
    KeyMotivoEscalamiento INT IDENTITY(1,1) PRIMARY KEY,
    Destino VARCHAR(80) NOT NULL,
    Motivo VARCHAR(120) NOT NULL
);
SET IDENTITY_INSERT dbo.DIM_MOTIVO_ESCALAMIENTO ON;
INSERT INTO dbo.DIM_MOTIVO_ESCALAMIENTO (KeyMotivoEscalamiento, Destino, Motivo)
VALUES (0, 'NO APLICA', 'NO APLICA'),
       (-1, 'SIN CLASIFICAR', 'SIN CLASIFICAR');
SET IDENTITY_INSERT dbo.DIM_MOTIVO_ESCALAMIENTO OFF;
GO

-- 18. DIM_INDICADOR
CREATE TABLE dbo.DIM_INDICADOR (
    KeyIndicador INT IDENTITY(1,1) PRIMARY KEY,
    FaseIMPULSE VARCHAR(40) NOT NULL,
    Indicador VARCHAR(120) NOT NULL
);
SET IDENTITY_INSERT dbo.DIM_INDICADOR ON;
INSERT INTO dbo.DIM_INDICADOR (KeyIndicador, FaseIMPULSE, Indicador)
VALUES (0, 'NO APLICA', 'NO APLICA'),
       (-1, 'SIN CLASIFICAR', 'SIN CLASIFICAR');
SET IDENTITY_INSERT dbo.DIM_INDICADOR OFF;
GO

-- DIMENSIONES COMPLEMENTARIAS PARA REPORTE R-PAYERS (AD2 y AD3)
CREATE TABLE dbo.DIM_ALERTA (
    KeyAlerta INT IDENTITY(1,1) PRIMARY KEY,
    TipoAlerta VARCHAR(80) NOT NULL,
    Secuencia VARCHAR(60) NOT NULL,
    Escalado BIT NOT NULL DEFAULT 0,
    idAlerta INT NOT NULL
);
SET IDENTITY_INSERT dbo.DIM_ALERTA ON;
INSERT INTO dbo.DIM_ALERTA (KeyAlerta, TipoAlerta, Secuencia, Escalado, idAlerta)
VALUES (0, 'NO APLICA', 'NO APLICA', 0, 0),
       (-1, 'SIN CLASIFICAR', 'SIN CLASIFICAR', 0, -1);
SET IDENTITY_INSERT dbo.DIM_ALERTA OFF;
GO

CREATE TABLE dbo.DIM_CUOTA (
    KeyCuota INT IDENTITY(1,1) PRIMARY KEY,
    CondicionCuota VARCHAR(80) NOT NULL,
    NumeroCuota INT NOT NULL,
    idCuota INT NOT NULL
);
SET IDENTITY_INSERT dbo.DIM_CUOTA ON;
INSERT INTO dbo.DIM_CUOTA (KeyCuota, CondicionCuota, NumeroCuota, idCuota)
VALUES (0, 'NO APLICA', 0, 0),
       (-1, 'SIN CLASIFICAR', 0, -1);
SET IDENTITY_INSERT dbo.DIM_CUOTA OFF;
GO

/* ============================================================================
   13 HECHOS OFICIALES DEL SCRIPT 04_ETL_POBLAR_DATAMART_DEFINITIVO.sql
============================================================================ */

-- 1. FACT_CAPTACION_BUYER
CREATE TABLE dbo.FACT_CAPTACION_BUYER (
    FactCaptacionId INT IDENTITY(1,1) PRIMARY KEY,
    KeyTiempo INT NOT NULL REFERENCES dbo.DIM_TIEMPO(KeyTiempo),
    KeyEstudiante INT NOT NULL REFERENCES dbo.DIM_ESTUDIANTE(KeyEstudiante),
    KeyCarrera INT NOT NULL REFERENCES dbo.DIM_CARRERA(KeyCarrera),
    KeyCanalCaptacion INT NOT NULL REFERENCES dbo.DIM_CANAL_CAPTACION(KeyCanalCaptacion),
    KeyContenido INT NOT NULL REFERENCES dbo.DIM_CONTENIDO(KeyContenido),
    KeyServicio INT NOT NULL REFERENCES dbo.DIM_SERVICIO(KeyServicio),
    buyer_registrado INT NOT NULL,
    lead_generado INT NOT NULL,
    buyer_con_interaccion_valor INT NOT NULL,
    buyer_con_descarga INT NOT NULL,
    minutos_hasta_primera_interaccion INT NULL,
    buyer_sin_cobertura INT NOT NULL
);

-- 2. FACT_SEGUIMIENTO_BUYER
CREATE TABLE dbo.FACT_SEGUIMIENTO_BUYER (
    FactSeguimientoId INT IDENTITY(1,1) PRIMARY KEY,
    KeyTiempo INT NOT NULL REFERENCES dbo.DIM_TIEMPO(KeyTiempo),
    KeyEstudiante INT NOT NULL REFERENCES dbo.DIM_ESTUDIANTE(KeyEstudiante),
    KeyCarrera INT NOT NULL REFERENCES dbo.DIM_CARRERA(KeyCarrera),
    KeySeguimiento INT NOT NULL REFERENCES dbo.DIM_SEGUIMIENTO(KeySeguimiento),
    buyer_inactivo_contactado INT NOT NULL,
    buyer_reactivado INT NOT NULL
);

-- 3. FACT_CAMPANIA
CREATE TABLE dbo.FACT_CAMPANIA (
    FactCampaniaId INT IDENTITY(1,1) PRIMARY KEY,
    KeyTiempo INT NOT NULL REFERENCES dbo.DIM_TIEMPO(KeyTiempo),
    KeyCanalCaptacion INT NOT NULL REFERENCES dbo.DIM_CANAL_CAPTACION(KeyCanalCaptacion),
    inversion DECIMAL(18,2) NOT NULL,
    buyers_generados INT NOT NULL
);

-- 4. FACT_DIAGNOSTICO_LEAD
CREATE TABLE dbo.FACT_DIAGNOSTICO_LEAD (
    FactDiagnosticoId INT IDENTITY(1,1) PRIMARY KEY,
    KeyTiempo INT NOT NULL REFERENCES dbo.DIM_TIEMPO(KeyTiempo),
    KeyEstudiante INT NOT NULL REFERENCES dbo.DIM_ESTUDIANTE(KeyEstudiante),
    KeyCarrera INT NOT NULL REFERENCES dbo.DIM_CARRERA(KeyCarrera),
    KeyInvestigacion INT NOT NULL REFERENCES dbo.DIM_INVESTIGACION(KeyInvestigacion),
    lead_solicita_diagnostico INT NOT NULL,
    perfil_completo INT NOT NULL,
    diagnostico_solicitado INT NOT NULL,
    diagnostico_48h INT NOT NULL,
    horas_diagnostico DECIMAL(10,2) NULL
);

-- 5. FACT_NEGOCIACION_LEAD
CREATE TABLE dbo.FACT_NEGOCIACION_LEAD (
    FactNegociacionId INT IDENTITY(1,1) PRIMARY KEY,
    KeyTiempo INT NOT NULL REFERENCES dbo.DIM_TIEMPO(KeyTiempo),
    KeyEstudiante INT NOT NULL REFERENCES dbo.DIM_ESTUDIANTE(KeyEstudiante),
    KeyCarrera INT NOT NULL REFERENCES dbo.DIM_CARRERA(KeyCarrera),
    KeyServicio INT NOT NULL REFERENCES dbo.DIM_SERVICIO(KeyServicio),
    KeyAsesor INT NOT NULL REFERENCES dbo.DIM_ASESOR(KeyAsesor),
    KeyOrigenPropuesta INT NOT NULL REFERENCES dbo.DIM_ORIGEN_PROPUESTA(KeyOrigenPropuesta),
    KeyCanalCaptacion INT NOT NULL REFERENCES dbo.DIM_CANAL_CAPTACION(KeyCanalCaptacion),
    lead_con_propuesta INT NOT NULL,
    lead_con_propuesta_aceptada INT NOT NULL,
    horas_hasta_aceptacion DECIMAL(10,2) NULL,
    horas_hasta_primera_propuesta DECIMAL(10,2) NULL,
    lead_cohorte INT NOT NULL,
    payer_generado INT NOT NULL,
    monto_descuento DECIMAL(18,2) NOT NULL,
    precio_base DECIMAL(18,2) NOT NULL,
    propuesta_en_minimo INT NOT NULL,
    propuesta_aceptada INT NOT NULL
);

-- 6. FACT_OBJECION_LEAD
CREATE TABLE dbo.FACT_OBJECION_LEAD (
    FactObjecionId INT IDENTITY(1,1) PRIMARY KEY,
    KeyTiempo INT NOT NULL REFERENCES dbo.DIM_TIEMPO(KeyTiempo),
    KeyObjecion INT NOT NULL REFERENCES dbo.DIM_OBJECION(KeyObjecion),
    KeyServicio INT NOT NULL REFERENCES dbo.DIM_SERVICIO(KeyServicio),
    KeyAsesor INT NOT NULL REFERENCES dbo.DIM_ASESOR(KeyAsesor),
    lead_con_objecion INT NOT NULL,
    lead_recuperado INT NOT NULL,
    lead_objecion_escalada INT NOT NULL
);

-- 7. FACT_COBRANZA (Grano: 1 fila por ORDEN_PAGO)
CREATE TABLE dbo.FACT_COBRANZA (
    FactCobranzaId INT IDENTITY(1,1) PRIMARY KEY,
    KeyTiempo INT NOT NULL REFERENCES dbo.DIM_TIEMPO(KeyTiempo),
    KeyServicio INT NOT NULL REFERENCES dbo.DIM_SERVICIO(KeyServicio),
    KeyModalidadPago INT NOT NULL REFERENCES dbo.DIM_MODALIDAD_PAGO(KeyModalidadPago),
    KeyPagador INT NOT NULL REFERENCES dbo.DIM_PAGADOR(KeyPagador),
    orden_creada INT NOT NULL,
    orden_con_pago INT NOT NULL,
    minutos_a_primer_pago INT NULL,
    pendiente_alertado INT NOT NULL,
    pendiente_recuperado INT NOT NULL,
    monto_exigible DECIMAL(18,2) NOT NULL,
    monto_cobrado DECIMAL(18,2) NOT NULL
);

-- 8. FACT_PAGO (Grano: 1 fila por PAGO confirmado)
CREATE TABLE dbo.FACT_PAGO (
    FactPagoId INT IDENTITY(1,1) PRIMARY KEY,
    KeyTiempo INT NOT NULL REFERENCES dbo.DIM_TIEMPO(KeyTiempo),
    KeyServicio INT NOT NULL REFERENCES dbo.DIM_SERVICIO(KeyServicio),
    KeyModalidadPago INT NOT NULL REFERENCES dbo.DIM_MODALIDAD_PAGO(KeyModalidadPago),
    KeyMedioPago INT NOT NULL REFERENCES dbo.DIM_MEDIO_PAGO(KeyMedioPago),
    pago_por_webhook INT NOT NULL,
    pago_confirmado INT NOT NULL,
    comision_pasarela DECIMAL(18,2) NOT NULL,
    monto_pagado DECIMAL(18,2) NOT NULL
);

-- 9. FACT_CUSTOMER_SERVICIO
CREATE TABLE dbo.FACT_CUSTOMER_SERVICIO (
    FactCustomerId INT IDENTITY(1,1) PRIMARY KEY,
    KeyTiempo INT NOT NULL REFERENCES dbo.DIM_TIEMPO(KeyTiempo),
    KeyEstudiante INT NOT NULL REFERENCES dbo.DIM_ESTUDIANTE(KeyEstudiante),
    KeyCarrera INT NOT NULL REFERENCES dbo.DIM_CARRERA(KeyCarrera),
    KeyServicio INT NOT NULL REFERENCES dbo.DIM_SERVICIO(KeyServicio),
    KeyAsesor INT NOT NULL REFERENCES dbo.DIM_ASESOR(KeyAsesor),
    customer_activado INT NOT NULL,
    asignacion_24h INT NOT NULL,
    horas_asignacion DECIMAL(10,2) NULL,
    primera_sesion_48h INT NOT NULL,
    encuesta_respondida INT NOT NULL,
    puntaje_satisfaccion DECIMAL(10,2) NULL,
    ingresos DECIMAL(18,2) NOT NULL,
    comision_pasarela DECIMAL(18,2) NOT NULL,
    honorarios DECIMAL(18,2) NOT NULL,
    costo_turnitin DECIMAL(18,2) NOT NULL,
    margen DECIMAL(18,2) NOT NULL
);

-- 10. FACT_SESION
CREATE TABLE dbo.FACT_SESION (
    FactSesionId INT IDENTITY(1,1) PRIMARY KEY,
    KeyTiempo INT NOT NULL REFERENCES dbo.DIM_TIEMPO(KeyTiempo),
    KeyEstudiante INT NOT NULL REFERENCES dbo.DIM_ESTUDIANTE(KeyEstudiante),
    KeyCarrera INT NOT NULL REFERENCES dbo.DIM_CARRERA(KeyCarrera),
    KeyServicio INT NOT NULL REFERENCES dbo.DIM_SERVICIO(KeyServicio),
    KeyAsesor INT NOT NULL REFERENCES dbo.DIM_ASESOR(KeyAsesor),
    KeySesion INT NOT NULL REFERENCES dbo.DIM_SESION(KeySesion),
    sesion_programada INT NOT NULL,
    sesion_reprogramada INT NOT NULL
);

-- 11. FACT_HITO_CALIDAD
CREATE TABLE dbo.FACT_HITO_CALIDAD (
    FactHitoId INT IDENTITY(1,1) PRIMARY KEY,
    KeyTiempo INT NOT NULL REFERENCES dbo.DIM_TIEMPO(KeyTiempo),
    KeyEstudiante INT NOT NULL REFERENCES dbo.DIM_ESTUDIANTE(KeyEstudiante),
    KeyCarrera INT NOT NULL REFERENCES dbo.DIM_CARRERA(KeyCarrera),
    KeyServicio INT NOT NULL REFERENCES dbo.DIM_SERVICIO(KeyServicio),
    KeyAsesor INT NOT NULL REFERENCES dbo.DIM_ASESOR(KeyAsesor),
    KeyHito INT NOT NULL REFERENCES dbo.DIM_HITO(KeyHito),
    hito_evaluado INT NOT NULL,
    hito_a_tiempo INT NOT NULL,
    dias_desviacion INT NULL,
    reporte_emitido INT NOT NULL,
    reporte_cumple_umbral INT NOT NULL,
    dias_levantamiento INT NOT NULL,
    observacion_levantada INT NOT NULL,
    ronda_extra INT NOT NULL,
    observacion_recibida INT NOT NULL
);

-- 12. FACT_CONVERSACION
CREATE TABLE dbo.FACT_CONVERSACION (
    FactConversacionId INT IDENTITY(1,1) PRIMARY KEY,
    KeyTiempo INT NOT NULL REFERENCES dbo.DIM_TIEMPO(KeyTiempo),
    KeyEstudiante INT NOT NULL REFERENCES dbo.DIM_ESTUDIANTE(KeyEstudiante),
    KeyCarrera INT NOT NULL REFERENCES dbo.DIM_CARRERA(KeyCarrera),
    KeyCanalCaptacion INT NOT NULL REFERENCES dbo.DIM_CANAL_CAPTACION(KeyCanalCaptacion),
    KeyMotivoEscalamiento INT NOT NULL REFERENCES dbo.DIM_MOTIVO_ESCALAMIENTO(KeyMotivoEscalamiento),
    conversacion_iniciada INT NOT NULL,
    segundos_primera_respuesta INT NULL,
    conversacion_resuelta_sin_humano INT NOT NULL,
    conversacion_escalada INT NOT NULL,
    escalamiento INT NOT NULL,
    escalamiento_atendido INT NOT NULL,
    minutos_hasta_atencion INT NULL
);

-- 13. FACT_META
CREATE TABLE dbo.FACT_META (
    FactMetaId INT IDENTITY(1,1) PRIMARY KEY,
    KeyTiempo INT NOT NULL REFERENCES dbo.DIM_TIEMPO(KeyTiempo),
    KeyIndicador INT NOT NULL REFERENCES dbo.DIM_INDICADOR(KeyIndicador),
    KeyCarrera INT NOT NULL REFERENCES dbo.DIM_CARRERA(KeyCarrera),
    valor_meta DECIMAL(18,2) NOT NULL,
    valor_real DECIMAL(18,2) NOT NULL
);

-- HECHOS ESPECÍFICOS COMPLEMENTARIOS DE PAYERS (payers.docx Sección 7)
CREATE TABLE dbo.FACT_ORDEN_COBRANZA (
    FactOrdenCobranzaId INT IDENTITY(1,1) PRIMARY KEY,
    KeyTiempo INT NOT NULL REFERENCES dbo.DIM_TIEMPO(KeyTiempo),
    KeyServicio INT NOT NULL REFERENCES dbo.DIM_SERVICIO(KeyServicio),
    KeyModalidadPago INT NOT NULL REFERENCES dbo.DIM_MODALIDAD_PAGO(KeyModalidadPago),
    KeyPagador INT NOT NULL REFERENCES dbo.DIM_PAGADOR(KeyPagador),
    orden_creada INT NOT NULL,
    orden_con_pago INT NOT NULL,
    monto_comprometido DECIMAL(18,2) NOT NULL,
    monto_exigible DECIMAL(18,2) NOT NULL,
    monto_cobrado DECIMAL(18,2) NOT NULL,
    minutos_a_primer_pago INT NULL
);

CREATE TABLE dbo.FACT_RECUPERACION_COBRANZA (
    FactRecuperacionId INT IDENTITY(1,1) PRIMARY KEY,
    KeyTiempo INT NOT NULL REFERENCES dbo.DIM_TIEMPO(KeyTiempo),
    KeyAlerta INT NOT NULL REFERENCES dbo.DIM_ALERTA(KeyAlerta),
    KeyServicio INT NOT NULL REFERENCES dbo.DIM_SERVICIO(KeyServicio),
    KeyModalidadPago INT NOT NULL REFERENCES dbo.DIM_MODALIDAD_PAGO(KeyModalidadPago),
    pendiente_alertado INT NOT NULL,
    pendiente_recuperado INT NOT NULL
);
GO

PRINT 'DDL INBESTIGA_MART CREADO EXITOSAMENTE.';
GO
