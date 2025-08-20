import { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyToken } from '../utils/jwt'
import { MeltRule } from '../utils/config'
import prisma from '../prisma'
import { handleAchievementDeckCardFusion } from '../utils/achievement/unique'

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
  const email = verifyToken(req)
  if (!email) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // 通过 email 查询 userId
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return res.status(401).json({ error: 'User not found' })
  }
  const userId = user.id
  if (user.meltCurrent <= 0) {
    return res.status(403).json({ error: 'Melt limit reached, please try again later' })
  }

  const { userCardId } = req.body
  const parsedUserCardId = Number(userCardId)
  if (
    userCardId === undefined ||
    userCardId === null ||
    isNaN(parsedUserCardId) ||
    parsedUserCardId < 0
  ) {
    return res.status(400).json({ error: 'Invalid userCardId, must be a positive integer' })
  }
  // 校验 deckCards 是否有冲突
  if (user.deckCards && Array.isArray(user.deckCards)) {
    // deckCards: [{ cardId, userCardId }, ...]
    const deckUserCardIdsSet = new Set(
      user.deckCards.map((item) => (item as { cardId: number; userCardId: number }).userCardId),
    )
    if (deckUserCardIdsSet.has(userCardId)) {
      return res.status(400).json({ error: 'This card is in your deck, please remove them first.' })
    }
  }

  // 使用事务处理 melt-card 逻辑
  try {
    const transactionResult = await prisma.$transaction(async (tx) => {
      // 查找用户卡牌
      const userCard = await tx.userCard.findUnique({
        where: { id: parsedUserCardId },
        include: { card: true },
      })
      if (!userCard || userCard.userId !== userId) {
        throw new Error('Card not found in user inventory')
      }

      // 查找返还的faithCoin
      const meltConfig = MeltRule.find((r) => r.rarity === userCard.card.rarity)
      if (!meltConfig) {
        throw new Error('Melt config not found')
      }

      // 删除用户卡牌
      await tx.userCard.delete({ where: { id: userCard.id } })
      // 增加用户faithAmount
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          faithAmount: { increment: meltConfig.faithCoin },
          meltCurrent: { decrement: 1 },
        },
      })
      // 处理成就
      await handleAchievementDeckCardFusion(updatedUser, 1, tx)

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
