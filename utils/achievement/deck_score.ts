import { Achievement, Prisma, User, UserAchievement } from '@prisma/client'
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

export const handleAchievementDeckScoreRank = async (
  user: User,
  rank: number,
  tx: Prisma.TransactionClient,
  recursiveProtection = 0,
) => {
  if (!user || rank <= 0) return
  const userId = user.id
  const type = 'deck_score'
  const subType = 'rank'
  const allAchievements = await tx.achievement.findMany({
    where: {
      type,
      subType,
    },
  })

  if (allAchievements.length === 0) {
    console.error(`Achievement not found for ${type}(${subType})`)
    return
  }
  if (recursiveProtection > allAchievements.length) {
    console.error('Max recursion depth reached in handleAchievementDeckScoreRank')
    return
  }

  // 找到未完成且target最大的成就
  let unfinishedAchievement: Achievement | undefined = undefined
  let unfinishedUserAchievement: UserAchievement | null = null
  for (const a of allAchievements.sort((a, b) => b.target - a.target)) {
    const userAch = await tx.userAchievement.findFirst({
      where: {
        userId: userId,
        achievementId: a.id,
      },
    })
    // status: 0 表示未完成，1 表示已完成，2 表示已领取（根据你的实际定义调整）
    if (!userAch || userAch.status === 0) {
      unfinishedAchievement = a
      unfinishedUserAchievement = userAch
      break
    }
  }

  if (!unfinishedAchievement) {
    console.log(`User ${user.email} finished all achievements in ${type}(${subType})`)
    return
  }
  const newAchievementProgress = rank
  const nextAchievementProgress = Math.max(newAchievementProgress, unfinishedAchievement.target)
  const nextAchievementStatus = nextAchievementProgress <= unfinishedAchievement.target ? 1 : 0

  if (unfinishedUserAchievement) {
    console.log(`Achievement update for ${user.email} in ${type}(${subType}):`, {
      progress: nextAchievementProgress,
      status: nextAchievementStatus,
    })
    await tx.userAchievement.update({
      where: {
        id: unfinishedUserAchievement.id,
      },
      data: {
        progress: nextAchievementProgress,
        status: nextAchievementStatus,
        completedAt: nextAchievementStatus === 1 ? new Date() : null,
      },
    })
  } else {
    console.log(`Achievement create for ${user.email} in ${type}(${subType}):`, {
      progress: nextAchievementProgress,
      status: nextAchievementStatus,
    })
    await tx.userAchievement.create({
      data: {
        userId,
        achievementId: unfinishedAchievement.id,
        progress: nextAchievementProgress,
        status: nextAchievementStatus,
        completedAt: nextAchievementStatus === 1 ? new Date() : null,
      },
    })
  }
  if (newAchievementProgress <= unfinishedAchievement.target) {
    console.log('Continue to next achievement:', {
      rank: rank,
    })
    // 递归推进下一个阶梯成就，递归也要在事务内
    await handleAchievementDeckScoreRank(
      user,
      rank, // 传入当前的rank
      tx,
      recursiveProtection + 1,
    )
  }
}
