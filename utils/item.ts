import { Item, Prisma, User } from '@prisma/client'
import { CARD_RARITY } from './config'

const handleAddMeltCurrent = async (tx: Prisma.TransactionClient, user: User, quantity: number) => {
  return tx.user.update({
    where: { id: user.id },
    data: { meltCurrent: { increment: quantity } },
  })
}

const handleAddDrawCardsSuccessRate = async (
  tx: Prisma.TransactionClient,
  user: User,
  rarity: CARD_RARITY,
) => {
  let data
  switch (rarity) {
    case CARD_RARITY.LEGENDARY:
      data = {
        legendaryCoinBoostRoundsLeft: { increment: 8 },
      }
      break
    case CARD_RARITY.EPIC:
      data = {
        epicCoinBoostRoundsLeft: { increment: 10 },
      }
      break
    default:
      return
  }
  return tx.user.update({
    where: { id: user.id },
    data,
  })
}

export const handleItemEffect = async (
  tx: Prisma.TransactionClient,
  user: User,
  item: Item,
  quantity: number,
) => {
  console.log('handleItemEffect', { userId: user.id, itemId: item.type, quantity })
  if (!user || !item || !tx || quantity < 1) return
  switch (item.type) {
    case 'add_melt_current':
      return await handleAddMeltCurrent(tx, user, quantity)
    case 'add_draw_cards_success_rate_epic':
      return await handleAddDrawCardsSuccessRate(tx, user, CARD_RARITY.EPIC)
    case 'add_draw_cards_success_rate_legendary':
      return await handleAddDrawCardsSuccessRate(tx, user, CARD_RARITY.LEGENDARY)
    default:
      break
  }
}
