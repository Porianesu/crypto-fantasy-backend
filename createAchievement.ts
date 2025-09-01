// createAchievement.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
import achievements from './achievements.json'

async function main() {
  // 遍历 achievements.json，存在id则更新，否则创建
  const result = await Promise.all(
    achievements.map(async (params) => {
      if (params.id) {
        // 更新已有成就
        return prisma.achievement.update({
          where: { id: params.id },
          data: {
            type: params.type,
            subType: params.subType || null,
            target: Number(params.target),
            description: params.description,
            rewardSolAmount: Number(params.rewardSolAmount),
            rewardFaithAmount: Number(params.rewardFaithAmount),
          },
        })
      } else {
        // 创建新成就
        return prisma.achievement.create({
          data: {
            type: params.type,
            subType: params.subType || null,
            target: Number(params.target),
            description: params.description,
            rewardSolAmount: Number(params.rewardSolAmount),
            rewardFaithAmount: Number(params.rewardFaithAmount),
          },
        })
      }
    }),
  )
  console.log('成就已同步:', result.length)
}

main()
  .catch((e) => {
    console.error(e)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
