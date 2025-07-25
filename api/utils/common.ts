import {Card} from "@prisma/client";
import {ICraftRule} from "./config";
import { BigNumber } from 'bignumber.js'


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

export const successRateCalculate = (currentCraftRule:ICraftRule, craftTargetCard:Card, additiveCards: Array<Card>) => {
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
