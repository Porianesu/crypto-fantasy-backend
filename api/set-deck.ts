import { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyToken } from '../utils/jwt'
import prisma from '../prisma'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // 鉴权，统一使用verifyToken(req)
  const email = verifyToken(req)
  if (!email) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  // 查询用户
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }
  const userId = user.id

  const { deckCards } = req.body || {}
  if (!Array.isArray(deckCards)) {
    return res.status(400).json({ error: 'deckCards must be an array' })
  }
  // 校验每个元素都包含 cardId 和 userCardId
  for (const item of deckCards) {
    if (typeof item.cardId !== 'number' || typeof item.userCardId !== 'number') {
      return res
        .status(400)
        .json({ error: 'Each deck card must have cardId and userCardId as number' })
    }
  }
  // 校验 deckCards 是否真实存在且属于当前用户
  const userCardIds = deckCards.map((item) => item.userCardId)
  const userCards = await prisma.userCard.findMany({
    where: {
      id: { in: userCardIds },
      userId: userId,
    },
    include: { card: true },
  })
  if (userCards.length !== deckCards.length) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        deckCards: [],
        deckPower: 0,
      },
    })
    return res.status(400).json({ error: 'Some userCardId does not belong to user' })
  }
  // 校验 cardId 是否匹配
  for (const item of deckCards) {
    const found = userCards.find((uc) => uc.id === item.userCardId && uc.cardId === item.cardId)
    if (!found) {
      return res.status(400).json({ error: 'userCardId and cardId mismatch' })
    }
  }

  // 计算总战力
  const deckPower = userCards.reduce((previousValue, currentValue) => {
    return previousValue + currentValue.card.score
  }, 0)
  // 更新用户卡组
  await prisma.user.update({
    where: { id: userId },
    data: {
      deckCards: deckCards,
      deckPower,
    },
  })
  res.status(200).json({ success: true, deckCards, deckPower })
}
