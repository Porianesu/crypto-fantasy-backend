import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 生成10位随机兑换码
  function generateRandomCode(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  // 手动配置兑换码参数
  const code = generateRandomCode(10) // 生成10位随机兑换码
  const solAmount = 1 // 兑换的 sol 数量
  const faithAmount = 50 // 兑换的 faith 数量
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
