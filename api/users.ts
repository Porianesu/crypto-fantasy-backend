import {VercelRequest, VercelResponse} from '@vercel/node';
import {PrismaClient} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { signToken } from './utils/jwt';

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') {
    // 预检请求直接返回204
    return res.status(204).end();
  }
  if (req.method === 'GET') {
    try {
      const users = await prisma.user.findMany();
      res.status(200).json(users);
    } catch (error) {
      console.log('get users error', error);
      res.status(500).json({error: 'Failed to fetch users'});
    }
  } else if (req.method === 'POST') {
    try {
      if (!req.body) {
        return res.status(400).json({error: 'Request body cannot be empty'});
      }
      const {email, password} = req.body;
      if (!email || !password) {
        return res.status(400).json({error: 'Email and password cannot be empty'});
      }
      // 查找用户
      const exist = await prisma.user.findUnique({where: {email}});
      if (!exist) {
        // 邮箱格式校验
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (typeof email !== 'string' || !emailRegex.test(email)) {
          return res.status(400).json({error: 'Invalid email format'});
        }
        // 密码长度和类型校验
        if (typeof password !== 'string' || password.length < 6 || password.length > 32) {
          return res.status(400).json({error: 'Password length must be 6-32 characters'});
        }
        // 注册流程
        const hash = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
          data: {
            email,
            password: hash,
            solAmount: 100,
            hasAlreadyReadGuide: false,
            faithAmount: 1000,
            expPercent: 0,
            meltCurrent: 20,
            meltMax: 20,
            cardsBag: []
          }
        });
        // 不返回密码
        const {password: _, ...userData} = user;
        // 生成token
        const token = signToken(user.email);
        return res.status(200).json({
          type: 'register',
          token,
          user: userData
        });
      } else {
        // 登录流程
        const valid = await bcrypt.compare(password, exist.password);
        if (!valid) {
          return res.status(400).json({error: 'Incorrect password'});
        }
        // 不返回密码
        const {password: _, ...userData} = exist;
        // 生成token
        const token = signToken(exist.email);
        return res.status(200).json({
          type: 'login',
          token,
          user: userData
        });
      }
    } catch (error) {
      console.log('get users error', error);
      res.status(500).json({error: 'Operation failed'});
    }
  } else {
    res.status(405).json({error: 'Method Not Allowed'});
  }
}
