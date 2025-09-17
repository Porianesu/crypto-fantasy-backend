import { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyToken } from '../../utils/jwt'
import prisma from '../../prisma'
import { setCorsHeaders } from '../../utils/common'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, 'GET, OPTIONS')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const user = await verifyToken(req)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const twitterAccount = await prisma.twitterAccount.findUnique({
    where: { userId: user.id },
  })

  res.status(200).json({ twitterAccount })
}
