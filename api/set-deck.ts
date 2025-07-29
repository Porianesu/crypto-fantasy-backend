import { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from './utils/jwt';

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 鉴权，统一使用verifyToken(req)
  const email = verifyToken(req);
  if (!email) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // 查询用户
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  const userId = user.id;

  const { cardIds } = req.body || {};
  if (!cardIds || !Array.isArray(cardIds)) {
    return res.status(400).json({ error: 'Invalid parameters' });
  }
  if (cardIds.length > 5) {
    return res.status(400).json({ error: 'Your deck can only contain up to 5 cards' });
  }

  // 校验卡牌是否属于用户
  const userCards = await prisma.userCard.findMany({
    where: { userId },
    select: { cardId: true },
  });
  const ownedCardIds = new Set(userCards.map(uc => uc.cardId));
  for (const cid of cardIds) {
    if (!ownedCardIds.has(cid)) {
      return res.status(400).json({ error: `卡牌${cid}不属于该用户` });
    }
  }

  // 计算总战力
  let deckPower = 0;
  if (cardIds.length > 0) {
    const cards = await prisma.card.findMany({ where: { id: { in: cardIds } }, select: { id: true, score: true } });
    const scoreMap = new Map(cards.map(c => [c.id, c.score]));
    deckPower = cardIds.reduce((sum, cid) => sum + (scoreMap.get(cid) || 0), 0);
  }

  // 更新用户卡组
  await prisma.user.update({
    where: { id: userId },
    data: {
      deckCardIds: cardIds,
      deckPower,
    },
  });

  res.status(200).json({ success: true, deckCardIds: cardIds, deckPower });
}
