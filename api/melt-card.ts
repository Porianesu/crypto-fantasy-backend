import { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyToken } from '../utils/jwt'
import { MeltRule } from '../utils/config'
import prisma from '../prisma'
import { handleAchievementCardFusion } from '../utils/achievement/unique'

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

  // 校验token
  const user = await verifyToken(req)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const userId = user.id
  if (user.meltCurrent <= 0) {
    return res.status(403).json({ error: 'Melt limit reached, please try again later' })
  }
  const { userCardIds } = req.body
  if (!Array.isArray(userCardIds) || userCardIds.length === 0) {
    return res.status(400).json({ error: 'userCardIds must be a non-empty array of numbers' })
  }
  const parsedUserCardIds = userCardIds.map(Number).filter((id) => !isNaN(id) && id >= 0)
  if (parsedUserCardIds.length !== userCardIds.length) {
    return res.status(400).json({ error: 'Invalid userCardIds, must be positive integers' })
  }
  if (parsedUserCardIds.length > user.meltCurrent) {
    return res.status(403).json({ error: 'Melt limit reached, please try again later' })
  }

  // 校验 deckCards 是否有冲突
  if (user.deckCards && Array.isArray(user.deckCards)) {
    const deckUserCardIdsSet = new Set(
      user.deckCards.map((item) => (item as { cardId: number; userCardId: number }).userCardId),
    )
    for (const id of parsedUserCardIds) {
      if (deckUserCardIdsSet.has(id)) {
        return res
          .status(400)
          .json({ error: 'Some cards are in your deck, please remove them first.' })
      }
    }
  }

  // 使用事务处理 melt-card 逻辑
  try {
    const transactionResult = await prisma.$transaction(async (tx) => {
      // 查找所有用户卡牌
      const userCards = await tx.userCard.findMany({
        where: {
          id: { in: parsedUserCardIds },
          userId,
        },
        include: { card: true },
      })
      if (userCards.length !== parsedUserCardIds.length) {
        throw new Error('Some cards not found in user inventory')
      }
      // 查找返还的faithCoin
      let totalFaithCoin = 0
      for (const userCard of userCards) {
        const meltConfig = MeltRule.find((r) => r.rarity === userCard.card.rarity)
        if (!meltConfig) {
          throw new Error('Melt config not found')
        }
        totalFaithCoin += meltConfig.faithCoin
      }
      // 删除用户卡牌
      await tx.userCard.deleteMany({
        where: { id: { in: parsedUserCardIds } },
      })
      // 增加用户faithAmount和减少meltCurrent
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          faithAmount: { increment: totalFaithCoin },
          meltCurrent: { decrement: parsedUserCardIds.length },
        },
      })
      // 处理成就
      await handleAchievementCardFusion(updatedUser, parsedUserCardIds.length, tx)

      const { password, ...userData } = updatedUser
      return {
        user: userData,
      }
    })
    return res.status(200).json({
      user: transactionResult.user,
    })
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal Server Error' })
  }
}
