import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const pass = await bcrypt.hash('admin123', 10);

  const siteAdmin = await prisma.user.upsert({
    where: { email: 'site-admin@minsk.local' },
    update: {},
    create: { email: 'site-admin@minsk.local', passwordHash: pass, globalRole: 'USER' }
  });
  const editor = await prisma.user.upsert({
    where: { email: 'editor@minsk.local' },
    update: {},
    create: { email: 'editor@minsk.local', passwordHash: pass, globalRole: 'USER' }
  });

  await prisma.siteUser.upsert({
    where: { siteId_userId: { siteId: 'site_test_001', userId: siteAdmin.id } },
    update: {},
    create: { siteId: 'site_test_001', userId: siteAdmin.id, role: 'ADMIN' }
  });
  await prisma.siteUser.upsert({
    where: { siteId_userId: { siteId: 'site_test_001', userId: editor.id } },
    update: {},
    create: { siteId: 'site_test_001', userId: editor.id, role: 'EDITOR' }
  });

  console.log('Seeded test users:', { siteAdmin: siteAdmin.id, editor: editor.id });
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
