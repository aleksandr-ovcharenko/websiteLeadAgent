import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { seedRbac, migrateExistingUsers } from '../apps/dashboard/src/security/rbacSeed.js';

const prisma = new PrismaClient({ log: ['error'] });

async function main() {
  await seedRbac(prisma);
  await migrateExistingUsers(prisma);
  console.log('RBAC seed and migration complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
