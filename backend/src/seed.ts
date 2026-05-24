import bcrypt from 'bcryptjs';
import { prisma } from './lib/prisma.js';

const DEMO_DOCUMENTO = '1234';
const DEMO_PASSWORD = 'miganado';
const DEMO_NOMBRE = 'Juan David (demo)';

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { documento: DEMO_DOCUMENTO },
    update: { passwordHash, nombre: DEMO_NOMBRE },
    create: { documento: DEMO_DOCUMENTO, nombre: DEMO_NOMBRE, passwordHash },
  });

  // Finca demo: el usuario es dueño y cuidador.
  const fincaExistente = await prisma.finca.findFirst({
    where: { duenoId: user.id },
    orderBy: { createdAt: 'asc' },
  });
  const finca = fincaExistente ?? (await prisma.finca.create({
    data: { duenoId: user.id, cuidadorId: user.id, nombre: 'Finca demo', capacidad: 16 },
  }));

  // Limpiar lotes previos de la finca demo para dejar estado conocido
  await prisma.lote.deleteMany({ where: { fincaId: finca.id } });

  // Datos reales tomados de la planilla "Centro Comercial Ganadero SAS" (14-may-2026)
  const fecha = new Date('2026-05-14T00:00:00.000Z');

  const lote1 = await prisma.lote.create({
    data: {
      fincaId: finca.id,
      fecha,
      numeroFeria: '026',
      loteNumero: '199',
      sexo: 'VP',
      cantidad: 2,
      pesoTotal: 790,
      pesoPromedio: 395,
      valorFinal: 7600,
      valorTotal: 6004000,
      deduccion: 0,
      referencia: 'C 193608',
      valorAPagar: 6004000,
      criasMacho: 1,
      criasHembra: 1,
    },
  });

  await prisma.animal.createMany({
    data: [
      { loteId: lote1.id, identificador: 'VP-01', sexo: 'VP', peso: 410, criaSexo: 'M' },
      { loteId: lote1.id, identificador: 'VP-02', sexo: 'VP', peso: 380, criaSexo: 'H' },
    ],
  });

  await prisma.lote.create({
    data: {
      fincaId: finca.id,
      fecha,
      numeroFeria: '026',
      loteNumero: '047',
      sexo: 'MC',
      cantidad: 1,
      pesoTotal: 474,
      pesoPromedio: 474,
      valorFinal: 7900,
      valorTotal: 3744600,
      deduccion: 0,
      referencia: 'C 193634',
      valorAPagar: 3744600,
      gastos: {
        create: [{ descripcion: 'Transporte camión', monto: 150000 }],
      },
    },
  });

  await prisma.lote.create({
    data: {
      fincaId: finca.id,
      fecha,
      numeroFeria: '026',
      loteNumero: '217',
      sexo: 'HV',
      cantidad: 1,
      pesoTotal: 502,
      pesoPromedio: 502,
      valorFinal: 7000,
      valorTotal: 3514000,
      deduccion: 0,
      referencia: 'C 193691',
      valorAPagar: 3514000,
    },
  });

  await prisma.lote.create({
    data: {
      fincaId: finca.id,
      fecha,
      numeroFeria: '026',
      loteNumero: '039',
      sexo: 'HL',
      cantidad: 1,
      pesoTotal: 286,
      pesoPromedio: 286,
      valorFinal: 7200,
      valorTotal: 2059200,
      deduccion: 0,
      referencia: 'C 193692',
      valorAPagar: 2059200,
    },
  });

  await prisma.lote.create({
    data: {
      fincaId: finca.id,
      fecha,
      numeroFeria: '026',
      loteNumero: '070',
      sexo: 'ML',
      cantidad: 1,
      pesoTotal: 112,
      pesoPromedio: 112,
      valorFinal: 10400,
      valorTotal: 1164800,
      deduccion: 0,
      referencia: 'C 193700',
      valorAPagar: 1164800,
    },
  });

  console.log('✔ Seed completo');
  console.log(`  Usuario: ${DEMO_DOCUMENTO} / ${DEMO_PASSWORD}`);
  console.log(`  Lotes creados: 5`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
