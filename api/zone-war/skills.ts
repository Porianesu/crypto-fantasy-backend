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
      const baseRace = await prisma.baseRace.findUnique({
        where: { name: content[0].race },
      })
      if (!baseRace) {
        return res.status(404).end({
          error: 'Base race not found',
          details: `Base race ${content[0].race} does not exist`,
        })
      }
      for (let index = 0; index < content.length; index++) {
        const item = content[index]
        await prisma.skill.update({
          where: { id: (baseRace.id - 1) * 4 + index + 1 },
          data: {
            name: item.name,
            description: item.description,
            baseRaceId: baseRace.id,
          },
        })
      }

      return res.status(200).json({
        success: true,
        message: `Received ${content.length} skills, 校验并写入成功`,
      })
    } catch (e) {
      return res.status(500).end({ error: 'Internal Server Error', details: e })
    }
  }
  return res.status(405).json({ error: 'Method not allowed' })
}
