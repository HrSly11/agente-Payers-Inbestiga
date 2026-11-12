/* ============================================================================
   07_PATCH_NOMBRES_ESTUDIANTES.sql
   Reemplaza los nombres genéricos ("Estudiante N" / "Apellido N") de
   INBESTIGA_TESIS.dbo.CONTACTO por nombres peruanos realistas (deterministas
   por contacto_id) y define a los 3 estudiantes reales de prueba con sus
   números de WhatsApp reales:

     - contacto_id 44 -> Harry Sánchez      (orden ORD-2026-0044 / +51 919632928)
     - contacto_id 65 -> Samira Miguel      (orden ORD-2026-0065 / +51 956092165)
     - contacto_id 81 -> Ricardo Velasquez   (orden ORD-2026-0081 / +51 961103226)

   La vista INBESTIGA_MART.dbo.vw_rpayers_ordenes_detalle (que alimenta el
   Live Chat) lee CONTACTO en vivo, por lo que NO requiere re-ejecutar el ETL.

   Idempotente: puede ejecutarse varias veces sin efectos secundarios.
   Ejecutar con codificación UTF-8:  sqlcmd ... -f 65001
============================================================================ */
USE INBESTIGA_TESIS;
GO
SET NOCOUNT ON;
GO

DECLARE @Nombres TABLE (idx INT PRIMARY KEY, valor NVARCHAR(60));
INSERT INTO @Nombres (idx, valor) VALUES
 (1,'Ana'),(2,'Luis'),(3,'María'),(4,'Jorge'),(5,'Carla'),
 (6,'Diego'),(7,'Sofía'),(8,'Miguel'),(9,'Valeria'),(10,'Andrés'),
 (11,'Camila'),(12,'Renato'),(13,'Lucía'),(14,'Bryan'),(15,'Fiorella'),
 (16,'Kevin'),(17,'Andrea'),(18,'Sebastián'),(19,'Paola'),(20,'Jhonatan'),
 (21,'Gabriela'),(22,'Álvaro'),(23,'Melissa'),(24,'Bruno'),(25,'Angie'),
 (26,'Rodrigo'),(27,'Yesenia'),(28,'Cristian'),(29,'Nicole'),(30,'Fabrizio'),
 (31,'Rosa'),(32,'Marco'),(33,'Sandra'),(34,'Piero'),(35,'Katherine'),
 (36,'Julio'),(37,'Milagros'),(38,'Renzo'),(39,'Diana'),(40,'César'),
 (41,'Sheyla'),(42,'Giancarlo'),(43,'Alessandra'),(44,'Hugo'),(45,'Brenda'),
 (46,'Enzo'),(47,'Yadira'),(48,'Aldo'),(49,'Pamela'),(50,'Víctor');

DECLARE @Apellidos TABLE (idx INT PRIMARY KEY, valor NVARCHAR(60));
INSERT INTO @Apellidos (idx, valor) VALUES
 (1,'Quispe'),(2,'Flores'),(3,'Huamán'),(4,'García'),(5,'Rodríguez'),
 (6,'Rojas'),(7,'Vargas'),(8,'Chávez'),(9,'Ramos'),(10,'Vásquez'),
 (11,'Salazar'),(12,'Mendoza'),(13,'Castillo'),(14,'Espinoza'),(15,'Gutiérrez'),
 (16,'Cruz'),(17,'Ríos'),(18,'Paredes'),(19,'Silva'),(20,'Díaz'),
 (21,'Ruiz'),(22,'Campos'),(23,'Suárez'),(24,'Mamani'),(25,'Álvarez'),
 (26,'Fernández'),(27,'Torres'),(28,'Reyes'),(29,'Gómez'),(30,'Sánchez'),
 (31,'Medina'),(32,'Cordero'),(33,'Zavaleta'),(34,'Lozano'),(35,'Delgado'),
 (36,'Acosta'),(37,'Cabrera'),(38,'Núñez'),(39,'Vega'),(40,'Peralta'),
 (41,'Cáceres'),(42,'Bautista'),(43,'Villanueva'),(44,'Carrasco'),(45,'Aguirre'),
 (46,'Palacios'),(47,'Bejarano'),(48,'Ticona'),(49,'Yupanqui'),(50,'Ancco');

-- 1. Nombres realistas peruanos (deterministas por contacto_id)
UPDATE ct
SET ct.nombres = n.valor,
    ct.apellidos = a.valor
FROM dbo.CONTACTO ct
INNER JOIN @Nombres   n ON n.idx = (ct.contacto_id % 50) + 1
INNER JOIN @Apellidos a ON a.idx = ((ct.contacto_id * 7) % 50) + 1;

-- 2. Los 3 estudiantes reales de prueba (con su WhatsApp real)
UPDATE dbo.CONTACTO SET nombres = N'Harry',   apellidos = N'Sánchez',   telefono = '51919632928' WHERE contacto_id = 44;
UPDATE dbo.CONTACTO SET nombres = N'Samira',  apellidos = N'Miguel',    telefono = '51956092165' WHERE contacto_id = 65;
UPDATE dbo.CONTACTO SET nombres = N'Ricardo', apellidos = N'Velasquez', telefono = '51961103226' WHERE contacto_id = 81;
GO

PRINT 'PATCH DE NOMBRES DE ESTUDIANTES APLICADO.';
GO

SELECT TOP 5 contacto_id, nombres, apellidos, telefono FROM dbo.CONTACTO WHERE contacto_id IN (44, 65, 81) ORDER BY contacto_id;
GO
