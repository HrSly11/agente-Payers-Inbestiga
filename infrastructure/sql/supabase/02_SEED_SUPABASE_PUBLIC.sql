-- =============================================================================
-- PROYECTO: INBESTIGA.TESIS — UNIVERSIDAD NACIONAL DE TRUJILLO (2026-II)
-- MOTOR: PostgreSQL 15+ (Supabase Cloud — Esquema public)
-- ARCHIVO: 02_SEED_SUPABASE_PUBLIC.sql
-- DESCRIPCIÓN: Semilla Determinística Completa para las 47 tablas en public:
--              - 2 Usuarios (admin y asesor_sistemas)
--              - 7 Ubicaciones, 6 Universidades, 13 Carreras
--              - 5 Canales, 4 Campañas, 4 Contenidos (Lead Magnets)
--              - 4 Servicios, 4 Reglas Comerciales, 4 Asesores, 1 Configuración Agente IA
--              - Catálogos PAYERS v2 (Modalidades, Medios, Plantillas, Entregables, Políticas, Parámetros)
--              - 30 Buyers de cohorte + 3 Estudiantes reales de prueba WhatsApp:
--                  * Harry Sánchez      (ORD-2026-0044 / 51919632928)
--                  * Samira Miguel      (ORD-2026-0065 / 51956092165)
--                  * Ricardo Velasquez  (ORD-2026-0081 / 51961103226)
--              - Leads, Conversaciones, Mensajes, Diagnósticos, Propuestas, Objeciones, Seguimientos
--              - Cotizaciones, Contratos, Órdenes de Pago, Cuotas, Enlaces, Pagos, Vouchers, Webhooks, Alertas
--              - Payers, Customers, Asignaciones, Sesiones, Hitos, Encuestas y Notificaciones
-- =============================================================================

BEGIN;

-- Limpieza controlada e idempotente de las 47 tablas
TRUNCATE TABLE
  public."OBJECION_PAGO",
  public."ALERTA_COBRANZA",
  public."EVENTO_WEBHOOK",
  public."VOUCHER",
  public."ENLACE_PAGO",
  public."CUOTA_PAGO",
  public."HITO_CRONOGRAMA",
  public."ENCUESTA_SATISFACCION",
  public."SESION",
  public."ASIGNACION_ASESOR",
  public."CUSTOMER",
  public."PAYER",
  public."PAGO",
  public."ORDEN_PAGO",
  public."CONTRATO",
  public."COTIZACION",
  public."SEGUIMIENTO",
  public."OBJECION",
  public."PROPUESTA",
  public."DIAGNOSTICO",
  public."MENSAJE",
  public."CONVERSACION",
  public."RESPONSABLE_PAGO",
  public."LEAD",
  public."PERFIL_NEGOCIACION",
  public."INTERACCION",
  public."FORMULARIO",
  public."BUYER",
  public."CONTENIDO",
  public."NOTIFICACION",
  public."REGLA_COMERCIAL",
  public."CAMPAÑA",
  public."CARRERA",
  public."CONFIG_PARAMETRO",
  public."POLITICA_COBRANZA",
  public."PLANTILLA_MENSAJE",
  public."ENTREGABLE",
  public."PLANTILLA_CONTRATO",
  public."MEDIO_PAGO",
  public."MODALIDAD_PAGO",
  public."CONFIGURACION_AGENTE",
  public."ASESOR",
  public."SERVICIO",
  public."CANAL",
  public."UBICACION",
  public."UNIVERSIDAD",
  public."USUARIO"
RESTART IDENTITY CASCADE;

-- -----------------------------------------------------------------------------
-- Tabla #1: public."USUARIO"
-- -----------------------------------------------------------------------------
INSERT INTO public."USUARIO" (id, username, email, "passwordHash", rol, activo, "fechaCreacion") VALUES
('11111111-1111-4111-8111-111111111101', 'admin', 'admin@inbestiga.edu.pe', '$2a$10$gimOZvTPn3E4j58.6kRO4ehomE6dDAmOvlaOKxQfzoYltN56Svt1.', 'ADMIN', true, '2026-11-12 16:26:24.126765+00'),
('11111111-1111-4111-8111-111111111102', 'asesor_sistemas', 'asesor.sistemas@inbestiga.edu.pe', '$2a$10$7oRi.h4k781oDyDWpSghAeFNw9ENcFNMBY.YX8sZVkEAFbMeO3ryS', 'ASESOR', true, '2026-11-12 16:26:24.126765+00');

-- -----------------------------------------------------------------------------
-- Tabla #2: public."UNIVERSIDAD"
-- -----------------------------------------------------------------------------
INSERT INTO public."UNIVERSIDAD" (id, nombre, siglas, ciudad, tipo, activo) VALUES
('33333333-3333-4333-8333-333333333301', 'Universidad Nacional de Trujillo', 'UNT', 'Trujillo', 'PUBLICA', true),
('33333333-3333-4333-8333-333333333302', 'Universidad César Vallejo', 'UCV', 'Trujillo', 'PRIVADA', true),
('33333333-3333-4333-8333-333333333303', 'Universidad Privada Antenor Orrego', 'UPAO', 'Trujillo', 'PRIVADA', true),
('33333333-3333-4333-8333-333333333304', 'Universidad Nacional Mayor de San Marcos', 'UNMSM', 'Lima', 'PUBLICA', true),
('33333333-3333-4333-8333-333333333305', 'Pontificia Universidad Católica del Perú', 'PUCP', 'Lima', 'PRIVADA', true),
('33333333-3333-4333-8333-333333333306', 'Universidad Nacional de Ingeniería', 'UNI', 'Lima', 'PUBLICA', true);

-- -----------------------------------------------------------------------------
-- Tabla #3: public."UBICACION"
-- -----------------------------------------------------------------------------
INSERT INTO public."UBICACION" (id, departamento, provincia, distrito) VALUES
('22222222-2222-4222-8222-222222222201', 'La Libertad', 'Trujillo', 'Trujillo'),
('22222222-2222-4222-8222-222222222202', 'La Libertad', 'Trujillo', 'Víctor Larco Herrera'),
('22222222-2222-4222-8222-222222222203', 'La Libertad', 'Trujillo', 'Huanchaco'),
('22222222-2222-4222-8222-222222222204', 'Lima', 'Lima', 'San Isidro'),
('22222222-2222-4222-8222-222222222205', 'Lima', 'Lima', 'Los Olivos'),
('22222222-2222-4222-8222-222222222206', 'Lambayeque', 'Chiclayo', 'Chiclayo'),
('22222222-2222-4222-8222-222222222207', 'Arequipa', 'Arequipa', 'Arequipa');

-- -----------------------------------------------------------------------------
-- Tabla #4: public."CANAL"
-- -----------------------------------------------------------------------------
INSERT INTO public."CANAL" (id, nombre, codigo, tipo, descripcion) VALUES
('55555555-5555-4555-8555-555555555501', 'Meta Ads (Facebook / Instagram)', 'META_ADS', 'PAGADO', 'Campañas segmentadas por universidad y carrera'),
('55555555-5555-4555-8555-555555555502', 'TikTok Ads', 'TIKTOK', 'PAGADO', 'Tráfico viral a landing page de matriz de consistencia'),
('55555555-5555-4555-8555-555555555503', 'Google Search & Display', 'GOOGLE', 'PAGADO', 'Búsquedas de alta intención: asesoría de tesis trujillo'),
('55555555-5555-4555-8555-555555555504', 'Búsqueda Orgánica / Web', 'ORGANICO', 'ORGANICO', 'Tráfico orgánico a artículos de blog'),
('55555555-5555-4555-8555-555555555505', 'Recomendación / Boca a Boca', 'REFERIDO', 'REFERIDO', 'Graduados que recomiendan a compañeros');

-- -----------------------------------------------------------------------------
-- Tabla #5: public."SERVICIO"
-- -----------------------------------------------------------------------------
INSERT INTO public."SERVICIO" (id, nombre, codigo, descripcion, "tipoInvestigacion", "precioBase", "precioMinimo", "precioMaximo", "plazoSemanasMin", "plazoSemanasMax", "maxCuotas", activo) VALUES
('77777777-7777-4777-8777-777777777701', 'Asesoría Integral de Tesis de Grado', 'TESIS_INTEGRAL', 'Acompañamiento completo desde la formulación del problema hasta la sustentación final. Incluye marco teórico, diseño metodológico, validación de instrumentos y análisis estadístico.', 'TESIS', 2200.00, 1870.00, 2800.00, 6, 16, 4, true),
('77777777-7777-4777-8777-777777777702', 'Elaboración y Aprobación de Plan de Tesis', 'PLAN_TESIS', 'Diseño riguroso del proyecto de tesis: justificación, estado del arte, formulación de hipótesis, operacionalización de variables y metodología según normativa universitaria.', 'PLAN_DE_TESIS', 1200.00, 1020.00, 1500.00, 3, 8, 2, true),
('77777777-7777-4777-8777-777777777703', 'Tratamiento y Análisis Estadístico (SPSS / Python / R)', 'ANALISIS_ESTADISTICO', 'Depuración de datos, pruebas de normalidad, contrastación de hipótesis paramétricas y no paramétricas (ANOVA, Chi-cuadrado, Regresión) con tablas y gráficos en formato APA 7ma.', 'TESIS', 850.00, 722.50, 1100.00, 2, 4, 2, true),
('77777777-7777-4777-8777-777777777704', 'Redacción y Adaptación de Artículo Científico (Scopus / WoS)', 'ARTICULO_CIENTIFICO', 'Transformación de tesis o resultados empíricos a formato de artículo científico de alto impacto. Selección de revista diana e informe antiplagio.', 'ARTICULO_CIENTIFICO', 1600.00, 1360.00, 2200.00, 4, 10, 3, true);

-- -----------------------------------------------------------------------------
-- Tabla #6: public."ASESOR"
-- -----------------------------------------------------------------------------
INSERT INTO public."ASESOR" (id, nombres, apellidos, especialidad, "gradoAcademico", email, whatsapp, "maxClientesSimultaneos", "clientesActivos", activo) VALUES
('88888888-8888-4888-8888-888888888801', 'Dr. Juan Carlos', 'Alva Paredes', 'Ingeniería de Software, Inteligencia Artificial y Metodología Científica', 'DOCTOR', 'juan.alva@inbestiga.edu.pe', '51944112233', 8, 2, true),
('88888888-8888-4888-8888-888888888802', 'Mg. Carmen Rosa', 'Rodríguez Valdivia', 'Bioestadística, SPSS, Epidemiología y Ciencias de la Salud', 'MAGISTER', 'carmen.rodriguez@inbestiga.edu.pe', '51955223344', 10, 2, true),
('88888888-8888-4888-8888-888888888803', 'Dr. Fernando', 'Mendoza Morales', 'Derecho Constitucional, Ciencias Políticas y Dogmática Jurídica', 'DOCTOR', 'fernando.mendoza@inbestiga.edu.pe', '51966334455', 6, 0, true),
('88888888-8888-4888-8888-888888888804', 'Mg. Patricia Elizabeth', 'Gómez Díaz', 'Gestión Financiera, Cadena de Suministro y Optimización Industrial', 'MAGISTER', 'patricia.gomez@inbestiga.edu.pe', '51977445566', 8, 0, true);

