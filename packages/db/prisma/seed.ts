import { PrismaClient, WorkspaceRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const clerkId = process.env['SEED_CLERK_USER_ID'];
  if (!clerkId) {
    console.info('Skip seed: set SEED_CLERK_USER_ID to seed a dev user and workspace.');
    return;
  }

  const user = await prisma.user.upsert({
    where: { clerkId },
    update: {},
    create: {
      clerkId,
      email: 'dev@example.com',
    },
  });

  const ws = await prisma.workspace.upsert({
    where: { slug: 'dev' },
    update: {},
    create: {
      name: 'Dev Workspace',
      slug: 'dev',
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: { workspaceId: ws.id, userId: user.id },
    },
    update: { role: WorkspaceRole.OWNER },
    create: {
      workspaceId: ws.id,
      userId: user.id,
      role: WorkspaceRole.OWNER,
    },
  });

  console.info('Seed OK:', { workspaceId: ws.id, userId: user.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
