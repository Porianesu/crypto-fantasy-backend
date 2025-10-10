import { VercelRequest, VercelResponse } from '@vercel/node'
import { setCorsHeaders } from '../../utils/common'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, 'POST, OPTIONS')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method === 'POST') {
    const { content } = req.body || {}
    console.log('Received content:', content)
    if (!content) {
      return res.status(400).json({ error: 'Invalid content parameter' })
    }
    if (Array.isArray(content)) {
      return res.status(200).json({ success: true, message: `Received ${content.length} races` })
    }
    console.log('content prototype:', Object.prototype.toString.call(content))
    try {
      const jsonData = JSON.parse(content)
      console.log('jsonData', jsonData)
    } catch (e) {
      return res.status(400).json({ error: 'Content is not valid JSON' })
    }
  }
  return res.status(405).json({ error: 'Method not allowed' })
}
