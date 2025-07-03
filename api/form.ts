import { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    try {
      if (!req.body) {
        return res.status(400).json({ error: '请求体不能为空' });
      }
      const { name, email, note } = req.body;
      if (!name || !email) {
        return res.status(400).json({ error: 'Name和Email不能为空' });
      }
      const submission = await prisma.formSubmission.create({
        data: { name, email, note }
      });
      res.status(200).json(submission);
    } catch (error) {
      res.status(500).json({ error: '表单提交失败' });
    }
  } else {
    res.status(405).json({ error: '仅支持POST方法' });
  }
}

