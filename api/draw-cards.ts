import { VercelRequest, VercelResponse } from '@vercel/node'
import BigNumber from 'bignumber.js'
import { verifyToken } from '../utils/jwt'
import prisma from '../prisma'
import { handleAchievementCardsCollect } from '../utils/achievement/card-collect'
import { handleAchievementSolConsume } from '../utils/achievement/unique'

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
  const email = verifyToken(req)
  if (!email) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // 查询用户
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return res.status(404).json({ error: 'User not found' })
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
  const resultCards = selectedIndexes.map((cardTypeIndex) => {
    const baseIndex = cardTypeIndex * 4
    const cardRaritySeed = Math.random()
    if (cardRaritySeed >= 0.995) {
      return cardsData[baseIndex + 3] // SSR
    } else if (cardRaritySeed >= 0.95) {
      return cardsData[baseIndex + 2] // SR
    } else if (cardRaritySeed >= 0.75) {
      return cardsData[baseIndex + 1] // R
    } else {
      return cardsData[baseIndex] // N
    }
  })

  const now = new Date()
  const userId = user.id
  // 使用事务保证原子性
  const result = await prisma.$transaction(async (tx) => {
    // 扣减余额
    const updatedUser = await tx.user.update({
      where: { email },
      data: {
        solAmount: {
          decrement: costBN.toNumber(),
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...userData } = result.updatedUser
  res.status(200).json({ cards: cardsWithUserCardId, user: userData })
}
