import { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyToken } from '../../utils/jwt'
import { SignInReward } from '../../utils/config'
import prisma from '../../prisma'

function getMonday(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay()
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  try {
    const user = await verifyToken(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const userId = user.id

    // 获取本周一（UTC）
    const now = new Date()
    const monday = getMonday(now)
    const sunday = new Date(monday)
    sunday.setUTCDate(monday.getUTCDate() + 6)

    // 查询本周签到记录
    const signIns = await prisma.userSignIn.findMany({
      where: {
        userId,
        signInDate: {
          gte: monday,
          lte: sunday,
        },
      },
      orderBy: { signInDate: 'asc' },
    })

    if (req.method === 'GET') {
      const totalSignInCount = await prisma.userSignIn.count({ where: { userId } })
      // 查询本周签到状态
      // 构造每一天的签到状态
      const signInStatus = Array.from({ length: 7 }, (_, i) => {
        const dayDate = new Date(monday)
        dayDate.setUTCDate(monday.getUTCDate() + i)
        const signed = signIns.some((r) => {
          const d = new Date(r.signInDate)
          return (
            d.getUTCFullYear() === dayDate.getUTCFullYear() &&
            d.getUTCMonth() === dayDate.getUTCMonth() &&
            d.getUTCDate() === dayDate.getUTCDate()
          )
        })
        return {
          date: dayDate,
          reward: SignInReward[i],
          signed,
        }
      })
      return res.status(200).json({ totalSignInCount, signInStatus })
    }

    if (req.method === 'POST') {
      // 校验今天是否已签到
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
      const alreadySigned = signIns.some((r) => {
        const d = new Date(r.signInDate)
        return (
          d.getUTCFullYear() === today.getUTCFullYear() &&
          d.getUTCMonth() === today.getUTCMonth() &&
          d.getUTCDate() === today.getUTCDate()
        )
      })
      if (alreadySigned) return res.status(400).json({ error: 'Already signed in today' })
      if (signIns.length >= 7)
        return res.status(400).json({ error: 'Sign-in rewards expired for this week' })
      // 发放奖励
      const dayIndex = now.getUTCDay() === 0 ? 6 : now.getUTCDay() - 1 // 周日为第7天
      const reward = SignInReward[dayIndex]
      const result = await prisma.$transaction(async (tx) => {
        await tx.userSignIn.create({
          data: {
            userId,
            signInDate: today,
          },
        })
        await tx.user.update({
          where: { id: userId },
          data: {
            solAmount: { increment: reward.solAmount },
            faithAmount: { increment: reward.faithAmount },
          },
        })
        return {
          signDate: today,
          success: true,
          reward,
        }
      })
      return res.status(200).json(result)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', detail: String(err) })
  }
}
