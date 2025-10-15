import { VercelRequest, VercelResponse } from '@vercel/node'
import { setCorsHeaders } from '../../utils/common'
import prisma from '../../prisma'

interface ReceivedData {
  content: Array<{
    type: string
    keywords: Array<string>
    question: string
    options: Array<{
      label: string
      answer: string
      elements: Array<string>
    }>
  }>
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, 'POST, OPTIONS, GET')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }
  try {
    if (req.method === 'GET') {
      // 随机返回一套题集
      const allIds = await prisma.questionSet.findMany({ select: { id: true } })
      if (!allIds.length) {
        return res.status(404).json({ error: '没有可用的题集' })
      }
      const { questionSetId } = req.query
      let queryQuestionSetId
      if (questionSetId && typeof questionSetId === 'string') {
        queryQuestionSetId = Number(questionSetId)
      } else {
        const randomIndex = Math.floor(Math.random() * allIds.length)
        queryQuestionSetId = allIds[randomIndex].id
      }
      // 查询指定 questionSetId
      const questionSet = await prisma.questionSet.findUnique({
        where: { id: queryQuestionSetId },
        include: {
          questions: {
            include: { options: true },
          },
        },
      })
      if (!questionSet) {
        return res.status(404).json({ error: '未找到指定的题集' })
      }
      // 格式化数据
      return res.status(200).json({
        questionSet: {
          id: questionSet.id,
          name: questionSet.name,
          createdAt: questionSet.createdAt,
          questions: questionSet.questions
            .sort((a, b) => a.id - b.id)
            .map((q) => ({
              id: q.id,
              type: q.type,
              keywords: q.keywords,
              question: q.question,
              options: q.options
                .sort((a, b) => a.id - b.id)
                .map((opt) => ({
                  id: opt.id,
                  label: opt.label,
                  answer: opt.answer,
                  elements: opt.elements,
                })),
            })),
        },
      })
    }

    if (req.method === 'POST') {
      if (!req.body) {
        return res.status(400).json({ error: 'Missing request body' })
      }
      const requestBody = req.body as ReceivedData
      console.log('Received request body:', requestBody)
      const { content } = requestBody
      console.log('Received content:', content)
      if (!content) {
        return res.status(400).json({ error: 'Invalid content parameter' })
      }
      if (Array.isArray(content)) {
        // 先过滤出有效题目
        const validQuestions = content.filter(
          (item) =>
            item.type &&
            item.keywords &&
            item.question &&
            item.options &&
            Array.isArray(item.options),
        )
        if (validQuestions.length !== 10) {
          return res.status(400).json({ error: '有效题目数必须为10' })
        }
        // 查询当前有多少个QuestionSet
        const setCount = await prisma.questionSet.count()
        // 嵌套写入：创建新的QuestionSet并一次性创建所有题目和选项
        const newSet = await prisma.questionSet.create({
          data: {
            name: `Zone War Question Set ${setCount + 1}`,
            questions: {
              create: validQuestions.map((item) => ({
                type: item.type,
                keywords: item.keywords,
                question: item.question,
                options: {
                  create: item.options.map((opt) => ({
                    label: opt.label,
                    answer: opt.answer,
                    elements: opt.elements,
                  })),
                },
              })),
            },
          },
          include: {
            questions: {
              include: { options: true },
            },
          },
        })
        const createdCount = newSet.questions.length
        return res.status(200).json({
          success: true,
          message: `Received ${content.length} questions, 校验并写入成功`,
          created: createdCount,
          questionSet: newSet,
        })
      }
      console.log('content prototype:', Object.prototype.toString.call(content))
    }
  } catch (e) {
    return res.status(500).end({ error: 'Internal Server Error', details: e })
  }
  return res.status(405).json({ error: 'Method not allowed' })
}
