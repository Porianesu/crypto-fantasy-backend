import { Item, Prisma, User } from '@prisma/client'

const handleAddMeltCurrent = async (tx: Prisma.TransactionClient, user: User, quantity: number) => {
  return tx.user.update({
    where: { id: user.id },
    data: { meltCurrent: { increment: quantity } },
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
    default:
      break
  }
}
