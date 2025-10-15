import fs from 'fs'
import path from 'path'
import prisma from '../../prisma'

async function exportSkillsToJson() {
  const skillsFromDb = await prisma.skill.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      baseRace: {
        select: { name: true },
      },
    },
  })

  const jsonPath = path.resolve(__dirname, 'skills.json')

  const data = skillsFromDb
    .sort((a, b) => a.id - b.id)
    .map((skill) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      baseRace: skill.baseRace.name,
      createdAt: skill.createdAt,
    }))

  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf-8')
  console.log('Skills exported to skills.json')
}

exportSkillsToJson()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