-- -----------------------------------------------------------------------------
-- Tabla #7: public."CONFIGURACION_AGENTE"
-- -----------------------------------------------------------------------------
INSERT INTO public."CONFIGURACION_AGENTE" (id, "proveedorIA", modelo, "promptSistema", tono, estilo, "permitirNegociacion", "maxDescuentoNegociablePct", "maxCuotasNegociables", "reglasObjecionesJson", "horarioInicio", "horarioFin", activo) VALUES
('99999999-9999-4999-8999-999999999901', 'GEMINI', 'gemini-1.5-flash', 'Eres el Asesor Especialista Comercial y Metodológico de INBESTIGA.TESIS. Tu misión es guiar al estudiante de manera empática, rigurosa y resolutiva hacia la solución adecuada para su graduación.
REGLAS ESTRICTAS:
1. Saluda por su nombre y menciona los detalles específicos de su formulario (universidad, carrera y dificultad académica).
2. Comprende su dolor académico con empatía y formula preguntas de diagnóstico precisas.
3. No prometas aprobación mágica; promete rigor metodológico, acompañamiento continuo y cumplimiento normativo.
4. Para ofrecer propuestas comerciales y descuentos, invoca SIEMPRE calculate_offer.
5. Al concretar el acuerdo o al consultar medios de pago, genera la cotización mediante create_payment_request y proporciona EXCLUSIVAMENTE el enlace oficial de la pasarela Culqi (https://express.culqi.com/pago/1E696A426C), explicando que Culqi cuenta con una pasarela de pago que acepta diferentes tipos de pago (Yape directo, tarjetas de débito/crédito y PagoEfectivo). NUNCA des cuentas bancarias ni transferencias manuales.', 'Profesional, empático, académico, proactivo y resolutivo', 'Consultor sénior de investigación universitaria', true, 15.00, 3, NULL, '08:00', '22:00', true);

-- -----------------------------------------------------------------------------
-- Tabla #8: public."MODALIDAD_PAGO"
-- -----------------------------------------------------------------------------
INSERT INTO public."MODALIDAD_PAGO" (modalidad_pago_id, nombre, tipo_modalidad, numero_cuotas, es_contado, condicion, porcentajes_json, activo) VALUES
(1, 'Contado', 'Contado', 1, true, '1 pago (100%)', '[100]', true),
(2, '2 cuotas 50/50', '2 cuotas', 2, false, '2 cuotas 50/50', '[50,50]', true),
(3, '3 cuotas 30/40/30', '3 cuotas', 3, false, '3 cuotas 30/40/30', '[30,40,30]', true),
(4, '6 cuotas inicial + hitos', '6 cuotas', 6, false, '6 cuotas (inicial + hitos)', '[20,16,16,16,16,16]', true);

-- -----------------------------------------------------------------------------
-- Tabla #9: public."MEDIO_PAGO"
-- -----------------------------------------------------------------------------
INSERT INTO public."MEDIO_PAGO" (medio_pago_id, tipo_medio, proveedor, nombre, metodo, canal, monto_maximo, comision_pct, verificacion, instrucciones_manual, activo) VALUES
(1, 'Pasarela (webhook)', 'Culqi', 'Yape', 'YAPE', 'CHECKOUT_LINK', 500.00, 2.95, 'PASARELA', NULL, true),
(2, 'Pasarela (webhook)', 'Culqi', 'Plin', 'PLIN', 'CHECKOUT_LINK', 500.00, 2.95, 'PASARELA', NULL, true),
(3, 'Pasarela (webhook)', 'Stripe / Culqi', 'Tarjeta', 'CARD', 'CHECKOUT_LINK', 15000.00, 3.99, 'PASARELA', NULL, true),
(4, 'Manual (voucher)', 'BCP / Interbank', 'Transferencia', 'TRANSFER', 'VOUCHER_WHATSAPP', 50000.00, 0.00, 'MANUAL', 'Cta Corriente Soles BCP: 570-2489103-0-12 | CCI: 00257000248910301235 a nombre de INBESTIGA SAC', true),
(5, 'Manual (voucher)', 'BCP / Interbank', 'Depósito', 'DEPOSITO', 'VOUCHER_WHATSAPP', 50000.00, 0.00, 'MANUAL', 'Agente o Ventanilla BCP Cta: 570-2489103-0-12 a nombre de INBESTIGA SAC', true);

-- -----------------------------------------------------------------------------
-- Tabla #10: public."PLANTILLA_CONTRATO"
-- -----------------------------------------------------------------------------
INSERT INTO public."PLANTILLA_CONTRATO" (plantilla_contrato_id, nombre, version, clausulas_variables, vigente_desde, activa) VALUES
(1, 'Contrato Estándar de Asesoría Metodológica por Entregables', 'v2.0', '{"garantia_similitud": "< 15% Turnitin", "penalidad_mora_pct": 10, "autoria": "100% del estudiante"}', '2026-01-01', true);

-- -----------------------------------------------------------------------------
-- Tabla #11: public."ENTREGABLE"
-- -----------------------------------------------------------------------------
INSERT INTO public."ENTREGABLE" (entregable_id, tipo_entregable, nombre, orden) VALUES
(1, 'Avance Metodológico', 'Planteamiento del Problema y Matriz', 1),
(2, 'Avance Metodológico', 'Marco Teórico y Metodología', 2),
(3, 'Informe Final', 'Resultados, Discusión y Conclusiones', 3),
(4, 'Revisión Calidad', 'Reporte Turnitin y Levantamiento de Observaciones', 4);

-- -----------------------------------------------------------------------------
-- Tabla #12: public."PLANTILLA_MENSAJE"
-- -----------------------------------------------------------------------------
INSERT INTO public."PLANTILLA_MENSAJE" (plantilla_msg_id, codigo, nombre, fase, cuerpo, aprobada_meta, activa) VALUES
(1, 'TPL_PAYERS_4H', 'Recordatorio Amable 4 Horas', 'PAYERS', 'Hola {{1}}, vimos que el enlace de tu {{2}} por S/ {{3}} sigue activo. ¿Tuviste algún inconveniente con el medio de pago o prefieres cambiar a cuotas?', true, true),
(2, 'TPL_PAYERS_24H', 'Recordatorio 24 Horas Activación', 'PAYERS', 'Hola {{1}}, te escribimos para confirmar si pudiste revisar el enlace de pago de tu servicio {{2}} y así asignar a tu especialista dentro de las 24 h.', true, true),
(3, 'TPL_PAYERS_CONTINUACION', 'Continuación Fuera de Ventana 24h', 'PAYERS', 'Hola {{1}}, retomamos tu proceso de activación en INBESTIGA para {{2}}. Responde este mensaje para enviarte el enlace actualizado.', true, true);

-- -----------------------------------------------------------------------------
-- Tabla #13: public."POLITICA_COBRANZA"
-- -----------------------------------------------------------------------------
INSERT INTO public."POLITICA_COBRANZA" (politica_id, tema, titulo, contenido, version, activo) VALUES
(1, 'SEGURIDAD', 'Seguridad y Respaldo Legal del Pago', 'Todos los pagos se procesan mediante pasarela oficial Culqi con comprobante electrónico o en cuentas corporativas de INBESTIGA SAC (RUC activo). Además, tu servicio está respaldado por el Contrato firmado y el pago por hitos verificables.', 'v2.0', true),
(2, 'CUOTAS', 'Política de Fraccionamiento en Cuotas por Hito', 'Puedes elegir pagar al contado, en 3 cuotas (30% inicial, 40% al entregar marco teórico, 30% al informe final) o en 6 cuotas atadas a cada entregable. No se cobra la siguiente cuota hasta que el asesor entregue el hito previo.', 'v2.0', true),
(3, 'TOPE_YAPE', 'Límite Operativo de Billeteras Yape y Plin', 'Por seguridad de las billeteras móviles en pasarela, el monto máximo por operación en Yape o Plin es de S/ 500.00. Si tu cuota supera S/ 500.00, puedes pagarla con tarjeta de débito/crédito, transferencia bancaria o fraccionando tu modalidad a más cuotas.', 'v2.0', true),
(4, 'DEVOLUCION', 'Política Transparente de Devolución y Cancelación', 'Si decides cancelar antes de iniciar sesiones, se reembolsa el 100% menos la comisión de pasarela. Una vez iniciada la asesoría, solo se descuentan los hitos efectivamente entregados según contrato.', 'v2.0', true),
(5, 'PROTECCION_DATOS', 'Protección de Datos Personales (Ley N.º 29733)', 'Tus datos académicos y comprobantes se tratan bajo confidencialidad estricta conforme a la Ley 29733. Nunca solicitamos números completos de tarjeta, códigos CVV ni claves bancarias por chat.', 'v2.0', true),
(6, 'AUTORIAS', 'Preservación de Autoría Académica', 'INBESTIGA brinda acompañamiento metodológico, revisión estadística y levantamiento de observaciones; la autoría intelectual pertenece íntegramente al tesista.', 'v2.0', true);

-- -----------------------------------------------------------------------------
-- Tabla #14: public."CONFIG_PARAMETRO"
-- -----------------------------------------------------------------------------
INSERT INTO public."CONFIG_PARAMETRO" (parametro_id, clave, valor, categoria, descripcion, fecha_actualizacion) VALUES
(1, 'TOPE_YAPE_PLIN_PEN', '500.00', 'PAYERS', 'Monto máximo permitido por transacción en Yape y Plin', '2026-11-12 16:26:24.126765+00'),
(2, 'ALERTA_RECORDATORIO_1_HORAS', '4', 'PAYERS', 'Horas desde el envío del enlace para el primer recordatorio', '2026-11-12 16:26:24.126765+00'),
(3, 'ALERTA_RECORDATORIO_2_HORAS', '24', 'PAYERS', 'Horas desde el envío del enlace para el segundo recordatorio', '2026-11-12 16:26:24.126765+00'),
(4, 'ALERTA_ESCALAMIENTO_HORAS', '48', 'PAYERS', 'Horas sin respuesta para escalar al administrador', '2026-11-12 16:26:24.126765+00'),
(5, 'MAX_RECORDATORIOS_AUTOMATICOS', '2', 'PAYERS', 'Tope máximo de recordatorios automáticos por cuota', '2026-11-12 16:26:24.126765+00'),
(6, 'HORARIO_ATENCION_INICIO', '08:00', 'PAYERS', 'Hora inicio permitida para envío de alertas (Lima)', '2026-11-12 16:26:24.126765+00'),
(7, 'HORARIO_ATENCION_FIN', '20:00', 'PAYERS', 'Hora fin permitida para envío de alertas (Lima)', '2026-11-12 16:26:24.126765+00'),
(8, 'DIAS_VENCIMIENTO_ORDEN', '7', 'PAYERS', 'Días para pasar una orden o cuota sin pago a VENCIDA', '2026-11-12 16:26:24.126765+00');

-- -----------------------------------------------------------------------------
-- Tabla #15: public."CARRERA"
-- -----------------------------------------------------------------------------
INSERT INTO public."CARRERA" (id, "universidadId", nombre, facultad, "areaConocimiento", activo) VALUES
('44444444-4444-4444-8444-444444444401', '33333333-3333-4333-8333-333333333301', 'Ingeniería de Sistemas', 'Facultad de Ingeniería', 'INGENIERIA', true),
('44444444-4444-4444-8444-444444444402', '33333333-3333-4333-8333-333333333301', 'Contabilidad y Finanzas', 'Ciencias Económicas', 'NEGOCIOS', true),
('44444444-4444-4444-8444-444444444403', '33333333-3333-4333-8333-333333333301', 'Enfermería', 'Enfermería', 'CIENCIAS_SALUD', true),
('44444444-4444-4444-8444-444444444404', '33333333-3333-4333-8333-333333333302', 'Ingeniería Industrial', 'Facultad de Ingeniería', 'INGENIERIA', true),
('44444444-4444-4444-8444-444444444405', '33333333-3333-4333-8333-333333333302', 'Psicología', 'Ciencias Humanas', 'SOCIALES', true),
('44444444-4444-4444-8444-444444444406', '33333333-3333-4333-8333-333333333302', 'Ingeniería Civil', 'Facultad de Ingeniería', 'INGENIERIA', true),
('44444444-4444-4444-8444-444444444407', '33333333-3333-4333-8333-333333333303', 'Derecho y Ciencias Políticas', 'Facultad de Derecho', 'DERECHO', true),
('44444444-4444-4444-8444-444444444408', '33333333-3333-4333-8333-333333333303', 'Medicina Humana', 'Facultad de Medicina', 'CIENCIAS_SALUD', true),
('44444444-4444-4444-8444-444444444409', '33333333-3333-4333-8333-333333333303', 'Administración de Empresas', 'Ciencias Económicas', 'NEGOCIOS', true),
('44444444-4444-4444-8444-444444444410', '33333333-3333-4333-8333-333333333304', 'Medicina Humana', 'San Fernando', 'CIENCIAS_SALUD', true),
('44444444-4444-4444-8444-444444444411', '33333333-3333-4333-8333-333333333304', 'Economía', 'Ciencias Económicas', 'NEGOCIOS', true),
('44444444-4444-4444-8444-444444444412', '33333333-3333-4333-8333-333333333305', 'Ingeniería Industrial', 'Ciencias e Ingeniería', 'INGENIERIA', true),
('44444444-4444-4444-8444-444444444413', '33333333-3333-4333-8333-333333333306', 'Ingeniería de Sistemas', 'FIIS', 'INGENIERIA', true);

-- -----------------------------------------------------------------------------
-- Tabla #16: public."CAMPAÑA"
-- -----------------------------------------------------------------------------
INSERT INTO public."CAMPAÑA" (id, "canalId", nombre, presupuesto, "fechaInicio", "fechaFin", activo) VALUES
('66666666-6666-4666-8666-666666666601', '55555555-5555-4555-8555-555555555501', 'Campaña Titulación 2026-I (Meta Ads)', 2500.00, '2026-07-01 00:00:00+00', '2026-12-31 00:00:00+00', true),
('66666666-6666-4666-8666-666666666602', '55555555-5555-4555-8555-555555555502', 'Campaña Tesis Flash (TikTok Ads)', 1800.00, '2026-08-01 00:00:00+00', '2026-11-30 00:00:00+00', true),
('66666666-6666-4666-8666-666666666603', '55555555-5555-4555-8555-555555555503', 'Campaña Intención Tesis Urgente (Google)', 2000.00, '2026-08-15 00:00:00+00', '2026-12-15 00:00:00+00', true),
('66666666-6666-4666-8666-666666666604', '55555555-5555-4555-8555-555555555504', 'Campaña Blog Científico & SEO', 0.00, '2026-01-01 00:00:00+00', '2026-12-31 00:00:00+00', true);

-- -----------------------------------------------------------------------------
-- Tabla #17: public."REGLA_COMERCIAL"
-- -----------------------------------------------------------------------------
INSERT INTO public."REGLA_COMERCIAL" (id, "servicioId", "tipoInvestigacion", "descuentoMaximoPct", "descuentoPagoUnicoPct", "cuotaMinima", "plazoMinimoDias", "plazoMaximoDias", "condicionesEspeciales", activo) VALUES
('78888888-8888-4888-8888-888888888801', '77777777-7777-4777-8777-777777777701', 'TESIS', 15.00, 10.00, 300.00, 30, 120, 'Aplica para tesistas de pregrado y posgrado con tema registrado.', true),
('78888888-8888-4888-8888-888888888802', '77777777-7777-4777-8777-777777777702', 'PLAN_DE_TESIS', 15.00, 10.00, 250.00, 20, 60, 'Garantía de levantamiento de observaciones hasta aprobación.', true),
('78888888-8888-4888-8888-888888888803', '77777777-7777-4777-8777-777777777703', 'TESIS', 15.00, 10.00, 200.00, 10, 30, 'Incluye script de procesamiento y asesoría grabada de interpretación.', true),
('78888888-8888-4888-8888-888888888804', '77777777-7777-4777-8777-777777777704', 'ARTICULO_CIENTIFICO', 15.00, 10.00, 350.00, 25, 75, NULL, true);

-- -----------------------------------------------------------------------------
-- Tabla #18: public."NOTIFICACION"
-- -----------------------------------------------------------------------------
INSERT INTO public."NOTIFICACION" (id, "usuarioId", tipo, titulo, mensaje, leido, "fechaCreacion", metadata) VALUES
('11edccf3-4973-4ca8-9057-4765b7f03ebb', '11111111-1111-4111-8111-111111111101', 'LEAD_CALIFICADO', '🔥 Lead Calificado Prioritario: Ana Lucía Pérez (UNT)', 'Score: 94/100. Carrera: Ingeniería de Sistemas. Dolor: Falta de tiempo y asesor no responde. Lista para [INICIAR NEGOCIACIÓN].', false, '2026-09-15 09:36:00+00', '{"buyerId":"b0000000-0000-4000-8000-000000000001","leadId":"1e000000-0000-4000-8000-000000000001","score":94}'),
('d3ad18bf-aec1-45d1-be3e-059edc340f98', '11111111-1111-4111-8111-111111111101', 'PAGO_CONFIRMADO', 'Pago Confirmado: S/ 1980 de César Augusto Villarreal Benítez', 'Método: CARD (STRIPE). Cotización: COT-2026-0003. Estado de Funnel: PAYER.', false, '2026-09-09 10:02:00+00', NULL),
('d99908d3-fb59-46e6-90e6-55c4c46653e0', '11111111-1111-4111-8111-111111111101', 'PAGO_CONFIRMADO', 'Pago Confirmado: S/ 1080 de Katherine Gisell Palacios Montoya', 'Método: YAPE (CULQI). Cotización: COT-2026-0004. Estado de Funnel: PAYER.', false, '2026-09-09 10:02:00+00', NULL),
('2e0f8835-5216-4481-bbf8-309f45074719', '11111111-1111-4111-8111-111111111101', 'PAGO_CONFIRMADO', 'Pago Confirmado: S/ 1000 de Rodrigo Javier Lecca Santillán', 'Método: TRANSFER (STRIPE). Cotización: COT-2026-0005. Estado de Funnel: PAYER.', false, '2026-09-09 10:02:00+00', NULL),
('71acc32b-00ec-43be-9e5a-ab902e18195c', '11111111-1111-4111-8111-111111111101', 'PAGO_CONFIRMADO', 'Pago Confirmado: S/ 765 de Miriam Elizabeth Chirinos Saavedra', 'Método: CARD (STRIPE). Cotización: COT-2026-0006. Estado de Funnel: PAYER.', false, '2026-09-09 10:02:00+00', NULL),
('624652c8-892c-49a3-a01f-49a2c5150bfc', '11111111-1111-4111-8111-111111111101', 'SESION_PROGRAMADA', 'Sesión #2 Programada para María Elena Castillo Vega', 'Fecha: 22 de Septiembre a las 16:00. Asesor asignado presente.', false, '2026-09-07 12:00:00+00', NULL),
('f7777197-53d1-4a7f-86e8-657455ed7a38', '11111111-1111-4111-8111-111111111101', 'SESION_PROGRAMADA', 'Sesión #2 Programada para Álvaro Sebastián Gutiérrez Cerna', 'Fecha: 22 de Septiembre a las 16:00. Asesor asignado presente.', false, '2026-09-07 12:00:00+00', NULL),
('7e32a586-36bd-4b56-a5ce-8b4252629831', '11111111-1111-4111-8111-111111111101', 'SESION_PROGRAMADA', 'Sesión #2 Programada para Gabriela Alejandra Paz Soldán Núñez', 'Fecha: 22 de Septiembre a las 16:00. Asesor asignado presente.', false, '2026-09-07 12:00:00+00', NULL),
('026a5a6d-6894-462e-a3b8-4d86694c223c', '11111111-1111-4111-8111-111111111101', 'SESION_PROGRAMADA', 'Sesión #2 Programada para Marco Antonio Bocanegra Tirado', 'Fecha: 22 de Septiembre a las 16:00. Asesor asignado presente.', false, '2026-09-07 12:00:00+00', NULL);

-- -----------------------------------------------------------------------------
-- Tabla #19: public."CONTENIDO"
-- -----------------------------------------------------------------------------
INSERT INTO public."CONTENIDO" (id, "campanaId", titulo, tipo, url, "leadMagnet", activo) VALUES
('67777777-7777-4777-8777-777777777701', '66666666-6666-4666-8666-666666666601', 'Guía Definitiva: Cómo plantear tu matriz de consistencia sin errores', 'GUIA_PDF', 'https://inbestiga.tesis/recursos/guia-matriz-consistencia.pdf', true, true),
('67777777-7777-4777-8777-777777777702', '66666666-6666-4666-8666-666666666602', 'Plantilla Excel: Operacionalización de variables y baremos psicométricos', 'DOCUMENT', 'https://inbestiga.tesis/recursos/plantilla-operacionalizacion.xlsx', true, true),
('67777777-7777-4777-8777-777777777703', '66666666-6666-4666-8666-666666666603', 'Masterclass en Video: Las 5 preguntas críticas de tu jurado de tesis', 'VIDEO', 'https://inbestiga.tesis/recursos/masterclass-sustentacion', true, true),
('67777777-7777-4777-8777-777777777704', '66666666-6666-4666-8666-666666666604', 'Ebook: Normas APA 7ma edición para citas y referencias complejas', 'GUIA_PDF', 'https://inbestiga.tesis/recursos/ebook-apa-7ma.pdf', true, true);

-- -----------------------------------------------------------------------------
-- Tabla #20: public."BUYER"
-- -----------------------------------------------------------------------------
INSERT INTO public."BUYER" (id, nombres, apellidos, whatsapp, email, "universidadId", "carreraId", "ubicacionId", "canalId", "campanaId", ciclo, "tipoInvestigacion", "situacionLaboral", "presupuestoAprox", "dolorPrincipal", "softwareRequerido", "plazoDefinidoDias", "leadScore", "estadoFunnel", "consentimientoWhatsapp", "fechaRegistro", "fechaConversionLead") VALUES
('b0000000-0000-4000-8000-000000000001', 'Ana Lucía', 'Pérez Mendoza', '51949123456', 'ana.perez.unt@gmail.com', '33333333-3333-4333-8333-333333333301', '44444444-4444-4444-8444-444444444401', '22222222-2222-4222-8222-222222222201', '55555555-5555-4555-8555-555555555501', '66666666-6666-4666-8666-666666666601', '10mo ciclo', 'TESIS', 'TRABAJA_TIEMPO_COMPLETO', 2200.00, 'Falta de tiempo laboral y el asesor universitario no responde ni valida el modelo predictivo', 'PYTHON', 60, 94, 'LEAD', true, '2026-09-15 09:30:00+00', '2026-09-15 09:35:00+00'),
('b0000000-0000-4000-8000-000000000002', 'Carlos Alberto', 'Ruiz Salinas', '51948765432', 'cruiz.ind@ucv.edu.pe', '33333333-3333-4333-8333-333333333302', '44444444-4444-4444-8444-444444444404', '22222222-2222-4222-8222-222222222202', '55555555-5555-4555-8555-555555555501', '66666666-6666-4666-8666-666666666601', 'EGRESADO', 'TESIS', 'TRABAJA_TIEMPO_COMPLETO', 1800.00, 'Dificultad con la propuesta de mejora en planta y análisis estadístico en SPSS', 'SPSS', 45, 88, 'LEAD', true, '2026-09-14 11:00:00+00', '2026-09-14 11:05:00+00'),
('b0000000-0000-4000-8000-000000000003', 'Valeria Sofía', 'Morales Castro', '51947112233', 'vmorales@upao.edu.pe', '33333333-3333-4333-8333-333333333303', '44444444-4444-4444-8444-444444444407', '22222222-2222-4222-8222-222222222201', '55555555-5555-4555-8555-555555555503', '66666666-6666-4666-8666-666666666603', 'BACHILLER', 'TESIS', 'MEDIO_TIEMPO', 2000.00, 'Marco teórico dogmático y estructuración de la argumentación jurídica para la tesis', 'ATLAS_TI', 40, 82, 'LEAD', true, '2026-09-13 16:20:00+00', '2026-09-13 16:25:00+00'),
('b0000000-0000-4000-8000-000000000004', 'Diego Armando', 'García Polo', '51945112244', 'dgarcia@uni.edu.pe', '33333333-3333-4333-8333-333333333306', '44444444-4444-4444-8444-444444444413', '22222222-2222-4222-8222-222222222205', '55555555-5555-4555-8555-555555555502', '66666666-6666-4666-8666-666666666602', '10mo ciclo', 'TESIS', 'TRABAJA_TIEMPO_COMPLETO', 2400.00, 'Metodología ágil y redacción formal bajo normas IEEE', 'PYTHON', 50, 91, 'LEAD', true, '2026-09-12 10:00:00+00', '2026-09-12 10:05:00+00'),
('b0000000-0000-4000-8000-000000000005', 'Fiorella Belén', 'Herrera Cruz', '51943223355', 'fherrera@pucp.edu.pe', '33333333-3333-4333-8333-333333333305', '44444444-4444-4444-8444-444444444412', '22222222-2222-4222-8222-222222222204', '55555555-5555-4555-8555-555555555503', '66666666-6666-4666-8666-666666666603', 'EGRESADO', 'TESIS', 'TRABAJA_TIEMPO_COMPLETO', 2500.00, 'Validación estadística con Minitab y formulación de objetivos específicos', 'MINITAB', 60, 89, 'LEAD', true, '2026-09-12 10:00:00+00', '2026-09-12 10:05:00+00'),
('b0000000-0000-4000-8000-000000000006', 'Jorge Luis', 'Chávez Rivas', '51942334466', 'jchavez@unmsm.edu.pe', '33333333-3333-4333-8333-333333333304', '44444444-4444-4444-8444-444444444411', '22222222-2222-4222-8222-222222222204', '55555555-5555-4555-8555-555555555501', '66666666-6666-4666-8666-666666666601', 'BACHILLER', 'TESIS', 'MEDIO_TIEMPO', 1900.00, 'Modelos econométricos en Stata y series de tiempo', 'STATA', 70, 84, 'LEAD', true, '2026-09-12 10:00:00+00', '2026-09-12 10:05:00+00'),
('b0000000-0000-4000-8000-000000000007', 'Claudia Vanessa', 'Salazar Benites', '51941445577', 'csalazar@ucv.edu.pe', '33333333-3333-4333-8333-333333333302', '44444444-4444-4444-8444-444444444405', '22222222-2222-4222-8222-222222222201', '55555555-5555-4555-8555-555555555502', '66666666-6666-4666-8666-666666666602', '10mo ciclo', 'TESIS', 'SOLO_ESTUDIA', 1500.00, 'Análisis psicométrico, confiabilidad alfa de Cronbach y omega de McDonald', 'SPSS', 60, 78, 'LEAD', true, '2026-09-12 10:00:00+00', '2026-09-12 10:05:00+00'),
('b0000000-0000-4000-8000-000000000008', 'Guillermo Manuel', 'Vargas Silva', '51940556688', 'gvargas@unt.edu.pe', '33333333-3333-4333-8333-333333333301', '44444444-4444-4444-8444-444444444402', '22222222-2222-4222-8222-222222222201', '55555555-5555-4555-8555-555555555504', '66666666-6666-4666-8666-666666666604', '9no ciclo', 'PLAN_DE_TESIS', 'MEDIO_TIEMPO', 1200.00, 'Elaboración y delimitación del plan de tesis sobre auditoría tributaria', 'EXCEL', 45, 75, 'LEAD', true, '2026-09-12 10:00:00+00', '2026-09-12 10:05:00+00'),
('b0000000-0000-4000-8000-000000000009', 'Luciana Milagros', 'Paz Soldán', '51939667799', 'lpaz@upao.edu.pe', '33333333-3333-4333-8333-333333333303', '44444444-4444-4444-8444-444444444408', '22222222-2222-4222-8222-222222222201', '55555555-5555-4555-8555-555555555501', '66666666-6666-4666-8666-666666666601', 'INTERNO', 'TESIS', 'TRABAJA_TIEMPO_COMPLETO', 2300.00, 'Tiempo cero por guardias médicas y asesor exige bioestadística inferencial', 'SPSS', 40, 93, 'LEAD', true, '2026-09-12 10:00:00+00', '2026-09-12 10:05:00+00'),
('b0000000-0000-4000-8000-000000000010', 'Renato Alonso', 'Ríos Paredes', '51938778800', 'rrios@ucv.edu.pe', '33333333-3333-4333-8333-333333333302', '44444444-4444-4444-8444-444444444406', '22222222-2222-4222-8222-222222222206', '55555555-5555-4555-8555-555555555505', '66666666-6666-4666-8666-666666666601', 'EGRESADO', 'TESIS', 'TRABAJA_TIEMPO_COMPLETO', 2100.00, 'Cálculo estructural en SAP2000 y redacción de la discusión', 'SAP2000', 50, 86, 'LEAD', true, '2026-09-12 10:00:00+00', '2026-09-12 10:05:00+00'),
('b0000000-0000-4000-8000-000000000011', 'Estefany Rocío', 'Vega Quispe', '51937889911', 'evega@unt.edu.pe', '33333333-3333-4333-8333-333333333301', '44444444-4444-4444-8444-444444444403', '22222222-2222-4222-8222-222222222203', '55555555-5555-4555-8555-555555555501', '66666666-6666-4666-8666-666666666601', '10mo ciclo', 'PLAN_DE_TESIS', 'MEDIO_TIEMPO', 1100.00, 'Aprobación del comité de ética y justificación teórica', NULL, 60, 74, 'LEAD', true, '2026-09-12 10:00:00+00', '2026-09-12 10:05:00+00'),
('b0000000-0000-4000-8000-000000000012', 'Alonso Gabriel', 'Bravo Carranza', '51936990022', 'abravo@pucp.edu.pe', '33333333-3333-4333-8333-333333333305', '44444444-4444-4444-8444-444444444407', '22222222-2222-4222-8222-222222222204', '55555555-5555-4555-8555-555555555504', '66666666-6666-4666-8666-666666666604', 'MAESTRIA', 'ARTICULO_CIENTIFICO', 'TRABAJA_TIEMPO_COMPLETO', 1700.00, 'Adaptación a guía de autores de revista Scopus Q2', NULL, 45, 87, 'LEAD', true, '2026-09-12 10:00:00+00', '2026-09-12 10:05:00+00'),
('b0000000-0000-4000-8000-000000000013', 'Pedro Miguel', 'Soto Vargas', '51921001122', 'psoto@upao.edu.pe', '33333333-3333-4333-8333-333333333303', '44444444-4444-4444-8444-444444444407', '22222222-2222-4222-8222-222222222201', '55555555-5555-4555-8555-555555555504', '66666666-6666-4666-8666-666666666604', '8vo ciclo', 'PLAN_DE_TESIS', 'SOLO_ESTUDIA', 600.00, 'Curiosidad inicial sobre cómo elegir un tema para el próximo año', NULL, NULL, 58, 'BUYER', true, '2026-09-10 14:00:00+00', NULL),
('b0000000-0000-4000-8000-000000000014', 'Karla Jimena', 'Mendoza León', '51922112233', 'kmendoza@ucv.edu.pe', '33333333-3333-4333-8333-333333333302', '44444444-4444-4444-8444-444444444404', '22222222-2222-4222-8222-222222222202', '55555555-5555-4555-8555-555555555502', '66666666-6666-4666-8666-666666666602', '7mo ciclo', 'TESINA', 'SOLO_ESTUDIA', 500.00, 'Duda con el formato de informe de prácticas', NULL, NULL, 42, 'BUYER', true, '2026-09-10 14:00:00+00', NULL),
('b0000000-0000-4000-8000-000000000015', 'Christian Paul', 'Navarro Rojas', '51923223344', 'cnavarro@unt.edu.pe', '33333333-3333-4333-8333-333333333301', '44444444-4444-4444-8444-444444444401', '22222222-2222-4222-8222-222222222201', '55555555-5555-4555-8555-555555555501', '66666666-6666-4666-8666-666666666601', '8vo ciclo', 'PLAN_DE_TESIS', 'SOLO_ESTUDIA', 800.00, 'Aún no tiene asesor asignado en la universidad', NULL, NULL, 62, 'BUYER', true, '2026-09-10 14:00:00+00', NULL),
('b0000000-0000-4000-8000-000000000016', 'Brenda Lucía', 'Flores Terrones', '51924334455', 'bflores@pucp.edu.pe', '33333333-3333-4333-8333-333333333305', '44444444-4444-4444-8444-444444444412', '22222222-2222-4222-8222-222222222204', '55555555-5555-4555-8555-555555555503', '66666666-6666-4666-8666-666666666603', '8vo ciclo', 'TESINA', 'SOLO_ESTUDIA', 750.00, 'Consulta preliminar sobre costos', NULL, NULL, 50, 'BUYER', true, '2026-09-10 14:00:00+00', NULL),
('b0000000-0000-4000-8000-000000000017', 'Gonzalo David', 'Iparraguirre Cruz', '51925445566', 'giparraguirre@unmsm.edu.pe', '33333333-3333-4333-8333-333333333304', '44444444-4444-4444-8444-444444444411', '22222222-2222-4222-8222-222222222205', '55555555-5555-4555-8555-555555555504', '66666666-6666-4666-8666-666666666604', '7mo ciclo', 'PLAN_DE_TESIS', 'SOLO_ESTUDIA', 500.00, 'Descargó plantilla de consistencia', NULL, NULL, 45, 'BUYER', true, '2026-09-10 14:00:00+00', NULL),
('b0000000-0000-4000-8000-000000000018', 'Diana Carolina', 'Zapata Morales', '51926556677', 'dzapata@upao.edu.pe', '33333333-3333-4333-8333-333333333303', '44444444-4444-4444-8444-444444444409', '22222222-2222-4222-8222-222222222201', '55555555-5555-4555-8555-555555555501', '66666666-6666-4666-8666-666666666601', '8vo ciclo', 'TESINA', 'MEDIO_TIEMPO', 700.00, 'Pregunta general sobre asesorías grupales', NULL, NULL, 55, 'BUYER', true, '2026-09-10 14:00:00+00', NULL),
('b0000000-0000-4000-8000-000000000019', 'Martín Eduardo', 'Cabrera Ortiz', '51927667788', 'mcabrera@unt.edu.pe', '33333333-3333-4333-8333-333333333301', '44444444-4444-4444-8444-444444444402', '22222222-2222-4222-8222-222222222201', '55555555-5555-4555-8555-555555555502', '66666666-6666-4666-8666-666666666602', '7mo ciclo', 'PLAN_DE_TESIS', 'SOLO_ESTUDIA', 400.00, 'Descargó ebook de normas APA', NULL, NULL, 38, 'BUYER', true, '2026-09-10 14:00:00+00', NULL),
('b0000000-0000-4000-8000-000000000020', 'Vanessa Stephanie', 'Guerrero Luján', '51928778899', 'vguerrero@ucv.edu.pe', '33333333-3333-4333-8333-333333333302', '44444444-4444-4444-8444-444444444405', '22222222-2222-4222-8222-222222222207', '55555555-5555-4555-8555-555555555504', '66666666-6666-4666-8666-666666666604', '8vo ciclo', 'PLAN_DE_TESIS', 'MEDIO_TIEMPO', 850.00, 'Dificultad inicial para seleccionar escalas', NULL, NULL, 64, 'BUYER', true, '2026-09-10 14:00:00+00', NULL),
('b0000000-0000-4000-8000-000000000021', 'José Fernando', 'Peralta Tapia', '51929889900', 'jperalta@uni.edu.pe', '33333333-3333-4333-8333-333333333306', '44444444-4444-4444-8444-444444444413', '22222222-2222-4222-8222-222222222205', '55555555-5555-4555-8555-555555555503', '66666666-6666-4666-8666-666666666603', '8vo ciclo', 'TESINA', 'SOLO_ESTUDIA', 600.00, 'Orientación para proyecto de curso', NULL, NULL, 48, 'BUYER', true, '2026-09-10 14:00:00+00', NULL),
('b0000000-0000-4000-8000-000000000022', 'Silvia Cristina', 'Reyes Sandoval', '51930990011', 'sreyes@unt.edu.pe', '33333333-3333-4333-8333-333333333301', '44444444-4444-4444-8444-444444444403', '22222222-2222-4222-8222-222222222203', '55555555-5555-4555-8555-555555555501', '66666666-6666-4666-8666-666666666601', '8vo ciclo', 'PLAN_DE_TESIS', 'SOLO_ESTUDIA', 700.00, 'Interés en cursos extracurriculares', NULL, NULL, 52, 'BUYER', true, '2026-09-10 14:00:00+00', NULL),
('b0000000-0000-4000-8000-000000000023', 'César Augusto', 'Villarreal Benítez', '51911112233', 'cvillarreal@unt.edu.pe', '33333333-3333-4333-8333-333333333301', '44444444-4444-4444-8444-444444444401', '22222222-2222-4222-8222-222222222201', '55555555-5555-4555-8555-555555555501', '66666666-6666-4666-8666-666666666601', '10mo ciclo', 'TESIS', 'TRABAJA_TIEMPO_COMPLETO', 2200.00, NULL, NULL, NULL, 91, 'PAYER', true, '2026-09-08 09:00:00+00', '2026-09-08 09:05:00+00'),
('b0000000-0000-4000-8000-000000000024', 'Katherine Gisell', 'Palacios Montoya', '51912223344', 'kpalacios@ucv.edu.pe', '33333333-3333-4333-8333-333333333302', '44444444-4444-4444-8444-444444444404', '22222222-2222-4222-8222-222222222202', '55555555-5555-4555-8555-555555555502', '66666666-6666-4666-8666-666666666602', 'EGRESADO', 'PLAN_DE_TESIS', 'MEDIO_TIEMPO', 1200.00, NULL, NULL, NULL, 83, 'PAYER', true, '2026-09-08 09:00:00+00', '2026-09-08 09:05:00+00'),
('b0000000-0000-4000-8000-000000000025', 'Rodrigo Javier', 'Lecca Santillán', '51913334455', 'rlecca@upao.edu.pe', '33333333-3333-4333-8333-333333333303', '44444444-4444-4444-8444-444444444407', '22222222-2222-4222-8222-222222222201', '55555555-5555-4555-8555-555555555503', '66666666-6666-4666-8666-666666666603', 'BACHILLER', 'TESIS', 'TRABAJA_TIEMPO_COMPLETO', 2200.00, NULL, NULL, NULL, 87, 'PAYER', true, '2026-09-08 09:00:00+00', '2026-09-08 09:05:00+00'),
('b0000000-0000-4000-8000-000000000026', 'Miriam Elizabeth', 'Chirinos Saavedra', '51914445566', 'mchirinos@unmsm.edu.pe', '33333333-3333-4333-8333-333333333304', '44444444-4444-4444-8444-444444444411', '22222222-2222-4222-8222-222222222204', '55555555-5555-4555-8555-555555555504', '66666666-6666-4666-8666-666666666604', 'EGRESADO', 'TESIS', 'TRABAJA_TIEMPO_COMPLETO', 850.00, NULL, NULL, NULL, 85, 'PAYER', true, '2026-09-08 09:00:00+00', '2026-09-08 09:05:00+00'),
('b0000000-0000-4000-8000-000000000027', 'María Elena', 'Castillo Vega', '51901112233', 'mcastillo@unmsm.edu.pe', '33333333-3333-4333-8333-333333333304', '44444444-4444-4444-8444-444444444410', '22222222-2222-4222-8222-222222222204', '55555555-5555-4555-8555-555555555501', '66666666-6666-4666-8666-666666666601', 'BACHILLER', 'TESIS', 'MEDIO_TIEMPO', 2200.00, NULL, NULL, NULL, 95, 'CUSTOMER', true, '2026-09-01 08:00:00+00', '2026-09-01 08:05:00+00'),
('b0000000-0000-4000-8000-000000000028', 'Álvaro Sebastián', 'Gutiérrez Cerna', '51902223344', 'agutierrez@unt.edu.pe', '33333333-3333-4333-8333-333333333301', '44444444-4444-4444-8444-444444444401', '22222222-2222-4222-8222-222222222201', '55555555-5555-4555-8555-555555555501', '66666666-6666-4666-8666-666666666601', '10mo ciclo', 'TESIS', 'TRABAJA_TIEMPO_COMPLETO', 2200.00, NULL, NULL, NULL, 92, 'CUSTOMER', true, '2026-09-01 08:00:00+00', '2026-09-01 08:05:00+00'),
('b0000000-0000-4000-8000-000000000029', 'Gabriela Alejandra', 'Paz Soldán Núñez', '51903334455', 'gpaz@upao.edu.pe', '33333333-3333-4333-8333-333333333303', '44444444-4444-4444-8444-444444444408', '22222222-2222-4222-8222-222222222201', '55555555-5555-4555-8555-555555555503', '66666666-6666-4666-8666-666666666603', 'INTERNO', 'TESIS', 'TRABAJA_TIEMPO_COMPLETO', 2200.00, NULL, NULL, NULL, 94, 'CUSTOMER', true, '2026-09-01 08:00:00+00', '2026-09-01 08:05:00+00'),
('b0000000-0000-4000-8000-000000000030', 'Marco Antonio', 'Bocanegra Tirado', '51904445566', 'mbocanegra@uni.edu.pe', '33333333-3333-4333-8333-333333333306', '44444444-4444-4444-8444-444444444413', '22222222-2222-4222-8222-222222222205', '55555555-5555-4555-8555-555555555502', '66666666-6666-4666-8666-666666666602', 'EGRESADO', 'TESIS', 'TRABAJA_TIEMPO_COMPLETO', 2200.00, NULL, NULL, NULL, 90, 'CUSTOMER', true, '2026-09-01 08:00:00+00', '2026-09-01 08:05:00+00'),
('b0000000-0000-4000-8000-000000000044', 'Harry', 'Sánchez', '51919632928', 'estudiante44@unitru.edu.pe', '33333333-3333-4333-8333-333333333301', '44444444-4444-4444-8444-444444444401', '22222222-2222-4222-8222-222222222201', '55555555-5555-4555-8555-555555555501', '66666666-6666-4666-8666-666666666601', '10mo ciclo', 'TESIS', 'TRABAJA_TIEMPO_COMPLETO', 2000.00, NULL, NULL, NULL, 82, 'LEAD', true, '2026-11-12 16:37:22.244652+00', NULL),
('b0000000-0000-4000-8000-000000000065', 'Samira', 'Miguel', '51956092165', 'estudiante65@unitru.edu.pe', '33333333-3333-4333-8333-333333333301', '44444444-4444-4444-8444-444444444401', '22222222-2222-4222-8222-222222222201', '55555555-5555-4555-8555-555555555501', '66666666-6666-4666-8666-666666666601', 'EGRESADO', 'TESIS', 'TRABAJA_TIEMPO_COMPLETO', 2200.00, NULL, NULL, NULL, 82, 'LEAD', true, '2026-11-12 16:37:22.244652+00', NULL),
('b0000000-0000-4000-8000-000000000081', 'Ricardo', 'Velasquez', '51961103226', 'estudiante81@unitru.edu.pe', '33333333-3333-4333-8333-333333333301', '44444444-4444-4444-8444-444444444401', '22222222-2222-4222-8222-222222222201', '55555555-5555-4555-8555-555555555501', '66666666-6666-4666-8666-666666666601', 'BACHILLER', 'TESIS', 'TRABAJA_TIEMPO_COMPLETO', 2500.00, NULL, NULL, NULL, 82, 'LEAD', true, '2026-11-12 16:37:22.244652+00', NULL);

-- -----------------------------------------------------------------------------
-- Tabla #21: public."FORMULARIO"
-- -----------------------------------------------------------------------------
INSERT INTO public."FORMULARIO" (id, "buyerId", "datosJson", ip, "userAgent", "fechaEnvio") VALUES
('8b4cff7c-191f-4b35-9101-2c73a8852539', 'b0000000-0000-4000-8000-000000000001', '{"nombres" : "Ana Lucía", "apellidos" : "Pérez Mendoza", "whatsapp" : "51949123456", "email" : "ana.perez.unt@gmail.com", "leadScore" : 94}', '190.237.12.84', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-11-12 16:31:22.779347+00'),
('544e2ab7-e6af-4c7f-ba49-226579f607b0', 'b0000000-0000-4000-8000-000000000002', '{"nombres" : "Carlos Alberto", "apellidos" : "Ruiz Salinas", "whatsapp" : "51948765432", "email" : "cruiz.ind@ucv.edu.pe", "leadScore" : 88}', '190.237.12.84', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-11-12 16:31:22.779347+00'),
('3d97d923-5889-4dcf-a406-0dba6bcdc6f1', 'b0000000-0000-4000-8000-000000000003', '{"nombres" : "Valeria Sofía", "apellidos" : "Morales Castro", "whatsapp" : "51947112233", "email" : "vmorales@upao.edu.pe", "leadScore" : 82}', '190.237.12.84', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-11-12 16:31:22.779347+00'),
('943a5cc3-89e0-4a96-a327-fddaa336bbaa', 'b0000000-0000-4000-8000-000000000004', '{"nombres" : "Diego Armando", "apellidos" : "García Polo", "whatsapp" : "51945112244", "email" : "dgarcia@uni.edu.pe", "leadScore" : 91}', '190.237.12.84', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-11-12 16:31:22.779347+00'),
('7a4047ca-f79c-44c5-bd35-268eb6326e7b', 'b0000000-0000-4000-8000-000000000005', '{"nombres" : "Fiorella Belén", "apellidos" : "Herrera Cruz", "whatsapp" : "51943223355", "email" : "fherrera@pucp.edu.pe", "leadScore" : 89}', '190.237.12.84', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-11-12 16:31:22.779347+00'),
('bb6d596a-de82-4a30-8cda-5827644c6d9c', 'b0000000-0000-4000-8000-000000000006', '{"nombres" : "Jorge Luis", "apellidos" : "Chávez Rivas", "whatsapp" : "51942334466", "email" : "jchavez@unmsm.edu.pe", "leadScore" : 84}', '190.237.12.84', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-11-12 16:31:22.779347+00'),
('fe32811c-64dc-4e4e-b426-c3fdea54eaea', 'b0000000-0000-4000-8000-000000000007', '{"nombres" : "Claudia Vanessa", "apellidos" : "Salazar Benites", "whatsapp" : "51941445577", "email" : "csalazar@ucv.edu.pe", "leadScore" : 78}', '190.237.12.84', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-11-12 16:31:22.779347+00'),
('1a281718-281a-4396-bf32-c82168d9b3a9', 'b0000000-0000-4000-8000-000000000008', '{"nombres" : "Guillermo Manuel", "apellidos" : "Vargas Silva", "whatsapp" : "51940556688", "email" : "gvargas@unt.edu.pe", "leadScore" : 75}', '190.237.12.84', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-11-12 16:31:22.779347+00'),
('b1d07974-ea28-4e33-bd63-c8702fd82aab', 'b0000000-0000-4000-8000-000000000009', '{"nombres" : "Luciana Milagros", "apellidos" : "Paz Soldán", "whatsapp" : "51939667799", "email" : "lpaz@upao.edu.pe", "leadScore" : 93}', '190.237.12.84', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-11-12 16:31:22.779347+00'),
('d3f06d32-62dd-44ef-9bd5-34e5f46a0f51', 'b0000000-0000-4000-8000-000000000010', '{"nombres" : "Renato Alonso", "apellidos" : "Ríos Paredes", "whatsapp" : "51938778800", "email" : "rrios@ucv.edu.pe", "leadScore" : 86}', '190.237.12.84', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-11-12 16:31:22.779347+00'),
('0627f6f7-8d80-4af4-8129-8f33b92a5740', 'b0000000-0000-4000-8000-000000000011', '{"nombres" : "Estefany Rocío", "apellidos" : "Vega Quispe", "whatsapp" : "51937889911", "email" : "evega@unt.edu.pe", "leadScore" : 74}', '190.237.12.84', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-11-12 16:31:22.779347+00'),
('ca3fa15a-d345-482a-8914-d2ac9e9ac98a', 'b0000000-0000-4000-8000-000000000012', '{"nombres" : "Alonso Gabriel", "apellidos" : "Bravo Carranza", "whatsapp" : "51936990022", "email" : "abravo@pucp.edu.pe", "leadScore" : 87}', '190.237.12.84', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-11-12 16:31:22.779347+00'),
('523b1864-d942-41e1-866b-932dcbf04126', 'b0000000-0000-4000-8000-000000000013', '{"nombres" : "Pedro Miguel", "apellidos" : "Soto Vargas", "whatsapp" : "51921001122", "email" : "psoto@upao.edu.pe", "leadScore" : 58}', '190.237.12.84', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-11-12 16:31:22.779347+00'),
('a4a165ff-7179-4787-ab2e-c4953d6473d5', 'b0000000-0000-4000-8000-000000000014', '{"nombres" : "Karla Jimena", "apellidos" : "Mendoza León", "whatsapp" : "51922112233", "email" : "kmendoza@ucv.edu.pe", "leadScore" : 42}', '190.237.12.84', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-11-12 16:31:22.779347+00'),
('e24258a5-f618-45f2-97f3-2f3ee38b4b8a', 'b0000000-0000-4000-8000-000000000015', '{"nombres" : "Christian Paul", "apellidos" : "Navarro Rojas", "whatsapp" : "51923223344", "email" : "cnavarro@unt.edu.pe", "leadScore" : 62}', '190.237.12.84', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-11-12 16:31:22.779347+00'),
('ff385649-ff6c-4367-802c-fb2221d9f96f', 'b0000000-0000-4000-8000-000000000016', '{"nombres" : "Brenda Lucía", "apellidos" : "Flores Terrones", "whatsapp" : "51924334455", "email" : "bflores@pucp.edu.pe", "leadScore" : 50}', '190.237.12.84', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-11-12 16:31:22.779347+00'),
('8ff2f3ad-d26c-4b8b-8ac5-7a42e592ef14', 'b0000000-0000-4000-8000-000000000017', '{"nombres" : "Gonzalo David", "apellidos" : "Iparraguirre Cruz", "whatsapp" : "51925445566", "email" : "giparraguirre@unmsm.edu.pe", "leadScore" : 45}', '190.237.12.84', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-11-12 16:31:22.779347+00'),
('b7886a58-c073-46f6-9e26-7453e95e5e59', 'b0000000-0000-4000-8000-000000000018', '{"nombres" : "Diana Carolina", "apellidos" : "Zapata Morales", "whatsapp" : "51926556677", "email" : "dzapata@upao.edu.pe", "leadScore" : 55}', '190.237.12.84', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-11-12 16:31:22.779347+00'),
('79917f80-e79d-4c79-b7ec-cdce97423e02', 'b0000000-0000-4000-8000-000000000019', '{"nombres" : "Martín Eduardo", "apellidos" : "Cabrera Ortiz", "whatsapp" : "51927667788", "email" : "mcabrera@unt.edu.pe", "leadScore" : 38}', '190.237.12.84', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-11-12 16:31:22.779347+00'),
('332ae28e-dca0-4b2b-83cd-151c62a9f119', 'b0000000-0000-4000-8000-000000000020', '{"nombres" : "Vanessa Stephanie", "apellidos" : "Guerrero Luján", "whatsapp" : "51928778899", "email" : "vguerrero@ucv.edu.pe", "leadScore" : 64}', '190.237.12.84', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-11-12 16:31:22.779347+00'),
('b91f641b-e2ba-4770-828c-a89c8095cb08', 'b0000000-0000-4000-8000-000000000021', '{"nombres" : "José Fernando", "apellidos" : "Peralta Tapia", "whatsapp" : "51929889900", "email" : "jperalta@uni.edu.pe", "leadScore" : 48}', '190.237.12.84', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-11-12 16:31:22.779347+00'),
('c7ae4dfb-be34-47ac-b675-54a65167f9d0', 'b0000000-0000-4000-8000-000000000022', '{"nombres" : "Silvia Cristina", "apellidos" : "Reyes Sandoval", "whatsapp" : "51930990011", "email" : "sreyes@unt.edu.pe", "leadScore" : 52}', '190.237.12.84', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-11-12 16:31:22.779347+00'),
('a9c45597-5646-4dd6-baf2-dbaeb9441e92', 'b0000000-0000-4000-8000-000000000023', '{"nombres" : "César Augusto", "apellidos" : "Villarreal Benítez", "whatsapp" : "51911112233", "email" : "cvillarreal@unt.edu.pe", "leadScore" : 91}', '190.237.12.84', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-11-12 16:31:22.779347+00'),
('cce70c7f-d92e-4fb1-a71a-c6e0ae604ef9', 'b0000000-0000-4000-8000-000000000024', '{"nombres" : "Katherine Gisell", "apellidos" : "Palacios Montoya", "whatsapp" : "51912223344", "email" : "kpalacios@ucv.edu.pe", "leadScore" : 83}', '190.237.12.84', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-11-12 16:31:22.779347+00'),
('008160d6-d701-4a5a-ab92-633367f1cbfd', 'b0000000-0000-4000-8000-000000000025', '{"nombres" : "Rodrigo Javier", "apellidos" : "Lecca Santillán", "whatsapp" : "51913334455", "email" : "rlecca@upao.edu.pe", "leadScore" : 87}', '190.237.12.84', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-11-12 16:31:22.779347+00'),
('f9da6b2e-6e8b-432e-86a3-b436c8542a4e', 'b0000000-0000-4000-8000-000000000026', '{"nombres" : "Miriam Elizabeth", "apellidos" : "Chirinos Saavedra", "whatsapp" : "51914445566", "email" : "mchirinos@unmsm.edu.pe", "leadScore" : 85}', '190.237.12.84', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-11-12 16:31:22.779347+00'),
('73d2e6a2-d9c2-4a46-afce-dc8adf1b9409', 'b0000000-0000-4000-8000-000000000027', '{"nombres" : "María Elena", "apellidos" : "Castillo Vega", "whatsapp" : "51901112233", "email" : "mcastillo@unmsm.edu.pe", "leadScore" : 95}', '190.237.12.84', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-11-12 16:31:22.779347+00'),
('02cf7442-9b92-461a-b849-389817a61676', 'b0000000-0000-4000-8000-000000000028', '{"nombres" : "Álvaro Sebastián", "apellidos" : "Gutiérrez Cerna", "whatsapp" : "51902223344", "email" : "agutierrez@unt.edu.pe", "leadScore" : 92}', '190.237.12.84', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-11-12 16:31:22.779347+00'),
('0382d728-90d4-4c02-9add-a0cb399c703c', 'b0000000-0000-4000-8000-000000000029', '{"nombres" : "Gabriela Alejandra", "apellidos" : "Paz Soldán Núñez", "whatsapp" : "51903334455", "email" : "gpaz@upao.edu.pe", "leadScore" : 94}', '190.237.12.84', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-11-12 16:31:22.779347+00'),
('086a7fdd-43cc-4c0a-bad9-8a0346d238b5', 'b0000000-0000-4000-8000-000000000030', '{"nombres" : "Marco Antonio", "apellidos" : "Bocanegra Tirado", "whatsapp" : "51904445566", "email" : "mbocanegra@uni.edu.pe", "leadScore" : 90}', '190.237.12.84', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-11-12 16:31:22.779347+00');

-- -----------------------------------------------------------------------------
-- Tabla #22: public."INTERACCION"
-- -----------------------------------------------------------------------------
INSERT INTO public."INTERACCION" (id, "buyerId", tipo, detalle, "fechaHora") VALUES
('f47cb2c2-0487-41aa-b291-c6eb1bbd928e', 'b0000000-0000-4000-8000-000000000001', 'DESCARGA_LEAD_MAGNET', 'Descarga de Guía Definitiva: Cómo plantear tu matriz de consistencia sin errores', '2026-11-12 16:31:22.779347+00'),
('3d9acb2c-da36-4e84-9aa2-641bb6e3c291', 'b0000000-0000-4000-8000-000000000001', 'ENVIO_FORMULARIO', 'Registro completo desde formulario Meta Ads con Lead Score 94/100', '2026-11-12 16:31:22.779347+00'),
('969b9b2a-e0e2-490b-b008-e7c2835c1a70', 'b0000000-0000-4000-8000-000000000002', 'ENVIO_FORMULARIO', 'Formulario registrado con score 88', '2026-11-12 16:31:22.779347+00'),
('9f1776fc-e2c3-4ed8-9e24-6b8a0eb054b1', 'b0000000-0000-4000-8000-000000000003', 'ENVIO_FORMULARIO', 'Formulario registrado con score 82', '2026-11-12 16:31:22.779347+00'),
('d96fd666-2167-43a9-a133-4080855b2286', 'b0000000-0000-4000-8000-000000000004', 'ENVIO_FORMULARIO', 'Formulario registrado con score 91', '2026-11-12 16:31:22.779347+00'),
('00d452f6-1334-4c5b-8678-a177cc1ee8d8', 'b0000000-0000-4000-8000-000000000005', 'ENVIO_FORMULARIO', 'Formulario registrado con score 89', '2026-11-12 16:31:22.779347+00'),
('858cee79-e1ab-40c5-82a8-6a102d064b18', 'b0000000-0000-4000-8000-000000000006', 'ENVIO_FORMULARIO', 'Formulario registrado con score 84', '2026-11-12 16:31:22.779347+00'),
('2c7eefc5-e1bf-48da-91ce-e0060ccaa616', 'b0000000-0000-4000-8000-000000000007', 'ENVIO_FORMULARIO', 'Formulario registrado con score 78', '2026-11-12 16:31:22.779347+00'),
('6af0c194-b281-40c2-b21b-62f2efcc2434', 'b0000000-0000-4000-8000-000000000008', 'ENVIO_FORMULARIO', 'Formulario registrado con score 75', '2026-11-12 16:31:22.779347+00'),
('967567d8-7f8b-4316-8dab-2a8a4ea32966', 'b0000000-0000-4000-8000-000000000009', 'ENVIO_FORMULARIO', 'Formulario registrado con score 93', '2026-11-12 16:31:22.779347+00'),
('83f0da23-993d-4dcb-8067-042ab6eeb823', 'b0000000-0000-4000-8000-000000000010', 'ENVIO_FORMULARIO', 'Formulario registrado con score 86', '2026-11-12 16:31:22.779347+00'),
('e14c79fb-87ad-4f92-a8b6-b682c102cea5', 'b0000000-0000-4000-8000-000000000011', 'ENVIO_FORMULARIO', 'Formulario registrado con score 74', '2026-11-12 16:31:22.779347+00'),
('d8f6d452-aeab-4146-9422-262edbcbce26', 'b0000000-0000-4000-8000-000000000012', 'ENVIO_FORMULARIO', 'Formulario registrado con score 87', '2026-11-12 16:31:22.779347+00'),
('4ac3e52c-558b-46e1-a1f2-9faeac7c1bb7', 'b0000000-0000-4000-8000-000000000013', 'ENVIO_FORMULARIO', 'Formulario registrado con score 58', '2026-11-12 16:31:22.779347+00'),
('7b7de852-e039-429d-ae50-d185d82f3a65', 'b0000000-0000-4000-8000-000000000014', 'ENVIO_FORMULARIO', 'Formulario registrado con score 42', '2026-11-12 16:31:22.779347+00'),
('214d13cd-64a0-4251-a496-dc5c0035621a', 'b0000000-0000-4000-8000-000000000015', 'ENVIO_FORMULARIO', 'Formulario registrado con score 62', '2026-11-12 16:31:22.779347+00'),
('79aedf6d-5015-4bc5-8f4a-e41809a1c764', 'b0000000-0000-4000-8000-000000000016', 'ENVIO_FORMULARIO', 'Formulario registrado con score 50', '2026-11-12 16:31:22.779347+00'),
('b9bc8e8f-e7d6-4f33-a384-3f95fbf078ae', 'b0000000-0000-4000-8000-000000000017', 'ENVIO_FORMULARIO', 'Formulario registrado con score 45', '2026-11-12 16:31:22.779347+00'),
('a9e252ee-a517-4e52-8b77-39c487665746', 'b0000000-0000-4000-8000-000000000018', 'ENVIO_FORMULARIO', 'Formulario registrado con score 55', '2026-11-12 16:31:22.779347+00'),
('9117085a-2292-4b4d-8460-de57e7ae7527', 'b0000000-0000-4000-8000-000000000019', 'ENVIO_FORMULARIO', 'Formulario registrado con score 38', '2026-11-12 16:31:22.779347+00'),
('1e5f0b11-89cb-4a3e-9e61-6fa09fc53a8e', 'b0000000-0000-4000-8000-000000000020', 'ENVIO_FORMULARIO', 'Formulario registrado con score 64', '2026-11-12 16:31:22.779347+00'),
('dd017488-4e74-481f-87d1-4a180320aa52', 'b0000000-0000-4000-8000-000000000021', 'ENVIO_FORMULARIO', 'Formulario registrado con score 48', '2026-11-12 16:31:22.779347+00'),
('4fe717f5-55fc-4b9a-9909-fe38c4950dfe', 'b0000000-0000-4000-8000-000000000022', 'ENVIO_FORMULARIO', 'Formulario registrado con score 52', '2026-11-12 16:31:22.779347+00');

-- -----------------------------------------------------------------------------
-- Tabla #23: public."PERFIL_NEGOCIACION"
-- -----------------------------------------------------------------------------
INSERT INTO public."PERFIL_NEGOCIACION" (id, "buyerId", "presupuestoEstimado", "urgenciaNivel", "objecionPredominante", "scoreSensibilidadPrecio", notas) VALUES
('9ee6af2c-5d13-45da-8137-fadff938590f', 'b0000000-0000-4000-8000-000000000001', 2200.00, 'ALTA', 'TIEMPO', 40, 'Estudiante con proyecto avanzado al 30%. Necesita apoyo metodológico y código Python para sustentar en noviembre.'),
('0e909371-b960-43e4-ae81-554c33baea54', 'b0000000-0000-4000-8000-000000000002', 1800.00, 'MEDIA', 'PRECIO', 80, 'Sensible al precio. Requiere facilidad en cuotas o descuento por pago inicial.'),
('2a166656-e201-47b9-be39-9aaad262e640', 'b0000000-0000-4000-8000-000000000003', 2000.00, 'ALTA', 'TIEMPO', 50, 'Lista para cierre en 2 partes.'),
('4e72c6a9-f507-42ff-8204-58bed65cde36', 'b0000000-0000-4000-8000-000000000004', 2400.00, 'ALTA', 'TIEMPO', 60, NULL),
('ca413060-1354-4b81-b2e4-8c37927f6d95', 'b0000000-0000-4000-8000-000000000005', 2500.00, 'ALTA', 'TIEMPO', 60, NULL),
('ae5f509b-5727-4892-bfc0-98d16eb9ae38', 'b0000000-0000-4000-8000-000000000006', 1900.00, 'MEDIA', 'PRECIO', 60, NULL),
('83445db8-bca3-433b-9a77-99402288c689', 'b0000000-0000-4000-8000-000000000007', 1500.00, 'MEDIA', 'PRECIO', 60, NULL),
('fd0e7aa3-ffc7-4c39-b6cc-973c64fa5b13', 'b0000000-0000-4000-8000-000000000008', 1200.00, 'MEDIA', 'PRECIO', 60, NULL),
('f3822302-a08c-44f1-a72a-9a76d63f5b2e', 'b0000000-0000-4000-8000-000000000009', 2300.00, 'ALTA', 'TIEMPO', 60, NULL),
('dbcea2f2-5513-47a5-b35e-9477299065f1', 'b0000000-0000-4000-8000-000000000010', 2100.00, 'ALTA', 'TIEMPO', 60, NULL),
('6dfc4ca7-468f-4732-b10a-148fb0cdea6b', 'b0000000-0000-4000-8000-000000000011', 1100.00, 'MEDIA', 'PRECIO', 60, NULL),
('c2880948-6634-4d8f-857c-95f5ea819ae8', 'b0000000-0000-4000-8000-000000000012', 1700.00, 'ALTA', 'TIEMPO', 60, NULL);

-- -----------------------------------------------------------------------------
-- Tabla #24: public."LEAD"
-- -----------------------------------------------------------------------------
INSERT INTO public."LEAD" (id, "buyerId", "scoreCalificado", prioridad, "fechaCalificacion", "umbralSuperado", "criterioCalificacion") VALUES
('1e000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 94, 'ALTA', '2026-09-15 09:35:00+00', true, '{"perfilCompleto":20,"tipoInvestigacion":15,"plazoDefinido":15,"situacionLaboral":10,"dolorYSoftware":14,"consentimientoWhatsapp":10,"leadMagnetDescargado":10,"puntosTotales":94}'),
('1e000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 88, 'ALTA', '2026-09-14 11:05:00+00', true, '{"perfilCompleto":20,"tipoInvestigacion":15,"plazoDefinido":15,"situacionLaboral":10,"puntosTotales":88}'),
('1e000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003', 82, 'ALTA', '2026-09-13 16:25:00+00', true, '{"perfilCompleto":20,"tipoInvestigacion":15,"plazoDefinido":15,"puntosTotales":82}'),
('1e000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000004', 91, 'ALTA', '2026-09-12 10:05:00+00', true, '{"perfilCompleto":20,"tipoInvestigacion":15,"plazoDefinido":15,"puntosTotales":91}'),
('1e000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000005', 89, 'ALTA', '2026-09-12 10:05:00+00', true, '{"perfilCompleto":20,"tipoInvestigacion":15,"plazoDefinido":15,"puntosTotales":89}'),
('1e000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000006', 84, 'MEDIA', '2026-09-12 10:05:00+00', true, '{"perfilCompleto":20,"tipoInvestigacion":15,"plazoDefinido":15,"puntosTotales":84}'),
('1e000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000007', 78, 'MEDIA', '2026-09-12 10:05:00+00', true, '{"perfilCompleto":20,"tipoInvestigacion":15,"plazoDefinido":15,"puntosTotales":78}'),
('1e000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000008', 75, 'MEDIA', '2026-09-12 10:05:00+00', true, '{"perfilCompleto":20,"tipoInvestigacion":15,"plazoDefinido":15,"puntosTotales":75}'),
('1e000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000009', 93, 'ALTA', '2026-09-12 10:05:00+00', true, '{"perfilCompleto":20,"tipoInvestigacion":15,"plazoDefinido":15,"puntosTotales":93}'),
('1e000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000010', 86, 'ALTA', '2026-09-12 10:05:00+00', true, '{"perfilCompleto":20,"tipoInvestigacion":15,"plazoDefinido":15,"puntosTotales":86}'),
('1e000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000011', 74, 'MEDIA', '2026-09-12 10:05:00+00', true, '{"perfilCompleto":20,"tipoInvestigacion":15,"plazoDefinido":15,"puntosTotales":74}'),
('1e000000-0000-4000-8000-000000000012', 'b0000000-0000-4000-8000-000000000012', 87, 'ALTA', '2026-09-12 10:05:00+00', true, '{"perfilCompleto":20,"tipoInvestigacion":15,"plazoDefinido":15,"puntosTotales":87}'),
('1e000000-0000-4000-8000-000000000023', 'b0000000-0000-4000-8000-000000000023', 91, 'ALTA', '2026-09-08 09:05:00+00', true, '{"score":91}'),
('1e000000-0000-4000-8000-000000000024', 'b0000000-0000-4000-8000-000000000024', 83, 'MEDIA', '2026-09-08 09:05:00+00', true, '{"score":83}'),
('1e000000-0000-4000-8000-000000000025', 'b0000000-0000-4000-8000-000000000025', 87, 'ALTA', '2026-09-08 09:05:00+00', true, '{"score":87}'),
('1e000000-0000-4000-8000-000000000026', 'b0000000-0000-4000-8000-000000000026', 85, 'ALTA', '2026-09-08 09:05:00+00', true, '{"score":85}'),
('1e000000-0000-4000-8000-000000000027', 'b0000000-0000-4000-8000-000000000027', 95, 'ALTA', '2026-09-01 08:05:00+00', true, '{"score":95}'),
('1e000000-0000-4000-8000-000000000028', 'b0000000-0000-4000-8000-000000000028', 92, 'ALTA', '2026-09-01 08:05:00+00', true, '{"score":92}'),
('1e000000-0000-4000-8000-000000000029', 'b0000000-0000-4000-8000-000000000029', 94, 'ALTA', '2026-09-01 08:05:00+00', true, '{"score":94}'),
('1e000000-0000-4000-8000-000000000030', 'b0000000-0000-4000-8000-000000000030', 90, 'ALTA', '2026-09-01 08:05:00+00', true, '{"score":90}'),
('1e000000-0000-4000-8000-000000000044', 'b0000000-0000-4000-8000-000000000044', 82, 'ALTA', '2026-11-12 16:37:22.244652+00', true, '{"score":82,"estado":"PROPUESTA_ACEPTADA"}'),
('1e000000-0000-4000-8000-000000000065', 'b0000000-0000-4000-8000-000000000065', 82, 'ALTA', '2026-11-12 16:37:22.244652+00', true, '{"score":82,"estado":"PROPUESTA_ACEPTADA"}'),
('1e000000-0000-4000-8000-000000000081', 'b0000000-0000-4000-8000-000000000081', 82, 'ALTA', '2026-11-12 16:37:22.244652+00', true, '{"score":82,"estado":"PROPUESTA_ACEPTADA"}');

-- -----------------------------------------------------------------------------
-- Tabla #25: public."RESPONSABLE_PAGO"
-- -----------------------------------------------------------------------------
INSERT INTO public."RESPONSABLE_PAGO" (responsable_pago_id, buyer_id, nombre, telefono, email, segmento, tipo_responsable, relacion) VALUES
(1, 'b0000000-0000-4000-8000-000000000003', 'Valeria Sofía Morales Castro', '51947112233', 'vmorales@upao.edu.pe', 'Estudiante', 'Estudiante', 'El propio tesista'),
(2, 'b0000000-0000-4000-8000-000000000023', 'César Augusto Villarreal Benítez', '51911112233', 'cvillarreal@unt.edu.pe', 'Estudiante', 'Estudiante', 'El propio tesista'),
(3, 'b0000000-0000-4000-8000-000000000024', 'Katherine Gisell Palacios Montoya', '51912223344', 'kpalacios@ucv.edu.pe', 'Estudiante', 'Estudiante', 'El propio tesista'),
(4, 'b0000000-0000-4000-8000-000000000025', 'Rodrigo Javier Lecca Santillán', '51913334455', 'rlecca@upao.edu.pe', 'Estudiante', 'Estudiante', 'El propio tesista'),
(5, 'b0000000-0000-4000-8000-000000000026', 'Miriam Elizabeth Chirinos Saavedra', '51914445566', 'mchirinos@unmsm.edu.pe', 'Estudiante', 'Estudiante', 'El propio tesista'),
(6, 'b0000000-0000-4000-8000-000000000027', 'María Elena Castillo Vega', '51901112233', 'mcastillo@unmsm.edu.pe', 'Estudiante', 'Estudiante', 'El propio tesista'),
(7, 'b0000000-0000-4000-8000-000000000028', 'Álvaro Sebastián Gutiérrez Cerna', '51902223344', 'agutierrez@unt.edu.pe', 'Estudiante', 'Estudiante', 'El propio tesista'),
(8, 'b0000000-0000-4000-8000-000000000029', 'Gabriela Alejandra Paz Soldán Núñez', '51903334455', 'gpaz@upao.edu.pe', 'Estudiante', 'Estudiante', 'El propio tesista'),
(9, 'b0000000-0000-4000-8000-000000000030', 'Marco Antonio Bocanegra Tirado', '51904445566', 'mbocanegra@uni.edu.pe', 'Estudiante', 'Estudiante', 'El propio tesista');

-- -----------------------------------------------------------------------------
-- Tabla #26: public."CONVERSACION"
-- -----------------------------------------------------------------------------
INSERT INTO public."CONVERSACION" (id, "buyerId", "leadId", canal, "estadoEtapa", "fechaInicio", "fechaUltimaActividad") VALUES
('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', '1e000000-0000-4000-8000-000000000002', 'WHATSAPP', 'OBJECTION_HANDLING', '2026-09-14 11:10:00+00', '2026-09-14 14:30:00+00'),
('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000003', '1e000000-0000-4000-8000-000000000003', 'WHATSAPP', 'CLOSING', '2026-09-13 16:30:00+00', '2026-09-14 09:00:00+00');

-- -----------------------------------------------------------------------------
-- Tabla #27: public."MENSAJE"
-- -----------------------------------------------------------------------------
INSERT INTO public."MENSAJE" (id, "conversacionId", direccion, remitente, contenido, "tipoMensaje", "fechaHora", "estadoEntrega", "respuestaA", metadata) VALUES
('30b1fc43-7034-4170-af9c-f712537418e2', 'c0000000-0000-4000-8000-000000000001', 'OUTGOING', 'AGENTE_IA', '¡Hola Carlos Alberto! Te saluda el Asesor Especialista de INBESTIGA.TESIS. Vi que eres egresado de Ingeniería Industrial en la UCV y buscas apoyo para tu tesis con análisis estadístico en SPSS. ¿Cómo te encuentras el día de hoy?', 'TEXT', '2026-09-14 11:10:05+00', 'SENT', NULL, NULL),
('848ffa4b-0275-4482-869b-2e7fb84063ca', 'c0000000-0000-4000-8000-000000000001', 'INCOMING', 'CLIENTE', 'Hola estimado, gracias por contactarme. Sí, tengo los datos de tiempos y producción recolectados pero no sé qué prueba aplicar y el presupuesto que tengo es algo ajustado.', 'TEXT', '2026-09-14 11:15:00+00', 'SENT', NULL, NULL);

-- -----------------------------------------------------------------------------
-- Tabla #28: public."DIAGNOSTICO"
-- -----------------------------------------------------------------------------
INSERT INTO public."DIAGNOSTICO" (id, "conversacionId", "leadId", "temaInvestigacion", "avanceActualPct", "principalesDificultades", "resumenIA", "fechaDiagnostico") VALUES
('516e0857-368e-43f2-8d41-db2a8dd0d8ab', 'c0000000-0000-4000-8000-000000000001', '1e000000-0000-4000-8000-000000000002', 'Mejora de la productividad mediante manufactura esbelta en planta agroindustrial', 40, 'Contrastación de hipótesis en SPSS y cálculo de OEE', 'Estudiante con base de datos real. Requiere asesoría integral con énfasis estadístico.', '2026-11-12 16:31:22.779347+00');

-- -----------------------------------------------------------------------------
-- Tabla #29: public."PROPUESTA"
-- -----------------------------------------------------------------------------
INSERT INTO public."PROPUESTA" (id, "conversacionId", "leadId", "servicioId", "precioOriginal", "precioPropuesto", "descuentoAplicadoPct", "numeroCuotas", "montoPorCuota", "plazoDias", justificacion, estado, "fechaCreacion") VALUES
('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', '1e000000-0000-4000-8000-000000000002', '77777777-7777-4777-8777-777777777701', 2200.00, 2000.00, 9.09, 2, 1000.00, 45, 'Ajuste inicial por egresado con datos disponibles', 'ENVIADA', '2026-11-12 16:31:22.779347+00'),
('d0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', '1e000000-0000-4000-8000-000000000003', '77777777-7777-4777-8777-777777777701', 2200.00, 1980.00, 10.00, 2, 990.00, 40, 'Descuento del 10% por pronta confirmación en 2 partes', 'ACEPTADA', '2026-11-12 16:31:22.779347+00');

-- -----------------------------------------------------------------------------
-- Tabla #30: public."OBJECION"
-- -----------------------------------------------------------------------------
INSERT INTO public."OBJECION" (id, "conversacionId", "leadId", tipo, descripcion, "respuestaAgente", resuelta, "fechaRegistro") VALUES
('2e97264a-917b-4625-bbfb-0b00d81b1a0b', 'c0000000-0000-4000-8000-000000000001', '1e000000-0000-4000-8000-000000000002', 'PRECIO', 'El alumno comenta que 2 cuotas de S/ 1,000 se salen de su presupuesto disponible este mes.', 'El agente evaluará ampliar a 3 cuotas de S/ 650 bajo la regla comercial.', false, '2026-11-12 16:31:22.779347+00');

-- -----------------------------------------------------------------------------
-- Tabla #31: public."SEGUIMIENTO"
-- -----------------------------------------------------------------------------
INSERT INTO public."SEGUIMIENTO" (id, "conversacionId", "leadId", tipo, "fechaProgramada", "fechaEjecutada", estado, resultado) VALUES
('3f2e75bc-d22d-437c-8dea-f9be20ae4d1d', 'c0000000-0000-4000-8000-000000000001', '1e000000-0000-4000-8000-000000000002', 'OFERTA_LIMITADA', '2026-09-17 10:00:00+00', NULL, 'PENDIENTE', NULL);

-- -----------------------------------------------------------------------------
-- Tabla #32: public."COTIZACION"
-- -----------------------------------------------------------------------------
INSERT INTO public."COTIZACION" (id, "leadId", "propuestaId", "servicioId", "codigoCotizacion", subtotal, descuento, total, cuotas, "plazoEntregaDias", "fechaEmision", "fechaExpiracion", estado) VALUES
('e0000000-0000-4000-8000-000000000002', '1e000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000002', '77777777-7777-4777-8777-777777777701', 'COT-2026-0002', 2200.00, 220.00, 1980.00, 2, 40, '2026-09-14 00:00:00+00', '2026-09-21 00:00:00+00', 'ACTIVA'),
('e0000000-0000-4000-8000-000000000003', '1e000000-0000-4000-8000-000000000023', NULL, '77777777-7777-4777-8777-777777777701', 'COT-2026-0003', 1980.00, 0.00, 1980.00, 1, 45, '2026-09-08 00:00:00+00', '2026-09-15 00:00:00+00', 'ACEPTADA'),
('e0000000-0000-4000-8000-000000000004', '1e000000-0000-4000-8000-000000000024', NULL, '77777777-7777-4777-8777-777777777702', 'COT-2026-0004', 1080.00, 0.00, 1080.00, 1, 45, '2026-09-08 00:00:00+00', '2026-09-15 00:00:00+00', 'ACEPTADA'),
('e0000000-0000-4000-8000-000000000005', '1e000000-0000-4000-8000-000000000025', NULL, '77777777-7777-4777-8777-777777777701', 'COT-2026-0005', 1000.00, 0.00, 1000.00, 2, 45, '2026-09-08 00:00:00+00', '2026-09-15 00:00:00+00', 'ACEPTADA'),
('e0000000-0000-4000-8000-000000000006', '1e000000-0000-4000-8000-000000000026', NULL, '77777777-7777-4777-8777-777777777703', 'COT-2026-0006', 765.00, 0.00, 765.00, 1, 45, '2026-09-08 00:00:00+00', '2026-09-15 00:00:00+00', 'ACEPTADA'),
('e0000000-0000-4000-8000-000000000007', '1e000000-0000-4000-8000-000000000027', NULL, '77777777-7777-4777-8777-777777777701', 'COT-2026-0007', 2200.00, 220.00, 1980.00, 1, 45, '2026-09-02 00:00:00+00', '2026-09-09 00:00:00+00', 'ACEPTADA'),
('e0000000-0000-4000-8000-000000000008', '1e000000-0000-4000-8000-000000000028', NULL, '77777777-7777-4777-8777-777777777701', 'COT-2026-0008', 2200.00, 220.00, 1980.00, 1, 45, '2026-09-02 00:00:00+00', '2026-09-09 00:00:00+00', 'ACEPTADA'),
('e0000000-0000-4000-8000-000000000009', '1e000000-0000-4000-8000-000000000029', NULL, '77777777-7777-4777-8777-777777777701', 'COT-2026-0009', 2200.00, 220.00, 1980.00, 1, 45, '2026-09-02 00:00:00+00', '2026-09-09 00:00:00+00', 'ACEPTADA'),
('e0000000-0000-4000-8000-000000000010', '1e000000-0000-4000-8000-000000000030', NULL, '77777777-7777-4777-8777-777777777701', 'COT-2026-0010', 2200.00, 220.00, 1980.00, 1, 45, '2026-09-02 00:00:00+00', '2026-09-09 00:00:00+00', 'ACEPTADA'),
('e0000000-0000-4000-8000-000000000044', '1e000000-0000-4000-8000-000000000044', NULL, '77777777-7777-4777-8777-777777777702', 'COT-2026-0044', 1800.00, 180.00, 1620.00, 1, 60, '2026-09-15 00:00:00+00', '2026-09-22 00:00:00+00', 'ACTIVA'),
('e0000000-0000-4000-8000-000000000065', '1e000000-0000-4000-8000-000000000065', NULL, '77777777-7777-4777-8777-777777777701', 'COT-2026-0065', 2400.00, 168.00, 2232.00, 3, 90, '2026-09-15 00:00:00+00', '2026-09-22 00:00:00+00', 'ACTIVA'),
('e0000000-0000-4000-8000-000000000081', '1e000000-0000-4000-8000-000000000081', NULL, '77777777-7777-4777-8777-777777777701', 'COT-2026-0081', 3900.00, 234.00, 3666.00, 6, 120, '2026-09-15 00:00:00+00', '2026-09-22 00:00:00+00', 'ACTIVA');

-- -----------------------------------------------------------------------------
-- Tabla #33: public."CONTRATO"
-- -----------------------------------------------------------------------------
INSERT INTO public."CONTRATO" (contrato_id, cotizacion_id, propuesta_id, plantilla_contrato_id, version, alcance, plazo_dias, garantia, penalidad_pct, terminos_cancelacion, fecha_generacion, fecha_confirmacion, canal_confirmacion, evidencia_aceptacion, estado) VALUES
(1, 'e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', 1, 'v2.0', 'Asesoría metodológica personalizada por entregables verificables con garantía de levantamiento de observaciones.', 40, 'Acompañamiento hasta sustentación aprobada y similitud Turnitin < 15%.', 10.00, 'Reembolso proporcional descontando hitos entregados y comisión de pasarela.', '2026-09-14 09:00:00+00', '2026-09-14 09:10:00+00', 'WHATSAPP', NULL, 'CONFIRMADO'),
(2, 'e0000000-0000-4000-8000-000000000003', NULL, 1, 'v2.0', 'Asesoría metodológica personalizada por entregables verificables con garantía de levantamiento de observaciones.', 45, 'Acompañamiento hasta sustentación aprobada y similitud Turnitin < 15%.', 10.00, 'Reembolso proporcional descontando hitos entregados y comisión de pasarela.', '2026-09-08 09:00:00+00', '2026-09-08 09:30:00+00', 'WHATSAPP', NULL, 'CONFIRMADO'),
(3, 'e0000000-0000-4000-8000-000000000004', NULL, 1, 'v2.0', 'Asesoría metodológica personalizada por entregables verificables con garantía de levantamiento de observaciones.', 45, 'Acompañamiento hasta sustentación aprobada y similitud Turnitin < 15%.', 10.00, 'Reembolso proporcional descontando hitos entregados y comisión de pasarela.', '2026-09-08 09:00:00+00', '2026-09-08 09:30:00+00', 'WHATSAPP', NULL, 'CONFIRMADO'),
(4, 'e0000000-0000-4000-8000-000000000005', NULL, 1, 'v2.0', 'Asesoría metodológica personalizada por entregables verificables con garantía de levantamiento de observaciones.', 45, 'Acompañamiento hasta sustentación aprobada y similitud Turnitin < 15%.', 10.00, 'Reembolso proporcional descontando hitos entregados y comisión de pasarela.', '2026-09-08 09:00:00+00', '2026-09-08 09:30:00+00', 'WHATSAPP', NULL, 'CONFIRMADO'),
(5, 'e0000000-0000-4000-8000-000000000006', NULL, 1, 'v2.0', 'Asesoría metodológica personalizada por entregables verificables con garantía de levantamiento de observaciones.', 45, 'Acompañamiento hasta sustentación aprobada y similitud Turnitin < 15%.', 10.00, 'Reembolso proporcional descontando hitos entregados y comisión de pasarela.', '2026-09-08 09:00:00+00', '2026-09-08 09:30:00+00', 'WHATSAPP', NULL, 'CONFIRMADO'),
(6, 'e0000000-0000-4000-8000-000000000007', NULL, 1, 'v2.0', 'Asesoría metodológica personalizada por entregables verificables con garantía de levantamiento de observaciones.', 45, 'Acompañamiento hasta sustentación aprobada y similitud Turnitin < 15%.', 10.00, 'Reembolso proporcional descontando hitos entregados y comisión de pasarela.', '2026-09-02 09:00:00+00', '2026-09-02 09:30:00+00', 'WHATSAPP', NULL, 'CONFIRMADO'),
(7, 'e0000000-0000-4000-8000-000000000008', NULL, 1, 'v2.0', 'Asesoría metodológica personalizada por entregables verificables con garantía de levantamiento de observaciones.', 45, 'Acompañamiento hasta sustentación aprobada y similitud Turnitin < 15%.', 10.00, 'Reembolso proporcional descontando hitos entregados y comisión de pasarela.', '2026-09-02 09:00:00+00', '2026-09-02 09:30:00+00', 'WHATSAPP', NULL, 'CONFIRMADO'),
(8, 'e0000000-0000-4000-8000-000000000009', NULL, 1, 'v2.0', 'Asesoría metodológica personalizada por entregables verificables con garantía de levantamiento de observaciones.', 45, 'Acompañamiento hasta sustentación aprobada y similitud Turnitin < 15%.', 10.00, 'Reembolso proporcional descontando hitos entregados y comisión de pasarela.', '2026-09-02 09:00:00+00', '2026-09-02 09:30:00+00', 'WHATSAPP', NULL, 'CONFIRMADO'),
(9, 'e0000000-0000-4000-8000-000000000010', NULL, 1, 'v2.0', 'Asesoría metodológica personalizada por entregables verificables con garantía de levantamiento de observaciones.', 45, 'Acompañamiento hasta sustentación aprobada y similitud Turnitin < 15%.', 10.00, 'Reembolso proporcional descontando hitos entregados y comisión de pasarela.', '2026-09-02 09:00:00+00', '2026-09-02 09:30:00+00', 'WHATSAPP', NULL, 'CONFIRMADO');

-- -----------------------------------------------------------------------------
-- Tabla #34: public."ORDEN_PAGO"
-- -----------------------------------------------------------------------------
INSERT INTO public."ORDEN_PAGO" (orden_pago_id, codigo_orden, cotizacion_id, propuesta_id, contrato_id, responsable_pago_id, modalidad_pago_id, fecha_creacion, fecha_primer_enlace, monto_comprometido, moneda, dias_tolerancia_vencimiento, en_mora, servicio_suspendido_mora, estado) VALUES
(1, 'ORD-2026-0002', 'e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', 1, 1, 2, '2026-09-14 09:15:00+00', '2026-09-14 09:20:00+00', 1980.00, 'PEN', 7, false, false, 'ENLACE_ENVIADO'),
(2, 'ORD-2026-0003', 'e0000000-0000-4000-8000-000000000003', NULL, 2, 2, 1, '2026-09-08 10:00:00+00', '2026-09-08 10:05:00+00', 1980.00, 'PEN', 7, false, false, 'PAGADA'),
(3, 'ORD-2026-0004', 'e0000000-0000-4000-8000-000000000004', NULL, 3, 3, 1, '2026-09-08 10:00:00+00', '2026-09-08 10:05:00+00', 1080.00, 'PEN', 7, false, false, 'PAGADA'),
(4, 'ORD-2026-0005', 'e0000000-0000-4000-8000-000000000005', NULL, 4, 4, 2, '2026-09-08 10:00:00+00', '2026-09-08 10:05:00+00', 2000.00, 'PEN', 7, false, false, 'PARCIAL'),
(5, 'ORD-2026-0006', 'e0000000-0000-4000-8000-000000000006', NULL, 5, 5, 1, '2026-09-08 10:00:00+00', '2026-09-08 10:05:00+00', 765.00, 'PEN', 7, false, false, 'PAGADA'),
(6, 'ORD-2026-0007', 'e0000000-0000-4000-8000-000000000007', NULL, 6, 6, 1, '2026-09-02 10:00:00+00', '2026-09-02 10:05:00+00', 1980.00, 'PEN', 7, false, false, 'PAGADA'),
(7, 'ORD-2026-0008', 'e0000000-0000-4000-8000-000000000008', NULL, 7, 7, 1, '2026-09-02 10:00:00+00', '2026-09-02 10:05:00+00', 1980.00, 'PEN', 7, false, false, 'PAGADA'),
(8, 'ORD-2026-0009', 'e0000000-0000-4000-8000-000000000009', NULL, 8, 8, 1, '2026-09-02 10:00:00+00', '2026-09-02 10:05:00+00', 1980.00, 'PEN', 7, false, false, 'PAGADA'),
(9, 'ORD-2026-0010', 'e0000000-0000-4000-8000-000000000010', NULL, 9, 9, 1, '2026-09-02 10:00:00+00', '2026-09-02 10:05:00+00', 1980.00, 'PEN', 7, false, false, 'PAGADA'),
(13, 'ORD-2026-0044', 'e0000000-0000-4000-8000-000000000044', NULL, NULL, NULL, 1, '2026-11-12 16:37:22.244652+00', NULL, 1620.00, 'PEN', 7, false, false, 'ENLACE_ENVIADO'),
(14, 'ORD-2026-0065', 'e0000000-0000-4000-8000-000000000065', NULL, NULL, NULL, 3, '2026-11-12 16:37:22.244652+00', NULL, 2232.00, 'PEN', 7, false, false, 'ENLACE_ENVIADO'),
(15, 'ORD-2026-0081', 'e0000000-0000-4000-8000-000000000081', NULL, NULL, NULL, 4, '2026-11-12 16:37:22.244652+00', NULL, 3666.00, 'PEN', 7, false, false, 'ENLACE_ENVIADO');

-- -----------------------------------------------------------------------------
-- Tabla #35: public."PAGO"
-- -----------------------------------------------------------------------------
INSERT INTO public."PAGO" (id, "cotizacionId", "buyerId", "leadId", "gatewayProveedor", "gatewayTransactionId", monto, moneda, "metodoPago", estado, "fechaCreacion", "fechaConfirmacion", "gatewayPayload", "comprobanteUrl") VALUES
('f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000023', '1e000000-0000-4000-8000-000000000023', 'STRIPE', 'pi_test_3N82bX2eZvKYlo2C1g9aPayer1', 1980.00, 'PEN', 'CARD', 'CONFIRMADO', '2026-09-09 10:00:00+00', '2026-09-09 10:01:00+00', '{"status":"succeeded","id":"pi_test_3N82bX2eZvKYlo2C1g9aPayer1"}', NULL),
('f0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000024', '1e000000-0000-4000-8000-000000000024', 'CULQI', 'yape_trx_9481284718_payer2', 1080.00, 'PEN', 'YAPE', 'CONFIRMADO', '2026-09-09 10:00:00+00', '2026-09-09 10:01:00+00', '{"status":"succeeded","id":"yape_trx_9481284718_payer2"}', NULL),
('f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000025', '1e000000-0000-4000-8000-000000000025', 'STRIPE', 'bcp_transf_4819283_payer3', 1000.00, 'PEN', 'TRANSFER', 'CONFIRMADO', '2026-09-09 10:00:00+00', '2026-09-09 10:01:00+00', '{"status":"succeeded","id":"bcp_transf_4819283_payer3"}', NULL),
('f0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000026', '1e000000-0000-4000-8000-000000000026', 'STRIPE', 'pi_test_3N82bX2eZvKYlo2C1g9aPayer4', 765.00, 'PEN', 'CARD', 'CONFIRMADO', '2026-09-09 10:00:00+00', '2026-09-09 10:01:00+00', '{"status":"succeeded","id":"pi_test_3N82bX2eZvKYlo2C1g9aPayer4"}', NULL),
('f0000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000027', '1e000000-0000-4000-8000-000000000027', 'STRIPE', 'pi_test_maria_customer1', 1980.00, 'PEN', 'CARD', 'CONFIRMADO', '2026-09-03 10:00:00+00', '2026-09-03 10:01:00+00', '{"status":"succeeded"}', NULL),
('f0000000-0000-4000-8000-000000000006', 'e0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000028', '1e000000-0000-4000-8000-000000000028', 'STRIPE', 'pi_test_alvaro_customer2', 1980.00, 'PEN', 'CARD', 'CONFIRMADO', '2026-09-03 10:00:00+00', '2026-09-03 10:01:00+00', '{"status":"succeeded"}', NULL),
('f0000000-0000-4000-8000-000000000007', 'e0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000029', '1e000000-0000-4000-8000-000000000029', 'CULQI', 'yape_trx_gabriela_customer3', 1980.00, 'PEN', 'YAPE', 'CONFIRMADO', '2026-09-03 10:00:00+00', '2026-09-03 10:01:00+00', '{"status":"succeeded"}', NULL),
('f0000000-0000-4000-8000-000000000008', 'e0000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000030', '1e000000-0000-4000-8000-000000000030', 'STRIPE', 'bcp_transf_marco_customer4', 1980.00, 'PEN', 'TRANSFER', 'CONFIRMADO', '2026-09-03 10:00:00+00', '2026-09-03 10:01:00+00', '{"status":"succeeded"}', NULL);

-- -----------------------------------------------------------------------------
-- Tabla #36: public."PAYER"
-- -----------------------------------------------------------------------------
INSERT INTO public."PAYER" (id, "buyerId", "leadId", "primerPagoId", "montoTotalPagado", "metodoPrincipal", "fechaConversionPayer", estado) VALUES
('a1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000023', '1e000000-0000-4000-8000-000000000023', 'f0000000-0000-4000-8000-000000000001', 1980.00, 'CARD', '2026-09-09 10:01:00+00', 'ACTIVO'),
('a1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000024', '1e000000-0000-4000-8000-000000000024', 'f0000000-0000-4000-8000-000000000002', 1080.00, 'YAPE', '2026-09-09 10:01:00+00', 'ACTIVO'),
('a1000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000025', '1e000000-0000-4000-8000-000000000025', 'f0000000-0000-4000-8000-000000000003', 1000.00, 'TRANSFER', '2026-09-09 10:01:00+00', 'ACTIVO'),
('a1000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000026', '1e000000-0000-4000-8000-000000000026', 'f0000000-0000-4000-8000-000000000004', 765.00, 'CARD', '2026-09-09 10:01:00+00', 'ACTIVO'),
('a1000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000027', '1e000000-0000-4000-8000-000000000027', 'f0000000-0000-4000-8000-000000000005', 1980.00, 'CARD', '2026-09-03 10:01:00+00', 'ACTIVO'),
('a1000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000028', '1e000000-0000-4000-8000-000000000028', 'f0000000-0000-4000-8000-000000000006', 1980.00, 'CARD', '2026-09-03 10:01:00+00', 'ACTIVO'),
('a1000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000029', '1e000000-0000-4000-8000-000000000029', 'f0000000-0000-4000-8000-000000000007', 1980.00, 'YAPE', '2026-09-03 10:01:00+00', 'ACTIVO'),
('a1000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000030', '1e000000-0000-4000-8000-000000000030', 'f0000000-0000-4000-8000-000000000008', 1980.00, 'TRANSFER', '2026-09-03 10:01:00+00', 'ACTIVO');

-- -----------------------------------------------------------------------------
-- Tabla #37: public."CUSTOMER"
-- -----------------------------------------------------------------------------
INSERT INTO public."CUSTOMER" (id, "buyerId", "leadId", "payerId", "cotizacionId", "servicioId", "asesorId", "fechaInicioServicio", "estadoServicio", observaciones) VALUES
('a2000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000027', '1e000000-0000-4000-8000-000000000027', 'a1000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000007', '77777777-7777-4777-8777-777777777701', '88888888-8888-4888-8888-888888888802', '2026-09-04 09:00:00+00', 'EN_CURSO', 'Datos clínicos recolectados. Requiere análisis inferencial en SPSS y redacción APA 7.'),
('a2000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000028', '1e000000-0000-4000-8000-000000000028', 'a1000000-0000-4000-8000-000000000006', 'e0000000-0000-4000-8000-000000000008', '77777777-7777-4777-8777-777777777701', '88888888-8888-4888-8888-888888888801', '2026-09-04 09:00:00+00', 'EN_CURSO', 'Estudiante con tesis aprobada al 50%. Se coordina avance con Dr. Alva.'),
('a2000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000029', '1e000000-0000-4000-8000-000000000029', 'a1000000-0000-4000-8000-000000000007', 'e0000000-0000-4000-8000-000000000009', '77777777-7777-4777-8777-777777777701', '88888888-8888-4888-8888-888888888802', '2026-09-04 09:00:00+00', 'EN_CURSO', 'Se realizó primera sesión de depuración de variables.'),
('a2000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000030', '1e000000-0000-4000-8000-000000000030', 'a1000000-0000-4000-8000-000000000008', 'e0000000-0000-4000-8000-000000000010', '77777777-7777-4777-8777-777777777701', '88888888-8888-4888-8888-888888888801', '2026-09-04 09:00:00+00', 'EN_CURSO', 'En redacción de resultados y discusión.');

-- -----------------------------------------------------------------------------
-- Tabla #38: public."ASIGNACION_ASESOR"
-- -----------------------------------------------------------------------------
INSERT INTO public."ASIGNACION_ASESOR" (id, "customerId", "asesorId", "fechaAsignacion", motivo, "asignadoPor", activo) VALUES
('8470a4ac-ac0c-45a5-99e4-0b969437d7cf', 'a2000000-0000-4000-8000-000000000001', '88888888-8888-4888-8888-888888888802', '2026-09-04 09:00:00+00', 'Asignación por afinidad de especialidad temática', 'ADMIN', true),
('98579436-1cf4-40fe-addf-34e1d208c1ac', 'a2000000-0000-4000-8000-000000000002', '88888888-8888-4888-8888-888888888801', '2026-09-04 09:00:00+00', 'Asignación por afinidad de especialidad temática', 'ADMIN', true),
('45d82fd2-b3dc-4a12-9777-3cb35c2e232f', 'a2000000-0000-4000-8000-000000000003', '88888888-8888-4888-8888-888888888802', '2026-09-04 09:00:00+00', 'Asignación por afinidad de especialidad temática', 'ADMIN', true),
('5c752267-5829-4efe-b072-439dadc12aeb', 'a2000000-0000-4000-8000-000000000004', '88888888-8888-4888-8888-888888888801', '2026-09-04 09:00:00+00', 'Asignación por afinidad de especialidad temática', 'ADMIN', true);

-- -----------------------------------------------------------------------------
-- Tabla #39: public."SESION"
-- -----------------------------------------------------------------------------
INSERT INTO public."SESION" (id, "customerId", "asesorId", "numeroSesion", "fechaHoraProgramada", "fechaHoraRealizada", "temaTratado", estado, "enlaceReunion", observaciones) VALUES
('4916e649-875f-46b0-8d42-aac0cc57089c', 'a2000000-0000-4000-8000-000000000001', '88888888-8888-4888-8888-888888888802', 1, '2026-09-06 10:00:00+00', '2026-09-06 11:15:00+00', 'Revisión inicial del tema: Prevalencia de factores de riesgo cardiovascular en pacientes post-COVID y definición de cronograma', 'REALIZADA', 'https://meet.google.com/inbestiga-sesion-01', 'Se acordaron entregables para la semana siguiente.'),
('47f214c6-3d36-49f0-a1c5-c6f0dca504d7', 'a2000000-0000-4000-8000-000000000001', '88888888-8888-4888-8888-888888888802', 2, '2026-09-22 16:00:00+00', NULL, 'Revisión del capítulo de metodología, instrumentos y contrastación estadística', 'PROGRAMADA', 'https://meet.google.com/inbestiga-sesion-02', NULL),
('39b50768-7b76-49ba-8dcb-b1ed3c39ad19', 'a2000000-0000-4000-8000-000000000002', '88888888-8888-4888-8888-888888888801', 1, '2026-09-06 10:00:00+00', '2026-09-06 11:15:00+00', 'Revisión inicial del tema: Arquitectura de microservicios con NestJS y Docker para optimización hospitalaria y definición de cronograma', 'REALIZADA', 'https://meet.google.com/inbestiga-sesion-01', 'Se acordaron entregables para la semana siguiente.'),
('72eec982-f93f-41a6-8b1d-e4197cf17118', 'a2000000-0000-4000-8000-000000000002', '88888888-8888-4888-8888-888888888801', 2, '2026-09-22 16:00:00+00', NULL, 'Revisión del capítulo de metodología, instrumentos y contrastación estadística', 'PROGRAMADA', 'https://meet.google.com/inbestiga-sesion-02', NULL),
('69889727-823d-49cb-bfb8-7b56a4097e05', 'a2000000-0000-4000-8000-000000000003', '88888888-8888-4888-8888-888888888802', 1, '2026-09-06 10:00:00+00', '2026-09-06 11:15:00+00', 'Revisión inicial del tema: Biomarcadores de respuesta inflamatoria en pacientes pediátricos y definición de cronograma', 'REALIZADA', 'https://meet.google.com/inbestiga-sesion-01', 'Se acordaron entregables para la semana siguiente.'),
('f894c94e-9ae7-40c1-bf76-3dceb6067ac5', 'a2000000-0000-4000-8000-000000000003', '88888888-8888-4888-8888-888888888802', 2, '2026-09-22 16:00:00+00', NULL, 'Revisión del capítulo de metodología, instrumentos y contrastación estadística', 'PROGRAMADA', 'https://meet.google.com/inbestiga-sesion-02', NULL),
('44d46148-e6a0-470b-93a3-0014ddc42905', 'a2000000-0000-4000-8000-000000000004', '88888888-8888-4888-8888-888888888801', 1, '2026-09-06 10:00:00+00', '2026-09-06 11:15:00+00', 'Revisión inicial del tema: Algoritmos de aprendizaje profundo para detección de fallas en redes eléctricas y definición de cronograma', 'REALIZADA', 'https://meet.google.com/inbestiga-sesion-01', 'Se acordaron entregables para la semana siguiente.'),
('9abfba95-6619-450e-bd70-365fe6397019', 'a2000000-0000-4000-8000-000000000004', '88888888-8888-4888-8888-888888888801', 2, '2026-09-22 16:00:00+00', NULL, 'Revisión del capítulo de metodología, instrumentos y contrastación estadística', 'PROGRAMADA', 'https://meet.google.com/inbestiga-sesion-02', NULL);

-- -----------------------------------------------------------------------------
-- Tabla #40: public."ENCUESTA_SATISFACCION"
-- -----------------------------------------------------------------------------
INSERT INTO public."ENCUESTA_SATISFACCION" (id, "customerId", "asesorId", "calificacionGeneral", "claridadMetodologica", "puntualidadAsesor", comentarios, "fechaRegistro") VALUES
('d116478a-f779-4f7a-a278-d8af6fe24720', 'a2000000-0000-4000-8000-000000000001', '88888888-8888-4888-8888-888888888802', 4.90, 5, 5, 'Excelente dominio bioestadístico en la primera sesión.', '2026-11-12 16:31:22.779347+00'),
('94d4d394-f3e9-4b30-ab8f-101958d02477', 'a2000000-0000-4000-8000-000000000002', '88888888-8888-4888-8888-888888888801', 5.00, 5, 5, 'Muy clara la orientación sobre la arquitectura de microservicios.', '2026-11-12 16:31:22.779347+00'),
('8d7c5d5a-4d1d-433f-a41f-8ac1e358179a', 'a2000000-0000-4000-8000-000000000003', '88888888-8888-4888-8888-888888888802', 4.80, 5, 5, 'Gran acompañamiento metodológico.', '2026-11-12 16:31:22.779347+00'),
('0aa7d5ff-2530-4c4f-ad70-26236a69bdfd', 'a2000000-0000-4000-8000-000000000004', '88888888-8888-4888-8888-888888888801', 4.95, 5, 5, 'Revisión detallada de los modelos de aprendizaje profundo.', '2026-11-12 16:31:22.779347+00');

-- -----------------------------------------------------------------------------
-- Tabla #41: public."HITO_CRONOGRAMA"
-- -----------------------------------------------------------------------------
INSERT INTO public."HITO_CRONOGRAMA" (hito_id, customer_id, entregable_id, capitulo, fecha_pactada, fecha_entrega_real, estado) VALUES
(1, 'a2000000-0000-4000-8000-000000000001', 1, 'Planteamiento del Problema y Matriz', '2026-09-10', '2026-09-09', 'APROBADO'),
(2, 'a2000000-0000-4000-8000-000000000001', 2, 'Marco Teórico y Metodología', '2026-09-25', NULL, 'PENDIENTE'),
(3, 'a2000000-0000-4000-8000-000000000002', 1, 'Planteamiento del Problema y Matriz', '2026-09-10', '2026-09-08', 'APROBADO'),
(4, 'a2000000-0000-4000-8000-000000000002', 2, 'Marco Teórico y Metodología', '2026-09-24', NULL, 'PENDIENTE'),
(5, 'a2000000-0000-4000-8000-000000000003', 1, 'Planteamiento del Problema y Matriz', '2026-09-11', '2026-09-10', 'APROBADO'),
(6, 'a2000000-0000-4000-8000-000000000003', 2, 'Marco Teórico y Metodología', '2026-09-26', NULL, 'PENDIENTE'),
(7, 'a2000000-0000-4000-8000-000000000004', 1, 'Planteamiento del Problema y Matriz', '2026-09-10', '2026-09-09', 'APROBADO'),
(8, 'a2000000-0000-4000-8000-000000000004', 2, 'Marco Teórico y Metodología', '2026-09-25', NULL, 'PENDIENTE');

-- -----------------------------------------------------------------------------
-- Tabla #42: public."CUOTA_PAGO"
-- -----------------------------------------------------------------------------
INSERT INTO public."CUOTA_PAGO" (cuota_id, orden_pago_id, numero_cuota, porcentaje, monto_programado, condicion, fecha_vencimiento, hito_id, version_plan, estado) VALUES
(1, 1, 1, 50.00, 990.00, 'Cuota inicial', '2026-09-21', NULL, 1, 'ENLACE_ENVIADO'),
(2, 1, 2, 50.00, 990.00, 'Cuota por hito', '2026-10-15', NULL, 1, 'ESPERA_HITO'),
(3, 2, 1, 100.00, 1980.00, 'Pago único', '2026-09-15', NULL, 1, 'PAGADA'),
(4, 3, 1, 100.00, 1080.00, 'Pago único', '2026-09-15', NULL, 1, 'PAGADA'),
(5, 4, 1, 50.00, 1000.00, 'Cuota inicial', '2026-09-15', NULL, 1, 'PAGADA'),
(6, 4, 2, 50.00, 1000.00, 'Cuota por hito', '2026-10-10', NULL, 1, 'ESPERA_HITO'),
(7, 5, 1, 100.00, 765.00, 'Pago único', '2026-09-15', NULL, 1, 'PAGADA'),
(8, 6, 1, 100.00, 1980.00, 'Pago único', '2026-09-09', 1, 1, 'PAGADA'),
(9, 7, 1, 100.00, 1980.00, 'Pago único', '2026-09-09', 3, 1, 'PAGADA'),
(10, 8, 1, 100.00, 1980.00, 'Pago único', '2026-09-09', 5, 1, 'PAGADA'),
(11, 9, 1, 100.00, 1980.00, 'Pago único', '2026-09-09', 7, 1, 'PAGADA'),
(12, 13, 1, 100.00, 1620.00, 'Pago único', '2026-09-22', NULL, 1, 'ENLACE_ENVIADO'),
(13, 14, 1, 30.00, 669.60, 'Cuota inicial', '2026-09-22', NULL, 1, 'ENLACE_ENVIADO'),
(14, 14, 2, 40.00, 892.80, 'Cuota por hito', '2026-10-15', NULL, 1, 'ESPERA_HITO'),
(15, 14, 3, 30.00, 669.60, 'Cuota por hito', '2026-11-15', NULL, 1, 'ESPERA_HITO'),
(16, 15, 1, 20.00, 733.20, 'Cuota inicial', '2026-09-22', NULL, 1, 'ENLACE_ENVIADO'),
(17, 15, 2, 16.00, 586.56, 'Cuota por hito', '2026-10-15', NULL, 1, 'ESPERA_HITO');

-- -----------------------------------------------------------------------------
-- Tabla #43: public."ENLACE_PAGO"
-- -----------------------------------------------------------------------------
INSERT INTO public."ENLACE_PAGO" (enlace_id, orden_pago_id, cuota_id, medio_pago_id, referencia_externa, url_enlace, monto, fecha_envio, fecha_expiracion, estado) VALUES
(1, 1, 1, 3, 'lnk_culqi_ord_0002_c1', 'https://express.culqi.com/pago/1E696A426C?ord=ORD-2026-0002', 990.00, '2026-09-14 09:20:00+00', '2026-09-21 09:20:00+00', 'ENVIADO'),
(2, 2, 3, 3, 'lnk_stripe_ord_0003_c1', 'https://express.culqi.com/pago/1E696A426C?ord=ORD-2026-0003', 1980.00, '2026-09-08 10:05:00+00', '2026-09-15 10:05:00+00', 'PAGADO'),
(3, 3, 4, 1, 'lnk_culqi_ord_0004_c1', 'https://express.culqi.com/pago/1E696A426C?ord=ORD-2026-0004', 1080.00, '2026-09-08 10:05:00+00', '2026-09-15 10:05:00+00', 'PAGADO'),
(4, 4, 5, 4, 'lnk_bcp_ord_0005_c1', 'https://express.culqi.com/pago/1E696A426C?ord=ORD-2026-0005', 1000.00, '2026-09-08 10:05:00+00', '2026-09-15 10:05:00+00', 'PAGADO'),
(5, 5, 7, 3, 'lnk_stripe_ord_0006_c1', 'https://express.culqi.com/pago/1E696A426C?ord=ORD-2026-0006', 765.00, '2026-09-08 10:05:00+00', '2026-09-15 10:05:00+00', 'PAGADO'),
(6, 6, 8, 3, 'lnk_stripe_ord_0007_c1', 'https://express.culqi.com/pago/1E696A426C?ord=ORD-2026-0007', 1980.00, '2026-09-02 10:05:00+00', '2026-09-09 10:05:00+00', 'PAGADO'),
(7, 7, 9, 3, 'lnk_stripe_ord_0008_c1', 'https://express.culqi.com/pago/1E696A426C?ord=ORD-2026-0008', 1980.00, '2026-09-02 10:05:00+00', '2026-09-09 10:05:00+00', 'PAGADO'),
(8, 8, 10, 1, 'lnk_culqi_ord_0009_c1', 'https://express.culqi.com/pago/1E696A426C?ord=ORD-2026-0009', 1980.00, '2026-09-02 10:05:00+00', '2026-09-09 10:05:00+00', 'PAGADO'),
(9, 9, 11, 4, 'lnk_bcp_ord_0010_c1', 'https://express.culqi.com/pago/1E696A426C?ord=ORD-2026-0010', 1980.00, '2026-09-02 10:05:00+00', '2026-09-09 10:05:00+00', 'PAGADO');

-- -----------------------------------------------------------------------------
-- Tabla #44: public."VOUCHER"
-- -----------------------------------------------------------------------------
INSERT INTO public."VOUCHER" (voucher_id, pago_id, orden_pago_id, cuota_id, referencia_operacion, archivo_url, hash_imagen, monto_ocr, banco_ocr, estado, motivo_rechazo, verificado_por_asesor_id, fecha_carga, fecha_verificacion) VALUES
(1, 'f0000000-0000-4000-8000-000000000003', 4, 5, 'BCP-4819283', 'https://inbestiga.tesis/vouchers/bcp_4819283.jpg', 'sha256_voucher_rodrigo_0005', 1000.00, 'BCP', 'VERIFICADO', NULL, '88888888-8888-4888-8888-888888888804', '2026-09-09 09:55:00+00', '2026-09-09 10:01:00+00'),
(2, 'f0000000-0000-4000-8000-000000000008', 9, 11, 'BCP-9918273', 'https://inbestiga.tesis/vouchers/bcp_9918273.jpg', 'sha256_voucher_marco_0010', 1980.00, 'BCP', 'VERIFICADO', NULL, '88888888-8888-4888-8888-888888888804', '2026-09-03 09:50:00+00', '2026-09-03 10:01:00+00');

-- -----------------------------------------------------------------------------
-- Tabla #45: public."EVENTO_WEBHOOK"
-- -----------------------------------------------------------------------------
INSERT INTO public."EVENTO_WEBHOOK" (evento_id, pago_id, proveedor, tipo_evento, referencia_externa, firma_hmac, firma_valida, fecha_recepcion, procesado, detalle) VALUES
(1, 'f0000000-0000-4000-8000-000000000001', 'Stripe', 'payment_intent.succeeded', 'evt_stripe_payer1', 'hmac_sha256_valid_01', true, '2026-11-12 16:31:22.779347+00', true, 'Pago confirmado automáticamente por Webhook'),
(2, 'f0000000-0000-4000-8000-000000000002', 'Culqi', 'charge.succeeded', 'evt_culqi_payer2', 'hmac_sha256_valid_02', true, '2026-11-12 16:31:22.779347+00', true, 'Pago Yape confirmado automáticamente por Webhook'),
(3, 'f0000000-0000-4000-8000-000000000004', 'Stripe', 'payment_intent.succeeded', 'evt_stripe_payer4', 'hmac_sha256_valid_04', true, '2026-11-12 16:31:22.779347+00', true, 'Pago confirmado automáticamente por Webhook'),
(4, 'f0000000-0000-4000-8000-000000000005', 'Stripe', 'payment_intent.succeeded', 'evt_stripe_cust1', 'hmac_sha256_valid_05', true, '2026-11-12 16:31:22.779347+00', true, 'Pago confirmado automáticamente por Webhook'),
(5, 'f0000000-0000-4000-8000-000000000006', 'Stripe', 'payment_intent.succeeded', 'evt_stripe_cust2', 'hmac_sha256_valid_06', true, '2026-11-12 16:31:22.779347+00', true, 'Pago confirmado automáticamente por Webhook'),
(6, 'f0000000-0000-4000-8000-000000000007', 'Culqi', 'charge.succeeded', 'evt_culqi_cust3', 'hmac_sha256_valid_07', true, '2026-11-12 16:31:22.779347+00', true, 'Pago Yape confirmado automáticamente por Webhook');

-- -----------------------------------------------------------------------------
-- Tabla #46: public."ALERTA_COBRANZA"
-- -----------------------------------------------------------------------------
INSERT INTO public."ALERTA_COBRANZA" (alerta_cobranza_id, orden_pago_id, cuota_id, plantilla_msg_id, fecha_envio, secuencia, tipo, resultado, escalado, motivo_pausa) VALUES
(1, 1, 1, 1, '2026-09-14 13:20:00+00', 'Recordatorio 4 h', 'Orden sin pago', 'ENVIADO', false, NULL),
(2, 4, 6, 2, '2026-09-15 10:00:00+00', 'Recordatorio 24 h', 'Cuota de hito pendiente', 'ENVIADO', false, NULL);

-- -----------------------------------------------------------------------------
-- Tabla #47: public."OBJECION_PAGO"
-- -----------------------------------------------------------------------------
INSERT INTO public."OBJECION_PAGO" (objecion_pago_id, orden_pago_id, tipo, resumen, veces_repetida, resuelta, fecha_registro) VALUES
(1, 1, 'PAGO_EN_CUOTAS', 'Consulta sobre cronograma de vencimiento de la segunda cuota.', 1, true, '2026-11-12 16:31:22.779347+00');

-- Sincronización de secuencias SERIAL
SELECT setval(pg_get_serial_sequence('public."MODALIDAD_PAGO"', 'modalidad_pago_id'), COALESCE((SELECT MAX(modalidad_pago_id) FROM public."MODALIDAD_PAGO"), 1));
SELECT setval(pg_get_serial_sequence('public."MEDIO_PAGO"', 'medio_pago_id'), COALESCE((SELECT MAX(medio_pago_id) FROM public."MEDIO_PAGO"), 1));
SELECT setval(pg_get_serial_sequence('public."PLANTILLA_CONTRATO"', 'plantilla_contrato_id'), COALESCE((SELECT MAX(plantilla_contrato_id) FROM public."PLANTILLA_CONTRATO"), 1));
SELECT setval(pg_get_serial_sequence('public."ENTREGABLE"', 'entregable_id'), COALESCE((SELECT MAX(entregable_id) FROM public."ENTREGABLE"), 1));
SELECT setval(pg_get_serial_sequence('public."PLANTILLA_MENSAJE"', 'plantilla_msg_id'), COALESCE((SELECT MAX(plantilla_msg_id) FROM public."PLANTILLA_MENSAJE"), 1));
SELECT setval(pg_get_serial_sequence('public."POLITICA_COBRANZA"', 'politica_id'), COALESCE((SELECT MAX(politica_id) FROM public."POLITICA_COBRANZA"), 1));
SELECT setval(pg_get_serial_sequence('public."CONFIG_PARAMETRO"', 'parametro_id'), COALESCE((SELECT MAX(parametro_id) FROM public."CONFIG_PARAMETRO"), 1));
SELECT setval(pg_get_serial_sequence('public."RESPONSABLE_PAGO"', 'responsable_pago_id'), COALESCE((SELECT MAX(responsable_pago_id) FROM public."RESPONSABLE_PAGO"), 1));
SELECT setval(pg_get_serial_sequence('public."CONTRATO"', 'contrato_id'), COALESCE((SELECT MAX(contrato_id) FROM public."CONTRATO"), 1));
SELECT setval(pg_get_serial_sequence('public."ORDEN_PAGO"', 'orden_pago_id'), COALESCE((SELECT MAX(orden_pago_id) FROM public."ORDEN_PAGO"), 1));
SELECT setval(pg_get_serial_sequence('public."HITO_CRONOGRAMA"', 'hito_id'), COALESCE((SELECT MAX(hito_id) FROM public."HITO_CRONOGRAMA"), 1));
SELECT setval(pg_get_serial_sequence('public."CUOTA_PAGO"', 'cuota_id'), COALESCE((SELECT MAX(cuota_id) FROM public."CUOTA_PAGO"), 1));
SELECT setval(pg_get_serial_sequence('public."ENLACE_PAGO"', 'enlace_id'), COALESCE((SELECT MAX(enlace_id) FROM public."ENLACE_PAGO"), 1));
SELECT setval(pg_get_serial_sequence('public."VOUCHER"', 'voucher_id'), COALESCE((SELECT MAX(voucher_id) FROM public."VOUCHER"), 1));
SELECT setval(pg_get_serial_sequence('public."EVENTO_WEBHOOK"', 'evento_id'), COALESCE((SELECT MAX(evento_id) FROM public."EVENTO_WEBHOOK"), 1));
SELECT setval(pg_get_serial_sequence('public."ALERTA_COBRANZA"', 'alerta_cobranza_id'), COALESCE((SELECT MAX(alerta_cobranza_id) FROM public."ALERTA_COBRANZA"), 1));
SELECT setval(pg_get_serial_sequence('public."OBJECION_PAGO"', 'objecion_pago_id'), COALESCE((SELECT MAX(objecion_pago_id) FROM public."OBJECION_PAGO"), 1));

COMMIT;
