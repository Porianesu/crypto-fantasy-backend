import axios from 'axios'
import { Prisma, Task, User } from '@prisma/client'
import { getOAuth } from '../x-oauth'

// 修正正则
const TWEET_URL_REGEX = /https:\/\/x\.com\/[A-Za-z0-9_]+\/status\/(\d+)/

export interface IHandleTwitterTaskResult {
  result: boolean
  error?: unknown
}

interface ITwitterTweetResponse {
  id: string
  text: string
  referenced_tweets?: Array<{
    id: string
    type: 'retweeted' | 'quoted' | 'replied_to '
  }>
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

const handleTwitterReplyTask = async (
  userTwitterAccount: { twitterUserId: string; oauthToken: string; oauthTokenSecret: string },
  task: Task,
): Promise<IHandleTwitterTaskResult> => {
  if (!userTwitterAccount?.twitterUserId || !task.target) return { result: false }
  const match = task.target.match(TWEET_URL_REGEX)
  if (!match) return { result: false }
  const tweetId = match[1]
  const oauth = getOAuth()
  const url = `https://api.x.com/2/users/${userTwitterAccount.twitterUserId}/tweets`
  try {
    const request_data = { url, method: 'GET' }
    const headers = oauth.toHeader(
      oauth.authorize(request_data, {
        key: userTwitterAccount.oauthToken,
        secret: userTwitterAccount.oauthTokenSecret,
      }),
    ) as unknown as Record<string, string>
    const response = await axios.get<ITwitterCommonResponse<Array<ITwitterTweetResponse>>>(url, {
      headers,
      params: {
        'tweet.fields': 'referenced_tweets',
      },
    })
    console.log(`查询${url},得到tweets列表:`, response.data)
    if (Array.isArray(response?.data?.data) && response.data.data.length) {
      return {
        result: response.data.data.some((tweet) =>
          tweet.referenced_tweets?.some(
            (ref: any) => ref.type === 'replied_to' && ref.id === tweetId,
          ),
        ),
      }
    }
    return { result: false }
  } catch (e) {
    commonTwitterApiResponseErrorHandler(e, url)
    return { result: false, error: e }
  }
}

const handleTwitterRetweetTask = async (
  userTwitterAccount: { twitterUserId: string; oauthToken: string; oauthTokenSecret: string },
  task: Task,
): Promise<IHandleTwitterTaskResult> => {
  if (!userTwitterAccount?.twitterUserId || !task.target) return { result: false }
  // 1. 提取 tweetId
  const match = task.target.match(TWEET_URL_REGEX)
  if (!match) return { result: false }
  const tweetId = match[1]
  // 2. 查询用户的 tweets
  const oauth = getOAuth()
  const url = `https://api.x.com/2/users/${userTwitterAccount.twitterUserId}/tweets`
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
    const response = await axios.get<ITwitterCommonResponse<Array<ITwitterTweetResponse>>>(url, {
      headers,
      params: {
        'tweet.fields': 'referenced_tweets',
      },
    })
    console.log(`查询${url},得到tweets列表:`, response.data)
    if (Array.isArray(response?.data?.data) && response.data.data.length) {
      return {
        result: response.data.data.some((tweet) =>
          tweet.referenced_tweets?.some(
            (ref: any) => ref.type === 'retweeted' && ref.id === tweetId,
          ),
        ),
      }
    } else {
      return { result: false }
    }
  } catch (e) {
    commonTwitterApiResponseErrorHandler(e, url)
    return { result: false, error: e }
  }
}

const handleTwitterLikeTask = async (
  userTwitterAccount: { twitterUserId: string; oauthToken: string; oauthTokenSecret: string },
  task: Task,
): Promise<IHandleTwitterTaskResult> => {
  if (!userTwitterAccount?.twitterUserId || !task.target) return { result: false }
  // 1. 提取 tweetId
  const match = task.target.match(TWEET_URL_REGEX)
  if (!match) return { result: false }
  const tweetId = match[1]
  // 2. 查询该用户的 liked_tweets
  const oauth = getOAuth()
  const url = `https://api.x.com/2/users/${userTwitterAccount.twitterUserId}/liked_tweets`
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
    const response = await axios.get<ITwitterCommonResponse<Array<ITwitterTweetResponse>>>(url, {
      headers,
    })
    console.log(`查询${url},得到liked_tweets列表:`, response.data)
    if (Array.isArray(response?.data?.data) && response.data.data.length) {
      return {
        result: response.data.data.some((t) => t.id === tweetId),
      }
    } else {
      return { result: false }
    }
  } catch (e) {
    commonTwitterApiResponseErrorHandler(e, url)
    return { result: false, error: e }
  }
}

export const handleTwitterTask = async (
  tx: Prisma.TransactionClient,
  user: User,
  task: Task,
): Promise<IHandleTwitterTaskResult> => {
  if (!task || task.type !== 'twitter' || !task.subType || !user || !tx) {
    return { result: false }
  }
  const userTwitterAccount = await tx.twitterAccount.findUnique({ where: { userId: user.id } })
  if (task.subType === 'bind') {
    return { result: !!userTwitterAccount?.twitterUserId }
  } else {
    if (!userTwitterAccount?.twitterUserId) return { result: false }
    switch (task.subType) {
      case 'follow':
        return { result: true }
      case 'retweet':
        return await handleTwitterRetweetTask(userTwitterAccount, task)
      case 'like':
        return await handleTwitterLikeTask(userTwitterAccount, task)
      case 'reply':
        return await handleTwitterReplyTask(userTwitterAccount, task)
      default:
        return { result: false }
    }
  }
}
