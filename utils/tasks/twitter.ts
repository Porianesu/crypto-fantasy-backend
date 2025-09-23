import axios from 'axios'
import { Prisma, Task, User } from '@prisma/client'
import { getOAuth } from '../x-oauth'

// 修正正则
const TWEET_URL_REGEX = /https:\/\/x\.com\/[A-Za-z0-9_]+\/status\/(\d+)/

interface ITwitterUserResponse {
  id: string
  name: string
  username: string
}

interface ITwitterCommonResponse<T> {
  meta: {
    result_count: number
    next_token?: string
    previous_token?: string
  }
  errors?: Array<{
    title: string
    type: string
    detail?: string
    status?: number
  }>
  includes?: any
  data?: T
}

const commonTwitterApiResponseErrorHandler = (e: unknown, url: string) => {
  if (axios.isAxiosError(e) && e.response) {
    const status = e.response.status
    if (status === 429) {
      const resetTimeStamp = e.response.headers['x-rate-limit-reset']
      if (resetTimeStamp) {
        const resetMs = Number(resetTimeStamp) * 1000
        const now = Date.now()
        const waitSec = Math.max(0, Math.floor((resetMs - now) / 1000))
        console.warn(
          `Rate limit exceeded for ${url}. Retry after ${waitSec}s at ${new Date(resetMs).toLocaleString()}`,
        )
      } else {
        console.warn(`Rate limit exceeded for ${url}, but no reset time found.`)
      }
    }
  } else {
    console.log(`查询${url},报错:`, e)
  }
}

const handleTwitterRetweetTask = async (
  userTwitterAccount: { twitterUserId: string; oauthToken: string; oauthTokenSecret: string },
  task: Task,
) => {
  if (!userTwitterAccount?.twitterUserId || !task.target) return false
  // 1. 提取 tweetId
  const match = task.target.match(TWEET_URL_REGEX)
  if (!match) return false
  const tweetId = match[1]
  // 2. 查询该推文的 retweeted_by
  const oauth = getOAuth()
  const url = `https://api.twitter.com/2/tweets/${tweetId}/retweeted_by`
  try {
    const request_data = {
      url,
      method: 'GET',
    }
    const headers = oauth.toHeader(
      oauth.authorize(request_data, {
        key: userTwitterAccount.oauthToken,
        secret: userTwitterAccount.oauthTokenSecret,
      }),
    ) as unknown as Record<string, string>
    const response = await axios.get<ITwitterCommonResponse<Array<ITwitterUserResponse>>>(url, {
      headers,
    })
    console.log(`查询${url},得到retweeted_by列表:`, response.data)
    if (Array.isArray(response?.data?.data) && response.data.data.length) {
      // 判断当前用户是否在 retweeted_by 列表中
      return response.data.data.some((u) => u.id === userTwitterAccount.twitterUserId)
    } else {
      return false
    }
  } catch (e) {
    commonTwitterApiResponseErrorHandler(e, url)
    return false
  }
}

const handleTwitterLikeTask = async (
  userTwitterAccount: { twitterUserId: string; oauthToken: string; oauthTokenSecret: string },
  task: Task,
) => {
  if (!userTwitterAccount?.twitterUserId || !task.target) return false
  // 1. 提取 tweetId
  const match = task.target.match(TWEET_URL_REGEX)
  if (!match) return false
  const tweetId = match[1]
  // 2. 查询该推文的 liking_users
  const oauth = getOAuth()
  const url = `https://api.twitter.com/2/tweets/${tweetId}/liking_users`
  try {
    const request_data = {
      url,
      method: 'GET',
    }
    const headers = oauth.toHeader(
      oauth.authorize(request_data, {
        key: userTwitterAccount.oauthToken,
        secret: userTwitterAccount.oauthTokenSecret,
      }),
    ) as unknown as Record<string, string>
    const response = await axios.get<ITwitterCommonResponse<Array<ITwitterUserResponse>>>(url, {
      headers,
    })
    console.log(`查询${url},得到liking_users列表:`, response.data)
    if (Array.isArray(response?.data?.data) && response.data.data.length) {
      // 判断当前用户是否在 liking_users 列表中
      return response.data.data.some((u) => u.id === userTwitterAccount.twitterUserId)
    } else {
      return false
    }
  } catch (e) {
    commonTwitterApiResponseErrorHandler(e, url)
    return false
  }
}

export const handleTwitterTask = async (tx: Prisma.TransactionClient, user: User, task: Task) => {
  if (!task || task.type !== 'twitter' || !task.subType || !user || !tx) {
    return false
  }
  const userTwitterAccount = await tx.twitterAccount.findUnique({ where: { userId: user.id } })
  if (task.subType === 'bind') {
    return !!userTwitterAccount?.twitterUserId
  } else {
    if (!userTwitterAccount?.twitterUserId) return false
    switch (task.subType) {
      case 'follow':
        return true
      case 'retweet':
        return await handleTwitterRetweetTask(userTwitterAccount, task)
      case 'like':
        return await handleTwitterLikeTask(userTwitterAccount, task)
      default:
        return false
    }
  }
}
