import { VercelRequest, VercelResponse } from '@vercel/node'
import { setCorsHeaders } from '../../utils/common'
import { verifyToken } from '../../utils/jwt'
import prisma from '../../prisma'

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
}
