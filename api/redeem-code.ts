import { VercelRequest, VercelResponse } from '@vercel/node'
import { PrismaClient } from '@prisma/client'
import { verifyToken } from './utils/jwt'

const prisma = new PrismaClient()

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

  const { code } = req.body
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Invalid code' })
  }

  // 查询用户
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return res.status(401).json({ error: 'User not found' })
  }

  // 查询兑换码
  const redemptionCode = await prisma.redemptionCode.findUnique({
    where: { code },
    include: { records: true },
  })
  if (!redemptionCode) {
    return res.status(404).json({ error: 'Code not found' })
  }
  if (redemptionCode.expiredAt && new Date() > redemptionCode.expiredAt) {
    return res.status(400).json({ error: 'Code expired' })
  }
  if (redemptionCode.maxUses && redemptionCode.records.length >= redemptionCode.maxUses) {
    return res.status(400).json({ error: 'Code usage limit reached' })
  }
  if (redemptionCode.records.some((r) => r.userId === user.id)) {
    return res.status(400).json({ error: 'Already redeemed by this user' })
  }

  // 发放资源
  const updateData: any = {}
  if (redemptionCode.solAmount) updateData.solAmount = { increment: redemptionCode.solAmount }
  if (redemptionCode.faithAmount) updateData.faithAmount = { increment: redemptionCode.faithAmount }

  await prisma.user.update({ where: { id: user.id }, data: updateData })

  // 记录兑换
  await prisma.redemptionRecord.create({
    data: {
      codeId: redemptionCode.id,
      userId: user.id,
      redeemedAt: new Date(),
    },
  })

  return res.status(200).json({ success: true, resources: updateData })
}
