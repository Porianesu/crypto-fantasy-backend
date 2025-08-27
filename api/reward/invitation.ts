import { VercelRequest, VercelResponse } from '@vercel/node'
import prisma from '../../prisma'
import { verifyToken } from '../../utils/jwt'
import { generateRandomString } from '../../utils/common'
import { ReferralReward } from '../../utils/config'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const email = verifyToken(req)
  if (!email) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      invitees: { include: { invitee: true } },
      inviter: { include: { inviter: true } },
    },
  })
  if (!user) return res.status(401).json({ error: 'User not found' })

  // 查询邀请状态并自动生成邀请码
  if (req.method === 'GET') {
    let inviteCode = user.inviteCode
    if (!inviteCode) {
      // 自动生成唯一邀请码
      let unique = false
      let tryCount = 0
      while (!unique && tryCount < 10) {
        inviteCode = generateRandomString(8)
        const exists = await prisma.user.findUnique({ where: { inviteCode } })
        if (!exists) unique = true
        tryCount++
      }
      if (!unique) return res.status(500).json({ error: 'Failed to generate invite code' })
      await prisma.user.update({ where: { id: user.id }, data: { inviteCode } })
    }
    // 查询邀请信息
    const invitations = await prisma.invitation.findMany({
      where: { inviterUserId: user.id },
      include: { invitee: true },
      orderBy: { createdAt: 'asc' },
    })
    return res.status(200).json({
      inviteCode,
      invitedUsers: invitations.map((i) => ({
        id: i.invitee.id,
        email: i.invitee.email,
        nickname: i.invitee.nickname,
        claimed: i.claimed,
        createdAt: i.createdAt,
      })),
      hasUnclaimedRewardAsInvitee: !!(await prisma.invitation.findFirst({
        where: { inviteeUserId: user.id, claimed: false },
      })),
    })
  }

  // 绑定邀请码
  if (req.method === 'POST') {
    const { inviteCode } = req.body
    if (!inviteCode || typeof inviteCode !== 'string') {
      return res.status(400).json({ error: 'Invalid inviteCode' })
    }
    if (user.inviteCode === inviteCode) {
      return res.status(400).json({ error: 'You cannot invite yourself' })
    }
    // 检查是否已被邀请
    const alreadyBound = await prisma.invitation.findUnique({ where: { inviteeUserId: user.id } })
    if (alreadyBound) {
      return res.status(400).json({ error: 'You have already been invited' })
    }
    // 检查邀请码是否存在
    const inviter = await prisma.user.findUnique({ where: { inviteCode } })
    if (!inviter) {
      return res.status(404).json({ error: 'Invite code not found' })
    }
    if (inviter.id === user.id) {
      return res.status(400).json({ error: 'You cannot invite yourself' })
    }
    const result = await prisma.$transaction(async (tx) => {
      // 创建邀请关系
      await tx.invitation.create({
        data: {
          inviteeUserId: user.id,
          inviterUserId: inviter.id,
        },
      })

      //发放奖励
      await tx.user.update({
        where: { id: user.id },
        data: {
          faithAmount: {
            increment: ReferralReward.invitee.faithAmount,
          },
          solAmount: {
            increment: ReferralReward.invitee.solAmount,
          },
        },
      })
      return {
        success: true,
        rewardFaithAmount: ReferralReward.invitee.faithAmount,
        rewardSolAmount: ReferralReward.invitee.solAmount,
      }
    })
    return res.status(200).json(result)
  }

  return res.status(405).json({ error: 'Method Not Allowed' })
}
