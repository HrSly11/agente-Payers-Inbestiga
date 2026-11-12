/* ============================================================================
   01_DDL_INBESTIGA_TESIS.sql
   Base de Datos Transaccional OLTP v2 - INBESTIGA_TESIS
   Alineada 100% con:
     - 04_ETL_POBLAR_DATAMART_DEFINITIVO.sql
     - Especificación v2 del Agente de Cobranza PAYERS (payers.docx)
     - Informe del Curso de Inteligencia de Negocios (Anexo A y Sección 5)
============================================================================ */

USE master;
GO

IF DB_ID('INBESTIGA_TESIS') IS NULL
BEGIN
    CREATE DATABASE INBESTIGA_TESIS COLLATE Modern_Spanish_CI_AS;
END
GO

USE INBESTIGA_TESIS;
GO

SET NOCOUNT ON;
GO

/* ============================================================================
   LIMPIEZA ORDENADA DE VISTAS Y TABLAS (IDEMPOTENTE)
============================================================================ */
IF OBJECT_ID('dbo.v_MargenCustomer', 'V') IS NOT NULL DROP VIEW dbo.v_MargenCustomer;
IF OBJECT_ID('dbo.v_FechasBI', 'V') IS NOT NULL DROP VIEW dbo.v_FechasBI;
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
   1. CATÁLOGOS Y ENTIDADES COMPARTIDAS
============================================================================ */
CREATE TABLE dbo.UNIVERSIDAD (
    universidad_id INT IDENTITY(1,1) PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    siglas VARCHAR(20) NOT NULL UNIQUE,
    tipo VARCHAR(50) NOT NULL, -- Pública, Privada
    ciudad VARCHAR(100) NOT NULL DEFAULT 'Trujillo',
    norma_citacion VARCHAR(50) NOT NULL DEFAULT 'APA 7',
    atendida BIT NOT NULL DEFAULT 1
);

CREATE TABLE dbo.CARRERA (
    carrera_id INT IDENTITY(1,1) PRIMARY KEY,
    universidad_id INT NOT NULL REFERENCES dbo.UNIVERSIDAD(universidad_id),
    facultad VARCHAR(150) NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    area_conocimiento VARCHAR(100) NULL,
    atendida BIT NOT NULL DEFAULT 1
);

CREATE TABLE dbo.CONTACTO (
    contacto_id INT IDENTITY(1,1) PRIMARY KEY,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    telefono VARCHAR(30) NOT NULL,
    email VARCHAR(150) NULL,
    consentimiento BIT NOT NULL DEFAULT 1,
    no_contactar BIT NOT NULL DEFAULT 0,
    ventana_whatsapp_tipo VARCHAR(30) NOT NULL DEFAULT '24H', -- 24H, 72H_ANUNCIO, VENCIDA
    ventana_whatsapp_vence DATETIME2 NULL,
    fecha_registro DATETIME2 NOT NULL DEFAULT GETDATE()
);

CREATE TABLE dbo.PERFIL_ACADEMICO (
    perfil_academico_id INT IDENTITY(1,1) PRIMARY KEY,
    contacto_id INT NOT NULL UNIQUE REFERENCES dbo.CONTACTO(contacto_id),
    carrera_id INT NOT NULL REFERENCES dbo.CARRERA(carrera_id),
    sede VARCHAR(100) NOT NULL DEFAULT 'Trujillo',
    etapa_academica VARCHAR(80) NOT NULL, -- Pregrado, Egresado, Bachiller
    ciclo VARCHAR(50) NOT NULL, -- IX Ciclo, X Ciclo, Egresado, Bachiller
    tipo_investigacion VARCHAR(100) NOT NULL DEFAULT 'Proyecto de tesis',
    avance VARCHAR(80) NOT NULL DEFAULT 'Sin tema'
);

CREATE TABLE dbo.CANAL (
    canal_id INT IDENTITY(1,1) PRIMARY KEY,
    tipo VARCHAR(80) NOT NULL, -- Anuncio pagado, Mensajería, Referido
    plataforma VARCHAR(80) NOT NULL, -- Meta, TikTok, WhatsApp, Directo
    nombre VARCHAR(120) NOT NULL,
    activo BIT NOT NULL DEFAULT 1
);

CREATE TABLE dbo.CAMPANIA (
    campania_id INT IDENTITY(1,1) PRIMARY KEY,
    canal_id INT NOT NULL REFERENCES dbo.CANAL(canal_id),
    nombre VARCHAR(150) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NULL,
    inversion DECIMAL(18,2) NOT NULL DEFAULT 0,
    estado VARCHAR(40) NOT NULL DEFAULT 'ACTIVA'
);

CREATE TABLE dbo.CONTENIDO (
    contenido_id INT IDENTITY(1,1) PRIMARY KEY,
    tipo_contenido VARCHAR(80) NOT NULL, -- Guía PDF, Plantilla, Video, Checklist
    tema VARCHAR(120) NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    activo BIT NOT NULL DEFAULT 1
);

CREATE TABLE dbo.SERVICIO (
    servicio_id INT IDENTITY(1,1) PRIMARY KEY,
    familia VARCHAR(80) NOT NULL, -- Asesoría, Revisión
    tipo_servicio VARCHAR(100) NOT NULL, -- Tesis Pregrado, Completa, Turnitin
    nombre VARCHAR(150) NOT NULL,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    precio_base DECIMAL(18,2) NOT NULL,
    precio_minimo DECIMAL(18,2) NOT NULL,
    max_cuotas INT NOT NULL DEFAULT 6,
    plazo_semanas INT NOT NULL DEFAULT 12,
    solo_contado BIT NOT NULL DEFAULT 0,
    activo BIT NOT NULL DEFAULT 1
);

