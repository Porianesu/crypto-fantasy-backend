import { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    const { id } = req.query;
    try {
      if (id) {
        // 查询单个卡牌
        const card = await prisma.card.findUnique({ where: { id: Number(id) } });
        if (!card) {
          return res.status(404).json({ error: 'Card not found' });
        }
        return res.status(200).json(card);
      } else {
        // 查询所有卡牌
        const cards = await prisma.card.findMany();
        return res.status(200).json(cards);
      }
    } catch (error) {
      return res.status(500).json({ error: 'Failed to fetch card(s)' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

