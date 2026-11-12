-- =============================================================================
-- INBESTIGA.TESIS - Transaccional: FASE 4 — CUSTOMERS (Atención y Bitácora)
-- Conforme a la Sección 6 del Informe Académico (pág. 24-28, Figuras 6 y Mockups)
-- Tablas: ASESOR, CUSTOMER, ASIGNACION_ASESOR, SESION
-- =============================================================================

USE inbestiga_db;
GO

-- 1. ASESOR (Cuerpo docente y especialistas: Doctores y Magísteres)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ASESOR')
BEGIN
    CREATE TABLE dbo.ASESOR (
        id NVARCHAR(50) PRIMARY KEY,
        nombres NVARCHAR(100) NOT NULL,
        apellidos NVARCHAR(100) NOT NULL,
        especialidad NVARCHAR(200) NOT NULL,
        gradoAcademico NVARCHAR(50) NOT NULL, -- DOCTOR, MAGISTER, LICENCIADO
        email NVARCHAR(150) NOT NULL UNIQUE,
        whatsapp NVARCHAR(50) NOT NULL,
        maxClientesSimultaneos INT NOT NULL DEFAULT 10,
        clientesActivos INT NOT NULL DEFAULT 0,
        activo BIT NOT NULL DEFAULT 1
    );
    PRINT '✓ Tabla ASESOR creada exitosamente.';
END
GO

-- 2. CUSTOMER (Tesista activo con servicio de asesoría y expediente en marcha)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CUSTOMER')
BEGIN
    CREATE TABLE dbo.CUSTOMER (
        id NVARCHAR(50) PRIMARY KEY,
        buyerId NVARCHAR(50) NOT NULL UNIQUE FOREIGN KEY REFERENCES dbo.BUYER(id) ON DELETE CASCADE,
        leadId NVARCHAR(50) NULL UNIQUE FOREIGN KEY REFERENCES dbo.LEAD(id),
        payerId NVARCHAR(50) NOT NULL UNIQUE FOREIGN KEY REFERENCES dbo.PAYER(id),
        cotizacionId NVARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.COTIZACION(id),
        servicioId NVARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.SERVICIO(id),
        asesorId NVARCHAR(50) NULL FOREIGN KEY REFERENCES dbo.ASESOR(id),
        fechaInicioServicio DATETIME2 NOT NULL DEFAULT GETDATE(),
        estadoServicio NVARCHAR(50) NOT NULL DEFAULT 'ACTIVO', -- ACTIVO, EN_CURSO, FINALIZADO, PAUSADO
        observaciones NVARCHAR(MAX) NULL
    );
    PRINT '✓ Tabla CUSTOMER creada exitosamente.';
END
GO

-- 3. ASIGNACION_ASESOR (Historial de emparejamiento académico asesor-tesista)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ASIGNACION_ASESOR')
BEGIN
    CREATE TABLE dbo.ASIGNACION_ASESOR (
        id NVARCHAR(50) PRIMARY KEY,
        customerId NVARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.CUSTOMER(id) ON DELETE CASCADE,
        asesorId NVARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.ASESOR(id),
        fechaAsignacion DATETIME2 NOT NULL DEFAULT GETDATE(),
        motivo NVARCHAR(500) NULL,
        asignadoPor NVARCHAR(50) NOT NULL DEFAULT 'SISTEMA', -- SISTEMA, COORDINADOR
        activo BIT NOT NULL DEFAULT 1
    );
    PRINT '✓ Tabla ASIGNACION_ASESOR creada exitosamente.';
END
GO

-- 4. SESION (Bitácora de asesorías, actas de avance y revisión de capítulos)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SESION')
BEGIN
    CREATE TABLE dbo.SESION (
        id NVARCHAR(50) PRIMARY KEY,
        customerId NVARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.CUSTOMER(id) ON DELETE CASCADE,
        asesorId NVARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.ASESOR(id),
        numeroSesion INT NOT NULL DEFAULT 1,
        fechaHoraProgramada DATETIME2 NOT NULL,
        fechaHoraRealizada DATETIME2 NULL,
        temaTratado NVARCHAR(250) NOT NULL,
        estado NVARCHAR(50) NOT NULL DEFAULT 'PROGRAMADA', -- PROGRAMADA, REALIZADA, REPROGRAMADA, CANCELADA
        enlaceReunion NVARCHAR(500) NULL,
        observaciones NVARCHAR(MAX) NULL
    );
    PRINT '✓ Tabla SESION creada exitosamente.';
END
GO

-- 5. ENCUESTA_SATISFACCION (Calificación del estudiante y CSAT post-servicio/post-sesión)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ENCUESTA_SATISFACCION')
BEGIN
    CREATE TABLE dbo.ENCUESTA_SATISFACCION (
        id NVARCHAR(100) PRIMARY KEY,
        customerId NVARCHAR(1000) NOT NULL FOREIGN KEY REFERENCES dbo.CUSTOMER(id) ON DELETE CASCADE,
        asesorId NVARCHAR(1000) NOT NULL FOREIGN KEY REFERENCES dbo.ASESOR(id),
        calificacionGeneral DECIMAL(3,2) NOT NULL, -- 1.00 a 5.00 estrellas
        claridadMetodologica INT NOT NULL DEFAULT 5, -- 1 a 5
        puntualidadAsesor INT NOT NULL DEFAULT 5, -- 1 a 5
        comentarios NVARCHAR(MAX) NULL,
        fechaRegistro DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    PRINT '✓ Tabla ENCUESTA_SATISFACCION creada exitosamente.';
END
GO
