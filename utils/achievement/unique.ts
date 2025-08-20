import { Prisma, User } from '@prisma/client'
import { handleCountTypeAchievement } from './common-achievement'

export const handleAchievementDeckCardFusion = async (
  user: User,
  amount: number,
  tx?: Prisma.TransactionClient,
) => {
  await handleCountTypeAchievement(
    {
      user,
      amount,
      type: 'card_fusion',
      subType: 'amount',
    },
    tx,
  )
}
