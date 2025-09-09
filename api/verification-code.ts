import { VercelRequest, VercelResponse } from '@vercel/node'
import prisma from '../prisma'
import nodemailer from 'nodemailer'
import { setCorsHeaders, generateRandomString } from '../utils/common'
import validator from 'validator'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, 'POST,OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email is required' })
  if (!validator.isEmail(email)) return res.status(400).json({ error: 'Invalid email format' })
  // 查询是否已有未过期验证码
  const now = new Date()
  const code = await prisma.$transaction(async (tx) => {
    const existingCode = await tx.emailVerificationCode.findFirst({
      where: {
        email,
        expiresAt: { gt: now },
      },
      orderBy: { expiresAt: 'desc' },
    })
    let code: string
    if (existingCode) {
      code = existingCode.code
    } else {
      // 先删除该邮箱下所有验证码
      await tx.emailVerificationCode.deleteMany({
        where: { email },
      })
      code = generateRandomString(6)
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
      await tx.emailVerificationCode.create({
        data: { email, code, expiresAt },
      })
    }
    return code
  })
  // 邮件发送配置（请根据实际情况修改）
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
  await transporter.sendMail({
    from: 'developer@defed.finance',
    to: email,
    subject: 'Your verification code',
    text: `Your code is: ${code}`,
  })
  return res.status(200).json({ success: true })
}
