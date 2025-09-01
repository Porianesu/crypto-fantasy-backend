import { Prisma, User } from '@prisma/client'
import { ReferralReward } from './config'

export const createInvitationWithCode = async (
  tx: Prisma.TransactionClient,
  user: User,
  inviteCode: any,
) => {
  if (!inviteCode || typeof inviteCode !== 'string') {
    throw new Error('Invalid inviteCode')
  }
  if (user.inviteCode === inviteCode) {
    throw new Error('You cannot invite yourself')
  }
  // 检查是否已被邀请
  const alreadyBound = await tx.invitation.findUnique({ where: { inviteeUserId: user.id } })
  if (alreadyBound) {
    throw new Error('You have already been invited')
  }
  // 检查邀请人是否存在
  const inviter = await tx.user.findUnique({ where: { inviteCode } })
  if (!inviter) {
    throw new Error('Inviter not found')
  }
  if (inviter.id === user.id) {
    throw new Error('You cannot invite yourself')
  }
  // 创建邀请关系
  await tx.invitation.create({
    data: {
      inviteeUserId: user.id,
      inviterUserId: inviter.id,
    },
  })

  //发放奖励
  await tx.user.update({
    where: { id: user.id },
    data: {
      faithAmount: {
        increment: ReferralReward.invitee.faithAmount,
      },
      solAmount: {
        increment: ReferralReward.invitee.solAmount,
      },
    },
  })
  return {
    success: true,
    rewardFaithAmount: ReferralReward.invitee.faithAmount,
    rewardSolAmount: ReferralReward.invitee.solAmount,
  }
}
