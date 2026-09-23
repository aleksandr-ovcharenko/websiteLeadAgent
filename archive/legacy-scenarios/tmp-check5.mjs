import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const prjs = await p.project.findMany({ where: { siteId: 'cmuazd8v900011kiu4bp2hsnf' }, select: { id: true, title: true } });
for (const pr of prjs) {
  const g = await p.projectMedia.count({ where: { projectId: pr.id } });
  console.log(pr.title.slice(0,40), '| gallery:', g);
}
await p.$disconnect();
