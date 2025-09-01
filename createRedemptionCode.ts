import { PrismaClient } from '@prisma/client'
import { generateRandomString } from './utils/common'

const prisma = new PrismaClient()

async function main() {
  // 手动配置兑换码参数
  const code = generateRandomString(10) // 生成10位随机兑换码
  const solAmount = 10 // 兑换的 sol 数量
  const faithAmount = 2000 // 兑换的 faith 数量
  const maxUses = 2 // 最大可兑换次数
  const expiredAt = new Date('2025-12-31T23:59:59Z') // 过期时间

  const redemptionCode = await prisma.redemptionCode.create({
    data: {
      code,
      solAmount,
      faithAmount,
      maxUses,
      expiredAt,
    },
  })

  console.log('兑换码已创建:', redemptionCode)
}

main()
  .catch((e) => {
    console.error(e)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
