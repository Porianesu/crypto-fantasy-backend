import { VercelRequest, VercelResponse } from '@vercel/node'
import { setCorsHeaders } from '../../utils/common'
import prisma from '../../prisma'

interface ReceivedData {
  card: {
    name: string
    description?: string
    imageUrl?: string
    health_points?: number
    attack_points?: number
    skills?: Array<{
      name: string
      description?: string
    }>
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, 'POST, OPTIONS')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method === 'POST') {
    try {
      const { card } = (req.body as ReceivedData) || {}
      if (!card || typeof card !== 'object') {
        return res.status(400).json({ error: 'Invalid card parameter' })
      }

      const { name, description, imageUrl, skills } = card
      let { health_points, attack_points } = card

      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Card name is required' })
      }

      if (skills && !Array.isArray(skills)) {
        return res.status(400).json({ error: 'skills must be an array' })
      }

      // 校验每个 skill 的 name
      if (skills) {
        for (const s of skills) {
          if (!s || typeof s.name !== 'string' || !s.name.trim()) {
            return res.status(400).json({ error: 'Each skill must have a non-empty name' })
          }
        }
      }

      // 健壮化数值字段
      if (health_points == null || Number.isNaN(Number(health_points))) {
        health_points = 0
      } else {
        health_points = Math.floor(Number(health_points))
      }
      if (attack_points == null || Number.isNaN(Number(attack_points))) {
        attack_points = 0
      } else {
        attack_points = Math.floor(Number(attack_points))
      }

      // 使用交互式事务：先 upsert skills（按 name 唯一），再 upsert clientCard 并设置/连接 skills
      const result = await prisma.$transaction(async (tx) => {
        const skillInputs = skills ?? []
        const upsertedSkills = await Promise.all(
          skillInputs.map((s) =>
            tx.clientCardSkill.upsert({
              where: { name: s.name },
              create: { name: s.name, description: s.description ?? '' },
              update: { description: s.description ?? '' },
            }),
          ),
        )

        const skillIds = upsertedSkills.map((sk) => sk.id)

        // 准备 upsert 的数据体
        const cardDataCreate: any = {
          name,
          description: description ?? '',
          imageUrl: imageUrl ?? '',
          health_points,
          attack_points,
        }
        const cardDataUpdate: any = {
          description: description ?? undefined,
          imageUrl: imageUrl ?? undefined,
          health_points,
          attack_points,
        }

        if (skillIds.length > 0) {
          cardDataCreate.skills = { connect: skillIds.map((id) => ({ id })) }
          cardDataUpdate.skills = { set: skillIds.map((id) => ({ id })) }
        }

        // 使用 upsert 保证并发安全
        const upsertedCard = await tx.clientCard.upsert({
          where: { name },
          create: cardDataCreate,
          update: cardDataUpdate,
          include: { skills: true },
        })

        return upsertedCard
      })

      // 判断动作类型（created/updated）通过查询是否在 migrations 增量无法直接知晓，使用返回的 createdAt/updatedAt
      // 如果 createdAt === updatedAt（刚创建），则可以认为是新建
      const action =
        result.createdAt.getTime() === result.updatedAt.getTime() ? 'created' : 'updated'

      return res.status(200).json({ success: true, action, card: result })
    } catch (e: any) {
      console.error('cards.ts error:', e)
      return res.status(500).json({ error: 'Internal Server Error', details: String(e) })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
