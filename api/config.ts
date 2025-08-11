import { VercelRequest, VercelResponse } from '@vercel/node'
import { CraftRule, DefaultAvatars, MeltRule } from '../utils/config'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      DefaultAvatars,
      CraftRule,
      MeltRule,
    })
  }

  return res.status(405).json({ error: 'Method Not Allowed' })
}