CREATE TABLE dbo.ENTREGABLE (
    entregable_id INT IDENTITY(1,1) PRIMARY KEY,
    tipo_entregable VARCHAR(100) NOT NULL, -- Avance Metodológico, Informe Final, Revisión Calidad
    nombre VARCHAR(150) NOT NULL,
    orden INT NOT NULL DEFAULT 1
);

CREATE TABLE dbo.ASESOR (
    asesor_id INT IDENTITY(1,1) PRIMARY KEY,
    equipo VARCHAR(80) NOT NULL, -- Investigación, Comercial, Caja
    rol VARCHAR(80) NOT NULL, -- Especialista, Asesor Metodológico, Administrador
    especialidad VARCHAR(120) NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    email VARCHAR(150) NULL,
    activo BIT NOT NULL DEFAULT 1
);

/* ============================================================================
   2. FASE 1 — BUYERS (CAPTACIÓN Y MARKETING)
============================================================================ */
CREATE TABLE dbo.BUYER (
    buyer_id INT IDENTITY(1,1) PRIMARY KEY,
    contacto_id INT NOT NULL REFERENCES dbo.CONTACTO(contacto_id),
    canal_captacion_id INT NOT NULL REFERENCES dbo.CANAL(canal_id),
    campania_id INT NULL REFERENCES dbo.CAMPANIA(campania_id),
    servicio_interes_id INT NULL REFERENCES dbo.SERVICIO(servicio_id),
    lead_score INT NOT NULL DEFAULT 50,
    fecha_buyer DATETIME2 NOT NULL,
    estado VARCHAR(50) NOT NULL DEFAULT 'CALIFICADO' -- CALIFICADO, EN_NUTRICION, SIN_COBERTURA
);

CREATE TABLE dbo.INTERACCION_CAPTACION (
    interaccion_id INT IDENTITY(1,1) PRIMARY KEY,
    buyer_id INT NOT NULL REFERENCES dbo.BUYER(buyer_id),
    contenido_id INT NULL REFERENCES dbo.CONTENIDO(contenido_id),
    tipo_interaccion VARCHAR(80) NOT NULL DEFAULT 'RESPUESTA_FLUJO',
    es_valor BIT NOT NULL DEFAULT 1,
    fecha_interaccion DATETIME2 NOT NULL
);

CREATE TABLE dbo.DESCARGA_CONTENIDO (
    descarga_id INT IDENTITY(1,1) PRIMARY KEY,
    buyer_id INT NOT NULL REFERENCES dbo.BUYER(buyer_id),
    contenido_id INT NOT NULL REFERENCES dbo.CONTENIDO(contenido_id),
    fecha_descarga DATETIME2 NOT NULL
);

CREATE TABLE dbo.SEGUIMIENTO_BUYER (
    seguimiento_buyer_id INT IDENTITY(1,1) PRIMARY KEY,
    buyer_id INT NOT NULL REFERENCES dbo.BUYER(buyer_id),
    tipo_seguimiento VARCHAR(80) NOT NULL, -- Recordatorio 24h, Contenido de valor, Reactivación 7d
    resultado VARCHAR(50) NOT NULL, -- REACTIVADO, SIN_RESPUESTA, BAJA
    fecha_envio DATETIME2 NOT NULL
);

/* ============================================================================
   3. FASE 2 — LEADS (DIAGNÓSTICO, PROPUESTA Y NEGOCIACIÓN)
============================================================================ */
CREATE TABLE dbo.LEAD (
    lead_id INT IDENTITY(1,1) PRIMARY KEY,
    buyer_id INT NOT NULL UNIQUE REFERENCES dbo.BUYER(buyer_id),
    asesor_id INT NULL REFERENCES dbo.ASESOR(asesor_id),
    score_calificado INT NOT NULL DEFAULT 75,
    prioridad VARCHAR(30) NOT NULL DEFAULT 'ALTA',
    fecha_lead DATETIME2 NOT NULL,
    estado VARCHAR(50) NOT NULL DEFAULT 'EN_NEGOCIACION'
);

CREATE TABLE dbo.PERFIL_NEGOCIACION (
    perfil_negociacion_id INT IDENTITY(1,1) PRIMARY KEY,
    lead_id INT NOT NULL UNIQUE REFERENCES dbo.LEAD(lead_id),
    presupuesto_declarado DECIMAL(18,2) NULL,
    urgencia VARCHAR(50) NULL,
    completo BIT NOT NULL DEFAULT 1,
    fecha_actualizacion DATETIME2 NOT NULL DEFAULT GETDATE()
);

CREATE TABLE dbo.DIAGNOSTICO (
    diagnostico_id INT IDENTITY(1,1) PRIMARY KEY,
    lead_id INT NOT NULL REFERENCES dbo.LEAD(lead_id),
    tipo_tesis VARCHAR(100) NOT NULL,
    avance_declarado VARCHAR(80) NOT NULL,
    empresa_aplicacion VARCHAR(120) NOT NULL DEFAULT 'Empresa privada',
    fecha_solicitud DATETIME2 NOT NULL,
    fecha_entrega DATETIME2 NULL
);

