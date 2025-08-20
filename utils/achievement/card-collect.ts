import { Card, User } from '@prisma/client'
import { CARD_RARITY } from '../config'
import { handleCountTypeAchievement } from './common-achievement'

async function handleAchievementCardsCollectWithSubtype(
  user: User,
  subType: 'amount' | 'normal' | 'rare' | 'epic' | 'legendary' = 'amount',
  amount: number,
) {
  await handleCountTypeAchievement(user, amount, 'cards_collect', subType)
}

export async function handleAchievementCardsCollect(user: User, cards: Array<Card>) {
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
  const tasks = [handleAchievementCardsCollectWithSubtype(user, 'amount', amount)]
  if (normal > 0) tasks.push(handleAchievementCardsCollectWithSubtype(user, 'normal', normal))
  if (rare > 0) tasks.push(handleAchievementCardsCollectWithSubtype(user, 'rare', rare))
  if (epic > 0) tasks.push(handleAchievementCardsCollectWithSubtype(user, 'epic', epic))
  if (legendary > 0)
    tasks.push(handleAchievementCardsCollectWithSubtype(user, 'legendary', legendary))
  await Promise.all(tasks)
}
