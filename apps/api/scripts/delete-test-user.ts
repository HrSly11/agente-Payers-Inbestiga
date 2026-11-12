import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function deleteTestUser(identifier: string = '926619777') {
  console.log(`Buscando registros de prueba para: ${identifier}...`);

  const buyers = await prisma.buyer.findMany({
    where: {
      OR: [
        { whatsapp: { contains: identifier } },
        { email: { contains: 'pandaman' } },
        { nombres: { contains: 'Luis Josmell' } },
      ],
    },
    include: {
      lead: {
        include: {
          cotizaciones: true,
        },
      },
      customer: true,
      payer: true,
    },
  });

  for (const buyer of buyers) {
    console.log(`Eliminando registros de buyer: ${buyer.nombres} ${buyer.apellidos} (${buyer.id})`);

    // 1. Eliminar sesiones y clientes asociados
    if (buyer.customer) {
      await prisma.sesion.deleteMany({ where: { customerId: buyer.customer.id } });
      await prisma.customer.delete({ where: { id: buyer.customer.id } });
    }

    // 2. Eliminar payers y pagos
    if (buyer.payer) {
      await prisma.payer.delete({ where: { id: buyer.payer.id } });
    }
    await prisma.pago.deleteMany({ where: { buyerId: buyer.id } });

    // 3. Eliminar conversaciones, mensajes y relaciones asociadas al lead y al buyer
    const convs = await prisma.conversacion.findMany({
      where: {
        OR: [
          { buyerId: buyer.id },
          ...(buyer.lead ? [{ leadId: buyer.lead.id }] : []),
        ],
      },
    });

    for (const c of convs) {
      await prisma.mensaje.deleteMany({ where: { conversacionId: c.id } });
      await prisma.diagnostico.deleteMany({ where: { conversacionId: c.id } });
      await prisma.objecion.deleteMany({ where: { conversacionId: c.id } });
      await prisma.seguimiento.deleteMany({ where: { conversacionId: c.id } });
      await prisma.propuesta.deleteMany({ where: { conversacionId: c.id } });
      await prisma.conversacion.delete({ where: { id: c.id } }).catch(() => null);
    }

    // 4. Eliminar cotizaciones, propuestas y lead
    if (buyer.lead) {
      await prisma.pago.deleteMany({ where: { leadId: buyer.lead.id } });
      await prisma.cotizacion.deleteMany({ where: { leadId: buyer.lead.id } });
      await prisma.propuesta.deleteMany({ where: { leadId: buyer.lead.id } });
      await prisma.lead.delete({ where: { id: buyer.lead.id } });
    }

    // 5. Perfil de negociación, formularios, interacciones y buyer
    await prisma.perfilNegociacion.deleteMany({ where: { buyerId: buyer.id } });
    await prisma.formulario.deleteMany({ where: { buyerId: buyer.id } });
    await prisma.interaccion.deleteMany({ where: { buyerId: buyer.id } });
    await prisma.buyer.delete({ where: { id: buyer.id } });
    console.log(`✓ Buyer y datos asociados eliminados exitosamente.`);
  }

  console.log(`Limpieza completada con éxito.`);
}

if (require.main === module) {
  const arg = process.argv[2] || '926619777';
  deleteTestUser(arg)
    .catch((e) => console.error('Error durante la eliminación:', e))
    .finally(() => prisma.$disconnect());
}
