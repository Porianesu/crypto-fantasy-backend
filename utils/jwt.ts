import { VercelRequest } from '@vercel/node'
import jwt from 'jsonwebtoken'
import prisma from '../prisma'
import { Prisma } from '@prisma/client'

export const JWT_SECRET = process.env.JWT_SECRET as string

export async function verifyToken(
  req: VercelRequest,
  options?: Omit<Prisma.UserFindUniqueArgs, 'where'>,
) {
  const auth = req.headers['authorization'] || req.headers['Authorization']
  if (!auth || typeof auth !== 'string') return null
  const token = auth.replace(/^Bearer\s+/i, '')
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { email?: string; address?: string }
    let user = null
    if (decoded.email) {
      user = await prisma.user.findUnique({ where: { email: decoded.email }, ...(options || {}) })
    } else if (decoded.address) {
      user = await prisma.user.findUnique({
        where: { address: decoded.address },
        ...(options || {}),
      })
    }
    return user
  } catch {
    return null
  }
}

export function signToken(payload: { email?: string; address?: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}
