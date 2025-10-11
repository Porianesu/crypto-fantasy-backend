import { VercelRequest, VercelResponse } from '@vercel/node'
import { setCorsHeaders } from '../../utils/common'
import prisma from '../../prisma'

interface ReceivedData {
  content: Array<{
    name: string
    races: Array<string>
    description: string
  }>
}
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, 'POST, OPTIONS')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method === 'POST') {
    try {
      const { content } = (req.body as ReceivedData) || {}
      console.log('Received content:', content)
      if (!content) {
        return res.status(400).json({ error: 'Invalid content parameter' })
      }
      if (Array.isArray(content)) {
        const allBaseRaces = await prisma.baseRace.findMany()
        const baseRaceNames = allBaseRaces.map((r) => r.name)
        // 校验每个对象字段不能为空
        for (let i = 0; i < content.length; i++) {
          const item = content[i]
          if (!item.name || !item.races || !item.description) {
            return res.status(400).json({ error: `第${i + 1}项字段不能为空` })
          }
          if (!Array.isArray(item.races) || item.races.length === 0) {
            return res.status(400).json({ error: `第${i + 1}项races字段必须为非空数组` })
          }
          // races字段校验
          for (const race of item.races) {
            if (typeof race !== 'string' || !baseRaceNames.includes(race)) {
              return res
                .status(400)
                .json({ error: `第${i + 1}项races字段中的'${race}'不是有效的基础种族` })
            }
          }
        }
        let createdCount = 0
        let updatedCount = 0
        // 校验通过后，批量插入或更新 HybridRace
        for (let i = 0; i < content.length; i++) {
          const currentRace = content[i]
          // 生成 baseRaces 对象数组
          const baseRacesObjArr = currentRace.races.map((r) => ({ name: r }))
          const sortedCurrentRaces = [...currentRace.races].sort()
          // 查找所有 hybridRace，逐个比对 baseRaces 的 name 数组
          const allHybridRaces = await prisma.hybridRace.findMany({
            include: { baseRaces: true },
          })
          let existHybridRace = null
          for (const hr of allHybridRaces) {
            if (!Array.isArray(hr.baseRaces)) continue
            const hrNames = hr.baseRaces.map((br: any) => br.name).sort()
            if (JSON.stringify(hrNames) === JSON.stringify(sortedCurrentRaces)) {
              existHybridRace = hr
              break
            }
          }
          if (existHybridRace) {
            // 更新已存在的 HybridRace
            await prisma.hybridRace.update({
              where: { id: existHybridRace.id },
              data: {
                name: currentRace.name,
                description: currentRace.description,
              },
            })
            updatedCount++
          } else {
            // 创建新的 HybridRace（多对多关系，使用 connect 关联 baseRaces）
            await prisma.hybridRace.create({
              data: {
                name: currentRace.name,
                description: currentRace.description,
                baseRaces: {
                  connect: currentRace.races.map((raceName) => {
                    const targetBaseRace = allBaseRaces.find((br) => br.name === raceName)
                    return { id: targetBaseRace!.id }
                  }),
                },
              },
            })
            createdCount++
          }
        }
        return res.status(200).json({
          success: true,
          message: `Received ${content.length} races, 校验并写入成功`,
          created: createdCount,
          updated: updatedCount,
        })
      }
      console.log('content prototype:', Object.prototype.toString.call(content))
    } catch (e) {
      return res.status(500).end({ error: 'Internal Server Error', details: e })
    }
  }
  return res.status(405).json({ error: 'Method not allowed' })
}
