import { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyToken } from '../utils/jwt'
import prisma from '../prisma'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 处理跨域
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  // 校验token
  const user = await verifyToken(req)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const userId = user.id

  const { page = 1, pageSize = 20 } = req.query
  const take = Math.min(Number(pageSize), 200)
  const skip = (Number(page) - 1) * take

  try {
    const [total, userCards] = await Promise.all([
      prisma.userCard.count({ where: { userId } }),
      prisma.userCard.findMany({
        where: { userId },
        include: { card: true },
        skip,
        take,
        orderBy: { id: 'asc' },
      }),
    ])
    return res.status(200).json({
      total,
      page: Number(page),
      pageSize: take,
      data: userCards.map((uc) => ({
        userCardId: uc.id,
        cardId: uc.cardId,
      })),
    })
  } catch (error) {
    console.error('get user cards error', error)
    return res.status(500).json({ error: 'Operation failed' })
  }
}
