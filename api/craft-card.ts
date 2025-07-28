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

  const timeCheckpoints: Record<string, number> = {};
  timeCheckpoints['start'] = Date.now();

  // 校验token
  timeCheckpoints['beforeVerifyToken'] = Date.now();
  const email = verifyToken(req);
  timeCheckpoints['afterVerifyToken'] = Date.now();
  if (!email) {
    return res.status(401).json({error: 'Unauthorized'});
  }

  // 通过 email 查询 userId
  timeCheckpoints['beforeFindUser'] = Date.now();
  const user = await prisma.user.findUnique({where: {email}});
  timeCheckpoints['afterFindUser'] = Date.now();
  if (!user) {
    return res.status(401).json({error: 'User not found'});
  }

  const {craftCardId, additiveCardIds} = req.body;
  if (!craftCardId || typeof craftCardId !== 'number' || (additiveCardIds && !Array.isArray(additiveCardIds))) {
    return res.status(400).json({error: 'Invalid request body. craftCardId must be a number and additiveCardIds must be an array.'});
  }

  // 查询卡牌稀有度
  timeCheckpoints['beforeFindCard'] = Date.now();
  const craftCard = await prisma.card.findUnique({where: {id: craftCardId}});
  timeCheckpoints['afterFindCard'] = Date.now();
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

  // 查找用户拥有的 requiredCards必须是同链的下一级稀有度的卡
  timeCheckpoints['beforeFindRequiredCards'] = Date.now();
  const availableRequiredCards = await prisma.userCard.findMany({
    where: {
      userId: user.id,
      card: {
        id: craftCardId - 1,
        rarity: craftConfig.requiredCards.rarity,
      }
    }
  });
  timeCheckpoints['afterFindRequiredCards'] = Date.now();
  // 找出满足条件的卡牌
  const requiredCount = craftConfig.requiredCards.count;
  if (availableRequiredCards.length < requiredCount) {
    return res.status(400).json({error: 'Required cards not enough!'});
  }
  // 取出前 requiredCount 张卡牌
  const requiredCards = availableRequiredCards.slice(0, requiredCount);

  // 查找 additiveCards
  timeCheckpoints['beforeFindAdditiveCards'] = Date.now();
  let additiveCards: (UserCard & { card: Card })[] = [];
  if (additiveCardIds && Array.isArray(additiveCardIds) && additiveCardIds.length > 0) {
    const usedUserCardIds = new Set(requiredCards.map(userCard => userCard.id)); // 这里应该是 userCard 的 id
    const additivePromises = additiveCardIds.map(cardId =>
      prisma.userCard.findFirst({
        where: {
          userId: user.id,
          cardId: cardId,
          NOT: {id: {in: Array.from(usedUserCardIds)}}
        },
        include: { card: true }
      })
    );
    const foundCards = await Promise.all(additivePromises);
    for (const found of foundCards) {
      if (!found) {
        return res.status(400).json({error: 'Additive card not found!'});
      }
      additiveCards.push(found);
      usedUserCardIds.add(found.id);
    }
  }
  timeCheckpoints['afterFindAdditiveCards'] = Date.now();

  // 扣除 faithAmount（推荐使用 decrement 保证并发安全）
  timeCheckpoints['beforeUpdateUser'] = Date.now();
  const { password, ...userData } = await prisma.user.update({
    where: { id: user.id },
    data: { faithAmount: { decrement: craftConfig.requiredFaithCoin } }
  });
  timeCheckpoints['afterUpdateUser'] = Date.now();

  const successRate = successRateCalculate(craftConfig, craftCard, additiveCards.map(card => card.card));
  console.log('Craft success rate:', successRate.toString());
  const randomNumber = new BigNumber(Math.random())
  console.log('randomNumber', randomNumber.toString())
  // 删除所有消耗的卡牌
  timeCheckpoints['beforeDeleteUserCards'] = Date.now();
  const deleteResult = await prisma.userCard.deleteMany({
    where: {
      id: { in: [
        ...requiredCards.map(userCard => userCard.id),
        ...additiveCards.map(userCard => userCard.id)
      ] }
    }
  });
  timeCheckpoints['afterDeleteUserCards'] = Date.now();
  console.log('Deleted user cards count:', deleteResult.count);
  try {
    timeCheckpoints['beforeResultReturn'] = Date.now();
    if (randomNumber.isLessThanOrEqualTo(successRate)) {
      await prisma.userCard.create({
        data: {
          userId: user.id,
          cardId: craftCard.id
        }
      });
      timeCheckpoints['afterCreateResultCard'] = Date.now();
      console.log('接口各步骤耗时(ms):', {
        verifyToken: timeCheckpoints['afterVerifyToken'] - timeCheckpoints['beforeVerifyToken'],
        findUser: timeCheckpoints['afterFindUser'] - timeCheckpoints['beforeFindUser'],
        findCard: timeCheckpoints['afterFindCard'] - timeCheckpoints['beforeFindCard'],
        findRequiredCards: timeCheckpoints['afterFindRequiredCards'] - timeCheckpoints['beforeFindRequiredCards'],
        findAdditiveCards: timeCheckpoints['afterFindAdditiveCards'] - timeCheckpoints['beforeFindAdditiveCards'],
        updateUser: timeCheckpoints['afterUpdateUser'] - timeCheckpoints['beforeUpdateUser'],
        deleteUserCards: timeCheckpoints['afterDeleteUserCards'] - timeCheckpoints['beforeDeleteUserCards'],
        createResultCard: timeCheckpoints['afterCreateResultCard'] - timeCheckpoints['beforeResultReturn'],
        total: Date.now() - timeCheckpoints['start']
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
        const targetAdditiveCard = additiveCards[randomAdditiveCardIndex];
        const returnAdditiveCard = await prisma.card.findFirst({
          where: { id: targetAdditiveCard.card.rarity === 0 ? targetAdditiveCard.cardId : targetAdditiveCard.cardId - 1 }
        })
        if (!returnAdditiveCard) {
          return res.status(404).json({ error: 'Return additive card not found' });
        }
        console.log('returnAdditiveCard', returnAdditiveCard.id);
        resultCards.push(returnAdditiveCard.id);
      }
      // 返还 resultCards 到用户背包
      await prisma.userCard.createMany({
        data: resultCards.map(cardId => ({
          userId: user.id,
          cardId: cardId
        }))
      });
      const returnedCards = await prisma.card.findMany({
        where: { id: { in: resultCards } }
      });
      timeCheckpoints['afterFailLogic'] = Date.now();
      console.log('接口各步骤耗时(ms):', {
        verifyToken: timeCheckpoints['afterVerifyToken'] - timeCheckpoints['beforeVerifyToken'],
        findUser: timeCheckpoints['afterFindUser'] - timeCheckpoints['beforeFindUser'],
        findCard: timeCheckpoints['afterFindCard'] - timeCheckpoints['beforeFindCard'],
        findRequiredCards: timeCheckpoints['afterFindRequiredCards'] - timeCheckpoints['beforeFindRequiredCards'],
        findAdditiveCards: timeCheckpoints['afterFindAdditiveCards'] - timeCheckpoints['beforeFindAdditiveCards'],
        updateUser: timeCheckpoints['afterUpdateUser'] - timeCheckpoints['beforeUpdateUser'],
        deleteUserCards: timeCheckpoints['afterDeleteUserCards'] - timeCheckpoints['beforeDeleteUserCards'],
        failLogic: timeCheckpoints['afterFailLogic'] - timeCheckpoints['beforeResultReturn'],
        total: Date.now() - timeCheckpoints['start']
      });
      return res.status(200).json({ success: false, user: userData, resultCards: returnedCards });
    }
  } catch (error) {
    console.error('Craft error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
