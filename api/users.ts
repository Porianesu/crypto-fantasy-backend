import { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    try {
      const users = await prisma.user.findMany();
      res.status(200).json(users);
    } catch (error) {
      console.log('get users error', error);
      res.status(500).json({ error: '获取用户失败' });
    }
  } else if (req.method === 'POST') {
    try {
      if (!req.body) {
        return res.status(400).json({ error: '请求体不能为空' });
      }
      const { username, password, avatar } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
      }
      const user = await prisma.user.create({
        data: { username, password, avatar, solAsset: 0 }
      });
      res.status(200).json(user);
    } catch (error) {
      res.status(500).json({ error: '创建用户失败' });
    }
  } else {
    res.status(405).json({ error: 'Method Not Allowed' });
  }
}