CREATE TABLE dbo.PROPUESTA (
    propuesta_id INT IDENTITY(1,1) PRIMARY KEY,
    lead_id INT NOT NULL REFERENCES dbo.LEAD(lead_id),
    servicio_id INT NOT NULL REFERENCES dbo.SERVICIO(servicio_id),
    asesor_id INT NULL REFERENCES dbo.ASESOR(asesor_id),
    generada_por VARCHAR(50) NOT NULL DEFAULT 'Bot', -- Bot, Especialista
    version INT NOT NULL DEFAULT 1,
    precio_base DECIMAL(18,2) NOT NULL,
    descuento DECIMAL(18,2) NOT NULL DEFAULT 0,
    precio_final DECIMAL(18,2) NOT NULL,
    precio_minimo_aplicado DECIMAL(18,2) NOT NULL,
    vigencia_hasta DATETIME2 NULL,
    fecha_presentacion DATETIME2 NOT NULL,
    estado VARCHAR(50) NOT NULL DEFAULT 'ACEPTADA' -- PRESENTADA, ACEPTADA, RECHAZADA, VENCIDA
);

CREATE TABLE dbo.RESPUESTA_PROPUESTA (
    respuesta_propuesta_id INT IDENTITY(1,1) PRIMARY KEY,
    propuesta_id INT NOT NULL REFERENCES dbo.PROPUESTA(propuesta_id),
    tipo_respuesta VARCHAR(50) NOT NULL, -- ACEPTA, RECHAZA, CONTRAOFERTA
    comentario VARCHAR(300) NULL,
    fecha_respuesta DATETIME2 NOT NULL
);

CREATE TABLE dbo.OBJECION (
    objecion_id INT IDENTITY(1,1) PRIMARY KEY,
    propuesta_id INT NOT NULL REFERENCES dbo.PROPUESTA(propuesta_id),
    grupo VARCHAR(80) NOT NULL, -- Económica, Confianza, Tiempo, Alcance
    tipo VARCHAR(100) NOT NULL, -- Precio alto, Pago en partes, Desconfianza / estafa, Plazo corto
    estado VARCHAR(50) NOT NULL DEFAULT 'RESUELTA',
    veces_repetida INT NOT NULL DEFAULT 1,
    escalada BIT NOT NULL DEFAULT 0,
    fecha_registro DATETIME2 NOT NULL
);

CREATE TABLE dbo.SEGUIMIENTO_LEAD (
    seguimiento_lead_id INT IDENTITY(1,1) PRIMARY KEY,
    lead_id INT NOT NULL REFERENCES dbo.LEAD(lead_id),
    tipo_seguimiento VARCHAR(80) NOT NULL,
    resultado VARCHAR(50) NOT NULL,
    fecha_envio DATETIME2 NOT NULL
);

/* ============================================================================
   4. FASE 3 — PAYERS (CONTRATO, COBRANZA, PASARELA Y ACTIVACIÓN - ESPECIFICACIÓN v2)
============================================================================ */
CREATE TABLE dbo.MODALIDAD_PAGO (
    modalidad_pago_id INT IDENTITY(1,1) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    tipo_modalidad VARCHAR(50) NOT NULL, -- Contado, Cuotas
    numero_cuotas INT NOT NULL, -- 1, 3, 6
    es_contado BIT NOT NULL DEFAULT 0,
    condicion VARCHAR(120) NOT NULL, -- 1 pago (100%), 3 cuotas 30/40/30, 6 cuotas (inicial + hitos)
    porcentajes_json VARCHAR(200) NOT NULL DEFAULT '[100]',
    activo BIT NOT NULL DEFAULT 1
);

CREATE TABLE dbo.MEDIO_PAGO (
    medio_pago_id INT IDENTITY(1,1) PRIMARY KEY,
    tipo_medio VARCHAR(80) NOT NULL, -- Pasarela (webhook), Manual (voucher)
    proveedor VARCHAR(80) NOT NULL, -- Culqi, BCP / Interbank
    nombre VARCHAR(80) NOT NULL, -- Yape, Plin, Tarjeta, Transferencia, Depósito
    metodo VARCHAR(50) NOT NULL, -- YAPE, PLIN, TARJETA, TRANSFERENCIA, DEPOSITO
    canal VARCHAR(80) NOT NULL DEFAULT 'CHECKOUT_LINK',
    monto_maximo DECIMAL(18,2) NULL, -- S/ 500.00 para Yape y Plin (RN-05)
    comision_pct DECIMAL(6,2) NOT NULL DEFAULT 0.00, -- 2.95% Yape/Plin, 3.99% Tarjeta, 0% Manual
    verificacion VARCHAR(30) NOT NULL, -- PASARELA, MANUAL
    instrucciones_manual VARCHAR(500) NULL,
    activo BIT NOT NULL DEFAULT 1
);

CREATE TABLE dbo.RESPONSABLE_PAGO (
    responsable_pago_id INT IDENTITY(1,1) PRIMARY KEY,
    contacto_id INT NULL REFERENCES dbo.CONTACTO(contacto_id),
    nombre VARCHAR(150) NOT NULL,
    telefono VARCHAR(30) NULL,
    email VARCHAR(150) NULL,
    segmento VARCHAR(80) NOT NULL, -- Estudiante, Familiar, Otro
    tipo_responsable VARCHAR(80) NOT NULL, -- Estudiante, Familiar, Empresa
    relacion VARCHAR(100) NOT NULL -- El propio tesista, Padre o madre, Pareja o hermano(a), Empresa o empleador
);

CREATE TABLE dbo.PLANTILLA_CONTRATO (
    plantilla_contrato_id INT IDENTITY(1,1) PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    version VARCHAR(20) NOT NULL DEFAULT 'v2.0',
    clausulas_variables VARCHAR(MAX) NOT NULL,
    vigente_desde DATE NOT NULL DEFAULT '2026-01-01',
    activa BIT NOT NULL DEFAULT 1
);

