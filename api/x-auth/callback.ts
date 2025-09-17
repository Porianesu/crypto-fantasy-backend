import { VercelRequest, VercelResponse } from '@vercel/node'
import { getOAuth } from '../../utils/x-oauth'
import axios from 'axios'
import { setCorsHeaders } from '../../utils/common'
import prisma from '../../prisma'

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

  // 查询数据库获取 oauth_token_secret
  const tokenRecord = await prisma.twitterOauthToken.findUnique({
    where: { oauthToken: String(oauth_token) },
  })
  if (!tokenRecord) {
    return res.status(400).json({ error: 'Invalid or expired oauth_token' })
  }
  const oauth_token_secret = tokenRecord.oauthTokenSecret

  try {
    const oauth = getOAuth()
    const request_data = {
      url: 'https://api.twitter.com/oauth/access_token',
      method: 'POST',
    }
    // 关键：用 token 参与签名
    const token = {
      key: String(oauth_token),
      secret: oauth_token_secret,
    }
    const headers = {
      Accept: 'application/json',
      ...oauth.toHeader(oauth.authorize(request_data, token)),
    }
    const response = await axios.post(request_data.url, null, {
      headers,
      params: { oauth_token, oauth_verifier },
    })
    // 解析 response.data
    const params = new URLSearchParams(response.data)
    console.log('Access Token Response:', params.toString())
    const oauth_token_res = params.get('oauth_token')
    const oauth_token_secret_res = params.get('oauth_token_secret')
    const user_id = params.get('user_id')
    const screen_name = params.get('screen_name')
    if (!oauth_token_res || !user_id) {
      return res.status(500).json({ error: 'Failed to get access token' })
    }
    // 删除已用的token
    await prisma.twitterOauthToken.delete({ where: { oauthToken: String(oauth_token) } })
    // 返回数据
    return res.status(200).json({
      oauth_token: oauth_token_res,
      oauth_token_secret: oauth_token_secret_res,
      user_id,
      screen_name,
    })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get access token', detail: String(err) })
  }
}
