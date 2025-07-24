import { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from './utils/jwt';
import { MeltRule } from './utils/config';

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 校验token
  const email = verifyToken(req);
  if (!email) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 通过 email 查询 userId
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  const userId = user.id;

  const { cardId } = req.body;
  if (!cardId || isNaN(Number(cardId))) {
    return res.status(400).json({ error: 'Invalid cardId' });
  }

  // 查询用户是否拥有该卡
  const userCard = await prisma.userCard.findFirst({ where: { userId, cardId: Number(cardId) } });
  if (!userCard) {
    return res.status(404).json({ error: 'Card not found in user inventory' });
  }

  // 查询卡牌稀有度
  const card = await prisma.card.findUnique({ where: { id: Number(cardId) } });
  if (!card) {
    return res.status(404).json({ error: 'Card not found' });
  }

  // 查找返还的faithCoin
  const meltConfig = MeltRule.find(r => r.rarity === card.rarity);
  if (!meltConfig) {
    return res.status(500).json({ error: 'Melt config not found' });
  }

  // 删除用户卡牌
  await prisma.userCard.delete({ where: { id: userCard.id } });
  // 增加用户faithAmount
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { faithAmount: { increment: meltConfig.faithCoin } },
  });

  return res.status(200).json({
    faithAmount: updatedUser.faithAmount,
  });
}

