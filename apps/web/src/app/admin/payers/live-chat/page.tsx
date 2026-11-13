'use client';

import { useState, useEffect, useRef, Suspense, type ChangeEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  MessageSquare,
  Bot,
  User,
  Send,
  Sparkles,
  CreditCard,
  ArrowRight,
  RefreshCw,
  ChevronLeft,
  Search,
  Clock,
  Layers,
  AlertTriangle,
  Zap,
  CheckCircle2,
  X,
  Mic,
  Paperclip,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { api } from '@/lib/api';
import { SCENARIOS_PRUEBA } from '@/components/payers/PayersModule';

const FILTROS = [
  { id: 'PENDIENTES', label: 'Pendientes' },
  { id: 'PAGADA', label: 'Pagadas' },
  { id: 'TODAS', label: 'Todas' },
];

function estadoBadge(estado: string) {
  if (estado === 'PAGADA')
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
  if (estado === 'PARCIAL') return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-sky-300';
  return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
}

const PREFERRED_AUDIO_MIMES = [
  'audio/ogg;codecs=opus',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
];

function pickRecordingMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined;
  }
  return PREFERRED_AUDIO_MIMES.find((mime) => MediaRecorder.isTypeSupported(mime));
}

function extensionForMime(mime: string): string {
  const clean = mime.split(';')[0].trim().toLowerCase();
  if (clean.includes('ogg')) return 'ogg';
  if (clean.includes('mp4') || clean.includes('m4a')) return 'mp4';
  if (clean.includes('mpeg') || clean.includes('mp3')) return 'mp3';
  if (clean.includes('wav')) return 'wav';
  return 'webm';
}

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function base64ToBlobUrl(base64: string, mimeType = 'audio/ogg'): string {
  const clean = base64.replace(/^data:[^;]+;base64,/, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

function PayersLiveChatContent() {
  const searchParams = useSearchParams();
  const ordenParam = searchParams.get('orden');

  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState('PENDIENTES');
  const [canal, setCanal] = useState<'WHATSAPP' | 'TELEGRAM'>('WHATSAPP');
  const [activeId, setActiveId] = useState<number | null>(ordenParam ? Number(ordenParam) : null);
  const [detalle, setDetalle] = useState<any>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingVoice, setSendingVoice] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [autoVoice, setAutoVoice] = useState(true);
  const [voiceAudioByMsgId, setVoiceAudioByMsgId] = useState<Record<number, string>>({});
  const [unreadByOrder, setUnreadByOrder] = useState<Record<number, number>>({});
  const [lastActivityByOrder, setLastActivityByOrder] = useState<Record<number, string>>({});
  const [busyAction, setBusyAction] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [bannerActionOrdenId, setBannerActionOrdenId] = useState<number | null>(null);
  const [lastGuardrails, setLastGuardrails] = useState<string[]>([]);
  const [lastTools, setLastTools] = useState<any[]>([]);
  const [showMobileList, setShowMobileList] = useState(!ordenParam);
  const endRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordActionRef = useRef<'send' | 'cancel' | null>(null);
  const recordingStartRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const createdUrlsRef = useRef<string[]>([]);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const latestDetalleRef = useRef<any>(null);
  const canalRef = useRef(canal);
  const autoVoiceRef = useRef(autoVoice);
  const activeIdRef = useRef<number | null>(activeId);
  const isMountedRef = useRef(true);
  const startingRecordRef = useRef(false);

  const showBanner = (msg: string | null, actionOrdenId: number | null = null) => {
    setBanner(msg);
    setBannerActionOrdenId(actionOrdenId);
  };

  const cargarOrdenes = async () => {
    try {
      const res = await api.getPayersOverview();
      if (!isMountedRef.current) return;
      const list: any[] = res?.ordenesDetalle || [];
      setOrdenes(list);
      if (activeIdRef.current == null && list.length > 0) {
        const first = list.find((o) => o.estado_orden !== 'PAGADA') || list[0];
        setActiveId(first.id_orden_pago);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const cargarDetalle = async (id: number) => {
    try {
      const data = await api.getPayerOrden(id);
      if (isMountedRef.current && activeIdRef.current === id) {
        setDetalle(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    void cargarOrdenes();
    const ordersTimer = setInterval(() => {
      void cargarOrdenes();
    }, 10000);
    return () => clearInterval(ordersTimer);
  }, []);

  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    const es = new EventSource(api.getPayersEventsUrl());
    es.onmessage = (event) => {
      try {
        const ev = JSON.parse(event.data);
        if (ev?.type !== 'nuevo_mensaje') return;
        const eventOrdenId = Number(ev.ordenPagoId);
        if (ev.fecha && Number.isFinite(eventOrdenId)) {
          setLastActivityByOrder((prev) => ({ ...prev, [eventOrdenId]: String(ev.fecha) }));
        }
        void cargarOrdenes();

        if (eventOrdenId === activeIdRef.current) {
          if (!sendingRef.current) {
            void cargarDetalle(eventOrdenId);
            if (ev.canal === 'WHATSAPP' || ev.canal === 'TELEGRAM') {
              showBanner(
                `📩 Nuevo ${ev.esVoz ? 'audio' : 'mensaje'} recibido por ${ev.canal}.`,
                null,
              );
            }
          }
        } else if (Number.isFinite(eventOrdenId)) {
          setUnreadByOrder((prev) => ({
            ...prev,
            [eventOrdenId]: (prev[eventOrdenId] || 0) + 1,
          }));
          showBanner(
            `📩 ${ev.estudiante || 'Estudiante'} (${ev.codigoOrden || `#${eventOrdenId}`}) escribió por ${ev.canal}: "${ev.preview || ''}"`,
            eventOrdenId,
          );
        }
      } catch {
        // Ignorar eventos SSE no JSON
      }
    };
    return () => {
      es.close();
    };
  }, []);

  useEffect(() => {
    activeIdRef.current = activeId;
    if (activeId != null) {
      setLastGuardrails([]);
      setLastTools([]);
      setUnreadByOrder((prev) => {
        if (!prev[activeId]) return prev;
        const next = { ...prev };
        delete next[activeId];
        return next;
      });
      void cargarDetalle(activeId);
    }
  }, [activeId]);

  // Refresco automático para ver las respuestas reales que llegan por Telegram/WhatsApp
  useEffect(() => {
    if (activeId == null) return;
    const t = setInterval(() => {
      if (!sendingRef.current) cargarDetalle(activeId);
    }, 6000);
    return () => clearInterval(t);
  }, [activeId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [detalle]);

  useEffect(() => {
    latestDetalleRef.current = detalle;
  }, [detalle]);

  useEffect(() => {
    canalRef.current = canal;
  }, [canal]);

  useEffect(() => {
    autoVoiceRef.current = autoVoice;
  }, [autoVoice]);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const cleanupRecordingMedia = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
    if (isMountedRef.current) {
      setIsRecording(false);
      setRecordingSeconds(0);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      recordActionRef.current = 'cancel';
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      cleanupRecordingMedia();
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
      createdUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      createdUrlsRef.current = [];
    };
  }, []);

  const handleSelect = (id: number) => {
    if (isRecording || startingRecordRef.current) {
      handleCancelarGrabacion();
    }
    setUnreadByOrder((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setActiveId(id);
    setShowMobileList(false);
  };

  const enviarBlobAudio = async (audioBlob: Blob, filename: string, explicitOrdenId?: number | null) => {
    const targetOrdenId = explicitOrdenId ?? activeId;
    if (targetOrdenId == null || sendingRef.current) return;
    const currentCanal = canalRef.current;
    setSending(true);
    setSendingVoice(true);
    sendingRef.current = true;
    const prevMsgIds = new Set<number>(
      (latestDetalleRef.current?.mensajes || []).map((m: any) => Number(m.mensaje_id)),
    );

    try {
      const res =
        currentCanal === 'TELEGRAM'
          ? await api.enviarAudioTelegram(targetOrdenId, audioBlob, filename)
          : await api.enviarAudioWhatsapp(targetOrdenId, audioBlob, filename);

      const nextDetalle = res.estadoOrden || (await api.getPayerOrden(targetOrdenId));
      const nextMessages: any[] = nextDetalle?.mensajes || [];
      const newMessages = nextMessages.filter((m: any) => !prevMsgIds.has(Number(m.mensaje_id)));
      const studentMsg =
        [...newMessages].reverse().find((m: any) => m.emisor === 'ESTUDIANTE') ||
        [...nextMessages]
          .reverse()
          .find((m: any) => m.emisor === 'ESTUDIANTE' && m.tipo_mensaje === 'AUDIO_TRANSCRITO');
      const botMsg =
        [...newMessages].reverse().find((m: any) => m.emisor === 'BOT') ||
        [...nextMessages]
          .reverse()
          .find((m: any) => m.emisor === 'BOT' && m.tipo_mensaje === 'AUDIO_TRANSCRITO');

      const audioMapUpdates: Record<number, string> = {};
      if (isMountedRef.current && studentMsg?.mensaje_id) {
        const studentUrl = URL.createObjectURL(audioBlob);
        createdUrlsRef.current.push(studentUrl);
        audioMapUpdates[Number(studentMsg.mensaje_id)] = studentUrl;
      }

      const isStillSameOrder = isMountedRef.current && activeIdRef.current === targetOrdenId;
      let botAudioUrl: string | null = null;
      if (
        isMountedRef.current &&
        res.audioRespuestaBase64 &&
        (botMsg?.mensaje_id || (isStillSameOrder && autoVoiceRef.current))
      ) {
        botAudioUrl = base64ToBlobUrl(res.audioRespuestaBase64, res.audioMimeType || 'audio/ogg');
        createdUrlsRef.current.push(botAudioUrl);
        if (botMsg?.mensaje_id) {
          audioMapUpdates[Number(botMsg.mensaje_id)] = botAudioUrl;
        }
      }

      if (isMountedRef.current && Object.keys(audioMapUpdates).length > 0) {
        setVoiceAudioByMsgId((prev) => ({ ...prev, ...audioMapUpdates }));
      }

      if (isMountedRef.current) {
        cargarOrdenes();
      }

      if (isStillSameOrder) {
        setDetalle(nextDetalle);
        setLastGuardrails(res.guardrailsActivados || []);
        setLastTools(res.herramientasEjecutadas || []);

        if (autoVoiceRef.current && botAudioUrl) {
          if (activeAudioRef.current) {
            activeAudioRef.current.pause();
          }
          const player = new Audio(botAudioUrl);
          activeAudioRef.current = player;
          player.play().catch(() => {});
        }

        if (res.envio) {
          if (currentCanal === 'TELEGRAM' && !res.envio.exito) {
            showBanner(
              res.envio.razon === 'sin_telegram_chat_id'
                ? '⚠️ Nota de voz procesada por PAYERS, pero este estudiante aún no tiene telegram_chat_id vinculado en BD.'
                : `⚠️ Nota de voz procesada por PAYERS, pero Telegram reportó: ${res.envio.error || 'error al enviar audio'}.`,
            );
          } else if (currentCanal === 'WHATSAPP' && res.envio.exito === false) {
            showBanner('⚠️ Nota de voz procesada por PAYERS, pero ocurrió un aviso al despachar en Evolution API.');
          } else {
            showBanner(`🎙️ Nota de voz transcrita y respondida con audio en ${currentCanal}.`);
          }
        } else {
          showBanner(`🎙️ Nota de voz procesada ("${res.transcripcion || ''}").`);
        }
      }
    } catch (err: any) {
      if (isMountedRef.current && activeIdRef.current === targetOrdenId) {
        showBanner(`⚠️ Error al procesar nota de voz (${currentCanal}): ${err.message}`);
      }
    } finally {
      sendingRef.current = false;
      if (isMountedRef.current) {
        setSending(false);
        setSendingVoice(false);
      }
    }
  };

  const handleIniciarGrabacion = async () => {
    if (sending || isRecording || startingRecordRef.current || activeId == null) return;
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      showBanner(
        '⚠️ Tu navegador no soporta grabación de audio desde el micrófono. Puedes adjuntar un archivo de audio.',
      );
      return;
    }

    const targetOrdenId = activeId;
    startingRecordRef.current = true;
    recordActionRef.current = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (
        !isMountedRef.current ||
        mediaRecorderRef.current ||
        recordActionRef.current === 'cancel' ||
        activeIdRef.current !== targetOrdenId
      ) {
        stream.getTracks().forEach((track) => track.stop());
        recordActionRef.current = null;
        return;
      }

      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const preferredMime = pickRecordingMimeType();
      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      recordingStartRef.current = Date.now();
      setRecordingSeconds(0);
      setIsRecording(true);

      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds(Math.floor((Date.now() - recordingStartRef.current) / 1000));
      }, 250);

      recorder.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = () => {
        const action = recordActionRef.current;
        const elapsedMs = Date.now() - recordingStartRef.current;
        const chunks = [...audioChunksRef.current];
        const actualMime = recorder.mimeType || preferredMime || chunks[0]?.type || 'audio/webm';
        audioChunksRef.current = [];
        recordActionRef.current = null;
        cleanupRecordingMedia();

        if (action !== 'send') return;

        const blob = new Blob(chunks, { type: actualMime });
        if (elapsedMs < 400 || blob.size < 500) {
          if (isMountedRef.current && activeIdRef.current === targetOrdenId) {
            showBanner(
              '⚠️ La grabación de voz es demasiado corta o está vacía. Graba al menos 1 segundo.',
            );
          }
          return;
        }

        const ext = extensionForMime(actualMime);
        void enviarBlobAudio(blob, `nota-voz.${ext}`, targetOrdenId);
      };

      recorder.start(250);
    } catch (err: any) {
      cleanupRecordingMedia();
      if (!isMountedRef.current) return;
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        showBanner(
          '⚠️ Permiso de micrófono denegado. Habilítalo en tu navegador o adjunta un archivo de audio.',
        );
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        showBanner('⚠️ No se detectó ningún micrófono disponible. Puedes adjuntar un archivo de audio.');
      } else {
        showBanner(`⚠️ No se pudo iniciar la grabación de voz: ${err?.message || 'error desconocido'}.`);
      }
    } finally {
      startingRecordRef.current = false;
    }
  };

  const handleEnviarGrabacion = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      cleanupRecordingMedia();
      return;
    }
    recordActionRef.current = 'send';
    recorder.stop();
  };

  const handleCancelarGrabacion = () => {
    recordActionRef.current = 'cancel';
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        cleanupRecordingMedia();
      }
    } else {
      cleanupRecordingMedia();
    }
  };

  const handleAdjuntarAudio = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || activeId == null || sending) return;
    if (file.size === 0) {
      showBanner('⚠️ El archivo de audio seleccionado está vacío.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      showBanner('⚠️ El archivo de audio supera el máximo permitido de 15 MB.');
      return;
    }
    void enviarBlobAudio(file, file.name || 'nota-voz.webm', activeId);
  };

  const handleEnviar = async (texto?: string) => {
    const msg = (texto ?? input).trim();
    if (!msg || sending || activeId == null) return;
    setSending(true);
    sendingRef.current = true;
    if (!texto) setInput('');
    try {
      const res =
        canal === 'TELEGRAM'
          ? await api.enviarMensajeTelegram(activeId, msg)
          : await api.enviarMensajeWhatsapp(activeId, msg);
      setDetalle(res.estadoOrden || (await api.getPayerOrden(activeId)));
      setLastGuardrails(res.guardrailsActivados || []);
      setLastTools(res.herramientasEjecutadas || []);
      if (res.envio) {
        if (canal === 'TELEGRAM' && !res.envio.exito) {
          showBanner(
            '⚠️ Mensaje procesado por PAYERS, pero este estudiante aún no tiene telegram_chat_id vinculado en BD.',
          );
        } else if (canal === 'WHATSAPP' && res.envio.exito === false) {
          showBanner('⚠️ Mensaje procesado por PAYERS, pero ocurrió un aviso en Evolution API.');
        } else {
          showBanner(`✓ Mensaje enviado por Agente PAYERS y despachado exitosamente a ${canal}.`);
        }
      }
      cargarOrdenes();
    } catch (err: any) {
      alert(`Error en Agente IA PAYERS (${canal}): ${err.message}`);
    } finally {
      setSending(false);
      sendingRef.current = false;
    }
  };

  const handleAlerta = async (etapa: '4h' | '12h' | '24h') => {
    if (activeId == null) return;
    setBusyAction(true);
    try {
      const res = await api.simularAlertaEtapaPayers(activeId, etapa);
      showBanner(`Alerta de ${etapa.toUpperCase()} disparada a ${res.estudiante} (${res.secuencia}).`);
      await cargarDetalle(activeId);
    } catch (err: any) {
      alert(`Error al disparar alerta: ${err.message}`);
    } finally {
      setBusyAction(false);
    }
  };

  const handleAprobarHito = async (numeroCuota: number) => {
    if (activeId == null) return;
    setBusyAction(true);
    try {
      const res = await api.aprobarHitoCuota(activeId, numeroCuota);
      showBanner(
        `Hito aprobado: Cuota #${res.cuota} (S/ ${Number(res.monto).toFixed(2)}) habilitada como EXIGIBLE y notificada por Telegram.`,
      );
      await cargarDetalle(activeId);
      await cargarOrdenes();
    } catch (err: any) {
      alert(`Error aprobando hito: ${err.message}`);
    } finally {
      setBusyAction(false);
    }
  };

  const handleWebhook = async () => {
    if (activeId == null) return;
    setBusyAction(true);
    try {
      await api.simularWebhookPayers(activeId, 'Yape');
      showBanner('Webhook de pasarela simulado: la cuota fue acreditada.');
      await cargarDetalle(activeId);
      await cargarOrdenes();
    } catch (err: any) {
      alert(`Error simulando webhook: ${err.message}`);
    } finally {
      setBusyAction(false);
    }
  };

  const filtradas = ordenes
    .filter((o) => {
      if (filtro === 'PENDIENTES' && o.estado_orden === 'PAGADA') return false;
      if (filtro === 'PAGADA' && o.estado_orden !== 'PAGADA') return false;
      const q = search.toLowerCase();
      return (
        !q ||
        o.codigo_orden?.toLowerCase().includes(q) ||
        o.estudiante?.toLowerCase().includes(q) ||
        o.universidad?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const aUnread = unreadByOrder[a.id_orden_pago] || 0;
      const bUnread = unreadByOrder[b.id_orden_pago] || 0;
      if (aUnread !== bUnread) return bUnread - aUnread;

      const aAct = lastActivityByOrder[a.id_orden_pago] ? Date.parse(lastActivityByOrder[a.id_orden_pago]) || 0 : 0;
      const bAct = lastActivityByOrder[b.id_orden_pago] ? Date.parse(lastActivityByOrder[b.id_orden_pago]) || 0 : 0;
      if (aAct !== bAct) return bAct - aAct;

      return Number(a.estado_orden === 'PAGADA') - Number(b.estado_orden === 'PAGADA');
    });

  const orden = detalle?.orden;
  const mensajes: any[] = detalle?.mensajes || [];
  const cuotas: any[] = detalle?.cuotas || [];

  const bannerElement = banner ? (
    <div
      className={`border-b p-2.5 px-4 flex items-center justify-between gap-2 text-xs animate-fade-in ${
        banner.startsWith('⚠️')
          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300'
          : banner.startsWith('📩')
            ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/50 text-sky-900 dark:text-sky-200'
            : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {banner.startsWith('⚠️') ? (
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        ) : banner.startsWith('📩') ? (
          <MessageSquare className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        )}
        <span className="truncate">{banner}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {bannerActionOrdenId != null && (
          <button
            type="button"
            onClick={() => {
              handleSelect(bannerActionOrdenId);
              showBanner(null);
            }}
            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold cursor-pointer transition-colors"
          >
            Abrir chat
          </button>
        )}
        <button
          onClick={() => showBanner(null)}
          className="opacity-75 hover:opacity-100 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-heading text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-sky-400 shadow-sm">
                <MessageSquare className="w-5 h-5" />
              </span>
              <span>Live Chat de Cobranza (PAYERS)</span>
            </h1>
            <span className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-500/30 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Telegram / WhatsApp Bidireccional</span>
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 break-words">
            Retomá la conversación de cobranza con cualquier tesista que ya acordó su pago en LEADS.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start flex-wrap">
          {/* Selector de Canal: WhatsApp vs Telegram */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <button
              type="button"
              onClick={() => setCanal('WHATSAPP')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                canal === 'WHATSAPP'
                  ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
              <span>🟢 WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={() => setCanal('TELEGRAM')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                canal === 'TELEGRAM'
                  ? 'bg-sky-600 text-white shadow-sm ring-2 ring-sky-500/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-sky-300 animate-pulse" />
              <span>🔵 Telegram</span>
            </button>
          </div>

          <Link
            href="/admin/payers"
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-sky-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <span>Órdenes</span>
          </Link>
          <button
            onClick={() => activeId != null && cargarDetalle(activeId)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Main Chat Interface Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 min-h-[680px] lg:h-[720px]">
        {/* Sidebar: Órdenes */}
        <div
          className={`glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col space-y-3 overflow-hidden shadow-sm ${
            !showMobileList ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Conversaciones de Cobranza
            </h2>
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
              {filtradas.length}
            </span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar tesista u orden..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFiltro(f.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                  filtro === f.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filtradas.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
                Sin conversaciones para este filtro.
              </p>
            ) : (
              filtradas.map((o) => {
                const isSelected = o.id_orden_pago === activeId;
                const unread = unreadByOrder[o.id_orden_pago] || 0;
                return (
                  <button
                    key={o.id_orden_pago}
                    onClick={() => handleSelect(o.id_orden_pago)}
                    className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer min-w-0 ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-500/60 shadow-xs'
                        : unread > 0
                          ? 'bg-sky-50/70 dark:bg-sky-950/30 border-sky-300 dark:border-sky-700/80 hover:border-sky-400'
                          : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {o.estudiante}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {unread > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-black animate-pulse">
                            {unread}
                          </span>
                        )}
                        <span className="text-[10px] font-extrabold text-sky-600 dark:text-sky-400 font-mono">
                          S/ {Number(o.monto_comprometido).toFixed(0)}
                        </span>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {o.codigo_orden} • {o.modalidad_pago}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] gap-1">
                      <span
                        className={`px-1.5 py-0.5 rounded font-semibold uppercase truncate ${estadoBadge(o.estado_orden)}`}
                      >
                        {o.estado_orden}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 shrink-0 truncate">
                        {o.universidad}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Chat */}
        <div
          className={`lg:col-span-3 glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden shadow-lg ${
            showMobileList ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {orden ? (
            <>
              {/* Chat Top Banner */}
              <div className="bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 p-3.5 sm:p-4 flex items-center justify-between gap-3 min-w-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => setShowMobileList(true)}
                    className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 shrink-0"
                    title="Volver a la lista"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-700 to-sky-500 flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-xs">
                    {orden.estudiante_nombre?.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2 truncate">
                      <span className="truncate">{orden.estudiante_nombre}</span>
                      <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full font-mono shrink-0">
                        {orden.estudiante_telefono}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {orden.carrera} • {orden.universidad} • {orden.codigo_orden}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`px-2.5 py-1 rounded-md text-[11px] font-black tracking-wider uppercase border flex items-center gap-1.5 ${
                      canal === 'WHATSAPP'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                        : 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300 border-sky-300 dark:border-sky-700'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                    <span>Canal Activo: {canal}</span>
                  </span>
                  <span className="px-2.5 py-1 rounded-md text-[11px] font-black tracking-wider uppercase bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                    {orden.estado}
                  </span>
                </div>
              </div>

              {/* Sub-barra de canal y conectividad del estudiante */}
              <div
                className={`px-4 py-2 border-b flex items-center justify-between text-[11px] transition-colors ${
                  canal === 'WHATSAPP'
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200'
                    : 'bg-sky-50/70 dark:bg-sky-950/20 border-sky-200 dark:border-sky-900/40 text-sky-900 dark:text-sky-200'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="font-bold shrink-0">
                    {canal === 'WHATSAPP' ? '📱 WhatsApp Estudiante:' : '✈️ Telegram Estudiante:'}
                  </span>
                  <span className="font-mono truncate">
                    {canal === 'WHATSAPP'
                      ? orden.estudiante_telefono
                        ? `+${orden.estudiante_telefono}`
                        : 'Sin celular registrado'
                      : orden.telegram_username
                        ? `@${orden.telegram_username}`
                        : orden.telegram_chat_id
                          ? `ID: ${orden.telegram_chat_id}`
                          : 'Pendiente de vincular en Telegram (/start o compartir celular)'}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setAutoVoice((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                      autoVoice
                        ? 'bg-white/90 dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                        : 'bg-white/60 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                    }`}
                    title="Reproducir automáticamente la respuesta de voz del Agente PAYERS"
                  >
                    {autoVoice ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                    <span>Auto-voz: {autoVoice ? 'ON' : 'OFF'}</span>
                  </button>
                  <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono opacity-80 shrink-0">
                    <span>{canal === 'WHATSAPP' ? 'Bot: Evolution (+51 994 910 334)' : 'Bot: @inbestiga_tesis_bot'}</span>
                  </div>
                </div>
              </div>

              {/* Expediente + acciones de demo */}
              <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 flex flex-col gap-2">
                <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                  <span className="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-1">
                    Cuotas:
                  </span>
                  {cuotas.map((c: any) => (
                    <span
                      key={c.cuota_id}
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-semibold ${estadoBadge(
                        c.estado === 'PAGADA' ? 'PAGADA' : c.estado === 'EXIGIBLE' ? 'PARCIAL' : 'PENDIENTE',
                      )}`}
                    >
                      <span>
                        #{c.numero_cuota} • S/ {Number(c.monto_programado).toFixed(2)} • {c.estado}
                      </span>
                      {c.estado === 'ESPERA_HITO' && (
                        <button
                          type="button"
                          onClick={() => handleAprobarHito(c.numero_cuota)}
                          disabled={busyAction}
                          className="ml-1 px-1.5 py-0.2 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9px] cursor-pointer disabled:opacity-50"
                          title="El asesor aprueba el hito académico: pasa la cuota a EXIGIBLE y avisa por Telegram"
                        >
                          ✓ Aprobar hito
                        </button>
                      )}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-500" />
                    <span>Etapas de cobranza:</span>
                  </span>
                  <button
                    onClick={() => handleAlerta('4h')}
                    disabled={busyAction}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
                    title="Simula 4 horas sin pago: reenvía el enlace de pago"
                  >
                    <Clock className="w-3 h-3" />
                    <span>4h • Reenviar enlace</span>
                  </button>
                  <button
                    onClick={() => handleAlerta('12h')}
                    disabled={busyAction}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
                    title="Simula 12 horas sin pago: ofrece dividir en cuotas"
                  >
                    <Layers className="w-3 h-3" />
                    <span>12h • Ofrecer cuotas</span>
                  </button>
                  <button
                    onClick={() => handleAlerta('24h')}
                    disabled={busyAction}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
                    title="Simula 24 horas sin respuesta: escalamiento a asesor humano"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>24h • Escalar a asesor</span>
                  </button>
                  <span className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-700" />
                  <button
                    onClick={handleWebhook}
                    disabled={busyAction}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
                    title="Simula la confirmación de la pasarela (webhook firmado)"
                  >
                    <Zap className="w-3 h-3" />
                    <span>Simular pago (webhook)</span>
                  </button>
                </div>
              </div>

              {bannerElement}

              {/* Message Timeline */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/50 dark:bg-slate-950/40">
                {mensajes.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 text-center py-12">
                    Aún no hay mensajes en esta orden. Escribí como tesista o dispará una etapa de cobranza.
                  </div>
                ) : (
                  mensajes.map((m: any) => {
                    const esBot = m.emisor === 'BOT';
                    const isClient = !esBot;
                    const isPaymentLink = /\/checkout\//.test(m.contenido || '');
                    const audioSrc =
                      voiceAudioByMsgId[Number(m.mensaje_id)] ||
                      (m.audio_url ? api.getMediaUrl(m.audio_url) : null);

                    return (
                      <div
                        key={m.mensaje_id}
                        className={`flex gap-2.5 sm:gap-3 max-w-[90%] sm:max-w-[78%] ${
                          isClient ? 'mr-auto' : 'ml-auto flex-row-reverse'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold shadow-xs ${
                            isClient
                              ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                              : 'bg-blue-600 text-white'
                          }`}
                        >
                          {isClient ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                        </div>

                        <div
                          className={`p-3.5 rounded-2xl text-xs space-y-1.5 shadow-sm min-w-0 ${
                            isClient
                              ? 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-xs'
                              : 'bg-gradient-to-br from-blue-700 to-indigo-700 text-white rounded-tr-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] opacity-75 font-semibold gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="truncate">
                                {isClient ? 'Estudiante' : 'Agente IA de Cobranza'}
                              </span>
                              {m.tipo_mensaje === 'AUDIO_TRANSCRITO' && (
                                <span
                                  className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold shrink-0 ${
                                    isClient
                                      ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
                                      : 'bg-white/20 text-white'
                                  }`}
                                >
                                  🎙️ Nota de voz
                                </span>
                              )}
                            </div>
                            <span className="shrink-0">
                              {m.fecha_mensaje
                                ? new Date(m.fecha_mensaje).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : ''}
                            </span>
                          </div>

                          <p className="leading-relaxed whitespace-pre-wrap break-words">{m.contenido}</p>

                          {audioSrc && (
                            <audio
                              controls
                              src={audioSrc}
                              className="w-full max-w-[260px] h-8 mt-1.5"
                            />
                          )}

                          {isPaymentLink && (
                            <div className="mt-2 p-2.5 rounded-xl bg-slate-900/80 dark:bg-black/40 border border-white/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <CreditCard className="w-4 h-4 text-emerald-400 shrink-0" />
                                <span className="font-bold text-[11px] text-white truncate">
                                  Orden de Pago Oficial
                                </span>
                              </div>
                              <Link
                                href={m.contenido.match(/https?:\/\/[^\s]+/)?.[0] || '/checkout'}
                                className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg text-[10px] shadow transition-colors flex items-center gap-1 shrink-0"
                              >
                                <span>Abrir Pasarela</span> <ArrowRight className="w-3 h-3" />
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={endRef} />
              </div>

              {/* Guardarraíles / herramientas del último turno */}
              {(lastGuardrails.length > 0 || lastTools.length > 0) && (
                <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center gap-1.5 flex-wrap text-[10px]">
                  {lastGuardrails.map((g, i) => (
                    <span
                      key={`g${i}`}
                      className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold"
                    >
                      ✓ {g}
                    </span>
                  ))}
                  {lastTools.map((t: any, i: number) => (
                    <span
                      key={`t${i}`}
                      className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-mono font-semibold"
                    >
                      {t.herramienta || t.nombre || t.tool || 'tool'}
                    </span>
                  ))}
                </div>
              )}

              {/* Simulador del estudiante */}
              <div className="p-3 sm:p-4 bg-white dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
                    <Sparkles className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                    <span>Respuestas Demo:</span>
                  </span>
                  {SCENARIOS_PRUEBA.map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setInput(sc.mensaje)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] border border-slate-200 dark:border-slate-700 font-medium transition-colors cursor-pointer"
                      title={sc.mensaje}
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleAdjuntarAudio}
                  className="hidden"
                />

                {sendingVoice && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 text-[11px] font-semibold text-sky-800 dark:text-sky-300">
                    <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-sky-600 dark:border-sky-400 border-t-transparent shrink-0" />
                    <span>Transcribiendo y respondiendo con voz...</span>
                  </div>
                )}

                {isRecording ? (
                  <div className="flex items-center justify-between gap-2 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 rounded-xl px-3.5 py-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse shrink-0" />
                      <span className="text-xs font-bold text-rose-700 dark:text-rose-300 truncate">
                        Grabando nota de voz...
                      </span>
                      <span className="font-mono text-xs font-black text-rose-800 dark:text-rose-200 bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-800">
                        {formatDuration(recordingSeconds)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleCancelarGrabacion}
                        disabled={sending}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                        title="Cancelar grabación"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span className="hidden sm:inline">Cancelar</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleEnviarGrabacion}
                        disabled={sending}
                        className={`px-3.5 py-1.5 rounded-lg text-white font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all ${
                          canal === 'WHATSAPP'
                            ? 'bg-gradient-to-r from-emerald-700 to-green-600 hover:from-emerald-600 hover:to-green-500'
                            : 'bg-gradient-to-r from-blue-700 to-sky-600 hover:from-blue-600 hover:to-sky-500'
                        }`}
                        title={`Enviar nota de voz por ${canal}`}
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Enviar voz</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleEnviar();
                    }}
                    className="flex gap-2 items-center"
                  >
                    <input
                      type="text"
                      disabled={sending}
                      placeholder={
                        canal === 'WHATSAPP'
                          ? `Escribe un mensaje para enviar al WhatsApp del estudiante (+${orden.estudiante_telefono || '...'} vía Evolution)...`
                          : `Escribe un mensaje para enviar al Telegram del estudiante (@inbestiga_tesis_bot)...`
                      }
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700/80 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={sending}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
                      title="Adjuntar archivo de audio (.ogg, .webm, .mp3, .wav, .m4a)"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleIniciarGrabacion}
                      disabled={sending}
                      className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
                      title="Grabar nota de voz con el micrófono"
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                    <button
                      type="submit"
                      disabled={sending || !input.trim()}
                      className={`px-4 py-2 rounded-xl text-white font-bold text-xs shadow-md flex items-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer shrink-0 ${
                        canal === 'WHATSAPP'
                          ? 'bg-gradient-to-r from-emerald-700 to-green-600 hover:from-emerald-600 hover:to-green-500'
                          : 'bg-gradient-to-r from-blue-700 to-sky-600 hover:from-blue-600 hover:to-sky-500'
                      }`}
                    >
                      {sending ? (
                        <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>{canal === 'WHATSAPP' ? 'Enviar WhatsApp' : 'Enviar Telegram'}</span>
                    </button>
                  </form>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col">
              {bannerElement}
              <div className="flex-1 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 p-8 text-center">
                Selecciona una conversación a la izquierda para ver el Live Chat de cobranza.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PayersLiveChatPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center text-slate-500 dark:text-slate-400">
          <span className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-600 dark:border-sky-400 border-t-transparent" />
          <p className="mt-2 text-xs font-semibold">Cargando chat de cobranza...</p>
        </div>
      }
    >
      <PayersLiveChatContent />
    </Suspense>
  );
}
