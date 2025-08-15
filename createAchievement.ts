// createAchievement.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const Achievements = [
  {
    type: 'card_collect',
    subType: 'amount',
    target: 5,
    description: 'First step to becoming a card collector! Collect 5 common cards.',
    rewardSolAmount: 1,
    rewardFaithAmount: 100,
  },
  {
    type: 'card_collect',
    subType: 'epic',
    target: 5,
    description: 'Epic card collector! Collect 5 epic cards.',
    rewardSolAmount: 5,
    rewardFaithAmount: 500,
  },
  {
    type: 'deck_score',
    subType: 'number',
    target: 200,
    description: 'Achieve a deck score of 200 points.',
    rewardSolAmount: 2,
    rewardFaithAmount: 200,
  },
  {
    type: 'deck_score',
    subType: 'rank',
    target: 5,
    description: 'Achieve a deck rank of 5 or higher.',
    rewardSolAmount: 3,
    rewardFaithAmount: 300,
  },
  {
    type: 'card_fusion',
    subType: 'amount',
    target: 10,
    description: 'Fuse 10 common cards to create a new card.',
    rewardSolAmount: 1,
    rewardFaithAmount: 100,
  },
  {
    type: 'card_craft',
    subType: 'amount',
    target: 10,
    description: 'Craft 10 common cards to enhance your collection.',
    rewardSolAmount: 1,
    rewardFaithAmount: 100,
  },
  {
    type: 'sol_consume',
    subType: 'amount',
    target: 100,
    description: 'Consume 100 SOL in total to support the game ecosystem.',
    rewardSolAmount: 10,
    rewardFaithAmount: 1000,
  },
  {
    type: 'faith_consume',
    subType: 'amount',
    target: 1000,
    description: 'Consume 1000 Faith in total to support the game ecosystem.',
    rewardSolAmount: 1,
    rewardFaithAmount: 100,
  },
]

async function main() {
  const achievement = await prisma.achievement.createMany({
    data: Achievements.map((params) => ({
      type: params.type,
      subType: params.subType || null,
      target: Number(params.target),
      description: params.description,
      rewardSolAmount: Number(params.rewardSolAmount),
      rewardFaithAmount: Number(params.rewardFaithAmount),
    })),
  })

  console.log('成就已创建:', achievement.count)
}

main()
  .catch((e) => {
    console.error(e)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
