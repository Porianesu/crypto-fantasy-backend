import axios from 'axios'
import { Prisma, Task, User } from '@prisma/client'
import { getOAuth } from '../x-oauth'

// 修正正则
const TWEET_URL_REGEX = /https:\/\/x\.com\/[A-Za-z0-9_]+\/status\/(\d+)/

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
    const response = await axios.get<{
      data: Array<{
        id: string
        name: string
        username: string
      }>
    }>(url, { headers })
    if (Array.isArray(response?.data?.data) && response.data.data.length) {
      console.log(`查询${url},得到retweeted_by列表:`, response.data.data)
      // 判断当前用户是否在 retweeted_by 列表中
      return response.data.data.some((u) => u.id === userTwitterAccount.twitterUserId)
    } else {
      return false
    }
  } catch (e) {
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
      default:
        return false
    }
  }
}
