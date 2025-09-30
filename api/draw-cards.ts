import { VercelRequest, VercelResponse } from '@vercel/node'
import BigNumber from 'bignumber.js'
import { verifyToken } from '../utils/jwt'
import prisma from '../prisma'
import { handleAchievementCardsCollect } from '../utils/achievement/card-collect'
import { handleAchievementSolConsume } from '../utils/achievement/unique'
import {
  CARD_RARITY,
  EpicDrawCardsSucceedRate,
  LegendaryDrawCardGuarantee,
  LegendaryDrawCardsSucceedRate,
  NormalDrawCardsSucceedRate,
} from '../utils/config'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  // 校验token
  const user = await verifyToken(req)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // 查询所有卡牌
  const cardsData = await prisma.card.findMany({
    orderBy: { id: 'asc' }, // 确保卡牌按id顺序
  })
  if (!cardsData || cardsData.length === 0) {
    return res.status(500).json({ error: 'No card data found' })
  }

  // 使用BigNumber进行余额比较
  const solAmountBN = new BigNumber(user.solAmount)
  const costBN = new BigNumber(1)
  if (solAmountBN.isLessThan(costBN)) {
    return res.status(400).json({ error: 'Insufficient Balance!' })
  }

  // 分组，每4张为一个类型
  const cardTypeCount = Math.floor(cardsData.length / 4)
  const availableIndexes = Array.from({ length: cardTypeCount }, (_, i) => i)
  // 洗牌
  for (let i = availableIndexes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[availableIndexes[i], availableIndexes[j]] = [availableIndexes[j], availableIndexes[i]]
  }
  // 抽5张卡
  const drawCardsCount = 5
  const selectedIndexes = availableIndexes.slice(0, drawCardsCount)

  // 事务实现保底逻辑
  const now = new Date()
  const userId = user.id
  const result = await prisma.$transaction(async (tx) => {
    // 查询最新用户，获取保底计数
    const freshUser = await tx.user.findUnique({ where: { id: userId } })
    if (!freshUser) {
      throw new Error('User not found')
    }
    const drawCount = freshUser?.drawCountSinceLastLegendary ?? 0
    let legendaryDrawn = false
    let drawCardsRate
    let useLegendaryLuckyCoin = false
    let useEpicLuckyCoin = false
    if (freshUser.legendaryCoinBoostRoundsLeft) {
      drawCardsRate = LegendaryDrawCardsSucceedRate
      useLegendaryLuckyCoin = true
    } else if (freshUser.epicCoinBoostRoundsLeft) {
      drawCardsRate = EpicDrawCardsSucceedRate
      useEpicLuckyCoin = true
    } else {
      drawCardsRate = NormalDrawCardsSucceedRate
    }
    const resultCards = selectedIndexes.map((cardTypeIndex) => {
      const baseIndex = cardTypeIndex * 4
      const cardRaritySeed = Math.random()
      if (cardRaritySeed >= drawCardsRate[CARD_RARITY.LEGENDARY]) {
        legendaryDrawn = true
        return cardsData[baseIndex + 3] // SSR
      } else if (cardRaritySeed >= drawCardsRate[CARD_RARITY.EPIC]) {
        return cardsData[baseIndex + 2] // SR
      } else if (cardRaritySeed >= drawCardsRate[CARD_RARITY.RARE]) {
        return cardsData[baseIndex + 1] // R
      } else {
        return cardsData[baseIndex] // N
      }
    })
    // 保底逻辑：如果未抽到橙卡且计数达到60，则强制将最后一张卡设为橙卡
    if (!legendaryDrawn && drawCount + 1 >= LegendaryDrawCardGuarantee) {
      const lastIndex = selectedIndexes[selectedIndexes.length - 1]
      resultCards[resultCards.length - 1] = cardsData[lastIndex * 4 + 3]
      legendaryDrawn = true
    }
    // 更新保底计数
    const newDrawCount = legendaryDrawn ? 0 : drawCount + 1
    // 扣减余额和更新保底计数
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        solAmount: {
          decrement: costBN.toNumber(),
        },
        drawCountSinceLastLegendary: newDrawCount,
        legendaryCoinBoostRoundsLeft: {
          decrement: useLegendaryLuckyCoin ? 1 : 0,
        },
        epicCoinBoostRoundsLeft: {
          decrement: useEpicLuckyCoin ? 1 : 0,
        },
      },
    })
    // 批量插入UserCard
    await tx.userCard.createMany({
      data: resultCards.map((card) => ({ userId, cardId: card.id, obtainedAt: now })),
    })
    // 查询新获得的userCard
    const newUserCards = await tx.userCard.findMany({
      where: {
        userId,
        obtainedAt: { gte: now },
        cardId: { in: resultCards.map((card) => card.id) },
      },
      include: { card: true },
    })
    // 处理成就卡牌收集逻辑
    await Promise.all([
      handleAchievementSolConsume(updatedUser, costBN.toNumber(), tx),
      handleAchievementCardsCollect(
        updatedUser,
        newUserCards.map((item) => item.card),
        tx,
      ),
    ])
    return { updatedUser, newUserCards }
  })

  // 合并userCardId到resultCards
  const cardsWithUserCardId = result.newUserCards.map((item) => ({
    ...item.card,
    userCardId: item.id,
  }))

  // 不返回密码
  const { password, ...userData } = result.updatedUser
  res.status(200).json({ cards: cardsWithUserCardId, user: userData })
}
