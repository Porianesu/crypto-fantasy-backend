import { Prisma, User } from '@prisma/client'
import { handleCountTypeAchievement } from './common-achievement'

export const handleAchievementCardFusion = async (
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

export const handleAchievementCardCraft = async (
  user: User,
  amount: number,
  tx?: Prisma.TransactionClient,
) => {
  await handleCountTypeAchievement(
    {
      user,
      amount,
      type: 'card_craft',
      subType: 'amount',
    },
    tx,
  )
}

export const handleAchievementSolConsume = async (
  user: User,
  amount: number,
  tx?: Prisma.TransactionClient,
) => {
  await handleCountTypeAchievement(
    {
      user,
      amount,
      type: 'sol_consume',
      subType: 'amount',
    },
    tx,
  )
}
