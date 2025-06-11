import { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      const users = await prisma.user.findMany();
      res.status(200).json(users);
    } catch (error) {
      console.log('get users error', error);
      res.status(500).json({ error: '获取用户失败' });
    }
  } else if (req.method === 'POST') {
    const { username, password, avatar, solAsset } = req.body;
    try {
      const user = await prisma.user.create({
        data: { username, password, avatar, solAsset }
      });
      res.status(200).json(user);
    } catch (error) {
      res.status(500).json({ error: '创建用户失败' });
    }
  } else {
    res.status(405).json({ error: 'Method Not Allowed' });
  }
}
