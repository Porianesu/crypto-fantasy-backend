import { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from './utils/jwt';

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 统一鉴权，使用verifyToken(req)
  let email: string | null = null;
  try {
    email = verifyToken(req);
  } catch {
    email = null;
  }
  let userId: number | null = null;
  if (email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) userId = user.id;
  }

  // 查询前50名排行榜
  const topUsers = await prisma.user.findMany({
    orderBy: { deckPower: 'desc' },
    take: 50,
    select: {
      id: true,
      email: true,
      avatar: true,
      deckCardIds: true,
      deckPower: true,
    },
  });

  // 查询当前用户战力和排名
  let myDeckPower = 0;
  let myRank = null;
  if (userId) {
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { deckPower: true } });
    if (me) {
      myDeckPower = me.deckPower;
      // 查询排名
      const count = await prisma.user.count({ where: { deckPower: { gt: myDeckPower } } });
      myRank = count + 1;
    }
  }

  res.status(200).json({
    leaderboard: topUsers,
    myDeckPower,
    myRank,
  });
}
