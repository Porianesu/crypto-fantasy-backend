import { VercelRequest, VercelResponse } from '@vercel/node'
import { setCorsHeaders } from '../../utils/common'
import prisma from '../../prisma'

interface ReceivedData {
  content: Array<{
    name: string
    race: string
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
      if (!content || !Array.isArray(content)) {
        return res.status(400).json({ error: 'Invalid content parameter' })
      }

      let createdCount = 0
      let updatedCount = 0

      for (const item of content) {
        // 查找BaseRace
        const baseRace = await prisma.baseRace.findUnique({
          where: { name: item.race },
        })
        if (!baseRace) continue

        // 查询该BaseRace下的Skill数量
        const skills = await prisma.skill.findMany({
          where: { baseRaceId: baseRace.id },
        })

        if (skills.length < 4) {
          // 创建新Skill
          await prisma.skill.create({
            data: {
              name: item.name,
              description: item.description,
              baseRaceId: baseRace.id,
            },
          })
          createdCount++
        } else {
          // 随机选择一条Skill进行更新
          const randomSkill = skills[Math.floor(Math.random() * skills.length)]
          await prisma.skill.update({
            where: { id: randomSkill.id },
            data: {
              name: item.name,
              description: item.description,
            },
          })
          updatedCount++
        }
      }
      return res.status(200).json({
        success: true,
        message: `Received ${content.length} skills, 校验并写入成功`,
        created: createdCount,
        updated: updatedCount,
      })
    } catch (e) {
      return res.status(500).end({ error: 'Internal Server Error', details: e })
    }
  }
  return res.status(405).json({ error: 'Method not allowed' })
}
