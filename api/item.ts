import { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyToken } from '../utils/jwt'
import prisma from '../prisma'
import { setCorsHeaders } from '../utils/common'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, 'GET, POST, PUT, OPTIONS')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  // 鉴权
  const user = await verifyToken(req)
  if (!user) {
    return res.status(404).json({ error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    // 查询所有道具及用户背包数量
    const items = await prisma.item.findMany()
    const userItems = await prisma.userItem.findMany({
      where: { userId: user.id },
    })
    const userItemMap = Object.fromEntries(userItems.map((ui) => [ui.itemId, ui.quantity]))
    const result = items.map((item) => ({
      ...item,
      owned: userItemMap[item.id] || 0,
    }))
    return res.status(200).json({ items: result })
  }

  if (req.method === 'POST') {
    // 购买道具
    const { itemId, quantity } = req.body || {}
    if (
      !itemId ||
      typeof itemId !== 'number' ||
      !quantity ||
      typeof quantity !== 'number' ||
      quantity < 1
    ) {
      return res
        .status(400)
        .json({ error: 'itemId and quantity are required and must be positive numbers' })
    }
    const item = await prisma.item.findUnique({ where: { id: itemId } })
    if (!item) {
      return res.status(404).json({ error: 'Item not found' })
    }
    const totalSol = item.solPrice * quantity
    const totalFaith = item.faithPrice * quantity
    if (user.solAmount < totalSol) {
      return res.status(400).json({ error: 'Insufficient solAmount' })
    }
    if (user.faithAmount < totalFaith) {
      return res.status(400).json({ error: 'Insufficient faithAmount' })
    }
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 扣除余额
        const { password, ...userData } = await tx.user.update({
          where: { id: user.id },
          data: {
            solAmount: { decrement: totalSol },
            faithAmount: { decrement: totalFaith },
          },
        })
        // 背包堆叠
        const existing = await tx.userItem.findUnique({
          where: { userId_itemId: { userId: user.id, itemId: item.id } },
        })
        if (existing) {
          await tx.userItem.update({
            where: { userId_itemId: { userId: user.id, itemId: item.id } },
            data: { quantity: { increment: quantity } },
          })
        } else {
          await tx.userItem.create({
            data: { userId: user.id, itemId: item.id, quantity },
          })
        }
        return { success: true, user: userData }
      })
      return res.status(200).json(result)
    } catch (e) {
      return res
        .status(500)
        .json({ error: e instanceof Error ? e.message : 'Internal Server Error' })
    }
  }

  if (req.method === 'PUT') {
    // 使用道具
    const { itemId, quantity } = req.body || {}
    if (
      !itemId ||
      typeof itemId !== 'number' ||
      !quantity ||
      typeof quantity !== 'number' ||
      quantity < 1
    ) {
      return res
        .status(400)
        .json({ error: 'itemId and quantity are required and must be positive numbers' })
    }
    const userItem = await prisma.userItem.findUnique({
      where: { userId_itemId: { userId: user.id, itemId } },
    })
    if (!userItem || userItem.quantity < quantity) {
      return res.status(400).json({ error: 'Insufficient item quantity' })
    }
    // 预留：根据 item.type 处理不同道具效果
    try {
      await prisma.$transaction(async (tx) => {
        await tx.userItem.update({
          where: { userId_itemId: { userId: user.id, itemId } },
          data: { quantity: { decrement: quantity } },
        })
        // TODO: 根据道具类型处理效果
      })
      return res.status(200).json({ success: true })
    } catch (e) {
      return res
        .status(500)
        .json({ error: e instanceof Error ? e.message : 'Internal Server Error' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
