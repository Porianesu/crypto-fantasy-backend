import fs from 'fs'
import path from 'path'
import prisma from '../../prisma'

async function exportHybridRacesToJson() {
  const hybridRacesFromDb = await prisma.hybridRace.findMany({
    select: {
      id: true,
      baseRaces: true,
      name: true,
      description: true,
    },
  })

  // 读取原有 hybridRaces.json
  const jsonPath = path.resolve(__dirname, 'hybridRaces.json')

  // 合并并去重（以 type, subType, target 为唯一标识）
  const merged = hybridRacesFromDb
    .sort((a, b) => a.id - b.id)
    .map((r) => {
      return {
        id: r.id,
        name: r.name,
        description: r.description,
        races: r.baseRaces.map((br) => br.name),
      }
    })

  fs.writeFileSync(jsonPath, JSON.stringify(merged, null, 2), 'utf-8')
  console.log('Hybrid races exported to hybridRaces.json')
}

// 默认导出全部成就
exportHybridRacesToJson()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