CREATE TABLE dbo.CONTRATO (
    contrato_id INT IDENTITY(1,1) PRIMARY KEY,
    propuesta_id INT NOT NULL UNIQUE REFERENCES dbo.PROPUESTA(propuesta_id),
    plantilla_contrato_id INT NOT NULL REFERENCES dbo.PLANTILLA_CONTRATO(plantilla_contrato_id),
    version VARCHAR(20) NOT NULL DEFAULT 'v2.0',
    alcance VARCHAR(500) NOT NULL DEFAULT 'Asesoría metodológica personalizada por entregables verificables con garantía de levantamiento de observaciones.',
    plazo_dias INT NOT NULL DEFAULT 90,
    garantia VARCHAR(300) NOT NULL DEFAULT 'Acompañamiento hasta sustentación aprobada y similitud Turnitin < 15%.',
    penalidad_pct DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    terminos_cancelacion VARCHAR(300) NOT NULL DEFAULT 'Reembolso proporcional descontando hitos entregados y comisión de pasarela.',
    fecha_generacion DATETIME2 NOT NULL,
    fecha_confirmacion DATETIME2 NULL,
    canal_confirmacion VARCHAR(50) NULL DEFAULT 'WHATSAPP',
    evidencia_aceptacion VARCHAR(500) NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'CONFIRMADO', -- GENERADO, CONFIRMADO, ANULADO
    CONSTRAINT CK_CONTRATO_ESTADO CHECK (estado IN ('GENERADO', 'CONFIRMADO', 'ANULADO'))
);

CREATE TABLE dbo.ORDEN_PAGO (
    orden_pago_id INT IDENTITY(1,1) PRIMARY KEY,
    codigo_orden VARCHAR(40) NOT NULL UNIQUE,
    propuesta_id INT NOT NULL UNIQUE REFERENCES dbo.PROPUESTA(propuesta_id),
    contrato_id INT NULL REFERENCES dbo.CONTRATO(contrato_id),
    responsable_pago_id INT NULL REFERENCES dbo.RESPONSABLE_PAGO(responsable_pago_id),
    modalidad_pago_id INT NOT NULL REFERENCES dbo.MODALIDAD_PAGO(modalidad_pago_id),
    fecha_creacion DATETIME2 NOT NULL,
    fecha_primer_enlace DATETIME2 NULL,
    monto_comprometido DECIMAL(18,2) NOT NULL,
    moneda VARCHAR(10) NOT NULL DEFAULT 'PEN',
    dias_tolerancia_vencimiento INT NOT NULL DEFAULT 7,
    en_mora BIT NOT NULL DEFAULT 0,
    servicio_suspendido_mora BIT NOT NULL DEFAULT 0,
    estado VARCHAR(30) NOT NULL DEFAULT 'ENLACE_ENVIADO', -- PENDIENTE, ENLACE_ENVIADO, PARCIAL, PAGADA, VENCIDA, ANULADA
    CONSTRAINT CK_ORDEN_PAGO_ESTADO CHECK (estado IN ('PENDIENTE', 'ENLACE_ENVIADO', 'PARCIAL', 'PAGADA', 'VENCIDA', 'ANULADA'))
);

CREATE TABLE dbo.HANDOFF_LEADS (
    handoff_id INT IDENTITY(1,1) PRIMARY KEY,
    contacto_id INT NOT NULL REFERENCES dbo.CONTACTO(contacto_id),
    lead_id INT NOT NULL UNIQUE REFERENCES dbo.LEAD(lead_id),
    propuesta_id INT NOT NULL REFERENCES dbo.PROPUESTA(propuesta_id),
    contrato_id INT NULL REFERENCES dbo.CONTRATO(contrato_id),
    orden_pago_id INT NULL REFERENCES dbo.ORDEN_PAGO(orden_pago_id),
    servicio_nombre VARCHAR(150) NOT NULL,
    precio_final DECIMAL(18,2) NOT NULL,
    modalidad_acordada VARCHAR(50) NOT NULL, -- CONTADO, 3_CUOTAS, 6_CUOTAS, POR_DEFINIR
    responsable_pago_tipo VARCHAR(50) NULL,
    responsable_pago_nombre VARCHAR(150) NULL,
    responsable_pago_telefono VARCHAR(30) NULL,
    primer_enlace_url VARCHAR(300) NULL,
    fecha_envio_primer_enlace DATETIME2 NULL,
    objeciones_abiertas VARCHAR(500) NULL,
    resumen_conversacion_leads VARCHAR(1000) NULL,
    consentimiento BIT NOT NULL DEFAULT 1,
    no_contactar BIT NOT NULL DEFAULT 0,
    ventana_whatsapp_tipo VARCHAR(30) NOT NULL DEFAULT '24H',
    ventana_whatsapp_vencimiento DATETIME2 NULL,
    estado_traspaso VARCHAR(30) NOT NULL DEFAULT 'VALIDADO', -- RECIBIDO, VALIDADO, INCOMPLETO
    detalle_incompleto VARCHAR(500) NULL,
    fecha_recepcion DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT CK_HANDOFF_ESTADO CHECK (estado_traspaso IN ('RECIBIDO', 'VALIDADO', 'INCOMPLETO'))
);

CREATE TABLE dbo.PAYER (
    payer_id INT IDENTITY(1,1) PRIMARY KEY,
    lead_id INT NOT NULL UNIQUE REFERENCES dbo.LEAD(lead_id),
    orden_pago_id INT NOT NULL UNIQUE REFERENCES dbo.ORDEN_PAGO(orden_pago_id),
    fecha_payer DATETIME2 NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'ACTIVO'
);

