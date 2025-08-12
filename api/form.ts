import { VercelRequest, VercelResponse } from '@vercel/node'
import prisma from '../prisma'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')

  if (req.method === 'OPTIONS') {
    // 预检请求直接返回204
    return res.status(204).end()
  }

  if (req.method === 'POST') {
    try {
      if (!req.body) {
        return res.status(400).json({ code: 1001, error: 'Request body cannot be empty.' })
      }
      const { name, email, note } = req.body
      if (!name || !email) {
        return res.status(400).json({ code: 1002, error: 'Name and Email are required.' })
      }
      // 检查email是否已存在
      const existing = await prisma.formSubmission.findFirst({ where: { email } })
      if (existing) {
        return res.status(409).json({ code: 1003, error: 'This email has already submitted.' })
      }
      const submission = await prisma.formSubmission.create({
        data: { name, email, note },
      })
      res.status(200).json(submission)
    } catch (error) {
      res.status(500).json({ code: 1004, error: 'Form submission failed.' })
    }
  } else if (req.method === 'GET') {
    try {
      const submissions = await prisma.formSubmission.findMany({ orderBy: { createdAt: 'desc' } })
      res.status(200).json(submissions)
    } catch (error) {
      res.status(500).json({ code: 2001, error: 'Failed to fetch submissions.' })
    }
  } else {
    res.status(405).json({ code: 1005, error: 'Only POST and GET methods are allowed.' })
  }
}
