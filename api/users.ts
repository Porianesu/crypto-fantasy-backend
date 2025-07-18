import { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    try {
      const users = await prisma.user.findMany();
      res.status(200).json(users);
    } catch (error) {
      console.log('get users error', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  } else if (req.method === 'POST') {
    try {
      if (!req.body) {
        return res.status(400).json({ error: 'Request body cannot be empty' });
      }
      const { email, password } = req.body;
      // 邮箱格式校验
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (typeof email !== 'string' || !emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      // 密码长度和类型校验
      if (typeof password !== 'string' || password.length < 6 || password.length > 32) {
        return res.status(400).json({ error: 'Password length must be 6-32 characters' });
      }
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password cannot be empty' });
      }
      // 查找用户
      const exist = await prisma.user.findUnique({ where: { email } });
      if (!exist) {
        // 注册流程
        const hash = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
          data: {
            email,
            password: hash,
            solAsset: 100,
            hasAlreadyReadGuide: false,
            faithAmount: 1000,
            expPercent: 0,
            meltCurrent: 0,
            meltMax: 0,
            cardsBag: []
          }
        });
        // 不返回密码
        const { password: _, ...userData } = user;
        return res.status(200).json(userData);
      } else {
        // 登录流程
        const valid = await bcrypt.compare(password, exist.password);
        if (!valid) {
          return res.status(400).json({ error: 'Incorrect password' });
        }
        // 不返回密码
        const { password: _, ...userData } = exist;
        return res.status(200).json(userData);
      }
    } catch (error) {
      console.log('get users error', error);
      res.status(500).json({ error: 'Operation failed' });
    }
  } else {
    res.status(405).json({ error: 'Method Not Allowed' });
  }
}
