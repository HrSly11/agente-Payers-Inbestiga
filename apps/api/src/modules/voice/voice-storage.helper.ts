import * as fs from 'fs';
import * as path from 'path';

const EXT_BY_MIME: Record<string, string> = {
  'audio/ogg': 'ogg',
  'audio/opus': 'ogg',
  'audio/webm': 'webm',
  'video/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/mp4': 'mp4',
  'audio/m4a': 'mp4',
  'audio/x-m4a': 'mp4',
};

const MIME_BY_EXT: Record<string, string> = {
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  webm: 'audio/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  mp4: 'audio/mp4',
  m4a: 'audio/mp4',
};

const ALLOWED_EXTS = new Set(['ogg', 'webm', 'mp3', 'wav', 'mp4']);

export function getVoiceStorageDir(): string {
  const cwd = process.cwd();
  const apiRoot = fs.existsSync(path.join(cwd, 'apps', 'api'))
    ? path.join(cwd, 'apps', 'api')
    : cwd;
  return path.join(apiRoot, 'storage', 'voice');
}

function resolveVoiceExtension(filename?: string, mimeType?: string): string {
  const cleanMime = mimeType?.split(';')[0]?.trim().toLowerCase();
  if (cleanMime && cleanMime !== 'application/octet-stream' && EXT_BY_MIME[cleanMime]) {
    return EXT_BY_MIME[cleanMime];
  }
  const ext = filename?.toLowerCase().split('.').pop();
  if (ext === 'oga') return 'ogg';
  if (ext === 'm4a') return 'mp4';
  if (ext && ALLOWED_EXTS.has(ext)) return ext;
  return 'ogg';
}

/** Guarda un audio asociado a `mensajeId` en `apps/api/storage/voice/<mensajeId>.<ext>`. */
export async function saveVoiceFile(
  mensajeId: number,
  buffer: Buffer,
  filename?: string,
  mimeType?: string,
): Promise<void> {
  if (!Number.isInteger(mensajeId) || mensajeId <= 0) {
    throw new Error('mensajeId inválido para guardar nota de voz.');
  }
  if (!buffer || buffer.length === 0) return;

  const dir = getVoiceStorageDir();
  await fs.promises.mkdir(dir, { recursive: true });

  // Eliminar cualquier versión previa del mismo mensajeId
  const prefix = `${mensajeId}.`;
  const existing = await fs.promises.readdir(dir);
  await Promise.all(
    existing
      .filter((entry) => entry.startsWith(prefix))
      .map((entry) => fs.promises.unlink(path.join(dir, entry)).catch(() => undefined)),
  );

  const ext = resolveVoiceExtension(filename, mimeType);
  const targetPath = path.join(dir, `${mensajeId}.${ext}`);
  await fs.promises.writeFile(targetPath, buffer);
}

/** Localiza el archivo de audio almacenado para `mensajeId` validando path traversal. */
export function findVoiceFile(
  mensajeId: number,
): { filePath: string; mimeType: string; size: number } | null {
  if (!Number.isInteger(mensajeId) || mensajeId <= 0) return null;

  const dir = getVoiceStorageDir();
  if (!fs.existsSync(dir)) return null;

  const resolvedDir = path.resolve(dir);
  const pattern = new RegExp(`^${mensajeId}\\.([a-z0-9]+)$`, 'i');

  for (const entry of fs.readdirSync(resolvedDir)) {
    const match = pattern.exec(entry);
    if (!match) continue;
    const candidate = path.resolve(resolvedDir, entry);
    if (!candidate.startsWith(resolvedDir + path.sep)) continue;
    try {
      const stat = fs.statSync(candidate);
      if (stat.isFile()) {
        const ext = match[1].toLowerCase();
        return {
          filePath: candidate,
          mimeType: MIME_BY_EXT[ext] || 'audio/ogg',
          size: stat.size,
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}

/** Retorna el conjunto de mensaje_id que tienen audio almacenado en disco. */
export function listVoiceMessageIds(): Set<number> {
  const ids = new Set<number>();
  const dir = getVoiceStorageDir();
  if (!fs.existsSync(dir)) return ids;

  try {
    for (const entry of fs.readdirSync(dir)) {
      const match = /^(\d+)\.[a-z0-9]+$/i.exec(entry);
      if (!match) continue;
      const id = Number(match[1]);
      if (Number.isInteger(id) && id > 0) ids.add(id);
    }
  } catch {
    return ids;
  }

  return ids;
}
