import { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyToken } from '../utils/jwt'
import prisma from '../prisma'
import { setCorsHeaders } from '../utils/common'

// API: /api/card-generate
// GET  - 获取当前用户的生成图片（分页）
// POST - 存储一张用户生成的图片（接受 base64 字符串）

const OpenRouterKey = process.env.OPENROUTER_KEY
if (!OpenRouterKey) throw new Error('OPENROUTER_KEY not set')

async function generateImage(prompt: string) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OpenRouterKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-pro-image-preview',
      stream: false,
      messages: [
        {
          role: 'system',
          content:
            'You are Nano Banana Pro (Gemini 3 Pro Image Preview), a large language model from google.\\n\\nFormatting Rules:\\n- Use Markdown for lists, tables, and styling.\\n- Use ```code fences``` for all code blocks.\\n- Format file names, paths, and function names with `inline code` backticks.\\n- **For all mathematical expressions, you must use dollar-sign delimiters. Use $...$ for inline math and $$...$$ for block math. Do not use (...) or [...] delimiters.**\\n- For responses with many sections where some are more important than others, use collapsible sections (HTML details/summary tags) to highlight key information while allowing users to expand less critical details.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  })
  const data = await res.json()
  if (!data?.choices?.[0]?.message?.images?.[0]?.image_url?.url) {
    throw new Error('Failed to generate image')
  }
  return data.choices[0].message.images[0].image_url.url
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, 'GET, POST, OPTIONS')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  // 鉴权
  const user = await verifyToken(req)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method === 'POST') {
    // 存储用户生成的图片
    // body: { cardName: string, cardType: string, cardEffect: string, cardDescription?: string, artStyle?: string }
    const { cardName, cardType, cardEffect, cardDescription, artStyle } = req.body || {}
    if (!cardName || typeof cardName !== 'string') {
      return res.status(400).json({ error: 'cardName is required and must be a string' })
    }
    if (!cardType || typeof cardType !== 'string') {
      return res.status(400).json({ error: 'cardType is required and must be a string' })
    }
    if (!cardEffect || typeof cardEffect !== 'string') {
      return res.status(400).json({ error: 'cardEffect is required and must be a string' })
    }

    // 构造供 Nano Banana 使用的中文提示词（prompt）
    // 目标：用简洁明确的中文描述卡牌的名称、类型、效果、描述与画风，强调主体、色调与风格，便于生成高质量图片。
    const promptParts: string[] = []
    promptParts.push(`卡牌名称：${cardName}`)
    promptParts.push(`卡牌类型：${cardType}`)
    promptParts.push(`卡牌效果：${cardEffect}`)
    if (cardDescription) promptParts.push(`卡牌描述：${cardDescription || '自行发挥'}`)
    if (artStyle) promptParts.push(`画风：${artStyle}`)
    const prompt = promptParts.join('\n')
    console.log('Generated prompt:', prompt)

    // 调用生成接口
    let imageUrl: unknown
    try {
      imageUrl = await generateImage(prompt)
    } catch (e) {
      return res.status(502).json({
        error: 'Image generation failed',
        details: e instanceof Error ? e.message : String(e),
      })
    }

    // 将 imageUrl 转成二进制 Buffer（支持 data:URL 或远程链接）
    let buffer: Buffer
    try {
      if (typeof imageUrl !== 'string') {
        throw new Error('Invalid image URL from generator')
      }
      if (imageUrl.startsWith('data:')) {
        const cleaned = imageUrl.replace(/^data:\w+\/[a-zA-Z+.-]+;base64,/, '')
        buffer = Buffer.from(cleaned, 'base64')
      } else {
        const resp = await fetch(imageUrl)
        if (!resp.ok) throw new Error(`Failed to fetch generated image: ${resp.status}`)
        const ab = await resp.arrayBuffer()
        buffer = Buffer.from(ab)
      }
    } catch (e) {
      return res.status(502).json({
        error: 'Failed to retrieve generated image',
        details: e instanceof Error ? e.message : String(e),
      })
    }

    try {
      const created = await prisma.userGeneratedImage.create({
        data: {
          userId: user.id,
          imageBytes: buffer,
          cardName,
          cardType: cardType,
          cardEffect,
          cardDescription: cardDescription ?? null,
          artStyle: artStyle ?? null,
        },
      })

      const { imageBytes, ...meta } = created as any
      return res.status(201).json({ success: true, image: meta })
    } catch (e) {
      return res.status(500).json({
        error: e instanceof Error ? e.message : 'Internal Server Error',
      })
    }
  }

  if (req.method === 'GET') {
    // 分页查询当前用户生成的图片
    // Query params: page (1-based), limit, includeBytes (true/false)
    const page = Number(req.query.page ?? 1) || 1
    const limit = Math.min(Math.max(Number(req.query.limit ?? 10) || 10, 1), 100)
    const includeBytes = String(req.query.includeBytes ?? 'false') === 'true'

    const skip = (page - 1) * limit

    try {
      const [total, rows] = await Promise.all([
        prisma.userGeneratedImage.count({ where: { userId: user.id } }),
        prisma.userGeneratedImage.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
      ])

      const images = rows.map((r) => {
        const base = {
          id: r.id,
          cardName: r.cardName,
          cardType: r.cardType,
          cardEffect: r.cardEffect,
          cardDescription: r.cardDescription,
          artStyle: r.artStyle,
          createdAt: r.createdAt,
        }
        if (includeBytes && r.imageBytes) {
          // prisma returns Buffer/Uint8Array for Bytes, normalize to Buffer
          const buf = Buffer.isBuffer(r.imageBytes)
            ? r.imageBytes
            : Buffer.from(r.imageBytes as any)
          return { ...base, imageBase64: buf.toString('base64') }
        }
        return base
      })

      return res.status(200).json({ images, total, page, limit })
    } catch (e) {
      return res
        .status(500)
        .json({ error: e instanceof Error ? e.message : 'Internal Server Error' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
