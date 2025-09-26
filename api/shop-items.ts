import { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyToken } from '../utils/jwt'
import prisma from '../prisma'
import { handleAchievementSolConsume } from '../utils/achievement/unique'
import { setCorsHeaders } from '../utils/common'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, 'GET, POST, OPTIONS')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  // 鉴权
  const user = await verifyToken(req)
  if (!user) {
    return res.status(404).json({ error: 'Unauthorized' })
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
    try {
      const transactionResult = await prisma.$transaction(async (tx) => {
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
            throw new Error('Daily purchase limit reached')
          }
        }
        // 校验余额
        if (user.solAmount < item.price) {
          throw new Error('Insufficient solAmount')
        }
        // 扣除成就
        if (item.price) {
          await handleAchievementSolConsume(user, item.price, tx)
        }
        // 扣除余额并发放奖励

        const { password, ...userData } = await tx.user.update({
          where: { id: user.id },
          data: {
            solAmount: item.price ? { decrement: item.price } : { increment: item.rewardSol },
            faithAmount: { increment: item.rewardFaith },
            meltCurrent: { increment: item.rewardMeltTimes },
          },
        })
        // 记录购买
        await tx.userShopPurchase.create({
          data: {
            userId: user.id,
            shopItemId: item.id,
          },
        })
        return { success: true, user: userData }
      })
      return res.status(200).json({
        success: transactionResult.success,
        user: transactionResult.user,
      })
    } catch (e) {
      return res
        .status(500)
        .json({ error: e instanceof Error ? e.message : 'Internal Server Error' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
