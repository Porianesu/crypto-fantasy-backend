import { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyToken } from '../utils/jwt'
import prisma from '../prisma'
import { setCorsHeaders } from '../utils/common'

// API: /api/card-generate
// GET  - 获取当前用户的生成图片（分页或单图查询）
// POST - 通过 AI 生成或基于上传图片修改图片（接受 prompt，支持可选 image）

const OpenRouterKey = process.env.OPENROUTER_KEY
if (!OpenRouterKey) throw new Error('OPENROUTER_KEY not set')

async function generateImage(prompt: string, referenceImage?: Array<string>) {
  const userContent: Array<{
    type: string
    text?: string
    image_url?: {
      url: string
    }
  }> = [{ type: 'text', text: prompt }]
  if (referenceImage?.length) {
    referenceImage.forEach((image) => {
      userContent.push({
        image_url: {
          url: image,
        },
        type: 'image_url',
      })
    })
  }

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
        { role: 'user', content: userContent },
      ],
    }),
  })

  // 打印网络层信息（不包含敏感 header）
  console.log('fetch status:', res.status, res.statusText)
  // headers is a Headers object; convert to plain object for logging
  try {
    console.log('fetch headers:', Object.fromEntries(res.headers))
  } catch (e) {
    // Object.fromEntries on Headers may throw in some envs; fallback to simple log
    console.log('fetch headers: (unable to convert)')
  }

  const data = await res.json()

  // 打印解析后的响应体（调试用）
  console.log('response data:', data?.choices?.[0]?.message)

  // 如果请求失败，可同时查看状态和返回体
  if (!res.ok) {
    console.error('Image generation failed:', res.status)
    console.error('response body:', data)
  }
  let resultUrl: string | undefined
  if (data?.choices?.[0]?.message?.content) {
    const content = String(data.choices[0].message.content).trim()
    if (content.startsWith('data:image/')) {
      console.log('图片在content里')
      resultUrl = content
    }
  }
  if (data?.choices?.[0]?.message?.images?.[0]?.image_url?.url) {
    console.log('图片在images里')
    resultUrl = data.choices[0].message.images[0].image_url.url
  }
  if (!resultUrl) {
    throw new Error('Failed to generate image')
  }
  return resultUrl
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
    // 新的 POST 接口：只需要一个必填字段 prompt，支持可选 images（数组，元素可为 data:URL 或公网 URL）
    // body: { prompt: string, images?: string[] | string }
    const { prompt, images } = req.body || {}
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'prompt is required and must be a string' })
    }

    // Normalize images to string[] if provided. Accept a single string or an array of strings.
    let imagesArray: string[] | undefined
    if (images !== undefined) {
      if (typeof images === 'string') {
        imagesArray = [images]
      } else if (Array.isArray(images) && images.every((i) => typeof i === 'string')) {
        imagesArray = images
      } else {
        return res.status(400).json({ error: 'images must be a string or an array of strings' })
      }
      // optional: limit number of reference images to avoid huge payloads
      if (imagesArray.length > 5)
        return res.status(400).json({ error: 'max 5 reference images allowed' })
    }

    // 调用生成接口（将 reference images 传给模型，让模型在生成时参考或修改）
    let imageUrl: unknown
    try {
      imageUrl = await generateImage(prompt, imagesArray)
      console.log('generated imageUrl:', imageUrl)
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
      // 现有的 userGeneratedImage model 需要某些字段（以前有 cardName/cardType/cardEffect），
      // 现在 schema 已改为只保留 prompt 字段，我们将 prompt 保存到对应字段。
      const created = await prisma.userGeneratedImage.create({
        data: {
          userId: user.id,
          imageBytes: buffer,
        },
      })

      const { imageBytes, ...meta } = created
      return res.status(201).json({ success: true, image: { ...meta, url: imageUrl } })
    } catch (e) {
      return res.status(500).json({
        error: e instanceof Error ? e.message : 'Internal Server Error',
      })
    }
  }

  if (req.method === 'GET') {
    // 支持两种查询：
    // - 单图查询：?id=... (只返回当前用户且与 id 对应的那一张)
    // - 分页查询：?page=&limit=&includeBytes=
    const rawId = req.query.id ? String(req.query.id) : null
    const idParam = rawId ? Number(rawId) : null
    if (rawId && (typeof idParam !== 'number' || Number.isNaN(idParam))) {
      return res.status(400).json({ error: 'id must be a valid number' })
    }

    const page = Number(req.query.page ?? 1) || 1
    const limit = Math.min(Math.max(Number(req.query.limit ?? 10) || 10, 1), 100)
    const includeBytes = String(req.query.includeBytes ?? 'false') === 'true'

    const skip = (page - 1) * limit

    try {
      if (idParam !== null) {
        // 单图请求：确保图片属于当前用户
        const image = await prisma.userGeneratedImage.findFirst({
          where: { id: idParam, userId: user.id },
          select: {
            id: true,
            userId: true,
            createdAt: true,
            imageBytes: includeBytes,
          },
        })
        if (!image) return res.status(404).json({ error: 'Image not found' })
        return res.status(200).json({ image })
      }

      const [total, images] = await Promise.all([
        prisma.userGeneratedImage.count({ where: { userId: user.id } }),
        prisma.userGeneratedImage.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            userId: true,
            createdAt: true,
            imageBytes: includeBytes,
          },
        }),
      ])

      return res.status(200).json({ images, total, page, limit })
    } catch (e) {
      return res
        .status(500)
        .json({ error: e instanceof Error ? e.message : 'Internal Server Error' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
