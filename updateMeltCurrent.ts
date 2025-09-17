import prisma from './prisma'

async function updateMeltCurrent() {
  // 只更新 meltCurrent < meltMax 的用户
  await prisma.user.updateMany({
    where: {
      meltCurrent: { lt: prisma.user.fields.meltMax },
    },
    data: {
      meltCurrent: {
        increment: 1,
      },
    },
  })
  await prisma.$disconnect()
}

updateMeltCurrent()
  .then(() => {
    console.log('MeltCurrent updated for all users.')
  })
  .catch((err) => {
    console.error('Error updating MeltCurrent:', err)
    process.exit(1)
  })
