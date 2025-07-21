import { PrismaClient } from '@prisma/client';
import cards from './cards.json';

const prisma = new PrismaClient();

async function main() {
  await prisma.card.createMany({
    data: cards,
    skipDuplicates: true, // 如果有重复id可以跳过
  });
  console.log('Cards imported!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
