import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean up existing data to ensure idempotent seed
  await prisma.documentCollaborator.deleteMany();
  await prisma.documentUpdateLog.deleteMany();
  await prisma.documentSnapshot.deleteMany();
  await prisma.document.deleteMany();
  await prisma.user.deleteMany();

  const nikhilPassword = await bcrypt.hash('Nikhil@12', 10);
  const mahimaPassword = await bcrypt.hash('Mahima@12', 10);

  const alice = await prisma.user.create({
    data: {
      email: 'nikhil.wevois@gmail.com',
      name: 'Nikhil Jain',
      hashedPassword: nikhilPassword,
    },
  });

  const bob = await prisma.user.create({
    data: {
      email: 'jainmahima922@gmail.com',
      name: 'Mahima Jain',
      hashedPassword: mahimaPassword,
    },
  });

  const doc = await prisma.document.create({
    data: {
      title: 'DocSync Architecture Spec',
      ownerId: alice.id,
      collaborators: {
        create: [
          { userId: alice.id, role: Role.OWNER },
          { userId: bob.id, role: Role.VIEWER },
        ],
      },
    },
  });

  console.log('Seed completed successfully:');
  console.log(`- Created User (Alice): ${alice.email}`);
  console.log(`- Created User (Bob): ${bob.email}`);
  console.log(`- Created Document: "${doc.title}" (ID: ${doc.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
