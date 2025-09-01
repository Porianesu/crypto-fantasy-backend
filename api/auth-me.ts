import { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyToken } from '../utils/jwt'
import prisma from '../prisma'
import { create } from 'node:domain'
import { createInvitationWithCode } from '../utils/invitation'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const email = verifyToken(req)
  if (!email) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }
  try {
    const result = await prisma.$transaction(async (tx) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...userData } = user
      // 处理邀请绑定逻辑
      const inviteCode = req.query.inviteCode
      if (inviteCode) {
        const result = await createInvitationWithCode(tx, user, inviteCode)
        if (result.success) {
          return userData
        }
      } else {
        return userData
      }
    })
    res.status(200).json({ user: result })
  } catch (e) {
    return res
      .status(500)
      .json({ error: e instanceof Error ? e.message : 'Failed to bind invite code' })
  }
}
