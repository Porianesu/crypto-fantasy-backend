import { VercelRequest, VercelResponse } from '@vercel/node'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { signToken } from './utils/jwt'
import { DefaultAvatars } from './utils/config'

const prisma = new PrismaClient()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')

  if (req.method === 'OPTIONS') {
    // 预检请求直接返回204
    return res.status(204).end()
  }
  if (req.method === 'GET') {
    try {
      const users = await prisma.user.findMany()
      res.status(200).json(users)
    } catch (error) {
      console.log('get users error', error)
      res.status(500).json({ error: 'Failed to fetch users' })
    }
  } else if (req.method === 'POST') {
    try {
      if (!req.body) {
        return res.status(400).json({ error: 'Request body cannot be empty' })
      }
      const { email, password } = req.body
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password cannot be empty' })
      }
      // 查找用户
      const exist = await prisma.user.findUnique({ where: { email } })
      if (!exist) {
        // 邮箱格式校验
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (typeof email !== 'string' || !emailRegex.test(email)) {
          return res.status(400).json({ error: 'Invalid email format' })
        }
        // 密码长度和类型校验
        if (typeof password !== 'string' || password.length < 6 || password.length > 32) {
          return res.status(400).json({ error: 'Password length must be 6-32 characters' })
        }
        // 注册流程前生成唯一昵称
        // 优化昵称生成逻辑
        const batchSize = 20
        let nickname: string = ''
        let found = false
        while (!found) {
          // 批量生成昵称
          const candidates = Array.from(
            { length: batchSize },
            () => `Adventure_#${Math.floor(10000 + Math.random() * 90000)}`,
          )
          // 查询已存在的昵称
          const existNicknames = await prisma.user.findMany({
            where: { nickname: { in: candidates } },
            select: { nickname: true },
          })
          const existSet = new Set(existNicknames.map((u) => u.nickname))
          // 选出未被使用的昵称
          const available = candidates.filter((n) => !existSet.has(n))
          if (available.length > 0) {
            nickname = available[0]
            found = true
          }
        }
        // 注册流程
        const hash = await bcrypt.hash(password, 10)
        const randomDefaultAvatar =
          DefaultAvatars[Math.floor(Math.random() * DefaultAvatars.length)]
        const user = await prisma.user.create({
          data: {
            email,
            avatar: randomDefaultAvatar,
            password: hash,
            solAmount: 20,
            hasAlreadyReadGuide: false,
            faithAmount: 10000,
            expPercent: 0,
            meltCurrent: 20,
            meltMax: 20,
            nickname,
          },
        })
        // 不返回密码
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _, ...userData } = user
        // 生成token
        const token = signToken(user.email)
        return res.status(200).json({
          type: 'register',
          token,
          user: userData,
        })
      } else {
        // 登录流程
        const valid = await bcrypt.compare(password, exist.password)
        if (!valid) {
          return res.status(400).json({ error: 'Incorrect password' })
        }
        // 不返回密码
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _, ...userData } = exist
        // 生成token
        const token = signToken(exist.email)
        return res.status(200).json({
          type: 'login',
          token,
          user: userData,
        })
      }
    } catch (error) {
      console.log('get users error', error)
      res.status(500).json({ error: 'Operation failed' })
    }
  } else {
    res.status(405).json({ error: 'Method Not Allowed' })
  }
}
