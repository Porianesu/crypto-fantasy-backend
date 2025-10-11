import baseRaces from './baseRaces.json'
import prisma from '../../prisma'

async function main() {
  // 遍历 achievements.json，存在id则更新，否则创建
  const result = await Promise.all(
    baseRaces.map(async (params) => {
      // 创建新成就
      return prisma.baseRace.create({
        data: {
          name: params.name,
          englishName: params.englishName,
          description: params.description,
        },
      })
    }),
  )
  console.log('基础种族已同步:', result.length)
}

main()
  .catch((e) => {
    console.error(e)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
