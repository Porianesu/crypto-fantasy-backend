import { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from './utils/jwt';

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 处理跨域
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
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

  const { page = 1, pageSize = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(pageSize);
  const take = Number(pageSize);

  try {
    const [total, userCards] = await Promise.all([
      prisma.userCard.count({ where: { userId } }),
      prisma.userCard.findMany({
        where: { userId },
        include: { card: true },
        skip,
        take,
        orderBy: { id: 'asc' },
      })
    ]);
    return res.status(200).json({
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      cards: userCards.map(uc => uc.card)
    });
  } catch (error) {
    console.error('get user cards error', error);
    return res.status(500).json({ error: 'Operation failed' });
  }
}
