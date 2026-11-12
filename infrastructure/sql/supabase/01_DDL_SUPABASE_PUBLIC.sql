-- =============================================================================
-- PROYECTO: INBESTIGA.TESIS — UNIVERSIDAD NACIONAL DE TRUJILLO (2026-II)
-- MOTOR: PostgreSQL 15+ (Supabase Cloud — Esquema public)
-- ARCHIVO: 01_DDL_SUPABASE_PUBLIC.sql
-- DESCRIPCIÓN: DDL Completo e Idempotente de las 47 tablas transaccionales OLTP
--              (Funnel IMPULSE: BUYERS -> LEADS -> PAYERS v2 -> CUSTOMERS)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. CATÁLOGOS INDEPENDIENTES Y SEGURIDAD
-- =============================================================================

CREATE TABLE IF NOT EXISTS public."USUARIO" (
    "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "username" TEXT NOT NULL UNIQUE,
    "email" TEXT NOT NULL UNIQUE,
    "passwordHash" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'ADMIN',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fechaCreacion" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public."UNIVERSIDAD" (
    "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "nombre" TEXT NOT NULL,
    "siglas" TEXT NOT NULL UNIQUE,
    "ciudad" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public."UBICACION" (
    "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "departamento" TEXT NOT NULL,
    "provincia" TEXT NOT NULL,
    "distrito" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public."CANAL" (
    "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL UNIQUE,
    "tipo" TEXT NOT NULL,
    "descripcion" TEXT
);

CREATE TABLE IF NOT EXISTS public."SERVICIO" (
    "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL UNIQUE,
    "descripcion" TEXT NOT NULL,
    "tipoInvestigacion" TEXT NOT NULL,
    "precioBase" NUMERIC(10, 2) NOT NULL,
    "precioMinimo" NUMERIC(10, 2) NOT NULL,
    "precioMaximo" NUMERIC(10, 2) NOT NULL,
    "plazoSemanasMin" INTEGER NOT NULL DEFAULT 4,
    "plazoSemanasMax" INTEGER NOT NULL DEFAULT 16,
    "maxCuotas" INTEGER NOT NULL DEFAULT 4,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public."ASESOR" (
    "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "especialidad" TEXT NOT NULL,
    "gradoAcademico" TEXT NOT NULL,
    "email" TEXT NOT NULL UNIQUE,
    "whatsapp" TEXT NOT NULL,
    "maxClientesSimultaneos" INTEGER NOT NULL DEFAULT 10,
    "clientesActivos" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public."CONFIGURACION_AGENTE" (
    "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "proveedorIA" TEXT NOT NULL DEFAULT 'GEMINI',
    "modelo" TEXT NOT NULL DEFAULT 'gemini-1.5-flash',
    "promptSistema" TEXT NOT NULL,
    "tono" TEXT NOT NULL DEFAULT 'Profesional, empático, académico y resolutivo',
    "estilo" TEXT NOT NULL DEFAULT 'Consultor experto en investigación universitaria',
    "permitirNegociacion" BOOLEAN NOT NULL DEFAULT true,
    "maxDescuentoNegociablePct" NUMERIC(5, 2) NOT NULL DEFAULT 15.00,
    "maxCuotasNegociables" INTEGER NOT NULL DEFAULT 3,
    "reglasObjecionesJson" TEXT,
    "horarioInicio" TEXT NOT NULL DEFAULT '08:00',
    "horarioFin" TEXT NOT NULL DEFAULT '22:00',
    "activo" BOOLEAN NOT NULL DEFAULT true
);

-- Catálogos operativos de Cobranza y Pasarela (PAYERS)
CREATE TABLE IF NOT EXISTS public."MODALIDAD_PAGO" (
    "modalidad_pago_id" SERIAL PRIMARY KEY,
    "nombre" VARCHAR(100) NOT NULL,
    "tipo_modalidad" VARCHAR(50) NOT NULL,
    "numero_cuotas" INTEGER NOT NULL,
    "es_contado" BOOLEAN NOT NULL DEFAULT false,
    "condicion" VARCHAR(120) NOT NULL,
    "porcentajes_json" VARCHAR(200) NOT NULL DEFAULT '[100]',
    "activo" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public."MEDIO_PAGO" (
    "medio_pago_id" SERIAL PRIMARY KEY,
    "tipo_medio" VARCHAR(80) NOT NULL,
    "proveedor" VARCHAR(80) NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "metodo" VARCHAR(50) NOT NULL,
    "canal" VARCHAR(80) NOT NULL DEFAULT 'CHECKOUT_LINK',
    "monto_maximo" NUMERIC(18, 2),
    "comision_pct" NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    "verificacion" VARCHAR(30) NOT NULL,
    "instrucciones_manual" VARCHAR(500),
    "activo" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public."PLANTILLA_CONTRATO" (
    "plantilla_contrato_id" SERIAL PRIMARY KEY,
    "nombre" VARCHAR(150) NOT NULL,
    "version" VARCHAR(20) NOT NULL DEFAULT 'v2.0',
    "clausulas_variables" TEXT NOT NULL,
    "vigente_desde" DATE NOT NULL DEFAULT '2026-01-01',
    "activa" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public."ENTREGABLE" (
    "entregable_id" SERIAL PRIMARY KEY,
    "tipo_entregable" VARCHAR(100) NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public."PLANTILLA_MENSAJE" (
    "plantilla_msg_id" SERIAL PRIMARY KEY,
    "codigo" VARCHAR(60) NOT NULL UNIQUE,
    "nombre" VARCHAR(120) NOT NULL,
    "fase" VARCHAR(40) NOT NULL DEFAULT 'PAYERS',
    "cuerpo" VARCHAR(1000) NOT NULL,
    "aprobada_meta" BOOLEAN NOT NULL DEFAULT true,
    "activa" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public."POLITICA_COBRANZA" (
    "politica_id" SERIAL PRIMARY KEY,
    "tema" VARCHAR(60) NOT NULL UNIQUE,
    "titulo" VARCHAR(150) NOT NULL,
    "contenido" VARCHAR(1000) NOT NULL,
    "version" VARCHAR(20) NOT NULL DEFAULT 'v2.0',
    "activo" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public."CONFIG_PARAMETRO" (
    "parametro_id" SERIAL PRIMARY KEY,
    "clave" VARCHAR(80) NOT NULL UNIQUE,
    "valor" VARCHAR(250) NOT NULL,
    "categoria" VARCHAR(50) NOT NULL DEFAULT 'PAYERS',
    "descripcion" VARCHAR(250),
    "fecha_actualizacion" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 2. DEPENDIENTES DE NIVEL 1
-- =============================================================================

CREATE TABLE IF NOT EXISTS public."CARRERA" (
    "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "universidadId" TEXT NOT NULL REFERENCES public."UNIVERSIDAD"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
    "nombre" TEXT NOT NULL,
    "facultad" TEXT NOT NULL,
    "areaConocimiento" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public."CAMPAÑA" (
    "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "canalId" TEXT NOT NULL REFERENCES public."CANAL"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
    "nombre" TEXT NOT NULL,
    "presupuesto" NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    "fechaInicio" TIMESTAMPTZ NOT NULL,
    "fechaFin" TIMESTAMPTZ,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public."REGLA_COMERCIAL" (
    "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "servicioId" TEXT NOT NULL REFERENCES public."SERVICIO"("id") ON DELETE CASCADE,
    "tipoInvestigacion" TEXT,
    "descuentoMaximoPct" NUMERIC(5, 2) NOT NULL DEFAULT 15.00,
    "descuentoPagoUnicoPct" NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
    "cuotaMinima" NUMERIC(10, 2) NOT NULL DEFAULT 200.00,
    "plazoMinimoDias" INTEGER NOT NULL DEFAULT 15,
    "plazoMaximoDias" INTEGER NOT NULL DEFAULT 120,
    "condicionesEspeciales" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public."NOTIFICACION" (
    "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "usuarioId" TEXT REFERENCES public."USUARIO"("id") ON DELETE CASCADE,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "leido" BOOLEAN NOT NULL DEFAULT false,
    "fechaCreacion" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "metadata" TEXT
);

-- =============================================================================
-- 3. DEPENDIENTES DE NIVEL 2 (CONTENIDO y BUYER)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public."CONTENIDO" (
    "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "campanaId" TEXT NOT NULL REFERENCES public."CAMPAÑA"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
    "titulo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "url" TEXT,
    "leadMagnet" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public."BUYER" (
    "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "universidadId" TEXT REFERENCES public."UNIVERSIDAD"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
    "carreraId" TEXT REFERENCES public."CARRERA"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
    "ubicacionId" TEXT REFERENCES public."UBICACION"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
    "canalId" TEXT REFERENCES public."CANAL"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
    "campanaId" TEXT REFERENCES public."CAMPAÑA"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
    "ciclo" TEXT,
    "tipoInvestigacion" TEXT,
    "situacionLaboral" TEXT,
    "presupuestoAprox" NUMERIC(10, 2),
    "dolorPrincipal" TEXT,
    "softwareRequerido" TEXT,
    "plazoDefinidoDias" INTEGER,
    "leadScore" INTEGER NOT NULL DEFAULT 0,
    "estadoFunnel" TEXT NOT NULL DEFAULT 'BUYER',
    "consentimientoWhatsapp" BOOLEAN NOT NULL DEFAULT true,
    "fechaRegistro" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "fechaConversionLead" TIMESTAMPTZ
);

-- =============================================================================
-- 4. DEPENDIENTES DE NIVEL 3 (FORMULARIO, INTERACCION, PERFIL_NEGOCIACION, LEAD, RESPONSABLE_PAGO)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public."FORMULARIO" (
    "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "buyerId" TEXT NOT NULL REFERENCES public."BUYER"("id") ON DELETE CASCADE,
    "datosJson" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "fechaEnvio" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public."INTERACCION" (
    "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "buyerId" TEXT NOT NULL REFERENCES public."BUYER"("id") ON DELETE CASCADE,
    "tipo" TEXT NOT NULL,
    "detalle" TEXT,
    "fechaHora" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public."PERFIL_NEGOCIACION" (
    "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "buyerId" TEXT NOT NULL UNIQUE REFERENCES public."BUYER"("id") ON DELETE CASCADE,
    "presupuestoEstimado" NUMERIC(10, 2),
    "urgenciaNivel" TEXT,
    "objecionPredominante" TEXT,
    "scoreSensibilidadPrecio" INTEGER DEFAULT 50,
    "notas" TEXT
);

CREATE TABLE IF NOT EXISTS public."LEAD" (
    "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "buyerId" TEXT NOT NULL UNIQUE REFERENCES public."BUYER"("id") ON DELETE CASCADE,
    "scoreCalificado" INTEGER NOT NULL,
    "prioridad" TEXT NOT NULL DEFAULT 'MEDIA',
    "fechaCalificacion" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "umbralSuperado" BOOLEAN NOT NULL DEFAULT true,
    "criterioCalificacion" TEXT
);

CREATE TABLE IF NOT EXISTS public."RESPONSABLE_PAGO" (
    "responsable_pago_id" SERIAL PRIMARY KEY,
    "buyer_id" TEXT REFERENCES public."BUYER"("id") ON DELETE SET NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "telefono" VARCHAR(30),
    "email" VARCHAR(150),
    "segmento" VARCHAR(80) NOT NULL,
    "tipo_responsable" VARCHAR(80) NOT NULL,
    "relacion" VARCHAR(100) NOT NULL
);

-- =============================================================================
-- 5. DEPENDIENTES DE NIVEL 4 y 5 (CONVERSACION, MENSAJE, DIAGNOSTICO, PROPUESTA, OBJECION, SEGUIMIENTO)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public."CONVERSACION" (
    "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "buyerId" TEXT NOT NULL REFERENCES public."BUYER"("id") ON DELETE CASCADE,
    "leadId" TEXT REFERENCES public."LEAD"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
    "canal" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "estadoEtapa" TEXT NOT NULL DEFAULT 'DISCOVERY',
    "fechaInicio" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "fechaUltimaActividad" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public."MENSAJE" (
    "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "conversacionId" TEXT NOT NULL REFERENCES public."CONVERSACION"("id") ON DELETE CASCADE,
    "direccion" TEXT NOT NULL,
    "remitente" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "tipoMensaje" TEXT NOT NULL DEFAULT 'TEXT',
    "fechaHora" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "estadoEntrega" TEXT NOT NULL DEFAULT 'SENT',
    "respuestaA" TEXT,
    "metadata" TEXT
);

CREATE TABLE IF NOT EXISTS public."DIAGNOSTICO" (
    "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "conversacionId" TEXT NOT NULL REFERENCES public."CONVERSACION"("id") ON DELETE CASCADE,
    "leadId" TEXT REFERENCES public."LEAD"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
    "temaInvestigacion" TEXT,
    "avanceActualPct" INTEGER NOT NULL DEFAULT 0,
    "principalesDificultades" TEXT,
    "resumenIA" TEXT,
    "fechaDiagnostico" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public."PROPUESTA" (
    "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "conversacionId" TEXT NOT NULL REFERENCES public."CONVERSACION"("id") ON DELETE CASCADE,
    "leadId" TEXT REFERENCES public."LEAD"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
    "servicioId" TEXT NOT NULL REFERENCES public."SERVICIO"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
    "precioOriginal" NUMERIC(10, 2) NOT NULL,
    "precioPropuesto" NUMERIC(10, 2) NOT NULL,
    "descuentoAplicadoPct" NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    "numeroCuotas" INTEGER NOT NULL DEFAULT 1,
    "montoPorCuota" NUMERIC(10, 2) NOT NULL,
    "plazoDias" INTEGER NOT NULL DEFAULT 30,
    "justificacion" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "fechaCreacion" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public."OBJECION" (
    "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "conversacionId" TEXT NOT NULL REFERENCES public."CONVERSACION"("id") ON DELETE CASCADE,
    "leadId" TEXT REFERENCES public."LEAD"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
    "tipo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "respuestaAgente" TEXT,
    "resuelta" BOOLEAN NOT NULL DEFAULT false,
    "fechaRegistro" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public."SEGUIMIENTO" (
    "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "conversacionId" TEXT NOT NULL REFERENCES public."CONVERSACION"("id") ON DELETE CASCADE,
    "leadId" TEXT REFERENCES public."LEAD"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
    "tipo" TEXT NOT NULL,
    "fechaProgramada" TIMESTAMPTZ NOT NULL,
    "fechaEjecutada" TIMESTAMPTZ,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "resultado" TEXT
);

-- =============================================================================
-- 6. DEPENDIENTES DE NIVEL 6 y 7 (COTIZACION, CONTRATO, ORDEN_PAGO, PAGO, PAYER)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public."COTIZACION" (
    "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "leadId" TEXT NOT NULL REFERENCES public."LEAD"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
    "propuestaId" TEXT REFERENCES public."PROPUESTA"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
    "servicioId" TEXT NOT NULL REFERENCES public."SERVICIO"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
    "codigoCotizacion" TEXT NOT NULL UNIQUE,
    "subtotal" NUMERIC(10, 2) NOT NULL,
    "descuento" NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    "total" NUMERIC(10, 2) NOT NULL,
    "cuotas" INTEGER NOT NULL DEFAULT 1,
    "plazoEntregaDias" INTEGER NOT NULL DEFAULT 30,
    "fechaEmision" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "fechaExpiracion" TIMESTAMPTZ NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ACTIVA'
);

CREATE TABLE IF NOT EXISTS public."CONTRATO" (
    "contrato_id" SERIAL PRIMARY KEY,
    "cotizacion_id" TEXT UNIQUE REFERENCES public."COTIZACION"("id") ON DELETE CASCADE,
    "propuesta_id" TEXT REFERENCES public."PROPUESTA"("id") ON DELETE SET NULL,
    "plantilla_contrato_id" INTEGER NOT NULL REFERENCES public."PLANTILLA_CONTRATO"("plantilla_contrato_id"),
    "version" VARCHAR(20) NOT NULL DEFAULT 'v2.0',
    "alcance" VARCHAR(500) NOT NULL DEFAULT 'Asesoría metodológica personalizada por entregables verificables con garantía de levantamiento de observaciones.',
    "plazo_dias" INTEGER NOT NULL DEFAULT 90,
    "garantia" VARCHAR(300) NOT NULL DEFAULT 'Acompañamiento hasta sustentación aprobada y similitud Turnitin < 15%.',
    "penalidad_pct" NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
    "terminos_cancelacion" VARCHAR(300) NOT NULL DEFAULT 'Reembolso proporcional descontando hitos entregados y comisión de pasarela.',
    "fecha_generacion" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "fecha_confirmacion" TIMESTAMPTZ,
    "canal_confirmacion" VARCHAR(50) DEFAULT 'WHATSAPP',
    "evidencia_aceptacion" VARCHAR(500),
    "estado" VARCHAR(30) NOT NULL DEFAULT 'CONFIRMADO',
    CONSTRAINT "CK_CONTRATO_ESTADO" CHECK ("estado" IN ('GENERADO', 'CONFIRMADO', 'ANULADO'))
);

CREATE TABLE IF NOT EXISTS public."ORDEN_PAGO" (
    "orden_pago_id" SERIAL PRIMARY KEY,
    "codigo_orden" VARCHAR(40) NOT NULL UNIQUE,
    "cotizacion_id" TEXT UNIQUE REFERENCES public."COTIZACION"("id") ON DELETE CASCADE,
    "propuesta_id" TEXT REFERENCES public."PROPUESTA"("id") ON DELETE SET NULL,
    "contrato_id" INTEGER REFERENCES public."CONTRATO"("contrato_id") ON DELETE SET NULL,
    "responsable_pago_id" INTEGER REFERENCES public."RESPONSABLE_PAGO"("responsable_pago_id") ON DELETE SET NULL,
    "modalidad_pago_id" INTEGER NOT NULL REFERENCES public."MODALIDAD_PAGO"("modalidad_pago_id"),
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "fecha_primer_enlace" TIMESTAMPTZ,
    "monto_comprometido" NUMERIC(18, 2) NOT NULL,
    "moneda" VARCHAR(10) NOT NULL DEFAULT 'PEN',
    "dias_tolerancia_vencimiento" INTEGER NOT NULL DEFAULT 7,
    "en_mora" BOOLEAN NOT NULL DEFAULT false,
    "servicio_suspendido_mora" BOOLEAN NOT NULL DEFAULT false,
    "estado" VARCHAR(30) NOT NULL DEFAULT 'ENLACE_ENVIADO',
    CONSTRAINT "CK_ORDEN_PAGO_ESTADO" CHECK ("estado" IN ('PENDIENTE', 'ENLACE_ENVIADO', 'PARCIAL', 'PAGADA', 'VENCIDA', 'ANULADA'))
);

CREATE TABLE IF NOT EXISTS public."PAGO" (
    "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "cotizacionId" TEXT NOT NULL REFERENCES public."COTIZACION"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
    "buyerId" TEXT NOT NULL REFERENCES public."BUYER"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
    "leadId" TEXT REFERENCES public."LEAD"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
    "gatewayProveedor" TEXT NOT NULL,
    "gatewayTransactionId" TEXT UNIQUE,
    "monto" NUMERIC(10, 2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "metodoPago" TEXT NOT NULL DEFAULT 'CARD',
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "fechaCreacion" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "fechaConfirmacion" TIMESTAMPTZ,
    "gatewayPayload" TEXT,
    "comprobanteUrl" TEXT
);

CREATE TABLE IF NOT EXISTS public."PAYER" (
    "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "buyerId" TEXT NOT NULL UNIQUE REFERENCES public."BUYER"("id") ON DELETE CASCADE,
    "leadId" TEXT UNIQUE REFERENCES public."LEAD"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
    "primerPagoId" TEXT NOT NULL REFERENCES public."PAGO"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
    "montoTotalPagado" NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    "metodoPrincipal" TEXT NOT NULL DEFAULT 'CARD',
    "fechaConversionPayer" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "estado" TEXT NOT NULL DEFAULT 'ACTIVO'
);

-- =============================================================================
-- 7. DEPENDIENTES DE NIVEL 8, 9 y 10 (CUSTOMER, SESIONES, HITOS, CUOTAS, ENLACES, VOUCHERS, ALERTAS)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public."CUSTOMER" (
    "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "buyerId" TEXT NOT NULL UNIQUE REFERENCES public."BUYER"("id") ON DELETE CASCADE,
    "leadId" TEXT UNIQUE REFERENCES public."LEAD"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
    "payerId" TEXT NOT NULL UNIQUE REFERENCES public."PAYER"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
    "cotizacionId" TEXT NOT NULL REFERENCES public."COTIZACION"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
    "servicioId" TEXT NOT NULL REFERENCES public."SERVICIO"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
    "asesorId" TEXT REFERENCES public."ASESOR"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
    "fechaInicioServicio" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "estadoServicio" TEXT NOT NULL DEFAULT 'ACTIVO',
    "observaciones" TEXT
);

CREATE TABLE IF NOT EXISTS public."ASIGNACION_ASESOR" (
    "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "customerId" TEXT NOT NULL REFERENCES public."CUSTOMER"("id") ON DELETE CASCADE,
    "asesorId" TEXT NOT NULL REFERENCES public."ASESOR"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
    "fechaAsignacion" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "motivo" TEXT,
    "asignadoPor" TEXT NOT NULL DEFAULT 'SISTEMA',
    "activo" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public."SESION" (
    "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "customerId" TEXT NOT NULL REFERENCES public."CUSTOMER"("id") ON DELETE CASCADE,
    "asesorId" TEXT NOT NULL REFERENCES public."ASESOR"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
    "numeroSesion" INTEGER NOT NULL DEFAULT 1,
    "fechaHoraProgramada" TIMESTAMPTZ NOT NULL,
    "fechaHoraRealizada" TIMESTAMPTZ,
    "temaTratado" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PROGRAMADA',
    "enlaceReunion" TEXT,
    "observaciones" TEXT
);

CREATE TABLE IF NOT EXISTS public."ENCUESTA_SATISFACCION" (
    "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    "customerId" TEXT NOT NULL REFERENCES public."CUSTOMER"("id") ON DELETE CASCADE,
    "asesorId" TEXT NOT NULL REFERENCES public."ASESOR"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
    "calificacionGeneral" NUMERIC(3, 2) NOT NULL,
    "claridadMetodologica" INTEGER NOT NULL DEFAULT 5,
    "puntualidadAsesor" INTEGER NOT NULL DEFAULT 5,
    "comentarios" TEXT,
    "fechaRegistro" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public."HITO_CRONOGRAMA" (
    "hito_id" SERIAL PRIMARY KEY,
    "customer_id" TEXT NOT NULL REFERENCES public."CUSTOMER"("id") ON DELETE CASCADE,
    "entregable_id" INTEGER NOT NULL REFERENCES public."ENTREGABLE"("entregable_id"),
    "capitulo" VARCHAR(120) NOT NULL,
    "fecha_pactada" DATE NOT NULL,
    "fecha_entrega_real" DATE,
    "estado" VARCHAR(40) NOT NULL DEFAULT 'ENTREGADO'
);

CREATE TABLE IF NOT EXISTS public."CUOTA_PAGO" (
    "cuota_id" SERIAL PRIMARY KEY,
    "orden_pago_id" INTEGER NOT NULL REFERENCES public."ORDEN_PAGO"("orden_pago_id") ON DELETE CASCADE,
    "numero_cuota" INTEGER NOT NULL,
    "porcentaje" NUMERIC(6, 2) NOT NULL,
    "monto_programado" NUMERIC(18, 2) NOT NULL,
    "condicion" VARCHAR(50) NOT NULL,
    "fecha_vencimiento" DATE,
    "hito_id" INTEGER REFERENCES public."HITO_CRONOGRAMA"("hito_id") ON DELETE SET NULL,
    "version_plan" INTEGER NOT NULL DEFAULT 1,
    "estado" VARCHAR(30) NOT NULL DEFAULT 'EXIGIBLE',
    CONSTRAINT "CK_CUOTA_PAGO_ESTADO" CHECK ("estado" IN ('ESPERA_HITO', 'EXIGIBLE', 'ENLACE_ENVIADO', 'POR_VERIFICAR', 'PAGADA', 'VENCIDA', 'ANULADA'))
);

CREATE TABLE IF NOT EXISTS public."ENLACE_PAGO" (
    "enlace_id" SERIAL PRIMARY KEY,
    "orden_pago_id" INTEGER NOT NULL REFERENCES public."ORDEN_PAGO"("orden_pago_id") ON DELETE CASCADE,
    "cuota_id" INTEGER REFERENCES public."CUOTA_PAGO"("cuota_id") ON DELETE SET NULL,
    "medio_pago_id" INTEGER REFERENCES public."MEDIO_PAGO"("medio_pago_id") ON DELETE SET NULL,
    "referencia_externa" VARCHAR(120) NOT NULL UNIQUE,
    "url_enlace" VARCHAR(300) NOT NULL,
    "monto" NUMERIC(18, 2) NOT NULL,
    "fecha_envio" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "fecha_expiracion" TIMESTAMPTZ NOT NULL,
    "estado" VARCHAR(30) NOT NULL DEFAULT 'ENVIADO',
    CONSTRAINT "CK_ENLACE_ESTADO" CHECK ("estado" IN ('ENVIADO', 'EN_VERIFICACION', 'PAGADO', 'EXPIRADO', 'REEMPLAZADO'))
);

CREATE TABLE IF NOT EXISTS public."VOUCHER" (
    "voucher_id" SERIAL PRIMARY KEY,
    "pago_id" TEXT REFERENCES public."PAGO"("id") ON DELETE SET NULL,
    "orden_pago_id" INTEGER NOT NULL REFERENCES public."ORDEN_PAGO"("orden_pago_id") ON DELETE CASCADE,
    "cuota_id" INTEGER REFERENCES public."CUOTA_PAGO"("cuota_id") ON DELETE SET NULL,
    "referencia_operacion" VARCHAR(100) NOT NULL,
    "archivo_url" VARCHAR(300) NOT NULL,
    "hash_imagen" VARCHAR(128) NOT NULL UNIQUE,
    "monto_ocr" NUMERIC(18, 2),
    "banco_ocr" VARCHAR(80),
    "estado" VARCHAR(30) NOT NULL DEFAULT 'POR_VERIFICAR',
    "motivo_rechazo" VARCHAR(300),
    "verificado_por_asesor_id" TEXT REFERENCES public."ASESOR"("id") ON DELETE SET NULL,
    "fecha_carga" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "fecha_verificacion" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public."EVENTO_WEBHOOK" (
    "evento_id" SERIAL PRIMARY KEY,
    "pago_id" TEXT REFERENCES public."PAGO"("id") ON DELETE SET NULL,
    "proveedor" VARCHAR(50) NOT NULL DEFAULT 'Culqi',
    "tipo_evento" VARCHAR(80) NOT NULL DEFAULT 'charge.succeeded',
    "referencia_externa" VARCHAR(120) NOT NULL UNIQUE,
    "firma_hmac" VARCHAR(256) NOT NULL,
    "firma_valida" BOOLEAN NOT NULL DEFAULT true,
    "fecha_recepcion" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "procesado" BOOLEAN NOT NULL DEFAULT true,
    "detalle" VARCHAR(500)
);

CREATE TABLE IF NOT EXISTS public."ALERTA_COBRANZA" (
    "alerta_cobranza_id" SERIAL PRIMARY KEY,
    "orden_pago_id" INTEGER NOT NULL REFERENCES public."ORDEN_PAGO"("orden_pago_id") ON DELETE CASCADE,
    "cuota_id" INTEGER REFERENCES public."CUOTA_PAGO"("cuota_id") ON DELETE SET NULL,
    "plantilla_msg_id" INTEGER REFERENCES public."PLANTILLA_MENSAJE"("plantilla_msg_id") ON DELETE SET NULL,
    "fecha_envio" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "secuencia" VARCHAR(50) NOT NULL,
    "tipo" VARCHAR(80) NOT NULL,
    "resultado" VARCHAR(40) NOT NULL DEFAULT 'ENVIADO',
    "escalado" BOOLEAN NOT NULL DEFAULT false,
    "motivo_pausa" VARCHAR(250)
);

CREATE TABLE IF NOT EXISTS public."OBJECION_PAGO" (
    "objecion_pago_id" SERIAL PRIMARY KEY,
    "orden_pago_id" INTEGER NOT NULL REFERENCES public."ORDEN_PAGO"("orden_pago_id") ON DELETE CASCADE,
    "tipo" VARCHAR(60) NOT NULL,
    "resumen" VARCHAR(400) NOT NULL,
    "veces_repetida" INTEGER NOT NULL DEFAULT 1,
    "resuelta" BOOLEAN NOT NULL DEFAULT true,
    "fecha_registro" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
