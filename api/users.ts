import { VercelRequest, VercelResponse } from '@vercel/node'
import bcrypt from 'bcryptjs'
import { signToken, verifyToken } from '../utils/jwt'
import { setCorsHeaders, generateNickname, getRandomAvatar } from '../utils/common'
import prisma from '../prisma'
import { ethers } from 'ethers'

async function handleWalletAuth(req: VercelRequest, res: VercelResponse) {
  const { address, signature, nonce } = req.body
  if (!ethers.isAddress(address)) {
    return res.status(400).json({ error: 'Invalid address format' })
  }
  let user = await prisma.user.findUnique({ where: { address } })
  if (!user) {
    // 校验签名
    const valid = ethers.verifyMessage(nonce, signature).toLowerCase() === address.toLowerCase()
    if (!valid) {
      return res.status(400).json({ error: 'Invalid signature' })
    }
    const nickname = await generateNickname()
    const avatar = getRandomAvatar()
    const newNonce = ethers.hexlify(ethers.randomBytes(16))
    user = await prisma.user.create({
      data: {
        address,
        nickname,
        avatar,
        solAmount: 0,
        hasAlreadyReadGuide: false,
        faithAmount: 0,
        expPercent: 0,
        meltCurrent: 20,
        meltMax: 20,
        nonce: newNonce,
      },
    })
    const { password: _, ...userData } = user
    const token = signToken({ address: user.address! })
    return res.status(200).json({ type: 'register', token, user: userData })
  } else {
    if (!user.nonce) {
      return res.status(400).json({ error: 'Nonce not found, please refresh and try again' })
    }
    const valid =
      ethers.verifyMessage(user.nonce, signature).toLowerCase() === address.toLowerCase()
    if (!valid) {
      return res.status(400).json({ error: 'Invalid signature' })
    }
    const newNonce = ethers.hexlify(ethers.randomBytes(16))
    const updatedUser = await prisma.user.update({ where: { address }, data: { nonce: newNonce } })
    const { password: _, ...userData } = updatedUser
    const token = signToken({ address: updatedUser.address! })
    return res.status(200).json({ type: 'login', token, user: userData })
  }
}

async function handleEmailAuth(req: VercelRequest, res: VercelResponse) {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password cannot be empty' })
  }
  const exist = await prisma.user.findUnique({ where: { email } })
  if (!exist) {
    const nickname = await generateNickname()
    const avatar = getRandomAvatar()
    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        email,
        password: hash,
        nickname,
        avatar,
        solAmount: 0,
        hasAlreadyReadGuide: false,
        faithAmount: 0,
        expPercent: 0,
        meltCurrent: 20,
        meltMax: 20,
      },
    })
    const { password: _, ...userData } = user
    const token = signToken({ email: user.email! })
    return res.status(200).json({ type: 'register', token, user: userData })
  } else {
    const valid = await bcrypt.compare(password, exist.password || '')
    if (!valid) {
      return res.status(400).json({ error: 'Incorrect password' })
    }
    const { password: _, ...userData } = exist
    const token = signToken({ email: exist.email! })
    return res.status(200).json({ type: 'login', token, user: userData })
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, 'POST,OPTIONS,PATCH')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    if (req.body && req.body.address && req.body.signature && req.body.nonce) {
      return await handleWalletAuth(req, res)
    } else if (req.body && req.body.email && req.body.password) {
      return await handleEmailAuth(req, res)
    } else {
      return res.status(400).json({ error: 'Invalid request' })
    }
  } catch (e) {
    return res.status(500).json({ error: 'Internal server error' })
  }
}
