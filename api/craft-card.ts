import { VercelRequest, VercelResponse } from '@vercel/node'
import { Card } from '@prisma/client'
import { verifyToken } from '../utils/jwt'
import { CraftRule, ICraftRule } from '../utils/config'
import { successRateCalculate } from '../utils/common'
import { BigNumber } from 'bignumber.js'
import prisma from '../prisma'
import { handleAchievementCardsCollect } from '../utils/achievement/card-collect'
import {
  handleAchievementCardCraft,
  handleAchievementCardsFaithConsume,
} from '../utils/achievement/unique'

const isRequiredCardValid = (targetCard: Card, requiredCard: Card, ruleConfig: ICraftRule) => {
  if (requiredCard.id + 1 !== targetCard.id) {
    return false
  }
  return requiredCard.rarity === ruleConfig.requiredCards.rarity
}

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

  const user = await verifyToken(req)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  // 校验 deckCards 是否有冲突
  if (user.deckCards && Array.isArray(user.deckCards)) {
    // deckCards: [{ cardId, userCardId }, ...]
    const deckUserCardIdsSet = new Set(
      user.deckCards.map((item) => (item as { cardId: number; userCardId: number }).userCardId),
    )
    const conflictRequired = requiredUserCardIds.some((id: number) => deckUserCardIdsSet.has(id))
    const conflictAdditive =
      additiveUserCardIds && additiveUserCardIds.some((id: number) => deckUserCardIdsSet.has(id))
    if (conflictRequired || conflictAdditive) {
      return res
        .status(400)
        .json({ error: 'Some cards is in your deck, please remove them first.' })
    }
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
  // 校验 requiredCards 是否都符合规则
  const allRequiredValid = requiredCards.every((userCard) =>
    isRequiredCardValid(craftCard, userCard.card, craftConfig),
  )
  if (!allRequiredValid) {
    return res.status(400).json({ error: 'Required cards not valid!' })
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

  try {
    const transactionResult = await prisma.$transaction(async (tx) => {
      // faithAmount 扣款
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: { faithAmount: { decrement: craftConfig.requiredFaithCoin } },
      })
      //更新成就
      await handleAchievementCardsFaithConsume(updatedUser, craftConfig.requiredFaithCoin, tx)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...userData } = updatedUser

      const successRate = successRateCalculate(
        craftConfig,
        craftCard,
        additiveCards.map((card) => card.card),
      )
      const randomNumber = new BigNumber(Math.random())
      // 删除所有消耗的卡牌
      await tx.userCard.deleteMany({
        where: {
          id: {
            in: [
              ...requiredCards.map((userCard) => userCard.id),
              ...additiveCards.map((userCard) => userCard.id),
            ],
          },
        },
      })
      if (randomNumber.isLessThanOrEqualTo(successRate)) {
        // 合成成功
        const userCardCreateResult = await tx.userCard.create({
          data: {
            userId: user.id,
            cardId: craftCard.id,
          },
          include: { card: true },
        })
        // 更新成就
        await Promise.all([
          handleAchievementCardCraft(updatedUser, 1, tx),
          handleAchievementCardsCollect(updatedUser, [craftCard], tx),
        ])
        return {
          success: true,
          resultCards: [{ ...userCardCreateResult.card, userCardId: userCardCreateResult.id }],
          user: userData,
        }
      } else {
        // 合成失败，返还部分卡牌
        const randomRequiredCardIndex = Math.floor(Math.random() * requiredCards.length)
        const returnRequiredCards = requiredCards[randomRequiredCardIndex]
        const resultCards = [returnRequiredCards.card]
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
            throw new Error('Return additive card not found')
          }
          resultCards.push(returnAdditiveCard)
        }
        // 返还卡牌
        const returnUserCards = await Promise.all(
          resultCards.map((card) =>
            tx.userCard.create({
              data: {
                userId: user.id,
                cardId: card.id,
              },
              include: {
                card: true,
              },
            }),
          ),
        )
        return {
          success: false,
          resultCards: returnUserCards.map((userCard) => ({
            ...userCard.card,
            userCardId: userCard.id,
          })),
          user: userData,
        }
      }
    })
    return res.status(200).json({
      success: transactionResult.success,
      resultCards: transactionResult.resultCards,
      user: transactionResult.user,
    })
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Internal Server Error' })
  }
}
