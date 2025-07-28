import {VercelRequest, VercelResponse} from '@vercel/node';
import {Card, PrismaClient, UserCard} from '@prisma/client';
import {verifyToken} from './utils/jwt';
import {CraftRule} from './utils/config';
import {successRateCalculate} from "./utils/common";
import {BigNumber} from "bignumber.js";

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({error: 'Method Not Allowed'});
  }

  // 校验token
  const email = verifyToken(req);
  if (!email) {
    return res.status(401).json({error: 'Unauthorized'});
  }

  // 通过 email 查询 userId
  const user = await prisma.user.findUnique({where: {email}});
  if (!user) {
    return res.status(401).json({error: 'User not found'});
  }

  const {craftCardId, additiveCardIds} = req.body;
  if (!craftCardId || typeof craftCardId !== 'number' || (additiveCardIds && !Array.isArray(additiveCardIds))) {
    return res.status(400).json({error: 'Invalid request body. craftCardId must be a number and additiveCardIds must be an array.'});
  }

  // 查询卡牌稀有度
  const craftCard = await prisma.card.findUnique({where: {id: craftCardId}});
  if (!craftCard) {
    return res.status(404).json({error: 'Card not found'});
  }

  const craftConfig = CraftRule.find(item => item.targetRarity === craftCard.rarity);
  if (!craftConfig) {
    return res.status(500).json({error: 'Craft config not found'});
  }

  // faithAmount 校验和扣款
  if (user.faithAmount < craftConfig.requiredFaithCoin) {
    return res.status(400).json({ error: 'Insufficient faith coin!' });
  }

  const availableRequiredCards = await prisma.userCard.findMany({
    where: {
      userId: user.id,
      card: {
        rarity: craftConfig.requiredCards.rarity,
      }
    }
  });

  // 找出满足条件的卡牌
  const requiredCount = craftConfig.requiredCards.count;
  if (availableRequiredCards.length < requiredCount) {
    return res.status(400).json({error: 'Required cards not enough!'});
  }
  // 取出前 requiredCount 张卡牌
  const requiredCards = availableRequiredCards.slice(0, requiredCount);

  // 查找 additiveCards
  let additiveCards: (UserCard & { card: Card })[] = [];
  if (additiveCardIds && Array.isArray(additiveCardIds) && additiveCardIds.length > 0) {
    const usedUserCardIds = new Set(requiredCards.map(userCard => userCard.id)); // 这里应该是 userCard 的 id
    for (const cardId of additiveCardIds) {
      // 查找用户拥有的、cardId匹配且未被requiredCards使用的任意一张卡
      const found = await prisma.userCard.findFirst({
        where: {
          userId: user.id,
          cardId: cardId,
          NOT: {id: {in: Array.from(usedUserCardIds)}}
        },
        include: {
          card: true, // 包含卡牌信息
        }
      });
      if (!found) {
        return res.status(400).json({error: `Additive card ${cardId} not found!`});
      }
      additiveCards.push(found);
      usedUserCardIds.add(found.id); // 防止重复使用
    }
  }
  // 扣除 faithAmount（推荐使用 decrement 保证并发安全）
  const { password, ...userData } = await prisma.user.update({
    where: { id: user.id },
    data: { faithAmount: { decrement: craftConfig.requiredFaithCoin } }
  });

  const successRate = successRateCalculate(craftConfig, craftCard, additiveCards.map(card => card.card));
  console.log('Craft success rate:', successRate.toString());
  const randomNumber = new BigNumber(Math.random())
  console.log('randomNumber', randomNumber.toString())
  // 删除所有消耗的卡牌
  const deleteIds = [
    ...requiredCards.map(userCard => userCard.id),
    ...additiveCards.map(userCard => userCard.id)
  ];
  console.log('deleteIds', deleteIds);
  const {count} = await prisma.userCard.deleteMany({
    where: {
      id: { in: deleteIds }
    }
  });
  console.log('Deleted user cards count:', count);
  try {
    if (randomNumber.isLessThanOrEqualTo(successRate)) {
      await prisma.userCard.create({
        data: {
          userId: user.id,
          cardId: craftCard.id
        }
      });
      return res.status(200).json({ success: true, user: userData, resultCards: [craftCard] });
    } else {
      // 合成失败逻辑：按规则返还部分消耗卡牌
      // 随机返还一张 requiredCards 中的卡
      const randomRequiredCardIndex = Math.floor(Math.random() * requiredCards.length);
      const returnRequiredCard = requiredCards[randomRequiredCardIndex];
      const resultCards: number[] = [returnRequiredCard.cardId];
      console.log('returnRequiredCard', returnRequiredCard.cardId);
      // 可选：随机返还一张 additiveCards 中的卡
      if (additiveCards.length > 0) {
        const randomAdditiveCardIndex = Math.floor(Math.random() * additiveCards.length);
        const returnAdditiveCard = additiveCards[randomAdditiveCardIndex];
        console.log('returnAdditiveCard', returnAdditiveCard.cardId);
        resultCards.push(returnAdditiveCard.cardId);
      }
      // 返还 resultCards 到用户背包
      await Promise.all(resultCards.map(cardId =>
        prisma.userCard.create({
          data: {
            userId: user.id,
            cardId: cardId
          }
        })
      ));
      const returnedCards = await prisma.card.findMany({
        where: { id: { in: resultCards } }
      });
      return res.status(200).json({ success: false, user: userData, resultCards: returnedCards });
    }
  } catch (error) {
    console.error('Craft error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