CREATE TABLE dbo.CUSTOMER (
    customer_id INT IDENTITY(1,1) PRIMARY KEY,
    payer_id INT NOT NULL UNIQUE REFERENCES dbo.PAYER(payer_id),
    fecha_activacion DATETIME2 NOT NULL,
    estado_servicio VARCHAR(40) NOT NULL DEFAULT 'ACTIVO' -- ACTIVO, EN_EJECUCION, SUSPENDIDO_MORA, CERRADO
);

CREATE TABLE dbo.HITO_CRONOGRAMA (
    hito_id INT IDENTITY(1,1) PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES dbo.CUSTOMER(customer_id),
    entregable_id INT NOT NULL REFERENCES dbo.ENTREGABLE(entregable_id),
    capitulo VARCHAR(120) NOT NULL,
    fecha_pactada DATE NOT NULL,
    fecha_entrega_real DATE NULL,
    estado VARCHAR(40) NOT NULL DEFAULT 'ENTREGADO' -- PENDIENTE, ENTREGADO, APROBADO
);

CREATE TABLE dbo.CUOTA_PAGO (
    cuota_id INT IDENTITY(1,1) PRIMARY KEY,
    orden_pago_id INT NOT NULL REFERENCES dbo.ORDEN_PAGO(orden_pago_id),
    numero_cuota INT NOT NULL,
    porcentaje DECIMAL(6,2) NOT NULL,
    monto_programado DECIMAL(18,2) NOT NULL,
    condicion VARCHAR(50) NOT NULL, -- Pago único, Cuota inicial, Cuota por hito (INICIAL, AL_ENTREGAR_HITO, FECHA)
    fecha_vencimiento DATE NULL,
    hito_id INT NULL REFERENCES dbo.HITO_CRONOGRAMA(hito_id),
    version_plan INT NOT NULL DEFAULT 1,
    estado VARCHAR(30) NOT NULL DEFAULT 'EXIGIBLE', -- ESPERA_HITO, EXIGIBLE, ENLACE_ENVIADO, POR_VERIFICAR, PAGADA, VENCIDA, ANULADA
    CONSTRAINT CK_CUOTA_PAGO_ESTADO CHECK (estado IN ('ESPERA_HITO', 'EXIGIBLE', 'ENLACE_ENVIADO', 'POR_VERIFICAR', 'PAGADA', 'VENCIDA', 'ANULADA'))
);

CREATE TABLE dbo.ENLACE_PAGO (
    enlace_id INT IDENTITY(1,1) PRIMARY KEY,
    orden_pago_id INT NOT NULL REFERENCES dbo.ORDEN_PAGO(orden_pago_id),
    cuota_id INT NULL REFERENCES dbo.CUOTA_PAGO(cuota_id),
    medio_pago_id INT NULL REFERENCES dbo.MEDIO_PAGO(medio_pago_id),
    referencia_externa VARCHAR(120) NOT NULL UNIQUE,
    url_enlace VARCHAR(300) NOT NULL,
    monto DECIMAL(18,2) NOT NULL,
    fecha_envio DATETIME2 NOT NULL,
    fecha_expiracion DATETIME2 NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'ENVIADO', -- ENVIADO, EN_VERIFICACION, PAGADO, EXPIRADO, REEMPLAZADO
    CONSTRAINT CK_ENLACE_ESTADO CHECK (estado IN ('ENVIADO', 'EN_VERIFICACION', 'PAGADO', 'EXPIRADO', 'REEMPLAZADO'))
);

CREATE TABLE dbo.PAGO (
    pago_id INT IDENTITY(1,1) PRIMARY KEY,
    orden_pago_id INT NOT NULL REFERENCES dbo.ORDEN_PAGO(orden_pago_id),
    cuota_id INT NULL REFERENCES dbo.CUOTA_PAGO(cuota_id),
    enlace_id INT NULL REFERENCES dbo.ENLACE_PAGO(enlace_id),
    medio_pago_id INT NOT NULL REFERENCES dbo.MEDIO_PAGO(medio_pago_id),
    fecha_inicio DATETIME2 NOT NULL,
    fecha_confirmacion DATETIME2 NULL,
    monto_pagado DECIMAL(18,2) NOT NULL,
    comision_pasarela DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    referencia VARCHAR(120) NOT NULL,
    metodo_verificacion VARCHAR(30) NOT NULL DEFAULT 'WEBHOOK', -- WEBHOOK, MANUAL
    verificado_por_asesor_id INT NULL REFERENCES dbo.ASESOR(asesor_id),
    motivo_rechazo VARCHAR(300) NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'CONFIRMADO', -- INICIADO, POR_VERIFICAR, CONFIRMADO, RECHAZADO, OBSERVADO, REEMBOLSADO
    CONSTRAINT CK_PAGO_ESTADO CHECK (estado IN ('INICIADO', 'POR_VERIFICAR', 'CONFIRMADO', 'RECHAZADO', 'OBSERVADO', 'REEMBOLSADO'))
);

CREATE TABLE dbo.VOUCHER (
    voucher_id INT IDENTITY(1,1) PRIMARY KEY,
    pago_id INT NULL REFERENCES dbo.PAGO(pago_id),
    orden_pago_id INT NOT NULL REFERENCES dbo.ORDEN_PAGO(orden_pago_id),
    cuota_id INT NULL REFERENCES dbo.CUOTA_PAGO(cuota_id),
    referencia_operacion VARCHAR(100) NOT NULL,
    archivo_url VARCHAR(300) NOT NULL,
    hash_imagen VARCHAR(128) NOT NULL UNIQUE,
    monto_ocr DECIMAL(18,2) NULL,
    banco_ocr VARCHAR(80) NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'POR_VERIFICAR', -- POR_VERIFICAR, VERIFICADO, RECHAZADO, DUDOSO
    motivo_rechazo VARCHAR(300) NULL,
    verificado_por_asesor_id INT NULL REFERENCES dbo.ASESOR(asesor_id),
    fecha_carga DATETIME2 NOT NULL DEFAULT GETDATE(),
    fecha_verificacion DATETIME2 NULL
);

