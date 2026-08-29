import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10);

  const user = await prisma.user.upsert({
    where: { email: 'admin@minsk.local' },
    update: {},
    create: { email: 'admin@minsk.local', passwordHash, globalRole: 'SUPER_ADMIN' }
  });

  await prisma.site.upsert({
    where: { id: 'site_test_001' },
    update: { name: 'Demo Site', domain: 'demo.local', status: 'ACTIVE' },
    create: {
      id: 'site_test_001',
      name: 'Demo Site',
      slug: 'demo-site',
      domain: 'demo.local',
      previewToken: 'demotest',
      templateId: 'construction-modern-v1',
      status: 'ACTIVE'
    }
  });

  console.log('Seeded:', { userId: user.id });
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
