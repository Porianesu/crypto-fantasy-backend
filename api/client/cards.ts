import { VercelRequest, VercelResponse } from '@vercel/node'
import { setCorsHeaders } from '../../utils/common'
import prisma from '../../prisma'

interface ReceivedData {
  card: {
    name: string
    description?: string
    imageUrl?: string
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

      // 先为每个 skill 做 upsert（按 name 唯一），收集 id
      const skillInputs = skills ?? []
      const skillUpsertPromises = skillInputs.map((s) =>
        prisma.clientCardSkill.upsert({
          where: { name: s.name },
          create: { name: s.name, description: s.description ?? '' },
          update: { description: s.description ?? '' },
        })
      )

      const upsertedSkills = await prisma.$transaction(skillUpsertPromises)
      const skillIds = upsertedSkills.map((sk) => sk.id)

      // 查找是否已有同名 ClientCard
      const existing = await prisma.clientCard.findUnique({ where: { name } })

      if (existing) {
        // 更新并替换关系为当前提供的 skills
        await prisma.clientCard.update({
          where: { id: existing.id },
          data: {
            description: description ?? existing.description,
            imageUrl: imageUrl ?? existing.imageUrl,
            skills: { set: skillIds.map((id) => ({ id })) },
          },
        })

        return res.status(200).json({ success: true, action: 'updated', name })
      } else {
        // 创建 ClientCard 并连接已存在/新建的 skills
        await prisma.clientCard.create({
          data: {
            name,
            description: description ?? '',
            imageUrl: imageUrl ?? '',
            skills: { connect: skillIds.map((id) => ({ id })) },
          },
        })

        return res.status(201).json({ success: true, action: 'created', name })
      }
    } catch (e: any) {
      console.error('cards.ts error:', e)
      return res.status(500).json({ error: 'Internal Server Error', details: String(e) })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

