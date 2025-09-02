import { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyToken } from '../utils/jwt'
import prisma from '../prisma'

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

  const { code } = req.body
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Invalid code' })
  }

  const user = await verifyToken(req)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // 查询兑换码
  const redemptionCode = await prisma.redemptionCode.findUnique({
    where: { code },
    include: { records: true },
  })
  if (!redemptionCode) {
    return res.status(404).json({ error: 'The code is wrong' })
  }
  if (redemptionCode.expiredAt && new Date() > redemptionCode.expiredAt) {
    return res.status(400).json({ error: 'The code is expired' })
  }
  if (redemptionCode.records.some((r) => r.userId === user.id)) {
    return res.status(400).json({ error: 'The code has been redeemed' })
  }
  if (redemptionCode.maxUses && redemptionCode.records.length >= redemptionCode.maxUses) {
    return res.status(400).json({ error: 'Code usage limit reached' })
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

  return res.status(200).json({
    success: true,
    reward: {
      solAmount: redemptionCode.solAmount,
      faithAmount: redemptionCode.faithAmount,
    },
  })
}
