import { Injectable, Logger } from '@nestjs/common';
import OpenAI, { toFile } from 'openai';

export const STT_MODEL = 'gpt-4o-mini-transcribe';
export const LLM_MODEL = 'gpt-4o-mini';
export const TTS_MODEL = 'gpt-4o-mini-tts';

const MAX_HISTORY = 6;
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos de inactividad para reiniciar sesión

const SYSTEM_PROMPT =
  process.env.OPENAI_SYSTEM_PROMPT ||
  'Eres un asistente virtual amable. Responde siempre en español, de forma concisa y natural, ' +
    'con frases cortas como si hablaras por teléfono. Usa solo texto plano: sin Markdown, sin asteriscos, ' +
    'sin listas, sin viñetas, sin emojis ni encabezados. Tu respuesta será leída en voz alta.';

/** El tiempo de TTS crece con el largo del texto: en modo voz se pide brevedad extrema. */
export const VOICE_BREVITY =
  'IMPORTANTE (respuesta por nota de voz): máximo 2 frases cortas, unas 35 palabras en total. ' +
  'Ve directo al punto, sin saludos largos ni repeticiones.';

interface HistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Pipeline OpenAI: STT (gpt-4o-mini-transcribe) -> LLM (gpt-4o-mini) -> TTS (gpt-4o-mini-tts).
 * Mantiene en memoria los últimos 6 mensajes por usuario.
 */
@Injectable()
export class OpenAiVoiceService {
  private readonly logger = new Logger(OpenAiVoiceService.name);
  private readonly client: OpenAI | null;
  private readonly history = new Map<string, HistoryItem[]>();
  private readonly lastActive = new Map<string, number>();

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    this.client = apiKey ? new OpenAI({ apiKey, maxRetries: 1, timeout: 30000 }) : null;
    if (!this.client) {
      this.logger.warn('OPENAI_API_KEY no configurada: pipeline de voz OpenAI inactivo.');
    }
  }

  get enabled(): boolean {
    return !!this.client && process.env.OPENAI_AGENT_ENABLED !== 'false';
  }

  private async timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const t0 = Date.now();
    try {
      return await fn();
    } finally {
      this.logger.log(`[perf] ${label}: ${Date.now() - t0} ms`);
    }
  }

  /** Resuelve un MIME type limpio desde el parámetro explícito o la extensión del archivo. */
  private resolveMimeType(filename: string, mimeType?: string): string {
    const clean = mimeType?.split(';')[0]?.trim().toLowerCase();
    if (clean && clean !== 'application/octet-stream') return clean;
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'webm':
        return 'audio/webm';
      case 'ogg':
        return 'audio/ogg';
      case 'mp3':
        return 'audio/mpeg';
      case 'wav':
        return 'audio/wav';
      case 'mp4':
      case 'm4a':
        return 'audio/mp4';
      default:
        return 'audio/ogg';
    }
  }

  /** STT: audio (.ogg, .webm, .mp3, .wav, .mp4/.m4a) -> texto en español. */
  async transcribe(audio: Buffer, filename = 'audio.ogg', mimeType?: string): Promise<string> {
    const cleanMime = this.resolveMimeType(filename, mimeType);
    return this.timed('STT gpt-4o-mini-transcribe', async () => {
      const file = await toFile(audio, filename, { type: cleanMime });
      const res = await this.client!.audio.transcriptions.create({
        model: STT_MODEL,
        file,
        language: 'es',
      });
      return (res.text || '').trim();
    });
  }

  /** LLM: responde con historial acotado a los últimos 6 mensajes del usuario. */
  async reply(userKey: string, text: string, opts?: { voz?: boolean }): Promise<string> {
    const system = opts?.voz ? `${SYSTEM_PROMPT}\n\n${VOICE_BREVITY}` : SYSTEM_PROMPT;
    return this.chat(userKey, system, text, 'LLM gpt-4o-mini');
  }

  /**
   * Cerebro de PAYERS con gpt-4o-mini: contexto transaccional + regla de texto plano.
   * Con `voz` se exige una respuesta muy corta para acelerar el TTS.
   */
  async generarRespuestaPayers(
    userKey: string,
    contextPrompt: string,
    mensajeUsuario: string,
    opts?: { voz?: boolean },
  ): Promise<string> {
    const system =
      `${contextPrompt}\n\n` +
      `REGLA DE FORMATO ESTRICTA PARA COMUNICACIÓN CON EL ESTUDIANTE:\n` +
      `- Responde de forma concisa, cálida y natural, apto para lectura en voz alta.\n` +
      `- Usa estrictamente TEXTO PLANO: NO uses Markdown, asteriscos (*), almohadillas (#), viñetas ni listas.\n` +
      `- PROHIBIDO mencionar siglas técnicas internas como "RN-01", "RN-02", "RN-03", "RN-05", "RN-09", "DEVOLVER_A_LEADS" o "FASE PAYERS". Trata siempre al estudiante con calidez humana y lenguaje profesional natural.` +
      (opts?.voz ? `\n- ${VOICE_BREVITY}` : '');
    return this.chat(userKey, system, mensajeUsuario, 'LLM PAYERS gpt-4o-mini');
  }

  private async chat(userKey: string, system: string, userText: string, label: string): Promise<string> {
    const now = Date.now();
    const prevTime = this.lastActive.get(userKey) || 0;
    let past = this.history.get(userKey) || [];

    // Si pasaron más de 15 minutos de inactividad, se reinicia la memoria de la conversación
    if (prevTime > 0 && now - prevTime > INACTIVITY_TIMEOUT_MS) {
      this.logger.log(`[sesión] Inactividad > 15 min para ${userKey}: reiniciando memoria conversacional.`);
      past = [];
      this.history.delete(userKey);
    }
    this.lastActive.set(userKey, now);

    const completion = await this.timed(label, () =>
      this.client!.chat.completions.create({
        model: LLM_MODEL,
        max_tokens: 250,
        messages: [{ role: 'system', content: system }, ...past, { role: 'user', content: userText }],
      }),
    );
    const answer = (completion.choices[0]?.message?.content || '').trim();

    const updated = [...past, { role: 'user' as const, content: userText }];
    if (answer) updated.push({ role: 'assistant' as const, content: answer });
    this.history.set(userKey, updated.slice(-MAX_HISTORY));

    return answer;
  }

  /** TTS: texto -> Ogg/Opus (apto para notas de voz). */
  async synthesize(text: string): Promise<Buffer> {
    const spokenInput = text
      .replace(/\*\*|__/g, '')
      .replace(/`+/g, '')
      .replace(/^\s*#{1,6}\s*/gm, '')
      .replace(/#/g, '')
      .replace(/^\s*[•·▪▸]\s*/gm, '')
      .replace(/^\s*[-*]\s+/gm, '')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
    if (!spokenInput) {
      throw new Error('El texto para sintetizar audio está vacío.');
    }

    return this.timed(`TTS gpt-4o-mini-tts (${spokenInput.length} chars)`, async () => {
      const res = await this.client!.audio.speech.create({
        model: TTS_MODEL,
        voice: 'coral',
        input: spokenInput,
        response_format: 'opus',
        instructions: 'Habla en español con un tono natural, cálido y conversacional.',
      });
      return Buffer.from(await res.arrayBuffer());
    });
  }
}
