import { VercelRequest, VercelResponse } from '@vercel/node'
import { PrismaClient } from '@prisma/client'
import { verifyToken } from '../utils/jwt'

const prisma = new PrismaClient()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  // 鉴权
  const email = verifyToken(req)
  if (!email) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  // 查询用户
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }

  if (req.method === 'GET') {
    // 商品列表
    const items = await prisma.shopItem.findMany()
    // 查询用户今日已购次数
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const purchases = await prisma.userShopPurchase.findMany({
      where: {
        userId: user.id,
        purchasedAt: { gte: today },
      },
    })
    // 统计每个商品今日已购次数
    const purchaseMap = {} as Record<number, number>
    purchases.forEach((p) => {
      purchaseMap[p.shopItemId] = (purchaseMap[p.shopItemId] || 0) + 1
    })
    const result = items.map((item) => ({
      ...item,
      todayPurchased: purchaseMap[item.id] || 0,
    }))
    return res.status(200).json({ items: result })
  }

  if (req.method === 'POST') {
    // 购买商品
    const { shopItemId } = req.body || {}
    if (!shopItemId || typeof shopItemId !== 'number') {
      return res.status(400).json({ error: 'shopItemId is required and must be a number' })
    }
    const item = await prisma.shopItem.findUnique({ where: { id: shopItemId } })
    if (!item) {
      return res.status(404).json({ error: 'Shop item not found' })
    }
    // 校验限购
    if (item.dailyLimit > 0) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayCount = await prisma.userShopPurchase.count({
        where: {
          userId: user.id,
          shopItemId: item.id,
          purchasedAt: { gte: today },
        },
      })
      if (todayCount >= item.dailyLimit) {
        return res.status(403).json({ error: 'Daily purchase limit reached' })
      }
    }
    // 校验余额
    if (user.solAmount < item.price) {
      return res.status(403).json({ error: 'Insufficient solAmount' })
    }
    // 扣除余额并发放奖励
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userData } = await prisma.user.update({
      where: { id: user.id },
      data: {
        solAmount: { decrement: item.price },
        faithAmount: { increment: item.rewardFaith },
        meltCurrent: { increment: item.rewardMeltTimes },
      },
    })
    // 记录购买
    await prisma.userShopPurchase.create({
      data: {
        userId: user.id,
        shopItemId: item.id,
      },
    })
    return res.status(200).json({ success: true, user: userData })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
