import { Prisma, User } from '@prisma/client'
import { handleCountTypeAchievement } from './common-achievement'

export const handleAchievementDeckScore = async (
  user: User,
  deckScore: number,
  tx?: Prisma.TransactionClient,
) => {
  await handleCountTypeAchievement(
    {
      user,
      amount: deckScore,
      type: 'deck_score',
      subType: 'amount',
    },
    tx,
  )
}

export const handleAchievementDeckScoreRank = async (user: User, rank: number) => {}