CREATE TABLE dbo.EVENTO_WEBHOOK (
    evento_id INT IDENTITY(1,1) PRIMARY KEY,
    pago_id INT NULL REFERENCES dbo.PAGO(pago_id),
    proveedor VARCHAR(50) NOT NULL DEFAULT 'Culqi',
    tipo_evento VARCHAR(80) NOT NULL DEFAULT 'charge.succeeded',
    referencia_externa VARCHAR(120) NOT NULL UNIQUE,
    firma_hmac VARCHAR(256) NOT NULL,
    firma_valida BIT NOT NULL DEFAULT 1,
    fecha_recepcion DATETIME2 NOT NULL,
    procesado BIT NOT NULL DEFAULT 1,
    detalle VARCHAR(500) NULL
);

CREATE TABLE dbo.PLANTILLA_MENSAJE (
    plantilla_msg_id INT IDENTITY(1,1) PRIMARY KEY,
    codigo VARCHAR(60) NOT NULL UNIQUE,
    nombre VARCHAR(120) NOT NULL,
    fase VARCHAR(40) NOT NULL DEFAULT 'PAYERS',
    cuerpo VARCHAR(1000) NOT NULL,
    aprobada_meta BIT NOT NULL DEFAULT 1,
    activa BIT NOT NULL DEFAULT 1
);

CREATE TABLE dbo.ALERTA_COBRANZA (
    alerta_cobranza_id INT IDENTITY(1,1) PRIMARY KEY,
    orden_pago_id INT NOT NULL REFERENCES dbo.ORDEN_PAGO(orden_pago_id),
    cuota_id INT NULL REFERENCES dbo.CUOTA_PAGO(cuota_id),
    plantilla_msg_id INT NULL REFERENCES dbo.PLANTILLA_MENSAJE(plantilla_msg_id),
    fecha_envio DATETIME2 NOT NULL,
    secuencia VARCHAR(50) NOT NULL, -- Recordatorio 4 h, Recordatorio 24 h, Escalado al administrador
    tipo VARCHAR(80) NOT NULL, -- Orden sin pago, Cuota de hito pendiente
    resultado VARCHAR(40) NOT NULL DEFAULT 'ENVIADO', -- ENVIADO, RECUPERADO, SIN_RESPUESTA, PAUSADO, ESCALADO
    escalado BIT NOT NULL DEFAULT 0,
    motivo_pausa VARCHAR(250) NULL
);

CREATE TABLE dbo.OBJECION_PAGO (
    objecion_pago_id INT IDENTITY(1,1) PRIMARY KEY,
    orden_pago_id INT NOT NULL REFERENCES dbo.ORDEN_PAGO(orden_pago_id),
    tipo VARCHAR(60) NOT NULL, -- SEGURIDAD_ESTAFA, CONFIANZA_EMPRESA, PAGO_EN_CUOTAS, TOPE_MEDIO, QUIEN_PAGA, LO_PIENSO, PLAZOS, PLAGIO_IA, DEVOLUCION_CANCELACION, DESCUENTO_REBAJA, OTRO
    resumen VARCHAR(400) NOT NULL,
    veces_repetida INT NOT NULL DEFAULT 1,
    resuelta BIT NOT NULL DEFAULT 1,
    fecha_registro DATETIME2 NOT NULL DEFAULT GETDATE()
);

CREATE TABLE dbo.REEMBOLSO (
    reembolso_id INT IDENTITY(1,1) PRIMARY KEY,
    pago_id INT NOT NULL REFERENCES dbo.PAGO(pago_id),
    orden_pago_id INT NOT NULL REFERENCES dbo.ORDEN_PAGO(orden_pago_id),
    monto_bruto DECIMAL(18,2) NOT NULL,
    comision_descontada DECIMAL(18,2) NOT NULL DEFAULT 0,
    monto_neto_devuelto DECIMAL(18,2) NOT NULL,
    motivo VARCHAR(300) NOT NULL,
    aprobado_por_asesor_id INT NULL REFERENCES dbo.ASESOR(asesor_id),
    estado VARCHAR(30) NOT NULL DEFAULT 'PROCESADO',
    fecha_reembolso DATETIME2 NOT NULL DEFAULT GETDATE()
);

/* ============================================================================
   5. FASE 4 — CUSTOMERS (EJECUCIÓN, CALIDAD Y MARGEN)
============================================================================ */
CREATE TABLE dbo.ASIGNACION_ASESOR (
    asignacion_id INT IDENTITY(1,1) PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES dbo.CUSTOMER(customer_id),
    asesor_id INT NOT NULL REFERENCES dbo.ASESOR(asesor_id),
    fecha_asignacion DATETIME2 NOT NULL,
    motivo VARCHAR(150) NOT NULL DEFAULT 'Especialidad en carrera'
);

CREATE TABLE dbo.SESION (
    sesion_id INT IDENTITY(1,1) PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES dbo.CUSTOMER(customer_id),
    asesor_id INT NOT NULL REFERENCES dbo.ASESOR(asesor_id),
    tipo_sesion VARCHAR(80) NOT NULL DEFAULT 'Asesoría metodológica',
    modalidad VARCHAR(60) NOT NULL DEFAULT 'Google Meet',
    fecha_programada DATETIME2 NOT NULL,
    fecha_realizada DATETIME2 NULL,
    estado VARCHAR(40) NOT NULL DEFAULT 'REALIZADA'
);

