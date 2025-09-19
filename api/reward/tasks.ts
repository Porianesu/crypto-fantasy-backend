import { VercelRequest, VercelResponse } from '@vercel/node'
import { setCorsHeaders } from '../../utils/common'
import { verifyToken } from '../../utils/jwt'
import prisma from '../../prisma'
import { handleTwitterTask } from '../../utils/tasks/twitter'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  const user = await verifyToken(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  // 查询所有任务及用户状态
  if (req.method === 'GET') {
    try {
      const [tasks, userTasks] = await Promise.all([
        prisma.task.findMany({
          orderBy: [{ type: 'asc' }, { subType: 'asc' }, { target: 'asc' }],
        }),
        prisma.userTask.findMany({ where: { userId: user.id } }),
      ])
      // 合并成就和用户状态
      const result = tasks.map((task) => {
        const userTask = userTasks.find((ut) => ut.taskId === task.id)
        return {
          ...task,
          status: userTask?.status || 0, // 0未完成 1已完成 2已领取
          completedAt: userTask?.completedAt || null,
        }
      })
      return res.status(200).json({ tasks: result })
    } catch (e) {
      return res
        .status(500)
        .json({ error: e instanceof Error ? e.message : 'Internal Server Error' })
    }
  }

  // 领取任务奖励
  if (req.method === 'POST') {
    const { taskId } = req.body
    if (!taskId || typeof taskId !== 'number') {
      return res.status(400).json({ error: 'Invalid taskId' })
    }
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 查询用户任务
        const userTask = await tx.userTask.findFirst({
          where: { userId: user.id, taskId },
        })
        if (userTask?.status === 2) {
          throw new Error('Task reward already claimed')
        }
        // 查询任务奖励
        const task = await tx.task.findUnique({ where: { id: taskId } })
        if (!task) {
          throw new Error('Task not found')
        }
        // 判断任务是否已完成
        let taskResult = false
        switch (task.type) {
          case 'twitter':
            taskResult = await handleTwitterTask(tx, user, task)
            break
          default:
            break
        }
        if (!taskResult) {
          throw new Error("You didn't complete this task yet!")
        }
        // 发放奖励（这里只做简单的资源奖励，按实际业务调整）
        const updatedUser = await tx.user.update({
          where: { id: user.id },
          data: {
            solAmount: { increment: task.rewardSolAmount },
            faithAmount: { increment: task.rewardFaithAmount },
          },
        })
        const now = new Date()
        // 更新任务状态为已完成
        await tx.userTask.upsert({
          where: { id: userTask?.id },
          update: {
            status: 2,
            completedAt: now,
            claimedAt: now,
          },
          create: {
            userId: user.id,
            taskId: task.id,
            status: 2,
            completedAt: now,
            claimedAt: now,
          },
        })
        return {
          success: true,
          solAmount: updatedUser.solAmount,
          faithAmount: updatedUser.faithAmount,
        }
      })
      return res.status(200).json(result)
    } catch (e) {
      return res
        .status(500)
        .json({ error: e instanceof Error ? e.message : 'Internal Server Error' })
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' })
}
