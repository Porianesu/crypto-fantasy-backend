import { VercelRequest, VercelResponse } from '@vercel/node'
import { setCorsHeaders } from '../../utils/common'
import prisma from '../../prisma'

interface ReceivedData {
  content: {
    prompt: string
    races: Array<string>
    inscription: string
  }
}
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, 'POST, OPTIONS')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method === 'POST') {
    try {
      const { content } = (req.body as ReceivedData) || {}
      if (!content || !Array.isArray(content.races) || content.races.length === 0) {
        return res.status(400).json({ error: 'Invalid races parameter' })
      }
      const sortedContentRaces = content.races.sort((a, b) => {
        return a.localeCompare(b)
      })

      // 查询所有BaseRace
      const allBaseRaces = await prisma.baseRace.findMany()
      const baseRaceNames = allBaseRaces.map((r) => r.name)

      // 校验 races 是否都在 BaseRace.name 中
      for (const race of sortedContentRaces) {
        if (!baseRaceNames.includes(race)) {
          return res.status(400).json({ error: `Race ${race} not found in BaseRace` })
        }
      }

      let matchedRace = null
      if (sortedContentRaces.length === 1) {
        matchedRace = allBaseRaces.find((r) => r.name === sortedContentRaces[0])
      } else {
        // 查询所有HybridRace，找到baseRaces字段与races完全匹配的那条
        const allHybridRaces = await prisma.hybridRace.findMany({
          include: {
            baseRaces: true,
          },
        })
        matchedRace = allHybridRaces.find((hr) => {
          if (!Array.isArray(hr.baseRaces) || hr.baseRaces.length !== sortedContentRaces.length)
            return false
          // baseRaces字段里的name也进行排序后再比较
          const sortedBaseRaces = hr.baseRaces.map((b: any) => b.name).sort()
          return sortedBaseRaces.join(',') === sortedContentRaces.join(',')
        })
      }

      if (!matchedRace) {
        return res.status(404).end({
          error: 'No matching races found',
        })
      }

      // 查询 races 对应的所有技能
      const skills = await prisma.skill.findMany({
        where: {
          baseRace: {
            name: { in: sortedContentRaces },
          },
        },
      })

      return res.status(200).json({
        hybridRace: matchedRace,
        skills,
      })
    } catch (e) {
      return res.status(500).json({ error: 'Internal Server Error', details: String(e) })
    }
  }
  return res.status(405).json({ error: 'Method not allowed' })
}
