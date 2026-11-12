# INBESTIGA · PAYERS v2.0 — Autonomous Collection & Milestone Activation Agent

Dedicated repository for the **PAYERS (Phase 3)** AI Agent ecosystem of **INBESTIGA.TESIS**, integrating:

- **Deterministic + LLM Collection Agent (`PayersService` + Gemini 3 Flash)**: Enforces business rules `RN-01`..`RN-10` with 11 specialized tools and 0% payment hallucination.
- **Mercado Pago Checkout Pro (`MPE` - Peru Soles)**: Official payment preference generation, real-time payment verification, and automatic customer service activation (`PAYER` -> `CUSTOMER`).
- **Bidirectional Telegram Bot (`@inbestiga_tesis_bot`) & Web Live Chat**: Synchronized conversation history in `INBESTIGA_TESIS.dbo.MENSAJE`, phone verification, and proactive payment notifications.
- **Option B Milestone-Gated Installments (`CuotasHitoService`)**: Installments in `ESPERA_HITO` remain locked at checkout until the assigned academic advisor (`Dr. Carlos Alberto Méndez Vargas`) approves the corresponding academic deliverable (`EXIGIBLE`).
- **Kimball BI Report `R-PAYERS` (`INBESTIGA_MART`)**: Executive KPIs `P01`–`P06` and 40-case evaluation matrix.

## Architecture

- **`apps/api`**: NestJS backend (`http://localhost:4000/api/v1`) connected to SQL Server (`INBESTIGA_TESIS` OLTP + `INBESTIGA_MART` Kimball Data Mart).
- **`apps/web`**: Next.js 14 App Router frontend (`http://localhost:3000`) featuring the PAYERS Command Center (`/`), Bidirectional Live Chat (`/admin/payers/live-chat`), Official Mercado Pago Checkout (`/checkout/[cotizacionId]`), Advisor Milestone Validation (`/admin/customers`), 104-Order Operational Tray (`/admin/payers`), and BI Report (`R-PAYERS`).
- **`infrastructure/sql/definitivo`**: SQL Server DDL, deterministic cohort seed, and ETL scripts.

## Quick Start

1. Copy `.env.example` to `.env` and configure your SQL Server connection, Telegram Bot token, Gemini API key, and Mercado Pago test credentials.
2. Build and start the API and Web servers:

```bash
npm install
npm run build --workspace=@inbestiga/api
npm run build --workspace=@inbestiga/web
```
