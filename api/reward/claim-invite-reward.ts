import { VercelRequest, VercelResponse } from '@vercel/node'
import prisma from '../../prisma'
import { verifyToken } from '../../utils/jwt'
import { ReferralReward } from '../../utils/config'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const email = verifyToken(req)
  if (!email) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return res.status(401).json({ error: 'User not found' })

  // 查询未领取的邀请奖励
  const unclaimedInvitations = await prisma.invitation.findMany({
    where: { inviterUserId: user.id, claimed: false },
  })
  if (!unclaimedInvitations.length) {
    return res.status(400).json({ error: 'No unclaimed invitations' })
  }

  const unclaimedInvitationsCount = unclaimedInvitations.length
  // 事务：发放奖励并标记为已领取
  const result = await prisma.$transaction(async (tx) => {
    const totalFaithReward = ReferralReward.inviter.faithAmount * unclaimedInvitationsCount
    const totalSolReward = ReferralReward.inviter.solAmount * unclaimedInvitationsCount
    await tx.user.update({
      where: { id: user.id },
      data: {
        faithAmount: { increment: totalFaithReward },
        solAmount: { increment: totalSolReward },
      },
    })
    const unclaimedInvitationIds = unclaimedInvitations.map((item) => item.id)
    await tx.invitation.updateMany({
      where: { id: { in: unclaimedInvitationIds } },
      data: { claimed: true },
    })
    return {
      success: true,
      rewardFaithAmount: totalFaithReward,
      rewardSolAmount: totalSolReward,
      claimedInvitationIds: unclaimedInvitationIds,
    }
  })

  return res.status(200).json(result)
}
