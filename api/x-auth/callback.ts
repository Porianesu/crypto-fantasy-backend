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

  const { oauth_token, oauth_verifier } = req.query
  if (!oauth_token || !oauth_verifier) {
    return res.status(400).json({ error: 'Missing oauth_token or oauth_verifier' })
  }

  try {
    const oauth = getOAuth()
    const request_data = {
      url: 'https://api.twitter.com/oauth/access_token',
      method: 'POST',
    }
    const headers = {
      Accept: 'application/json',
      ...oauth.toHeader(oauth.authorize(request_data)),
    }
    const response = await axios.post(request_data.url, null, {
      headers,
      params: { oauth_token, oauth_verifier },
    })
    // 解析 response.data
    const params = new URLSearchParams(response.data)
    const oauth_token_res = params.get('oauth_token')
    const oauth_token_secret = params.get('oauth_token_secret')
    const user_id = params.get('user_id')
    const screen_name = params.get('screen_name')
    if (!oauth_token_res || !user_id) {
      return res.status(500).json({ error: 'Failed to get access token' })
    }
    // TODO: 这里可以将 user_id, screen_name 绑定到你自己的用户表
    return res
      .status(200)
      .json({ oauth_token: oauth_token_res, oauth_token_secret, user_id, screen_name })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get access token', detail: String(err) })
  }
}
