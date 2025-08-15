import { Achievement, Card, PrismaClient, User, UserAchievement } from '@prisma/client'
import { CARD_RARITY } from './config'

const prisma = new PrismaClient()

async function handleAchievementCardsCollectWithSubtype(
  user: User,
  subType: 'amount' | 'normal' | 'rare' | 'epic' | 'legendary' = 'amount',
  amount: number,
) {
  if (!user || amount < 0) return
  const userId = user.id
  await prisma.$transaction(async (tx) => {
    const allAchievements = await tx.achievement.findMany({
      where: {
        type: 'card_collect',
        subType: subType,
      },
    })

    if (allAchievements.length === 0) {
      console.error('Achievement not found for card collect:', subType)
      return
    }

    // 找到未完成且target最小的成就
    let unfinishedAchievement: Achievement | undefined = undefined
    let unfinishedUserAchievement: UserAchievement | null = null
    for (const a of allAchievements.sort((a, b) => a.target - b.target)) {
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
      console.log(`User ${user.email} finished all achievements in this type ${subType}`)
      return
    }
    const newAchievementProgress = amount + (unfinishedUserAchievement?.progress || 0)
    const nextAchievementProgress = Math.min(newAchievementProgress, unfinishedAchievement.target)
    const nextAchievementStatus = nextAchievementProgress === unfinishedAchievement.target ? 1 : 0

    if (unfinishedUserAchievement) {
      await tx.userAchievement.update({
        where: {
          id: unfinishedUserAchievement.id,
        },
        data: {
          progress: nextAchievementProgress,
          status: nextAchievementStatus,
        },
      })
    } else {
      await tx.userAchievement.create({
        data: {
          userId,
          achievementId: unfinishedAchievement.id,
          progress: nextAchievementProgress,
          status: nextAchievementStatus,
        },
      })
    }
    if (newAchievementProgress > unfinishedAchievement.target) {
      console.log('超出了成就目标进度需要继续迭代')
      // 递归推进下一个阶梯成就，递归也要在事务内
      await handleAchievementCardsCollectWithSubtype(
        user,
        subType,
        newAchievementProgress - unfinishedAchievement.target,
      )
    }

    console.log('Achievement awarded:', unfinishedAchievement.description)
  })
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
