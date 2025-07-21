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
    const { id, ids, page = '1', pageSize = '20' } = req.query;
    try {
      if (id) {
        // 查询单个卡牌
        const card = await prisma.card.findUnique({ where: { id: Number(id) } });
        if (!card) {
          return res.status(404).json({ error: 'Card not found' });
        }
        return res.status(200).json(card);
      } else if (ids) {
        // 批量查询卡牌，ids=1,2,3
        const idArr = Array.isArray(ids) ? ids : String(ids).split(',');
        const numIds = idArr.map(Number).filter(Boolean);
        if (numIds.length === 0) {
          return res.status(400).json({ error: 'Invalid ids parameter' });
        }
        const cards = await prisma.card.findMany({ where: { id: { in: numIds } } });
        return res.status(200).json(cards);
      } else {
        // 分页查询所有卡牌
        const pageNum = Math.max(1, parseInt(page as string, 10));
        const pageSizeNum = Math.max(1, parseInt(pageSize as string, 10));
        const [cards, total] = await Promise.all([
          prisma.card.findMany({
            skip: (pageNum - 1) * pageSizeNum,
            take: pageSizeNum,
          }),
          prisma.card.count(),
        ]);
        return res.status(200).json({
          data: cards,
          total,
          page: pageNum,
          pageSize: pageSizeNum,
        });
      }
    } catch (error) {
      return res.status(500).json({ error: 'Failed to fetch card(s)' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
