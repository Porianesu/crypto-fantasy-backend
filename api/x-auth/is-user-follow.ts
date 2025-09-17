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
    const url = `https://api.twitter.com/2/users/${twitterAccount.twitterUserId}/following`
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
    headers['Content-Type'] = 'application/json'

    // 支持分页参数
    const { pagination_token, max_results } = req.query
    const params: any = {}
    if (pagination_token) params.pagination_token = pagination_token
    if (max_results) params.max_results = max_results

    const response = await axios.get(url, { headers, params })
    // 返回完整的 following 列表（部分字段）
    return res.status(200).json(response.data)
  } catch (err: any) {
    return res.status(500).json({
      error: 'Failed to fetch following list',
      detail: err.message,
      twitterError: err,
    })
  }
}