CREATE TABLE dbo.REPROGRAMACION_SESION (
    reprogramacion_id INT IDENTITY(1,1) PRIMARY KEY,
    sesion_id INT NOT NULL REFERENCES dbo.SESION(sesion_id),
    motivo VARCHAR(200) NOT NULL DEFAULT 'Solicitud del estudiante',
    fecha_reprogramacion DATETIME2 NOT NULL
);

CREATE TABLE dbo.REPORTE_CALIDAD (
    reporte_calidad_id INT IDENTITY(1,1) PRIMARY KEY,
    hito_id INT NOT NULL REFERENCES dbo.HITO_CRONOGRAMA(hito_id),
    porcentaje_similitud DECIMAL(5,2) NOT NULL DEFAULT 11.00,
    porcentaje_ia DECIMAL(5,2) NOT NULL DEFAULT 8.00,
    cumple_umbral BIT NOT NULL DEFAULT 1,
    costo_turnitin DECIMAL(18,2) NOT NULL DEFAULT 25.00,
    fecha_emision DATETIME2 NOT NULL
);

CREATE TABLE dbo.OBSERVACION_UNIVERSITARIA (
    observacion_id INT IDENTITY(1,1) PRIMARY KEY,
    hito_id INT NOT NULL REFERENCES dbo.HITO_CRONOGRAMA(hito_id),
    descripcion VARCHAR(300) NOT NULL,
    es_ronda_extra BIT NOT NULL DEFAULT 0,
    fecha_recepcion DATE NOT NULL,
    fecha_levantamiento DATE NULL
);

CREATE TABLE dbo.ENCUESTA_SATISFACCION (
    encuesta_id INT IDENTITY(1,1) PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES dbo.CUSTOMER(customer_id),
    puntaje DECIMAL(5,2) NOT NULL,
    comentario VARCHAR(300) NULL,
    fecha_encuesta DATETIME2 NOT NULL
);

CREATE TABLE dbo.HONORARIO (
    honorario_id INT IDENTITY(1,1) PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES dbo.CUSTOMER(customer_id),
    asesor_id INT NOT NULL REFERENCES dbo.ASESOR(asesor_id),
    monto DECIMAL(18,2) NOT NULL,
    fecha_pago DATE NOT NULL
);

/* ============================================================================
   6. COMPONENTE TRANSVERSAL: AGENTE IA, ESCALAMIENTO, AUDITORÍA Y METAS
============================================================================ */
CREATE TABLE dbo.CONVERSACION (
    conversacion_id INT IDENTITY(1,1) PRIMARY KEY,
    contacto_id INT NULL REFERENCES dbo.CONTACTO(contacto_id),
    canal_id INT NULL REFERENCES dbo.CANAL(canal_id),
    campania_id INT NULL REFERENCES dbo.CAMPANIA(campania_id),
    fase VARCHAR(30) NOT NULL DEFAULT 'PAYERS', -- BUYERS, LEADS, PAYERS, CUSTOMERS
    version_prompt VARCHAR(30) NOT NULL DEFAULT 'payers-v2.0',
    fecha_inicio DATETIME2 NOT NULL,
    fecha_fin DATETIME2 NULL,
    resuelta_sin_humano BIT NOT NULL DEFAULT 1,
    estado VARCHAR(30) NOT NULL DEFAULT 'ACTIVA'
);

CREATE TABLE dbo.MENSAJE (
    mensaje_id INT IDENTITY(1,1) PRIMARY KEY,
    conversacion_id INT NOT NULL REFERENCES dbo.CONVERSACION(conversacion_id),
    emisor VARCHAR(30) NOT NULL, -- ESTUDIANTE, BOT, ASESOR, SISTEMA
    tipo_mensaje VARCHAR(40) NOT NULL DEFAULT 'TEXTO', -- TEXTO, IMAGEN_VOUCHER, AUDIO_TRANSCRITO, PLANTILLA
    contenido VARCHAR(MAX) NOT NULL,
    fecha_mensaje DATETIME2 NOT NULL
);

CREATE TABLE dbo.ESCALAMIENTO (
    escalamiento_id INT IDENTITY(1,1) PRIMARY KEY,
    conversacion_id INT NULL REFERENCES dbo.CONVERSACION(conversacion_id),
    orden_pago_id INT NULL REFERENCES dbo.ORDEN_PAGO(orden_pago_id),
    tipo_escalamiento VARCHAR(50) NOT NULL DEFAULT 'OTRO', -- DESCUENTO, DEVOLVER_A_LEADS, TRASPASO_INCOMPLETO, RECLAMO_PAGO, VOUCHER_DUDOSO, OBJECION_REPETIDA, SIN_RESPUESTA, OTRO
    destino VARCHAR(80) NOT NULL, -- Especialista, Administrador, Coordinación, LEADS
    motivo VARCHAR(120) NOT NULL, -- Reclamo de pago, Descuento excede tope, Objeción repetida, Cliente pide especialista, etc.
    resumen_automatico VARCHAR(500) NULL,
    respuesta_admin VARCHAR(500) NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'RESUELTO', -- ABIERTO, EN_ATENCION, RESUELTO
    fecha DATETIME2 NOT NULL,
    fecha_atencion DATETIME2 NULL
);

CREATE TABLE dbo.META (
    meta_id INT IDENTITY(1,1) PRIMARY KEY,
    periodo DATE NOT NULL,
    carrera_id INT NOT NULL REFERENCES dbo.CARRERA(carrera_id),
    fase VARCHAR(40) NOT NULL, -- BUYERS, LEADS, PAYERS, CUSTOMERS
    indicador VARCHAR(120) NOT NULL,
    valor_meta DECIMAL(18,2) NOT NULL,
    valor_real DECIMAL(18,2) NOT NULL
);

