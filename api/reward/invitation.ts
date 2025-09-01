import { VercelRequest, VercelResponse } from '@vercel/node'
import prisma from '../../prisma'
import { verifyToken } from '../../utils/jwt'
import { generateRandomString } from '../../utils/common'
import { ReferralReward } from '../../utils/config'
import { createInvitationWithCode } from '../../utils/invitation'

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
      // 自动生成唯一邀请码，保证100%成功
      while (true) {
        inviteCode = generateRandomString(8)
        try {
          await prisma.user.update({ where: { id: user.id }, data: { inviteCode } })
          console.log(`Create invite code ${inviteCode} for user ${user.email}`)
          break // 成功写入，跳出循环
        } catch (err: any) {
          // Prisma 唯一性冲突错误码
          if (err.code === 'P2002') {
            continue // 邀请码重复，重试
          }
          throw err // 其他错误直接抛出
        }
      }
    }
    // 查询邀请信息
    const invitations = await prisma.invitation.findMany({
      where: { inviterUserId: user.id },
      orderBy: { createdAt: 'asc' },
    })
    const invitationsAsInvitee = await prisma.invitation.findFirst({
      where: { inviteeUserId: user.id },
    })
    return res.status(200).json({
      inviteCode,
      invitationsAsInviter: invitations.map((i) => ({
        id: i.id,
        claimed: i.claimed,
        createdAt: i.createdAt,
      })),
      invitationsAsInvitee: invitationsAsInvitee
        ? {
            id: invitationsAsInvitee.id,
            claimed: invitationsAsInvitee.claimed,
            createdAt: invitationsAsInvitee.createdAt,
          }
        : null,
    })
  }

  // 绑定邀请码
  if (req.method === 'POST') {
    const { inviteCode } = req.body
    try {
      const result = await prisma.$transaction(async (tx) => {
        return await createInvitationWithCode(tx, user, inviteCode)
      })
      return res.status(200).json(result)
    } catch (e) {
      console.error('Error binding invite code:', e)
      return res
        .status(500)
        .json({ error: e instanceof Error ? e.message : 'Failed to bind invite code' })
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' })
}
