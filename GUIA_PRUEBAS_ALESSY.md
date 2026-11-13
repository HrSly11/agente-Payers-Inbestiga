# 🎓 Guía de Pruebas Rápidas — Alessy Tania (INBESTIGA · PAYERS v2.0)

Esta guía detalla cómo probar el sistema completo desde otra máquina para la usuaria **Alessy Tania**, simulando el recorrido exacto de un tesista desde la recepción de su enlace hasta la habilitación por hitos.

---

## 🚀 1. Cómo Iniciar el Sistema en Otra Máquina

### Requisitos Previos:
- **Node.js v20+** instalado ([Descargar aquí](https://nodejs.org/)).
- **Git** instalado.

### Pasos Rápidos:
1. Clona el repositorio:
   ```bash
   git clone https://github.com/HrSly11/agente-Payers-Inbestiga.git
   cd agente-Payers-Inbestiga
   ```
2. Ejecuta el script de inicio automático con doble clic o desde terminal:
   ```cmd
   iniciar_demo_alessy.bat
   ```
   *(O en PowerShell: `.\iniciar_demo_alessy.ps1`)*

El script instalará las dependencias y levantará automáticamente:
- **Backend API (NestJS):** `http://localhost:4000/api/v1`
- **Frontend Web (Next.js):** `http://localhost:3000/`

---

## 👤 2. Datos de Prueba del Expediente

| Campo | Valor de Prueba |
| :--- | :--- |
| **Tesista / Estudiante** | **Alessy Tania** |
| **Universidad** | Universidad Nacional de Trujillo (UNT) |
| **Carrera** | Ingeniería de Sistemas |
| **Teléfono Registrado** | `51994910334` *(o `994910334`)* |
| **Código de Orden** | `ORD-2026-0001` |
| **Monto Total del Contrato** | S/ 1,620.00 |
| **Modalidad de Pago** | 3 cuotas (30% / 40% / 30%) |
| **Cuota Inicial (#1)** | **S/ 486.00** (`ENLACE_ENVIADO`) |
| **Cuotas #2 y #3** | S/ 648.00 y S/ 486.00 (`ESPERA_HITO`) |

---

## 🧪 3. Escenarios de Prueba para Alessy

### Escenario A: Portal del Tesista (Vista Estudiante)
1. Ingresa a `http://localhost:3000/`.
2. Haz clic en **"Portal del Tesista"** o **"Iniciar Sesión"**.
3. Selecciona **"Soy Estudiante / Tesista"** e ingresa con su teléfono:
   - **Celular:** `51994910334` (o `994910334`).
4. Verás la bienvenida personalizada:
   - *«Hola, Alessy Tania: tu Tesis de Grado y Sustentación con Garantía por Hitos»*.
   - Verás tu expediente activo (`ORD-2026-0001`), tu asesor asignado y el botón para chatear con el Bot en Telegram.

### Escenario B: Chat Interactivo con el Bot de Telegram
1. Abre Telegram y busca al bot oficial: **[@inbestiga_tesis_bot](https://t.me/inbestiga_tesis_bot)**.
2. Escribe `/start`.
3. El bot te reconocerá como **Alessy Tania** y te informará:
   - Que tu cuota inicial (#1) por **S/ 486.00** está lista para abonar.
   - Te enviará el enlace oficial de la pasarela **Mercado Pago Checkout Pro**.
4. Puedes interactuar por texto o **notas de voz** preguntándole:
   - *«¿Cuánto es mi cuota inicial y cómo la pago?»*
   - *«¿Se puede fraccionar en más cuotas?»*
   - *«¿Quién es mi asesor asignado?»*

### Escenario C: Pago Simulado en Pasarela Oficial
1. Abre el checkout directo: `http://localhost:3000/checkout/ORD-2026-0001`.
2. O usa el enlace oficial de Mercado Pago: [Pagar Cuota 1 en Mercado Pago](https://www.mercadopago.com.pe/checkout/v1/redirect?pref_id=3202143111-912ff791-b9ff-417b-835f-39cf760966eb).
3. Tras abonar la cuota inicial, el bot te notificará la acreditación (HTTP 200 OK), activando tu fase **CUSTOMER** e inducción con tu asesor.

### Escenario D: Panel de Administración (Vista Administrador)
1. En la barra superior, cambia al rol **ADMIN**.
2. Ve a **Cobranza & Pasarela ▾ -> Comprobantes**:
   - Revisa las boletas emitidas con botón **"Previsualizar Boleta"** (formato oficial SUNAT / SUNEDU con descarga en PDF).
3. Ve a **Hitos & Asesor**:
   - Monitorea el avance de la cohorte, la bitácora metodológica y el desbloqueo de hitos para habilitar las siguientes cuotas.
