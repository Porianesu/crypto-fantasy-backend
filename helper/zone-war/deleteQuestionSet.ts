import readline from 'readline'
import prisma from '../../prisma'

function askConfirm(prompt: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close()
      const normalized = (answer || '').trim().toLowerCase()
      resolve(normalized === 'y' || normalized === 'yes')
    })
  })
}

async function main() {
  const idArg = process.argv[2]
  if (!idArg) {
    console.error('Usage: ts-node scripts/deleteQuestionSet.ts <questionSetId>')
    process.exit(1)
  }

  const questionSetId = Number(idArg)
  if (Number.isNaN(questionSetId) || !Number.isInteger(questionSetId) || questionSetId <= 0) {
    console.error('questionSetId must be a positive integer')
    process.exit(1)
  }

  try {
    const existing = await prisma.questionSet.findUnique({
      where: { id: questionSetId },
      include: {
        questions: {
          include: {
            options: true,
          },
        },
      },
    })

    if (!existing) {
      console.log(`QuestionSet with id=${questionSetId} not found.`)
      process.exit(0)
    }

    const questionCount = existing.questions.length
    const optionCount = existing.questions.reduce((acc, q) => acc + (q.options?.length || 0), 0)

    console.log(`Found QuestionSet id=${questionSetId}, name="${existing.name}"`)
    console.log(` - Questions: ${questionCount}`)
    console.log(` - Options: ${optionCount}`)

    const ok = await askConfirm(
      'Are you sure you want to permanently delete this QuestionSet and its child records? (y/N): ',
    )
    if (!ok) {
      console.log('Aborted by user.')
      process.exit(0)
    }

    const questionIds = existing.questions.map((q) => q.id)

    // Build transaction: delete options -> delete questions -> delete questionSet
    const results = await prisma.$transaction(async (tx) => {
      let deletedOptions: { count: number } | null = null
      if (questionIds.length > 0) {
        deletedOptions = await tx.option.deleteMany({ where: { questionId: { in: questionIds } } })
      }

      const deletedQuestions = await tx.question.deleteMany({
        where: { questionSetId: questionSetId },
      })

      const deletedSet = await tx.questionSet.delete({ where: { id: questionSetId } })

      return {
        deletedOptionsCount: deletedOptions ? deletedOptions.count : 0,
        deletedQuestionsCount: deletedQuestions.count,
        deletedSetId: deletedSet.id,
      }
    })

    console.log('Delete result:')
    console.log(` - Options deleted: ${results.deletedOptionsCount}`)
    console.log(` - Questions deleted: ${results.deletedQuestionsCount}`)
    console.log(` - QuestionSet deleted id: ${results.deletedSetId}`)
  } catch (err) {
    console.error('Error while deleting QuestionSet:', err)
    process.exitCode = 2
  } finally {
    await prisma.$disconnect()
  }
}

main()
