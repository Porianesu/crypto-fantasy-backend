import tasks from './myTasks.json'
import prisma from '../prisma'

async function main() {
  // 遍历 tasks.json，存在id则更新，否则创建
  const result = await Promise.all(
    tasks.map(async (params) => {
      if ((params as any).id) {
        // 更新已有成就
        return prisma.task.update({
          where: { id: (params as any).id },
          data: {
            type: params.type,
            subType: params.subType || null,
            target: params.target,
            description: params.description,
            rewardSolAmount: Number(params.rewardSolAmount),
            rewardFaithAmount: Number(params.rewardFaithAmount),
          },
        })
      } else {
        // 创建新成就
        return prisma.task.create({
          data: {
            type: params.type,
            subType: params.subType || null,
            target: params.target,
            description: params.description,
            rewardSolAmount: Number(params.rewardSolAmount),
            rewardFaithAmount: Number(params.rewardFaithAmount),
          },
        })
      }
    }),
  )
  console.log('任务已同步:', result.length)
}

main()
  .catch((e) => {
    console.error(e)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
