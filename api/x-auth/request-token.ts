import { VercelRequest, VercelResponse } from '@vercel/node'
import { getOAuth } from '../../utils/x-oauth'
import axios from 'axios'
import { setCorsHeaders } from '../../utils/common'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const oauth = getOAuth()
    const callbackUrl = process.env.X_CALLBACK_URL!
    const request_data = {
      url: `https://api.twitter.com/oauth/request_token?oauth_callback=${encodeURIComponent(callbackUrl)}`,
      method: 'POST',
    }
    const headers = {
      Accept: 'application/json',
      ...oauth.toHeader(oauth.authorize(request_data)),
    }
    const response = await axios.post(request_data.url, null, { headers })
    // 解析 response.data
    const params = new URLSearchParams(response.data)
    const oauth_token = params.get('oauth_token')
    const oauth_token_secret = params.get('oauth_token_secret')
    if (!oauth_token) {
      return res.status(500).json({ error: 'Failed to get oauth_token' })
    }
    // 返回 oauth_token 给前端
    return res.status(200).json({ oauth_token })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get request token', detail: String(err) })
  }
}
