import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function syncCulqiPanelReal() {
  console.log('Ingresando transacciones reales de CulqiPanel...');

  const servicio = await prisma.servicio.findFirst();
  if (!servicio) throw new Error('No se encontró servicio.');

  const asesor = await prisma.asesor.findFirst();

  // 1. LUIS CRUZ ESQUIVEL (dejerbakers1@gmail.com)
  let buyerLuis = await prisma.buyer.findFirst({
    where: {
      OR: [
        { email: 'dejerbakers1@gmail.com' },
        { whatsapp: { contains: '926619777' } },
        { nombres: { contains: 'Luis' } },
      ],
    },
  });

  if (!buyerLuis) {
    buyerLuis = await prisma.buyer.create({
      data: {
        nombres: 'Luis',
        apellidos: 'Cruz Esquivel',
        email: 'dejerbakers1@gmail.com',
        whatsapp: '51926619777',
        ciclo: '10mo ciclo',
        tipoInvestigacion: 'TRABAJO_INVESTIGACION_BACHILLER',
        estadoFunnel: 'CUSTOMER',
        consentimientoWhatsapp: true,
      },
    });
  } else {
    buyerLuis = await prisma.buyer.update({
      where: { id: buyerLuis.id },
      data: {
        nombres: 'Luis',
        apellidos: 'Cruz Esquivel',
        email: 'dejerbakers1@gmail.com',
        estadoFunnel: 'CUSTOMER',
      },
    });
  }

  let leadLuis = await prisma.lead.findFirst({ where: { buyerId: buyerLuis.id } });
  if (!leadLuis) {
    leadLuis = await prisma.lead.create({
      data: {
        buyer: { connect: { id: buyerLuis.id } },
        scoreCalificado: 100,
        prioridad: 'ALTA',
        umbralSuperado: true,
      },
    });
  }

  let cotLuis = await prisma.cotizacion.findFirst({ where: { leadId: leadLuis.id } });
  if (!cotLuis) {
    cotLuis = await prisma.cotizacion.create({
      data: {
        lead: { connect: { id: leadLuis.id } },
        servicio: { connect: { id: servicio.id } },
        codigoCotizacion: 'COT-2026-00026891',
        subtotal: 6,
        descuento: 0,
        total: 6,
        cuotas: 1,
        plazoEntregaDias: 45,
        fechaExpiracion: new Date(Date.now() + 7 * 86400000),
        estado: 'ACEPTADA',
      },
    });
  }

  // Transacción 1: ord_live_TLHdcffTCP8wzWR6 (Aprobada - S/ 6.00)
  const pagoAprobado = await prisma.pago.upsert({
    where: { gatewayTransactionId: 'ord_live_TLHdcffTCP8wzWR6' },
    update: {
      estado: 'CONFIRMADO',
      monto: 6,
      metodoPago: 'PagoEfectivo',
      fechaConfirmacion: new Date('2026-09-18T11:35:00-05:00'),
    },
    create: {
      cotizacion: { connect: { id: cotLuis.id } },
      buyer: { connect: { id: buyerLuis.id } },
      lead: { connect: { id: leadLuis.id } },
      gatewayProveedor: 'CULQI',
      gatewayTransactionId: 'ord_live_TLHdcffTCP8wzWR6',
      monto: 6,
      moneda: 'PEN',
      metodoPago: 'PagoEfectivo',
      estado: 'CONFIRMADO',
      fechaCreacion: new Date('2026-09-18T11:35:00-05:00'),
      fechaConfirmacion: new Date('2026-09-18T11:35:00-05:00'),
      gatewayPayload: JSON.stringify({
        id: 'ord_live_TLHdcffTCP8wzWR6',
        id_venta: '000268916994',
        payment_code: '416617638',
        state: 'paid',
        client_details: { email: 'dejerbakers1@gmail.com', first_name: 'Luis', last_name: 'Cruz Esquivel' },
      }),
    },
  });

  // Payer Luis
  let payerLuis = await prisma.payer.findUnique({ where: { buyerId: buyerLuis.id } });
  if (!payerLuis) {
    payerLuis = await prisma.payer.create({
      data: {
        buyer: { connect: { id: buyerLuis.id } },
        lead: { connect: { id: leadLuis.id } },
        primerPago: { connect: { id: pagoAprobado.id } },
        montoTotalPagado: 6,
        metodoPrincipal: 'PagoEfectivo',
        estado: 'ACTIVO',
      },
    });
  }

  // Customer Luis
  let customerLuis = await prisma.customer.findUnique({ where: { buyerId: buyerLuis.id } });
  if (!customerLuis) {
    customerLuis = await prisma.customer.create({
      data: {
        buyer: { connect: { id: buyerLuis.id } },
        lead: { connect: { id: leadLuis.id } },
        payer: { connect: { id: payerLuis.id } },
        cotizacion: { connect: { id: cotLuis.id } },
        servicio: { connect: { id: servicio.id } },
        ...(asesor ? { asesor: { connect: { id: asesor.id } } } : {}),
        fechaInicioServicio: new Date(),
        estadoServicio: 'ACTIVO',
        observaciones: 'Acreditación automática por CulqiLink / PagoEfectivo (000268916994)',
      },
    });
  }

  // Transacción 2: ord_live_mt2CuPyO1rx43cqp (Pendiente - S/ 6.00)
  await prisma.pago.upsert({
    where: { gatewayTransactionId: 'ord_live_mt2CuPyO1rx43cqp' },
    update: { estado: 'EXPIRADO' },
    create: {
      cotizacion: { connect: { id: cotLuis.id } },
      buyer: { connect: { id: buyerLuis.id } },
      lead: { connect: { id: leadLuis.id } },
      gatewayProveedor: 'CULQI',
      gatewayTransactionId: 'ord_live_mt2CuPyO1rx43cqp',
      monto: 6,
      moneda: 'PEN',
      metodoPago: 'PagoEfectivo',
      estado: 'EXPIRADO',
      fechaCreacion: new Date('2026-09-18T11:31:00-05:00'),
      gatewayPayload: JSON.stringify({
        id: 'ord_live_mt2CuPyO1rx43cqp',
        state: 'pending',
        payment_code: '416616813',
      }),
    },
  });

  // 2. ALVARO JOSEPH PAZ ROMERO (pandaman010608@gmail.com)
  let buyerAlvaro = await prisma.buyer.findFirst({ where: { email: 'pandaman010608@gmail.com' } });
  if (!buyerAlvaro) {
    buyerAlvaro = await prisma.buyer.create({
      data: {
        nombres: 'Alvaro Joseph',
        apellidos: 'Paz Romero',
        email: 'pandaman010608@gmail.com',
        whatsapp: '51926619777',
        ciclo: '10mo ciclo',
        tipoInvestigacion: 'TESIS',
        estadoFunnel: 'LEAD',
      },
    });
  }
  let leadAlvaro = await prisma.lead.findFirst({ where: { buyerId: buyerAlvaro.id } });
  if (!leadAlvaro) {
    leadAlvaro = await prisma.lead.create({
      data: {
        buyer: { connect: { id: buyerAlvaro.id } },
        scoreCalificado: 85,
        prioridad: 'ALTA',
        umbralSuperado: true,
      },
    });
  }
  let cotAlvaro = await prisma.cotizacion.findFirst({ where: { leadId: leadAlvaro.id } });
  if (!cotAlvaro) {
    cotAlvaro = await prisma.cotizacion.create({
      data: {
        lead: { connect: { id: leadAlvaro.id } },
        servicio: { connect: { id: servicio.id } },
        codigoCotizacion: 'COT-2026-ALVARO',
        subtotal: 6,
        descuento: 0,
        total: 6,
        cuotas: 1,
        plazoEntregaDias: 30,
        fechaExpiracion: new Date(Date.now() + 7 * 86400000),
        estado: 'PENDIENTE',
      },
    });
  }

  // Transacción 3: ord_live_2CGxmZ6M3LhESRm (Pendiente - S/ 6.00)
  await prisma.pago.upsert({
    where: { gatewayTransactionId: 'ord_live_2CGxmZ6M3LhESRm' },
    update: { estado: 'PENDIENTE' },
    create: {
      cotizacion: { connect: { id: cotAlvaro.id } },
      buyer: { connect: { id: buyerAlvaro.id } },
      lead: { connect: { id: leadAlvaro.id } },
      gatewayProveedor: 'CULQI',
      gatewayTransactionId: 'ord_live_2CGxmZ6M3LhESRm',
      monto: 6,
      moneda: 'PEN',
      metodoPago: 'PagoEfectivo',
      estado: 'PENDIENTE',
      fechaCreacion: new Date('2026-09-18T11:28:00-05:00'),
      gatewayPayload: JSON.stringify({
        id: 'ord_live_2CGxmZ6M3LhESRm',
        payment_code: '416615345',
        state: 'pending',
      }),
    },
  });

  // 3. JOSEPH PAREDES (jlparedesll@unitru.edu.pe)
  let buyerJoseph = await prisma.buyer.findFirst({ where: { email: 'jlparedesll@unitru.edu.pe' } });
  if (!buyerJoseph) {
    buyerJoseph = await prisma.buyer.create({
      data: {
        nombres: 'Joseph',
        apellidos: 'Paredes',
        email: 'jlparedesll@unitru.edu.pe',
        whatsapp: '51944112233',
        ciclo: '10mo ciclo',
        tipoInvestigacion: 'TESIS',
        estadoFunnel: 'LEAD',
      },
    });
  }
  let leadJoseph = await prisma.lead.findFirst({ where: { buyerId: buyerJoseph.id } });
  if (!leadJoseph) {
    leadJoseph = await prisma.lead.create({
      data: {
        buyer: { connect: { id: buyerJoseph.id } },
        scoreCalificado: 85,
        prioridad: 'ALTA',
        umbralSuperado: true,
      },
    });
  }
  let cotJoseph = await prisma.cotizacion.findFirst({ where: { leadId: leadJoseph.id } });
  if (!cotJoseph) {
    cotJoseph = await prisma.cotizacion.create({
      data: {
        lead: { connect: { id: leadJoseph.id } },
        servicio: { connect: { id: servicio.id } },
        codigoCotizacion: 'COT-2026-JOSEPH',
        subtotal: 10,
        descuento: 0,
        total: 10,
        cuotas: 1,
        plazoEntregaDias: 30,
        fechaExpiracion: new Date(Date.now() + 7 * 86400000),
        estado: 'PENDIENTE',
      },
    });
  }

  // Transacción 4: ord_live_UmmL7fIAPL9ETZIQ (Pendiente - S/ 10.00)
  await prisma.pago.upsert({
    where: { gatewayTransactionId: 'ord_live_UmmL7fIAPL9ETZIQ' },
    update: { estado: 'PENDIENTE' },
    create: {
      cotizacion: { connect: { id: cotJoseph.id } },
      buyer: { connect: { id: buyerJoseph.id } },
      lead: { connect: { id: leadJoseph.id } },
      gatewayProveedor: 'CULQI',
      gatewayTransactionId: 'ord_live_UmmL7fIAPL9ETZIQ',
      monto: 10,
      moneda: 'PEN',
      metodoPago: 'PagoEfectivo',
      estado: 'PENDIENTE',
      fechaCreacion: new Date('2026-09-17T17:56:00-05:00'),
      gatewayPayload: JSON.stringify({
        id: 'ord_live_UmmL7fIAPL9ETZIQ',
        payment_code: '416383151',
        state: 'pending',
      }),
    },
  });

  // 4. PEDRO PAZ ROMERO (965055811pazito@gmail.com) - DEVUELTO
  let buyerPedro = await prisma.buyer.findFirst({ where: { email: '965055811pazito@gmail.com' } });
  if (!buyerPedro) {
    buyerPedro = await prisma.buyer.create({
      data: {
        nombres: 'Pedro',
        apellidos: 'PAZ Romero',
        email: '965055811pazito@gmail.com',
        whatsapp: '51965055811',
        ciclo: 'EGRESADO',
        tipoInvestigacion: 'TESIS',
        estadoFunnel: 'LEAD',
      },
    });
  }
  let leadPedro = await prisma.lead.findFirst({ where: { buyerId: buyerPedro.id } });
  if (!leadPedro) {
    leadPedro = await prisma.lead.create({
      data: {
        buyer: { connect: { id: buyerPedro.id } },
        scoreCalificado: 75,
        prioridad: 'MEDIA',
        umbralSuperado: true,
      },
    });
  }
  let cotPedro = await prisma.cotizacion.findFirst({ where: { leadId: leadPedro.id } });
  if (!cotPedro) {
    cotPedro = await prisma.cotizacion.create({
      data: {
        lead: { connect: { id: leadPedro.id } },
        servicio: { connect: { id: servicio.id } },
        codigoCotizacion: 'COT-2026-PEDRO',
        subtotal: 0,
        descuento: 0,
        total: 0,
        cuotas: 1,
        plazoEntregaDias: 30,
        fechaExpiracion: new Date(Date.now() + 7 * 86400000),
        estado: 'RECHAZADA',
      },
    });
  }

  // Transacción 8: chr_live_KnOCYTGtCAN3NQehW (Devuelto - VISA S/ 0.00)
  await prisma.pago.upsert({
    where: { gatewayTransactionId: 'chr_live_KnOCYTGtCAN3NQehW' },
    update: { estado: 'REEMBOLSADO' },
    create: {
      cotizacion: { connect: { id: cotPedro.id } },
      buyer: { connect: { id: buyerPedro.id } },
      lead: { connect: { id: leadPedro.id } },
      gatewayProveedor: 'CULQI',
      gatewayTransactionId: 'chr_live_KnOCYTGtCAN3NQehW',
      monto: 0,
      moneda: 'PEN',
      metodoPago: 'CARD',
      estado: 'REEMBOLSADO',
      fechaCreacion: new Date('2026-09-17T14:44:00-05:00'),
      gatewayPayload: JSON.stringify({
        id: 'chr_live_KnOCYTGtCAN3NQehW',
        id_venta: '000540411540',
        card: 'VISA 455788******0435',
        refunded: true,
      }),
    },
  });

  console.log('✓ Todas las transacciones reales de CulqiPanel sincronizadas correctamente.');
}

if (require.main === module) {
  syncCulqiPanelReal()
    .catch((e) => console.error(e))
    .finally(() => prisma.$disconnect());
}
