import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';

/**
 * Acceso de SOLO LECTURA a la base de datos interna de Evolution API (Postgres).
 *
 * ¿Por qué existe? WhatsApp introdujo el direccionamiento por LID: los mensajes
 * ENTRANTES llegan identificados con un `remoteJid` del tipo `220168747761919@lid`
 * (un LID estable y opaco), NO con el número de teléfono. El webhook necesita el
 * teléfono real (PN, `@s.whatsapp.net`) para localizar la ORDEN_PAGO del estudiante
 * y despachar la respuesta del Agente PAYERS.
 *
 * Evolution guarda el mapeo autoritativo en `evolution_api."Message"`: cada mensaje
 * SALIENTE (fromMe = true) que enviamos al teléfono del estudiante registra el LID
 * en `key.remoteJid` y el teléfono en `key.remoteJidAlt`. Ese par es la traducción
 * LID -> teléfono.
 */
@Injectable()
export class EvolutionDbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EvolutionDbService.name);
  private pool: Pool | null = null;
  private readonly cache = new Map<string, string>();

  /** Resoluciones ya encontradas (LID -> teléfono). El mapeo es estable. */
  private readonly config: {
    host?: string;
    port: number;
    user?: string;
    password?: string;
    database?: string;
  };

  constructor() {
    this.config = {
      host: process.env.EVO_DB_HOST,
      port: Number(process.env.EVO_DB_PORT || 5432),
      user: process.env.EVO_DB_USER,
      password: process.env.EVO_DB_PASSWORD,
      database: process.env.EVO_DB_NAME,
    };
  }

  private get habilitado(): boolean {
    return !!(this.config.host && this.config.user && this.config.database);
  }

  onModuleInit() {
    if (!this.habilitado) {
      this.logger.warn(
        'Resolución LID->teléfono inactiva: define EVO_DB_HOST, EVO_DB_USER, EVO_DB_PASSWORD y EVO_DB_NAME.',
      );
      return;
    }
    this.pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      max: 4,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    this.pool.on('error', (err) => this.logger.warn(`[Evolution DB] Error en el pool: ${err.message}`));
    this.logger.log(`✓ [Evolution DB] Resolución LID->teléfono activa en ${this.config.host}:${this.config.port}`);
  }

  async onModuleDestroy() {
    if (this.pool) await this.pool.end().catch(() => undefined);
  }

  /**
   * Traduce un JID de WhatsApp de tipo LID (`...@lid`) al número de teléfono real.
   * Devuelve solo dígitos (ej. "51956092165") o `null` si no se puede resolver.
   */
  async resolverTelefonoDesdeLid(lid: string): Promise<string | null> {
    const jid = String(lid).includes('@') ? String(lid) : `${String(lid)}@lid`;

    if (this.cache.has(jid)) return this.cache.get(jid) || null;
    if (!this.pool) return null;

    try {
      // 1) Mapeo autoritativo: mensajes SALIENTES hacia ese LID exponen el teléfono en remoteJidAlt.
      const porMensaje = await this.pool.query(
        `SELECT key->>'remoteJidAlt' AS pn
           FROM evolution_api."Message"
          WHERE key->>'remoteJid' = $1
            AND COALESCE(key->>'remoteJidAlt', '') <> ''
          ORDER BY "messageTimestamp" DESC
          LIMIT 1`,
        [jid],
      );

      let pn = porMensaje.rows[0]?.pn as string | undefined;

      // 2) Respaldo: contacto LID y contacto PN que comparten la misma foto de perfil.
      if (!pn) {
        const porContacto = await this.pool.query(
          `SELECT pn."remoteJid" AS pn
             FROM evolution_api."Contact" lid
             JOIN evolution_api."Contact" pn
               ON pn."profilePicUrl" = lid."profilePicUrl"
            WHERE lid."remoteJid" = $1
              AND COALESCE(lid."profilePicUrl", '') <> ''
              AND pn."remoteJid" LIKE '%@s.whatsapp.net'
            ORDER BY pn."updatedAt" DESC
            LIMIT 1`,
          [jid],
        );
        pn = porContacto.rows[0]?.pn as string | undefined;
      }

      if (!pn) return null;

      const telefono = String(pn).split('@')[0].replace(/\D/g, '');
      if (!telefono) return null;

      this.cache.set(jid, telefono);
      this.logger.log(`✓ [Evolution DB] LID ${jid} resuelto -> teléfono ${telefono}`);
      return telefono;
    } catch (error: any) {
      this.logger.warn(`[Evolution DB] No se pudo resolver el LID ${jid}: ${error.message}`);
      return null;
    }
  }
}
