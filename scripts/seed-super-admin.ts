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
    update: { name: 'ГАРАНТ КАЧЕСТВА', domain: 'garantk.by', status: 'ACTIVE' },
    create: {
      id: 'site_test_001',
      name: 'ГАРАНТ КАЧЕСТВА',
      slug: 'garantk-by',
      domain: 'garantk.by',
      previewToken: 'garantktest',
      templateId: 'construction-modern-v1',
      status: 'ACTIVE'
    }
  });

  console.log('Seeded:', { userId: user.id });
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
