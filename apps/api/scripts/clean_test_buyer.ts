import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanTestBuyer() {
  console.log('--- Iniciando limpieza segura de usuario de prueba (Luis Josmell Cruz Esquivel) ---');

  const buyer = await prisma.buyer.findFirst({
    where: {
      OR: [
        { whatsapp: '51926619777' },
        { whatsapp: '926619777' },
        { email: 'luis@gmail.com' },
        { AND: [{ nombres: { contains: 'Josmell' } }, { apellidos: { contains: 'Cruz' } }] },
      ],
    },
    include: {
      lead: true,
      conversaciones: true,
      pagos: true,
      payer: true,
      customer: true,
    },
  });

  if (!buyer) {
    console.log('ℹ No se encontró ningún registro para Luis Josmell Cruz Esquivel. La base de datos ya está limpia y lista para registrarse desde cero.');
    return;
  }

  console.log(`Encontrado BUYER: ${buyer.nombres} ${buyer.apellidos} (ID: ${buyer.id}, WhatsApp: ${buyer.whatsapp})`);

  // 1. Eliminar sesiones y asignaciones de asesor si tiene customer
  if (buyer.customer) {
    await prisma.sesion.deleteMany({ where: { customerId: buyer.customer.id } });
    await prisma.asignacionAsesor.deleteMany({ where: { customerId: buyer.customer.id } });
    await prisma.customer.delete({ where: { id: buyer.customer.id } });
    console.log('✓ Customer, sesiones y asignaciones eliminados.');
  }

  // 2. Eliminar PAYER
  if (buyer.payer) {
    await prisma.payer.delete({ where: { id: buyer.payer.id } });
    console.log('✓ Payer eliminado.');
  }

  // 3. Eliminar Pagos
  const deletedPagos = await prisma.pago.deleteMany({ where: { buyerId: buyer.id } });
  console.log(`✓ ${deletedPagos.count} pago(s) eliminados.`);

  // 4. Eliminar Cotizaciones vinculadas a sus leads
  if (buyer.lead) {
    const deletedCotizaciones = await prisma.cotizacion.deleteMany({ where: { leadId: buyer.lead.id } });
    console.log(`✓ ${deletedCotizaciones.count} cotización(es) eliminadas.`);
  }

  // 5. Eliminar mensajes, diagnósticos, propuestas, objeciones y conversaciones
  for (const conv of buyer.conversaciones) {
    await prisma.mensaje.deleteMany({ where: { conversacionId: conv.id } });
    await prisma.diagnostico.deleteMany({ where: { conversacionId: conv.id } });
    await prisma.propuesta.deleteMany({ where: { conversacionId: conv.id } });
    await prisma.objecion.deleteMany({ where: { conversacionId: conv.id } });
    await prisma.seguimiento.deleteMany({ where: { conversacionId: conv.id } });
  }
  await prisma.conversacion.deleteMany({ where: { buyerId: buyer.id } });
  console.log('✓ Conversaciones y mensajes eliminados.');

  // 6. Eliminar LEAD, Perfil, Formularios e Interacciones
  if (buyer.lead) {
    await prisma.lead.delete({ where: { id: buyer.lead.id } });
    console.log('✓ Lead eliminado.');
  }

  await prisma.perfilNegociacion.deleteMany({ where: { buyerId: buyer.id } });
  await prisma.formulario.deleteMany({ where: { buyerId: buyer.id } });
  await prisma.interaccion.deleteMany({ where: { buyerId: buyer.id } });

  // 7. Eliminar NOTIFICACIONES asociadas al buyer
  await prisma.notificacion.deleteMany({
    where: {
      OR: [
        { titulo: { contains: 'Cruz Esquivel' } },
        { titulo: { contains: 'Josmell' } },
        { mensaje: { contains: '926619777' } },
        { metadata: { contains: buyer.id } },
      ],
    },
  });

  // 8. Eliminar BUYER
  await prisma.buyer.delete({ where: { id: buyer.id } });
  console.log('✓ BUYER eliminado exitosamente.');

  console.log('=============================================================================');
  console.log('🎉 Limpieza completada con éxito.');
  console.log('El usuario Luis Josmell Cruz Esquivel ha sido removido de la base de datos.');
  console.log('Ahora puedes ingresar a http://localhost:3000/formulario y registrar sus datos desde cero.');
  console.log('=============================================================================');
}

cleanTestBuyer()
  .catch((e) => {
    console.error('Error durante la limpieza:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
