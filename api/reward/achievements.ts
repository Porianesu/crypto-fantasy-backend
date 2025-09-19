import { VercelRequest, VercelResponse } from '@vercel/node'
import prisma from '../../prisma'
import { verifyToken } from '../../utils/jwt'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const user = await verifyToken(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  // 查询所有成就及用户状态
  if (req.method === 'GET') {
    try {
      const [achievements, userAchievements] = await Promise.all([
        prisma.achievement.findMany({
          orderBy: [{ type: 'asc' }, { subType: 'asc' }, { target: 'asc' }],
        }),
        prisma.userAchievement.findMany({ where: { userId: user.id } }),
      ])
      // 合并成就和用户状态
      const result = achievements.map((ach) => {
        const userAch = userAchievements.find((ua) => ua.achievementId === ach.id)
        return {
          ...ach,
          progress: userAch?.progress || 0,
          status: userAch?.status || 0, // 0未完成 1已完成 2已领取
          completedAt: userAch?.completedAt || null,
        }
      })
      return res.status(200).json({ achievements: result })
    } catch (e) {
      return res
        .status(500)
        .json({ error: e instanceof Error ? e.message : 'Internal Server Error' })
    }
  }

  // 领取成就奖励
  if (req.method === 'POST') {
    const { achievementId } = req.body
    if (!achievementId || typeof achievementId !== 'number') {
      return res.status(400).json({ error: 'Invalid achievementId' })
    }
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 查询用户成就
        const userAchievement = await tx.userAchievement.findFirst({
          where: { userId: user.id, achievementId },
        })
        if (!userAchievement || userAchievement.status !== 1) {
          throw new Error('Achievement not completed or already claimed')
        }
        // 查询成就奖励
        const achievement = await tx.achievement.findUnique({ where: { id: achievementId } })
        if (!achievement) {
          throw new Error('Achievement not found')
        }
        // 发放奖励（这里只做简单的资源奖励，按实际业务调整）
        const updatedUser = await tx.user.update({
          where: { id: user.id },
          data: {
            solAmount: { increment: achievement.rewardSolAmount },
            faithAmount: { increment: achievement.rewardFaithAmount },
          },
        })
        // 更新成就状态为已领取
        await tx.userAchievement.update({
          where: { id: userAchievement.id },
          data: { status: 2 },
        })
        return {
          success: true,
          solAmount: updatedUser.solAmount,
          faithAmount: updatedUser.faithAmount,
        }
      })
      return res.status(200).json(result)
    } catch (e) {
      return res
        .status(500)
        .json({ error: e instanceof Error ? e.message : 'Internal Server Error' })
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' })
}
