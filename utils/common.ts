import { Card } from '@prisma/client'
import { ICraftRule, DefaultAvatars } from './config'
import { BigNumber } from 'bignumber.js'
import prisma from '../prisma'
import { VercelResponse } from '@vercel/node'

export const generateRandomString = (length = 8) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export const isCardsSameChain = (card1: Card, card2: Card) => {
  return Math.floor(card1.id / 4) === Math.floor(card2.id / 4)
}

const calculateAdditiveCardBonusRate = (craftTargetCard: Card, additiveCard: Card) => {
  let exponent = additiveCard.rarity - craftTargetCard.rarity
  if (!isCardsSameChain(additiveCard, craftTargetCard)) {
    exponent -= 1 // If the card is not in the same chain, reduce the exponent by 1
  }
  const baseSuccessRate = new BigNumber(0.1) // Base success rate for each additive card
  const base = new BigNumber(2)
  return baseSuccessRate.times(base.exponentiatedBy(exponent))
}

export const successRateCalculate = (
  currentCraftRule: ICraftRule,
  craftTargetCard: Card,
  additiveCards: Array<Card>,
) => {
  if (!currentCraftRule || !craftTargetCard) return new BigNumber(0)
  const baseSuccessRate = new BigNumber(currentCraftRule.baseSuccessRate)
  const maxSuccessRate = new BigNumber(currentCraftRule.maxSuccessRate)
  const additiveSuccessRate = additiveCards.reduce((previousValue, currentValue) => {
    return previousValue.plus(calculateAdditiveCardBonusRate(craftTargetCard, currentValue))
  }, new BigNumber(0))
  const finalSuccessRate = new BigNumber(baseSuccessRate).plus(additiveSuccessRate)
  if (finalSuccessRate.isGreaterThan(maxSuccessRate)) {
    return maxSuccessRate
  } else {
    return finalSuccessRate
  }
}

export function setCorsHeaders(res: VercelResponse, allowMethods = 'GET,POST,OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', allowMethods)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
}

export async function generateNickname(): Promise<string> {
  const batchSize = 20
  let nickname = ''
  let found = false
  while (!found) {
    const candidates = Array.from(
      { length: batchSize },
      () => `Adventurer_#${Math.floor(10000 + Math.random() * 90000)}`,
    )
    const existNicknames = await prisma.user.findMany({
      where: { nickname: { in: candidates } },
      select: { nickname: true },
    })
    const existSet = new Set(existNicknames.map((u) => u.nickname))
    const available = candidates.filter((n) => !existSet.has(n))
    if (available.length > 0) {
      nickname = available[0]
      found = true
    }
  }
  return nickname
}

export function getRandomAvatar(): string {
  return DefaultAvatars[Math.floor(Math.random() * DefaultAvatars.length)]
}
