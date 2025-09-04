import { VercelRequest, VercelResponse } from '@vercel/node'
import prisma from '../prisma'
import { ethers } from 'ethers/lib.esm'
import { setCorsHeaders } from '../utils/common'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, 'GET,OPTIONS')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { address } = req.query
  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid address' })
  }

  const user = await prisma.user.findUnique({ where: { address } })
  if (user && user.nonce) {
    return res.status(200).json({ nonce: user.nonce })
  }
  // 新用户或无nonce，生成一个新的
  const newNonce = ethers.hexlify(ethers.randomBytes(16))
  return res.status(200).json({ nonce: newNonce })
}
