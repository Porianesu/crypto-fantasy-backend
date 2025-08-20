import { User } from '@prisma/client'
import { handleCountTypeAchievement } from './common-achievement'

export const handleAchievementDeckScore = async (user: User, deckScore: number) => {
  await handleCountTypeAchievement(user, deckScore, 'deck_score', 'amount')
}

export const handleAchievementDeckScoreRank = async (user: User, rank: number) => {}
