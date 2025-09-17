import fs from 'fs'
import path from 'path'
import prisma from './prisma'

async function exportAchievementsToJson(type?: string, subType?: string) {
  // 构建 where 条件
  const where: any = {}
  if (type) where.type = type
  if (subType) where.subType = subType

  // 查询 achievement 表
  const achievementsFromDb = await prisma.achievement.findMany({
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

  // 读取原有 achievements.json
  const jsonPath = path.resolve(__dirname, 'achievements.json')

  // 合并并去重（以 type, subType, target 为唯一标识）
  const merged = [...achievementsFromDb]

  fs.writeFileSync(jsonPath, JSON.stringify(merged, null, 2), 'utf-8')
  console.log('Achievements exported to achievements.json')
}

// 默认导出全部成就
exportAchievementsToJson()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
