import { VercelRequest, VercelResponse } from '@vercel/node'
import { PrismaClient } from '@prisma/client'
import { verifyToken } from './utils/jwt'
import { CraftRule } from './utils/config'
import { successRateCalculate } from './utils/common'
import { BigNumber } from 'bignumber.js'

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

  // 通过 email 查询 userId
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return res.status(401).json({ error: 'User not found' })
  }

  const { craftCardId, requiredUserCardIds, additiveUserCardIds } = req.body
  if (
    !craftCardId ||
    typeof craftCardId !== 'number' ||
    !requiredUserCardIds ||
    !Array.isArray(requiredUserCardIds) ||
    (additiveUserCardIds && !Array.isArray(additiveUserCardIds))
  ) {
    return res.status(400).json({
      error:
        'Invalid request body. craftCardId must be a number, requiredUserCardIds and additiveUserCardIds must be arrays.',
    })
  }

  // 查询卡牌稀有度
  const craftCard = await prisma.card.findUnique({ where: { id: craftCardId } })
  if (!craftCard) {
    return res.status(404).json({ error: 'Card not found' })
  }

  const craftConfig = CraftRule.find((item) => item.targetRarity === craftCard.rarity)
  if (!craftConfig) {
    return res.status(500).json({ error: 'Craft config not found' })
  }

  // faithAmount 校验和扣款
  if (user.faithAmount < craftConfig.requiredFaithCoin) {
    return res.status(400).json({ error: 'Insufficient faith coin!' })
  }

  // 查找用户拥有的 requiredCards
  const requiredCards = await prisma.userCard.findMany({
    where: {
      id: { in: requiredUserCardIds },
      userId: user.id,
    },
    include: { card: true },
  })
  if (requiredCards.length < craftConfig.requiredCards.count) {
    return res.status(400).json({ error: 'Required cards not enough!' })
  }

  // 查找 additiveCards
  const additiveCards = await prisma.userCard.findMany({
    where: {
      id: { in: additiveUserCardIds },
      userId: user.id,
    },
    include: { card: true },
  })
  if (additiveCards.length < additiveUserCardIds.length) {
    return res.status(400).json({ error: "Additive cards doesn't match" })
  }

  // faithAmount 扣款
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...userData } = await prisma.user.update({
    where: { id: user.id },
    data: { faithAmount: { decrement: craftConfig.requiredFaithCoin } },
  })

  const successRate = successRateCalculate(
    craftConfig,
    craftCard,
    additiveCards.map((card) => card.card),
  )
  const randomNumber = new BigNumber(Math.random())
  // 删除所有消耗的卡牌
  await prisma.userCard.deleteMany({
    where: {
      id: {
        in: [
          ...requiredCards.map((userCard) => userCard.id),
          ...additiveCards.map((userCard) => userCard.id),
        ],
      },
    },
  })
  try {
    if (randomNumber.isLessThanOrEqualTo(successRate)) {
      const userCardCreateResult = await prisma.userCard.create({
        data: {
          userId: user.id,
          cardId: craftCard.id,
        },
        include: { card: true },
      })
      return res.status(200).json({
        success: true,
        user: userData,
        resultCards: [
          {
            userCardId: userCardCreateResult.id,
            ...userCardCreateResult.card,
          },
        ],
      })
    } else {
      // 合成失败逻辑：按规则返还部分消耗卡牌
      // 随机返还一张 requiredCards 中的卡
      const randomRequiredCardIndex = Math.floor(Math.random() * requiredCards.length)
      const returnRequiredCard = requiredCards[randomRequiredCardIndex]
      const resultCards: Array<number> = [returnRequiredCard.cardId]
      // 可选：随机返还一张 additiveCards 中的卡
      if (additiveCards.length > 0) {
        const randomAdditiveCardIndex = Math.floor(Math.random() * additiveCards.length)
        const targetAdditiveCard = additiveCards[randomAdditiveCardIndex]
        const returnAdditiveCard = await prisma.card.findFirst({
          where: {
            id:
              targetAdditiveCard.card.rarity === 0
                ? targetAdditiveCard.cardId
                : targetAdditiveCard.cardId - 1,
          },
        })
        if (!returnAdditiveCard) {
          return res.status(404).json({ error: 'Return additive card not found' })
        }
        resultCards.push(returnAdditiveCard.id)
      }
      const now = new Date()
      // 返还 resultCards 到用户背包
      await prisma.userCard.createMany({
        data: resultCards.map((cardId) => ({
          userId: user.id,
          cardId: cardId,
        })),
      })
      // 查询本次新获得的userCard
      const newUserCards = await prisma.userCard.findMany({
        where: {
          userId: user.id,
          obtainedAt: { gte: now },
          cardId: { in: resultCards },
        },
        include: { card: true },
      })
      return res.status(200).json({
        success: false,
        user: userData,
        resultCards: newUserCards.map((item) => ({
          ...item.card,
          userCardId: item.id,
        })),
      })
    }
  } catch (error) {
    console.error('Craft error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}
