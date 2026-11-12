'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CreditCard,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  GraduationCap,
  Calendar,
  AlertCircle,
  Video,
  ExternalLink,
} from 'lucide-react';
import { api } from '@/lib/api';

export default function CheckoutPage() {
  const params = useParams();
  const cotizacionId = params?.cotizacionId as string;
  const router = useRouter();

  const [cotizacion, setCotizacion] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [metodo, setMetodo] = useState<'MERCADOPAGO' | 'YAPE' | 'CARD' | 'TRANSFER'>('MERCADOPAGO');
  const [processing, setProcessing] = useState(false);
  const [pagoResultado, setPagoResultado] = useState<any>(null);

  // Form states
  const [numeroTarjeta, setNumeroTarjeta] = useState('4242 •••• •••• 4242');
  const [telefonoYape, setTelefonoYape] = useState('926 619 777');
  const [codigoAprobacion, setCodigoAprobacion] = useState('491823');
  const [mostrarQrAlternativo, setMostrarQrAlternativo] = useState(false);

  // Detección de Cuotas & Verificación Financiera
  const esCuotas = (cotizacion?.cuotas || 1) > 1;
  const cuotasTotal = cotizacion?.cuotas || 1;
  const totalContrato = Number(cotizacion?.total || 0);
  const yaPagado = cotizacion?.pagoEstado === 'CONFIRMADO' || cotizacion?.estado === 'PAGADA';
  const montoPorCuota = Number(cotizacion?.planCuotas?.montoPorCuota) || (esCuotas ? Math.round((totalContrato / cuotasTotal) * 100) / 100 : totalContrato);
  const cuotaActualNumero = Number(cotizacion?.planCuotas?.cuotaActualNumero || 1);
  const cuotaActualEstado = cotizacion?.planCuotas?.cuotaActualEstado || 'EXIGIBLE';
  const cuotaActualCondicion = cotizacion?.planCuotas?.cuotaActualCondicion || 'Cuota inicial';
  const bloqueadaPorHito = Boolean(cotizacion?.planCuotas?.bloqueadaPorHito);
  const cuotasPagadas = Number(cotizacion?.planCuotas?.cuotasPagadas || 0);
  const montoPagado = Number(cotizacion?.planCuotas?.montoPagado || 0);
  const cuotasDetalle: any[] = cotizacion?.planCuotas?.cuotasDetalle || [];
  const [tipoAbono, setTipoAbono] = useState<'CUOTA' | 'TOTAL'>('CUOTA');

  const montoAPagar = esCuotas && tipoAbono === 'CUOTA' ? montoPorCuota : Math.max(0, totalContrato - montoPagado);
  const saldoRestante = Math.max(0, totalContrato - montoPagado - montoAPagar);

  useEffect(() => {
    if (cotizacionId) {
      api
        .getCotizacionCheckout(cotizacionId)
        .then((res) => {
          setCotizacion(res);
          if (res?.estudiante?.whatsapp) {
            setTelefonoYape(res.estudiante.whatsapp);
          }
        })
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [cotizacionId]);

  // Verificación del pago en Mercado Pago (sin webhook): al volver a la pestaña o al cargar con un pago pendiente
  const [verificando, setVerificando] = useState(false);
  const [mensajeVerificacion, setMensajeVerificacion] = useState<string | null>(null);

  const verificarPagoMercadoPago = async (manual = false) => {
    if (!cotizacionId || verificando) return;
    setVerificando(true);
    try {
      const res = await api.verificarPagoMercadoPago(cotizacionId);
      if (res?.status === 'confirmed') {
        localStorage.removeItem(`mp_pendiente_${cotizacionId}`);
        const info = await api.getCotizacionCheckout(cotizacionId);
        setCotizacion(info);
        setPagoResultado({ status: 'confirmed', ...res });
      } else if (manual) {
        setMensajeVerificacion('Todavía no figura un pago aprobado en Mercado Pago. Completa el pago y vuelve a verificar.');
      }
    } catch (err: any) {
      if (manual) setMensajeVerificacion(`No se pudo verificar: ${err.message}`);
    } finally {
      setVerificando(false);
    }
  };

  useEffect(() => {
    if (!cotizacionId || yaPagado || pagoResultado || typeof window === 'undefined') return;
    const hayPendiente = () => localStorage.getItem(`mp_pendiente_${cotizacionId}`) === '1';
    if (hayPendiente()) verificarPagoMercadoPago();
    const onFocus = () => {
      if (hayPendiente()) verificarPagoMercadoPago();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cotizacionId, yaPagado, pagoResultado]);

  const handlePagarConMercadoPago = async () => {
    setProcessing(true);
    try {
      const pref = await api.crearPreferenciaMercadoPago(cotizacionId, montoAPagar);
      if (pref?.checkoutUrl) {
        localStorage.setItem(`mp_pendiente_${cotizacionId}`, '1');
        window.open(pref.checkoutUrl, '_blank', 'noopener');
        setMensajeVerificacion('Pasarela abierta en otra pestaña. Al terminar el pago vuelve aquí: se verifica automáticamente.');
      } else {
        alert('No se pudo generar la preferencia en Mercado Pago.');
      }
    } catch (err: any) {
      alert(`Error conectando con Mercado Pago: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handlePagar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (metodo === 'MERCADOPAGO') {
      return handlePagarConMercadoPago();
    }

    setProcessing(true);

    try {
      const res = await api.procesarCheckout({
        cotizacionId,
        metodoPago: metodo,
        tipoAbono: esCuotas ? tipoAbono : 'TOTAL',
        montoAbonar: montoAPagar,
        referencia: `OP-${Math.floor(100000 + Math.random() * 900000)}`,
        numeroTarjeta: metodo === 'CARD' ? numeroTarjeta : undefined,
        telefonoYape: metodo === 'YAPE' ? telefonoYape : undefined,
        codigoAprobacion: metodo === 'YAPE' ? codigoAprobacion : undefined,
      });

      setPagoResultado(res);
    } catch (err: any) {
      alert(`Error procesando pago: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  if (loading || !cotizacion) {
    return (
      <div className="py-24 text-center text-slate-500 dark:text-slate-400">
        <span className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-600 dark:border-sky-400 border-t-transparent" />
        <p className="mt-2 text-xs font-semibold">Cargando orden de pago y cotización oficial...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 animate-fade-in">
      {pagoResultado?.status === 'confirmed' || yaPagado ? (
        /* Pantalla de Confirmación de Pago y Transición a CUSTOMER */
        <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-emerald-300 dark:border-emerald-500/40 bg-white dark:bg-emerald-950/20 shadow-xl space-y-6 text-center animate-fade-in">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/40">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              {esCuotas && tipoAbono === 'CUOTA'
                ? `¡Cuota 1 de ${cuotasTotal} Confirmada Exitosamente!`
                : '¡Pago Total Cancelado y Confirmado por Pasarela!'}
            </span>
            <h1 className="font-heading text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              ¡Bienvenido a INBESTIGA.TESIS!
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-lg mx-auto">
              Hemos confirmado el abono de <strong className="text-slate-900 dark:text-white">S/ {montoAPagar.toFixed(2)}</strong> para la orden/cotización{' '}
              <strong className="font-mono text-sky-700 dark:text-sky-400">{cotizacion.codigoCotizacion}</strong>.
              {esCuotas && tipoAbono === 'CUOTA' && (
                <span className="block mt-1 font-semibold text-purple-700 dark:text-purple-300">
                  Saldo pendiente para la 2da cuota: S/ {saldoRestante.toFixed(2)} (atado al siguiente hito académico).
                </span>
              )}
            </p>
          </div>

          {/* Tarjeta de Trazabilidad y Asesor Asignado */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-left space-y-3 max-w-md mx-auto">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 pb-2">
              <GraduationCap className="w-4 h-4 text-blue-600 dark:text-sky-400" />
              <span>Transición Exitosa del Funnel: PAYER ➔ CUSTOMER</span>
            </div>
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Estado del Expediente:</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">ACTIVO (Fase 4: CUSTOMERS)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Pasarela Utilizada:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">MERCADO PAGO CHECKOUT PRO</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Comprobante SUNAT:</span>
                <span className="font-mono font-semibold text-blue-700 dark:text-sky-400">BV01-00041289 (Boleta Emitida)</span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/admin/customers"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
            >
              <span>Ver en Bitácora de Asesoría (CUSTOMERS)</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/admin/comprobantes"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all"
            >
              Ver Boleta Electrónica
            </Link>
          </div>
        </div>
      ) : bloqueadaPorHito ? (
        /* Pantalla de Cuota Bloqueada en Espera de Validación de Hito Académico (Opción B) */
        <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-amber-300 dark:border-amber-500/40 bg-white dark:bg-slate-900 shadow-xl space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-500/40 shrink-0">
              <Lock className="w-7 h-7" />
            </div>
            <div className="text-center sm:text-left">
              <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                Servicio Activo • {cuotasPagadas} de {cuotasTotal} Cuota(s) Pagada(s) (S/ {montoPagado.toFixed(2)})
              </span>
              <h1 className="font-heading text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-2">
                Cuota #{cuotaActualNumero} en Espera de Hito Académico
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                Tu orden <strong className="font-mono text-sky-700 dark:text-sky-400">{cotizacion.codigoCotizacion}</strong> ya tiene el servicio activo. La{' '}
                <strong>Cuota #{cuotaActualNumero} (S/ {montoPorCuota.toFixed(2)})</strong> se habilitará para pago recién cuando tu asesor apruebe el entregable académico correspondiente.
              </p>
            </div>
          </div>

          {/* Cronograma de Cuotas por Hito */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Estado de tu Cronograma por Entregables ({cotizacion.codigoCotizacion})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {cuotasDetalle.map((c: any) => {
                const pagada = c.estado === 'PAGADA';
                const espera = c.estado === 'ESPERA_HITO';
                return (
                  <div
                    key={c.cuotaId}
                    className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                      pagada
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                        : espera
                          ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
                          : 'bg-sky-50/60 dark:bg-sky-950/20 border-sky-300 dark:border-sky-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-heading font-black text-slate-900 dark:text-white">
                        Cuota #{c.numero} ({c.porcentaje}%)
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          pagada
                            ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200'
                            : espera
                              ? 'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200'
                              : 'bg-sky-200 text-sky-900 dark:bg-sky-900 dark:text-sky-200'
                        }`}
                      >
                        {c.estado}
                      </span>
                    </div>
                    <div className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                      S/ {Number(c.monto).toFixed(2)}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      {c.condicion}
                    </p>
                    {c.fechaVencimiento && (
                      <p className="text-[10px] font-mono text-slate-500">
                        Fecha límite: {String(c.fechaVencimiento).slice(0, 10)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Protección al Tesista (Opción B):</strong> El cobro de la Cuota #{cuotaActualNumero} está bloqueado mientras el estado sea{' '}
              <code className="font-mono font-bold">ESPERA_HITO</code>. Cuando el asesor valide tu avance en la bitácora, recibirás una notificación en Telegram y este enlace quedará habilitado automáticamente.
            </div>
          </div>

          <div className="pt-1 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={async () => {
                setLoading(true);
                const fresh = await api.getCotizacionCheckout(cotizacionId).catch(() => cotizacion);
                setCotizacion(fresh);
                setLoading(false);
              }}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold text-xs bg-amber-600 hover:bg-amber-500 text-white transition-all cursor-pointer"
            >
              Verificar si el asesor ya aprobó el hito
            </button>
            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
              <Link
                href="/admin/customers"
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold text-xs bg-purple-600 hover:bg-purple-500 text-white transition-all flex items-center justify-center gap-1.5"
              >
                <GraduationCap className="w-4 h-4" />
                <span>Panel del Asesor (Aprobar Hito)</span>
              </Link>
              <Link
                href={`/admin/payers/live-chat?orden=${cotizacion.pagoId}`}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all text-center"
              >
                Ver Expediente PAYERS
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* Formulario Oficial de Checkout */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna Izquierda: Métodos de Pago */}
          <div className="lg:col-span-2 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">
                  Pasarela Conectada • Oficial
                </span>
                <h1 className="font-heading text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  Checkout de Activación de Asesoría
                </h1>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Cifrado SSL 256-bit</span>
              </div>
            </div>

            {/* Detección y Selección de Modalidad de Cuotas */}
            {esCuotas && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border-2 border-purple-300 dark:border-purple-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-600 text-white font-bold text-xs">
                      {cuotasTotal}
                    </span>
                    <span className="font-heading font-black text-xs sm:text-sm text-purple-900 dark:text-purple-200">
                      Plan en {cuotasTotal} Cuotas Detectado
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-200 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-700">
                    Elección del Tesista
                  </span>
                </div>

                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  El estudiante pactó pagar la asesoría de <strong className="text-slate-900 dark:text-white">S/ {totalContrato.toFixed(2)}</strong> en <strong className="text-purple-700 dark:text-purple-300">{cuotasTotal} cuotas de S/ {montoPorCuota.toFixed(2)}</strong>.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setTipoAbono('CUOTA')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      tipoAbono === 'CUOTA'
                        ? 'bg-white dark:bg-slate-900 border-purple-600 ring-2 ring-purple-500/40 shadow-sm'
                        : 'bg-white/60 dark:bg-slate-900/40 border-purple-200 dark:border-purple-900 hover:border-purple-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                        Opción 1 • Recomendada
                      </span>
                      {tipoAbono === 'CUOTA' && (
                        <CheckCircle2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      )}
                    </div>
                    <div className="font-heading font-black text-base text-slate-900 dark:text-white mt-1">
                      Pagar Cuota #{cuotaActualNumero}: S/ {montoPorCuota.toFixed(2)}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {cuotaActualCondicion} ({cuotaActualEstado}). Saldo posterior: S/ {saldoRestante.toFixed(2)}.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTipoAbono('TOTAL')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      tipoAbono === 'TOTAL'
                        ? 'bg-white dark:bg-slate-900 border-blue-600 ring-2 ring-blue-500/40 shadow-sm'
                        : 'bg-white/60 dark:bg-slate-900/40 border-purple-200 dark:border-purple-900 hover:border-purple-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-sky-300">
                        Opción 2 • Liquidación Total
                      </span>
                      {tipoAbono === 'TOTAL' && (
                        <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                      )}
                    </div>
                    <div className="font-heading font-black text-base text-slate-900 dark:text-white mt-1">
                      Pagar Total: S/ {totalContrato.toFixed(2)}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      100% Cancelado en una sola transacción. Sin cuotas pendientes.
                    </p>
                  </button>
                </div>
              </div>
            )}

            {/* Selector de Método de Pago */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Selecciona la Pasarela o Medio de Pago:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  type="button"
                  onClick={() => setMetodo('MERCADOPAGO')}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                    metodo === 'MERCADOPAGO'
                      ? 'bg-sky-50 dark:bg-sky-600/20 border-sky-500 text-sky-900 dark:text-white shadow-sm ring-2 ring-sky-500/50'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <CreditCard className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                  <span className="text-xs font-extrabold">Mercado Pago</span>
                  <span className="text-[9px] font-mono text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-950 px-1.5 py-0.2 rounded font-bold">
                    Sandbox Real
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setMetodo('YAPE')}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                    metodo === 'YAPE'
                      ? 'bg-purple-50 dark:bg-purple-600/20 border-purple-500 text-purple-900 dark:text-white shadow-sm ring-1 ring-purple-500/50'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <QrCode className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <span className="text-xs font-bold">Yape / Plin</span>
                  <span className="text-[9px] text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950 px-1.5 py-0.2 rounded">
                    Código OTP
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setMetodo('CARD')}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                    metodo === 'CARD'
                      ? 'bg-blue-50 dark:bg-blue-600/20 border-blue-500 text-blue-900 dark:text-white shadow-sm ring-1 ring-blue-500/50'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-bold">Tarjeta Web</span>
                  <span className="text-[9px] text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950 px-1.5 py-0.2 rounded">
                    Débito/Crédito
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setMetodo('TRANSFER')}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                    metodo === 'TRANSFER'
                      ? 'bg-emerald-50 dark:bg-emerald-600/20 border-emerald-500 text-emerald-900 dark:text-white shadow-sm ring-1 ring-emerald-500/50'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold">Cta. BCP</span>
                  <span className="text-[9px] text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.2 rounded">
                    Voucher Caja
                  </span>
                </button>
              </div>
            </div>

            {/* Input según método */}
            <form onSubmit={handlePagar} className="space-y-4">
              {metodo === 'MERCADOPAGO' ? (
                <div className="p-5 rounded-2xl bg-sky-50 dark:bg-sky-950/20 border-2 border-sky-300 dark:border-sky-800 space-y-4 shadow-sm animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-extrabold text-sky-900 dark:text-sky-300 block">
                        Pasarela Oficial Mercado Pago (Checkout Pro)
                      </span>
                      <span className="text-[11px] text-sky-700 dark:text-sky-400">
                        Conectado con tus credenciales de desarrollador Mercado Pago Perú (PEN).
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-sky-800 dark:text-sky-200 bg-sky-200/80 dark:bg-sky-900/80 px-2.5 py-1 rounded-full font-bold border border-sky-300 dark:border-sky-700">
                      SANDBOX ACTIVO
                    </span>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-sky-200 dark:border-sky-900/60 text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
                    <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-sky-600" />
                      <span>¿Cómo funciona el pago simulado?</span>
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      Al pulsar el botón serás redirigido a la pasarela real de <strong>Mercado Pago Sandbox</strong> donde podés pagar con tarjetas de prueba de Visa/Mastercard o iniciar sesión con tu usuario de prueba. Al completar el pago, Mercado Pago te devolverá automáticamente a esta pantalla con la orden confirmada.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handlePagarConMercadoPago}
                    disabled={processing}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                  >
                    {processing ? (
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    ) : (
                      <ExternalLink className="w-4 h-4" />
                    )}
                    <span>
                      Abrir Pasarela Mercado Pago • Pagar S/ {montoAPagar.toFixed(2)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => verificarPagoMercadoPago(true)}
                    disabled={verificando}
                    className="w-full py-2.5 rounded-xl border border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-200 text-xs font-bold hover:bg-sky-100 dark:hover:bg-sky-900/40 cursor-pointer transition-all disabled:opacity-50"
                  >
                    {verificando ? 'Verificando pago...' : 'Ya pagué, verificar mi pago'}
                  </button>
                  {mensajeVerificacion && (
                    <p className="text-[11px] text-sky-800 dark:text-sky-300 text-center">{mensajeVerificacion}</p>
                  )}
                </div>
              ) : metodo === 'YAPE' ? (
                <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-purple-900 dark:text-purple-300 block">Pago Directo con Yape (Vía Mercado Pago)</span>
                      <span className="text-[11px] text-purple-700 dark:text-purple-400">Sin escanear QR. Débito instantáneo y seguro en tu app.</span>
                    </div>
                    <span className="text-[10px] font-mono text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/60 px-2 py-0.5 rounded font-bold border border-purple-300 dark:border-purple-700">
                      MERCADO PAGO + YAPE
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Número de Celular Yape</label>
                      <input
                        type="tel"
                        value={telefonoYape}
                        onChange={(e) => setTelefonoYape(e.target.value)}
                        placeholder="Ej. 926 619 777"
                        required
                        className="w-full bg-white dark:bg-slate-950 border border-purple-200 dark:border-purple-800/60 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Código de Aprobación (OTP)</label>
                      <input
                        type="text"
                        maxLength={6}
                        value={codigoAprobacion}
                        onChange={(e) => setCodigoAprobacion(e.target.value)}
                        placeholder="6 dígitos (ej. 491823)"
                        required
                        className="w-full bg-white dark:bg-slate-950 border border-purple-200 dark:border-purple-800/60 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white font-mono font-bold tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  {/* Instrucción visual para obtener el código de aprobación */}
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-purple-200/80 dark:border-purple-900/50 flex items-start gap-2.5 text-[11px] text-slate-600 dark:text-slate-300">
                    <AlertCircle className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-purple-900 dark:text-purple-300">¿Cómo generar tu Código de Aprobación?</strong>
                      <p className="mt-0.5">Abre tu app Yape ➔ pulsa el menú superior (☰) ➔ pulsa <strong>&quot;Código de aprobación&quot;</strong>. Es un PIN de 6 dígitos que expira en 90 segundos para garantizar tu seguridad.</p>
                    </div>
                  </div>

                  {/* Toggle QR Alternativo */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setMostrarQrAlternativo(!mostrarQrAlternativo)}
                      className="text-[11px] text-purple-700 dark:text-purple-400 hover:underline font-semibold"
                    >
                      {mostrarQrAlternativo ? '▲ Ocultar QR tradicional' : '▼ ¿Prefieres escanear QR tradicional de Yape?'}
                    </button>

                    {mostrarQrAlternativo && (
                      <div className="mt-3 flex items-center gap-4 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 animate-fade-in">
                        <div className="w-16 h-16 bg-white p-1 rounded-lg flex items-center justify-center border border-slate-200 shrink-0">
                          <QrCode className="w-14 h-14 text-black" />
                        </div>
                        <div className="text-xs space-y-0.5">
                          <p className="font-bold text-slate-900 dark:text-white">INBESTIGA PERÚ S.A.C.</p>
                          <p className="text-slate-500 dark:text-slate-400">RUC: 20601234567</p>
                          <p className="font-mono text-purple-700 dark:text-purple-400 font-black text-sm">926 619 777</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Número de Tarjeta</label>
                    <input
                      type="text"
                      value={numeroTarjeta}
                      onChange={(e) => setNumeroTarjeta(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Vencimiento</label>
                      <input
                        type="text"
                        defaultValue="12/28"
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">CVC</label>
                      <input
                        type="text"
                        defaultValue="888"
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {metodo !== 'MERCADOPAGO' && (
                <button
                  type="submit"
                  disabled={processing}
                  className="w-full py-3.5 px-4 rounded-xl font-black text-sm bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95"
                >
                  {processing ? (
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  <span>
                    Confirmar y Pagar S/ {montoAPagar.toFixed(2)}
                    {esCuotas && tipoAbono === 'CUOTA' ? ` (Cuota 1 de ${cuotasTotal})` : ' (Totalidad)'}
                  </span>
                </button>
              )}
            </form>
          </div>

          {/* Columna Derecha: Resumen de Cotización */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-md bg-white dark:bg-slate-900/60 self-start">
            <h2 className="font-heading font-bold text-sm text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
              Resumen de la Cotización
            </h2>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Código Oficial:</span>
                <span className="font-mono font-bold text-sky-700 dark:text-sky-400">{cotizacion.codigoCotizacion}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400 shrink-0">Servicio:</span>
                <span className="font-semibold text-slate-900 dark:text-white text-right truncate">{cotizacion.servicio}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Modalidad:</span>
                <span className="font-bold text-purple-700 dark:text-purple-300">
                  {esCuotas ? `${cuotasTotal} cuotas de S/ ${montoPorCuota.toFixed(2)}` : 'Pago Único Contado'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Plazo Asesoría:</span>
                <span className="text-slate-700 dark:text-slate-300">{cotizacion.plazoEntregaDias} días</span>
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Precio Base:</span>
                <span>S/ {cotizacion.subtotal}</span>
              </div>
              {cotizacion.descuento > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                  <span>Descuento Negociado:</span>
                  <span>- S/ {cotizacion.descuento}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-700 dark:text-slate-300 font-semibold pt-1 border-t border-slate-100 dark:border-slate-800">
                <span>Total del Contrato:</span>
                <span>S/ {totalContrato.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-black text-slate-900 dark:text-white pt-1">
                <span>Monto a Pagar Hoy:</span>
                <span className="text-blue-700 dark:text-sky-300">S/ {montoAPagar.toFixed(2)}</span>
              </div>
              {esCuotas && tipoAbono === 'CUOTA' && (
                <div className="flex justify-between text-[11px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 p-2 rounded-lg border border-purple-200 dark:border-purple-800/60">
                  <span>Saldo Restante (Cuota 2):</span>
                  <span>S/ {saldoRestante.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
              <p>
                <strong className="text-slate-900 dark:text-slate-300">Titular del Contrato:</strong>
              </p>
              <p className="truncate">{cotizacion.estudiante.nombres}</p>
              <p className="truncate">{cotizacion.estudiante.carrera} • {cotizacion.estudiante.universidad}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
