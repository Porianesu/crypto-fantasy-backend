import { VercelRequest, VercelResponse } from '@vercel/node'
import axios from 'axios'
import { verifyToken } from '../../utils/jwt'
import prisma from '../../prisma'
import { setCorsHeaders } from '../../utils/common'
import { getOAuth } from '../../utils/x-oauth'

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
  if (!twitterAccount) {
    return res.status(400).json({ error: 'User has not bound X account' })
  }

  try {
    const oauth = getOAuth()
    // 查询当前绑定用户自己的信息
    const url = `https://api.twitter.com/2/users/me`
    const request_data = {
      url,
      method: 'GET',
    }
    const headers = oauth.toHeader(
      oauth.authorize(request_data, {
        key: twitterAccount.oauthToken,
        secret: twitterAccount.oauthTokenSecret,
      }),
    ) as unknown as Record<string, string>

    const response = await axios.get(url, { headers })
    return res.status(200).json(response.data)
  } catch (err: any) {
    return res.status(500).json({
      error: 'Failed to fetch user info',
      detail: err.message,
      twitterError: err.response?.data,
    })
  }
}
