import { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyToken } from '../utils/jwt'
import prisma from '../prisma'
import { handleAchievementDeckScoreRank } from '../utils/achievement/deck_score'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const email = verifyToken(req)
  if (!email) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 查询用户
      const user = await tx.user.findUnique({ where: { email } })
      if (!user) {
        throw new Error('User not found')
      }
      const userId = user.id

      // 查询前50名排行榜
      const topUsers = await tx.user.findMany({
        orderBy: { deckPower: 'desc' },
        take: 50,
        select: {
          id: true,
          nickname: true,
          avatar: true,
          deckPower: true,
        },
      })

      // 查询当前用户战力和排名
      let myDeckPower = 0
      let myRank = Infinity
      const me = await tx.user.findUnique({
        where: { id: userId },
        select: { deckPower: true },
      })
      if (me) {
        myDeckPower = me.deckPower
        // 查询排名
        const count = await tx.user.count({ where: { deckPower: { gt: myDeckPower } } })
        myRank = count + 1
      }
      await handleAchievementDeckScoreRank(user, myRank, tx)
      return {
        leaderboard: topUsers,
        myDeckPower,
        myRank,
      }
    })
    return res.status(200).json(result)
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal Server Error' })
  }
}