CREATE TABLE dbo.POLITICA_COBRANZA (
    politica_id INT IDENTITY(1,1) PRIMARY KEY,
    tema VARCHAR(60) NOT NULL UNIQUE, -- DEVOLUCION, SEGURIDAD, CUOTAS, PROTECCION_DATOS, TOPE_YAPE, AUTORIAS
    titulo VARCHAR(150) NOT NULL,
    contenido VARCHAR(1000) NOT NULL,
    version VARCHAR(20) NOT NULL DEFAULT 'v2.0',
    activo BIT NOT NULL DEFAULT 1
);

CREATE TABLE dbo.CONFIG_PARAMETRO (
    parametro_id INT IDENTITY(1,1) PRIMARY KEY,
    clave VARCHAR(80) NOT NULL UNIQUE,
    valor VARCHAR(250) NOT NULL,
    categoria VARCHAR(50) NOT NULL DEFAULT 'PAYERS',
    descripcion VARCHAR(250) NULL,
    fecha_actualizacion DATETIME2 NOT NULL DEFAULT GETDATE()
);

CREATE TABLE dbo.EJECUCION_HERRAMIENTA (
    ejecucion_id INT IDENTITY(1,1) PRIMARY KEY,
    conversacion_id INT NULL REFERENCES dbo.CONVERSACION(conversacion_id),
    orden_pago_id INT NULL REFERENCES dbo.ORDEN_PAGO(orden_pago_id),
    herramienta VARCHAR(80) NOT NULL,
    argumentos_json VARCHAR(MAX) NULL,
    resultado_json VARCHAR(MAX) NULL,
    latencia_ms INT NOT NULL DEFAULT 120,
    exitoso BIT NOT NULL DEFAULT 1,
    fecha_ejecucion DATETIME2 NOT NULL DEFAULT GETDATE()
);

CREATE TABLE dbo.AUDITORIA (
    auditoria_id INT IDENTITY(1,1) PRIMARY KEY,
    rol_usuario VARCHAR(40) NOT NULL, -- ESTUDIANTE, AGENTE, CAJA, ADMIN, ASESOR
    actor VARCHAR(120) NOT NULL,
    accion VARCHAR(100) NOT NULL,
    entidad VARCHAR(60) NOT NULL,
    entidad_id VARCHAR(60) NOT NULL,
    detalle VARCHAR(1000) NULL,
    fecha_evento DATETIME2 NOT NULL DEFAULT GETDATE()
);

CREATE TABLE dbo.EVALUACION_AGENTE (
    evaluacion_id INT IDENTITY(1,1) PRIMARY KEY,
    codigo_caso VARCHAR(40) NOT NULL UNIQUE,
    categoria VARCHAR(60) NOT NULL, -- OBJECION_SEGURIDAD, CUOTAS, TOPE_YAPE, REBAJA_LEADS, INYECCION_PROMPT, TRASPASO_INCOMPLETO, FLUJO_FELIZ
    mensaje_prueba VARCHAR(500) NOT NULL,
    herramienta_esperada VARCHAR(80) NOT NULL,
    herramienta_obtenida VARCHAR(80) NOT NULL,
    respuesta_agente VARCHAR(1000) NOT NULL,
    sin_alucinacion BIT NOT NULL DEFAULT 1,
    cumple_regla_backend BIT NOT NULL DEFAULT 1,
    puntaje INT NOT NULL DEFAULT 100,
    fecha_evaluacion DATETIME2 NOT NULL DEFAULT GETDATE()
);
GO

/* ============================================================================
   7. VISTA v_MargenCustomer (REQUERIDA POR FACT_CUSTOMER_SERVICIO EN EL ETL)
============================================================================ */
CREATE VIEW dbo.v_MargenCustomer
AS
SELECT
    c.customer_id,
    ingresos = ISNULL(pg.ingresos, 0),
    comision_pasarela = ISNULL(pg.comision_pasarela, 0),
    honorarios = ISNULL(hn.honorarios, 0),
    costo_turnitin = ISNULL(rc.costo_turnitin, 0),
    margen = ISNULL(pg.ingresos, 0) - ISNULL(pg.comision_pasarela, 0) - ISNULL(hn.honorarios, 0) - ISNULL(rc.costo_turnitin, 0)
FROM dbo.CUSTOMER c
INNER JOIN dbo.PAYER py ON py.payer_id = c.payer_id
LEFT JOIN (
    SELECT
        orden_pago_id,
        SUM(monto_pagado) AS ingresos,
        SUM(comision_pasarela) AS comision_pasarela
    FROM dbo.PAGO
    WHERE estado = 'CONFIRMADO'
    GROUP BY orden_pago_id
) pg ON pg.orden_pago_id = py.orden_pago_id
LEFT JOIN (
    SELECT
        customer_id,
        SUM(monto) AS honorarios
    FROM dbo.HONORARIO
    GROUP BY customer_id
) hn ON hn.customer_id = c.customer_id
LEFT JOIN (
    SELECT
        h.customer_id,
        SUM(r.costo_turnitin) AS costo_turnitin
    FROM dbo.HITO_CRONOGRAMA h
    INNER JOIN dbo.REPORTE_CALIDAD r ON r.hito_id = h.hito_id
    GROUP BY h.customer_id
) rc ON rc.customer_id = c.customer_id;
GO

PRINT 'DDL INBESTIGA_TESIS CREADO EXITOSAMENTE.';
GO
