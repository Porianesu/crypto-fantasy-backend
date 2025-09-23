import fs from 'fs'
import path from 'path'
import prisma from '../prisma'

async function exportTasksToJson(type?: string, subType?: string) {
  // 构建 where 条件
  const where: any = {}
  if (type) where.type = type
  if (subType) where.subType = subType

  // 查询 task 表
  const tasksFromDb = await prisma.task.findMany({
    where,
    select: {
      id: true,
      type: true,
      subType: true,
      target: true,
      description: true,
      rewardSolAmount: true,
      rewardFaithAmount: true,
    },
  })

  // 读取原有 myTasks.json
  const jsonPath = path.resolve(__dirname, 'myTasks.json')

  // 合并并去重（以 type, subType, target 为唯一标识）
  const merged = [...tasksFromDb]

  fs.writeFileSync(jsonPath, JSON.stringify(merged, null, 2), 'utf-8')
  console.log('Tasks exported to myTasks.json')
}

// 默认导出全部成就
exportTasksToJson()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
