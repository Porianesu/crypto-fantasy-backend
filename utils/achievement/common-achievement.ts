import { Achievement, Prisma, User, UserAchievement } from '@prisma/client'
import prisma from '../../prisma'

const findUnfinishedAchievementAndUserAchievement = async (
  allAchievements: Array<Achievement>,
  tx: Prisma.TransactionClient,
  userId: User['id'],
  type: 'desc' | 'asc' = 'asc',
) => {
  // 找到未完成且target最小的成就
  let unfinishedAchievement: Achievement | undefined = undefined
  let unfinishedUserAchievement: UserAchievement | null = null
  for (const a of allAchievements.sort((a, b) => {
    return type === 'asc' ? a.target - b.target : b.target - a.target
  })) {
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
  return {
    unfinishedAchievement,
    unfinishedUserAchievement,
  }
}

const calculateAchievementData = (
  amount: number,
  unfinishedUserAchievement: UserAchievement,
  unfinishedAchievement: Achievement,
  subType: string,
) => {
  let newAchievementProgress
  let nextAchievementProgress
  let nextAchievementStatus

  switch (subType) {
    case 'rank_desc':
      newAchievementProgress = amount
      nextAchievementProgress = Math.max(newAchievementProgress, unfinishedAchievement.target)
      nextAchievementStatus = nextAchievementProgress <= unfinishedAchievement.target ? 1 : 0
      break
    case 'rank_asc':
      newAchievementProgress = amount
      nextAchievementProgress = Math.min(newAchievementProgress, unfinishedAchievement.target)
      nextAchievementStatus = nextAchievementProgress >= unfinishedAchievement.target ? 1 : 0
      break
    case 'amount':
    default:
      newAchievementProgress = amount + (unfinishedUserAchievement?.progress || 0)
      nextAchievementProgress = Math.min(newAchievementProgress, unfinishedAchievement.target)
      nextAchievementStatus = nextAchievementProgress === unfinishedAchievement.target ? 1 : 0
  }
  return {
    newAchievementProgress,
    nextAchievementProgress,
    nextAchievementStatus,
  }
}

const calculateShouldContinueToNextAchievementAndAmount = (
  newAchievementProgress: number,
  unfinishedAchievement: Achievement,
  subType: Achievement['subType'],
) => {
  let shouldContinue
  let nextAchievementAmount
  switch (subType) {
    case 'rank_desc':
      shouldContinue = newAchievementProgress < unfinishedAchievement.target
      nextAchievementAmount = newAchievementProgress
      break
    case 'rank_asc':
      shouldContinue = newAchievementProgress > unfinishedAchievement.target
      nextAchievementAmount = newAchievementProgress
      break
    case 'amount':
    default:
      shouldContinue = newAchievementProgress > unfinishedAchievement.target
      nextAchievementAmount = newAchievementProgress - unfinishedAchievement.target
  }
  return {
    shouldContinue,
    nextAchievementAmount,
  }
}

const handleCountTypeAchievementLogic = async (
  tx: Prisma.TransactionClient,
  user: User,
  amount: number,
  type: string,
  subType = 'amount',
  recursiveProtection = 0,
) => {
  if (!user || amount <= 0 || !type) return
  const userId = user.id
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
    console.error('Max recursion depth reached in handleCountTypeAchievementLogic')
    return
  }

  const { unfinishedAchievement, unfinishedUserAchievement } =
    await findUnfinishedAchievementAndUserAchievement(
      allAchievements,
      tx,
      userId,
      subType === 'rank_desc' ? 'desc' : 'asc',
    )

  if (!unfinishedAchievement) {
    console.log(`User ${user.id} finished all achievements in ${type}(${subType})`)
    return
  }
  const { newAchievementProgress, nextAchievementProgress, nextAchievementStatus } =
    calculateAchievementData(amount, unfinishedUserAchievement!, unfinishedAchievement, subType)

  if (unfinishedUserAchievement) {
    console.log(`Achievement update for ${user.id} in ${type}(${subType}):`, {
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
    console.log(`Achievement create for ${user.id} in ${type}(${subType}):`, {
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
  const { shouldContinue, nextAchievementAmount } =
    calculateShouldContinueToNextAchievementAndAmount(
      newAchievementProgress,
      unfinishedAchievement,
      subType,
    )
  if (shouldContinue) {
    console.log('Continue to next achievement:', {
      nextAchievementAmount,
    })
    // 递归推进下一个阶梯成就，递归也要在事务内
    await handleCountTypeAchievementLogic(
      tx,
      user,
      nextAchievementAmount,
      type,
      subType,
      recursiveProtection + 1,
    )
  }
}
export const handleCountTypeAchievement = async (
  params: {
    user: User
    amount: number
    type: string
    subType: string
  },
  tx?: Prisma.TransactionClient,
) => {
  if (tx) {
    await handleCountTypeAchievementLogic(
      tx,
      params.user,
      params.amount,
      params.type,
      params.subType,
    )
  } else {
    await prisma.$transaction(async (tx) => {
      await handleCountTypeAchievementLogic(
        tx,
        params.user,
        params.amount,
        params.type,
        params.subType,
      )
    })
  }
}
