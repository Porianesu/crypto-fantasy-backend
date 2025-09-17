import { VercelRequest, VercelResponse } from '@vercel/node'
import prisma from '../../prisma'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end('Unauthorized')
  }

  // 测试用：每10分钟清理一次（10分钟）
  const TEN_MINUTES = 10 * 60 * 1000
  const now = new Date()
  const expiredAt = new Date(now.getTime() - TEN_MINUTES)

  try {
    const deleted = await prisma.twitterOauthToken.deleteMany({
      where: {
        createdAt: { lt: expiredAt },
      },
    })
    return res.status(200).json({ success: true, deletedCount: deleted.count })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to cleanup', detail: String(err) })
  }
}
