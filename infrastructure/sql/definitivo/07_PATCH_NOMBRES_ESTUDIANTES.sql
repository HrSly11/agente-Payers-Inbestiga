-- ============================================================================
-- Script 07: Nombres reales peruanos para todos los estudiantes de CONTACTO
-- Preserva intactos a contacto_id = 1 (Alessy Tania) y 42 (Harry Sánchez)
-- Ejecutar con UTF-8: sqlcmd -S localhost -E -C -f 65001 -i 07_PATCH_NOMBRES_ESTUDIANTES.sql
-- ============================================================================
USE INBESTIGA_TESIS;
GO

SET NOCOUNT ON;

DECLARE @Nombres TABLE (idx INT IDENTITY(0,1), val NVARCHAR(100));
INSERT INTO @Nombres (val) VALUES
(N'Lucía Fernanda'),(N'Mateo Sebastián'),(N'Valeria Sofía'),(N'Diego Alonso'),
(N'Camila Alejandra'),(N'Adrián Nicolás'),(N'Jimena Valentina'),(N'Joaquín Andrés'),
(N'Gabriela Isabel'),(N'Rodrigo Alejandro'),(N'Estefanía Paola'),(N'Gonzalo Martín'),
(N'Mariana Beatriz'),(N'Renzo Mauricio'),(N'Claudia Ximena'),(N'Álvaro Eduardo'),
(N'Brenda Carolina'),(N'César Augusto'),(N'Verónica Milagros'),(N'Raúl Ernesto'),
(N'Fabián Marcelo'),(N'Paloma Andrea'),(N'Iván Gustavo'),(N'Mónica Patricia'),
(N'Óscar Enrique'),(N'Daniela Rocío'),(N'Fernando José'),(N'Katherin Lucero'),
(N'Bruno Leonardo'),(N'Fiorella Celeste'),(N'Humberto Rafael'),(N'Natalia Alessandra');

DECLARE @ApellidosPat TABLE (idx INT IDENTITY(0,1), val NVARCHAR(80));
INSERT INTO @ApellidosPat (val) VALUES
(N'Quispe'),(N'Rojas'),(N'Paredes'),(N'Chávez'),(N'Castillo'),(N'Huamán'),
(N'Mendoza'),(N'Torres'),(N'Salazar'),(N'Vargas'),(N'Vásquez'),(N'Ramírez'),
(N'Rodríguez'),(N'Gonzáles'),(N'Morales'),(N'Gutiérrez'),(N'Pérez'),(N'García'),
(N'Ortega'),(N'Delgado'),(N'Espinoza'),(N'Silva'),(N'Castro'),(N'Romero'),
(N'Ruiz'),(N'Herrera'),(N'Medina'),(N'Aguilar'),(N'Cruz'),(N'Reyes'),(N'Cárdenas');

DECLARE @ApellidosMat TABLE (idx INT IDENTITY(0,1), val NVARCHAR(80));
INSERT INTO @ApellidosMat (val) VALUES
(N'Alvarado'),(N'Bautista'),(N'Carrillo'),(N'Domínguez'),(N'Escobar'),
(N'Fernández'),(N'Guerrero'),(N'Hidalgo'),(N'Ibarra'),(N'Juárez'),
(N'León'),(N'Montoya'),(N'Navarro'),(N'Olivares'),(N'Pacheco'),
(N'Quiroz'),(N'Sarmiento');

UPDATE c
SET
    c.nombres = n.val,
    c.apellidos = CONCAT(ap.val, N' ', am.val)
FROM INBESTIGA_TESIS.dbo.CONTACTO c
INNER JOIN @Nombres n
    ON n.idx = (c.contacto_id * 7 + 3) % 32
INNER JOIN @ApellidosPat ap
    ON ap.idx = (c.contacto_id * 11 + 5) % 31
INNER JOIN @ApellidosMat am
    ON am.idx = (c.contacto_id * 5 + 2) % 17
WHERE c.contacto_id NOT IN (1, 42);

SELECT
    COUNT(*) AS total_contactos,
    SUM(CASE WHEN nombres LIKE 'Estudiante %' OR apellidos LIKE 'Apellido %' THEN 1 ELSE 0 END) AS genericos_restantes
FROM INBESTIGA_TESIS.dbo.CONTACTO;

SELECT TOP 10 contacto_id, nombres, apellidos, telefono
FROM INBESTIGA_TESIS.dbo.CONTACTO
ORDER BY CASE WHEN contacto_id IN (1, 42) THEN 0 ELSE 1 END, contacto_id;
GO
