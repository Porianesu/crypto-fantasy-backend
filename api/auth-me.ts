import { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyToken } from '../utils/jwt'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const user = await verifyToken(req)
  if (!user) {
    return res.status(404).json({ error: 'Unauthorized' })
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...userData } = user
  res.status(200).json({ user: userData })
}
