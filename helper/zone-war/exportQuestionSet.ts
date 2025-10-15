import fs from 'fs'
import path from 'path'
import prisma from '../../prisma'

async function exportQuestionSetToJson(questionSetId: number) {
  const questionSet = await prisma.questionSet.findUnique({
    where: { id: questionSetId },
    include: {
      questions: {
        include: {
          options: true,
        },
      },
    },
  })

  if (!questionSet) {
    console.error('QuestionSet not found')
    return
  }

  // 格式化数据
  const data = {
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
  }

  const jsonPath = path.resolve(__dirname, `questionSet_${questionSetId}.json`)
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`QuestionSet exported to ${jsonPath}`)
}

// 例如 node exportQuestionSet.js 1
const id = Number(process.argv[2])
if (!id) {
  console.error('请传入要导出的QuestionSet id')
  process.exit(1)
}

exportQuestionSetToJson(id)
  .catch(console.error)
  .finally(() => prisma.$disconnect())
