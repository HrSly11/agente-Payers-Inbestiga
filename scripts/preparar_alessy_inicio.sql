-- ======================================================================
-- INBESTIGA.TESIS - Script de Preparación de Prueba para Alessy Tania
-- Estado Inicial: Orden Activa con Enlace Enviado (Cuota 1 pendiente)
-- ======================================================================
USE INBESTIGA_TESIS;
GO

BEGIN TRANSACTION;

-- 1. Limpieza de datos posteriores (para que empiece de cero, sin pagos previos)
DELETE FROM REPORTE_CALIDAD WHERE hito_id IN (SELECT hito_id FROM HITO_CRONOGRAMA WHERE customer_id = 1);
DELETE FROM HITO_CRONOGRAMA WHERE customer_id = 1;
DELETE FROM ASIGNACION_ASESOR WHERE customer_id = 1;
DELETE FROM SESION WHERE customer_id = 1;
DELETE FROM ENCUESTA_SATISFACCION WHERE customer_id = 1;
DELETE FROM HONORARIO WHERE customer_id = 1;
DELETE FROM CUSTOMER WHERE customer_id = 1;
DELETE FROM PAYER WHERE orden_pago_id = 1;
DELETE FROM PAGO WHERE orden_pago_id = 1;
DELETE FROM VOUCHER WHERE orden_pago_id = 1;
DELETE FROM ALERTA_COBRANZA WHERE orden_pago_id = 1;
DELETE FROM EJECUCION_HERRAMIENTA WHERE orden_pago_id = 1;
DELETE FROM MENSAJE WHERE conversacion_id = 1;

-- 2. Asegurar datos de contacto de Alessy Tania
UPDATE CONTACTO
SET nombres = 'Alessy',
    apellidos = 'Tania',
    telefono = '51994910334',
    email = 'estudiante1@unitru.edu.pe',
    telegram_username = 'Tania',
    telegram_chat_id = '8373142486',
    consentimiento = 1,
    no_contactar = 0
WHERE contacto_id = 1;

-- 3. Estado de la Orden de Pago: ENLACE_ENVIADO (S/ 1,620.00 comprometidos)
UPDATE ORDEN_PAGO
SET estado = 'ENLACE_ENVIADO',
    modalidad_pago_id = 2, -- 3 cuotas 30/40/30
    en_mora = 0,
    servicio_suspendido_mora = 0
WHERE orden_pago_id = 1;

-- 4. Plan de Cuotas: Cuota 1 en ENLACE_ENVIADO, Cuotas 2 y 3 en ESPERA_HITO
UPDATE CUOTA_PAGO SET estado = 'ENLACE_ENVIADO', monto_programado = 486.00, porcentaje = 30.00, condicion = 'Cuota inicial' WHERE orden_pago_id = 1 AND numero_cuota = 1;
UPDATE CUOTA_PAGO SET estado = 'ESPERA_HITO', monto_programado = 648.00, porcentaje = 40.00, condicion = 'Cuota por hito' WHERE orden_pago_id = 1 AND numero_cuota = 2;
UPDATE CUOTA_PAGO SET estado = 'ESPERA_HITO', monto_programado = 486.00, porcentaje = 30.00, condicion = 'Cuota por hito' WHERE orden_pago_id = 1 AND numero_cuota = 3;
DELETE FROM CUOTA_PAGO WHERE orden_pago_id = 1 AND numero_cuota > 3;

-- 5. Enlace Oficial de Mercado Pago Checkout Pro
IF NOT EXISTS (SELECT 1 FROM ENLACE_PAGO WHERE orden_pago_id = 1 AND cuota_id = 127)
BEGIN
    INSERT INTO ENLACE_PAGO (orden_pago_id, cuota_id, medio_pago_id, referencia_externa, url_enlace, monto, fecha_envio, fecha_expiracion, estado)
    VALUES (1, 127, 3, 'lnk_alessy_001_initial', 'https://www.mercadopago.com.pe/checkout/v1/redirect?pref_id=3202143111-912ff791-b9ff-417b-835f-39cf760966eb', 486.00, GETDATE(), DATEADD(DAY, 7, GETDATE()), 'ENVIADO');
END
ELSE
BEGIN
    UPDATE ENLACE_PAGO
    SET estado = 'ENVIADO',
        monto = 486.00,
        url_enlace = 'https://www.mercadopago.com.pe/checkout/v1/redirect?pref_id=3202143111-912ff791-b9ff-417b-835f-39cf760966eb'
    WHERE orden_pago_id = 1 AND cuota_id = 127;
END;

COMMIT TRANSACTION;
GO

PRINT '✓ Alessy Tania configurada exitosamente como estudiante inicial (Enlace Enviado, Cuota 1: S/ 486.00)';
GO
