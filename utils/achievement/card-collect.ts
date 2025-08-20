import { Card, Prisma, User } from '@prisma/client'
import { CARD_RARITY } from '../config'
import { handleCountTypeAchievement } from './common-achievement'

async function handleAchievementCardsCollectWithSubtype(
  user: User,
  subType: 'amount' | 'normal' | 'rare' | 'epic' | 'legendary' = 'amount',
  amount: number,
  tx?: Prisma.TransactionClient,
) {
  await handleCountTypeAchievement({ user, amount, type: 'cards_collect', subType }, tx)
}

export async function handleAchievementCardsCollect(
  user: User,
  cards: Array<Card>,
  tx?: Prisma.TransactionClient,
) {
  if (!user || !cards || cards.length === 0) return
  const amount = cards.length
  let normal = 0
  let rare = 0
  let epic = 0
  let legendary = 0
  for (const card of cards) {
    switch (card.rarity) {
      case CARD_RARITY.NORMAL:
        normal++
        break
      case CARD_RARITY.RARE:
        rare++
        break
      case CARD_RARITY.EPIC:
        epic++
        break
      case CARD_RARITY.LEGENDARY:
        legendary++
        break
    }
  }
  // 使用 Promise.all 并���推进不同稀有度的成就
  const tasks = [handleAchievementCardsCollectWithSubtype(user, 'amount', amount, tx)]
  if (normal > 0) tasks.push(handleAchievementCardsCollectWithSubtype(user, 'normal', normal, tx))
  if (rare > 0) tasks.push(handleAchievementCardsCollectWithSubtype(user, 'rare', rare, tx))
  if (epic > 0) tasks.push(handleAchievementCardsCollectWithSubtype(user, 'epic', epic, tx))
  if (legendary > 0)
    tasks.push(handleAchievementCardsCollectWithSubtype(user, 'legendary', legendary, tx))
  await Promise.all(tasks)
}
