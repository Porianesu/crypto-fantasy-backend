import { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyToken } from '../../utils/jwt'
import prisma from '../../prisma'
import { NewbieReward } from '../../utils/config'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // 鉴权
    const user = await verifyToken(req)
    if (!user) {
      return res.status(404).json({ error: 'Unauthorized' })
    }

    if (user.newbieRewardClaimed) {
      return res.status(400).json({ error: 'Reward already claimed' })
    }

    // 发放奖励
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        solAmount: { increment: NewbieReward.solAmount },
        faithAmount: { increment: NewbieReward.faithAmount },
        newbieRewardClaimed: true,
      },
    })

    return res.status(200).json({
      success: true,
      user: {
        solAmount: updatedUser.solAmount,
        faithAmount: updatedUser.faithAmount,
        newbieRewardClaimed: updatedUser.newbieRewardClaimed,
      },
    })
  } catch (error) {
    console.log('Error claiming newbie reward:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
