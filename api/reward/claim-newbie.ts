import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../utils/common'
import { verifyToken } from '../utils/jwt'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const email = verifyToken(req)
    if (!email) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (user.newbieRewardClaimed) {
      return res.status(400).json({ error: 'Reward already claimed' })
    }

    // Grant reward
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        solAmount: { increment: 100 },
        faithAmount: { increment: 10000 },
        newbieRewardClaimed: true,
      },
    })

    return res.status(200).json({
      success: true,
      solAmount: updatedUser.solAmount,
      faithAmount: updatedUser.faithAmount,
    })
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' })
  }
}
