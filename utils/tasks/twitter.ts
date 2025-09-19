import { Prisma, Task, User } from '@prisma/client'

export const handleTwitterTask = async (tx: Prisma.TransactionClient, user: User, task: Task) => {
  if (!task || task.type !== 'twitter' || !task.subType || !user || !tx) {
    return false
  }
  const userTwitterAccount = await tx.twitterAccount.findUnique({ where: { userId: user.id } })
  if (task.subType === 'bind') {
    return !!userTwitterAccount?.twitterUserId
  } else {
    if (!userTwitterAccount?.twitterUserId) return false
    switch (task.subType) {
      case 'follow':
        return true
      default:
        return false
    }
  }
}
