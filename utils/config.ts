export const DefaultAvatars = [
  'https://fantasy.defed.network/defaultAvatars/player_female_1.png',
  'https://fantasy.defed.network/defaultAvatars/player_female_2.png',
  'https://fantasy.defed.network/defaultAvatars/player_male_1.png',
  'https://fantasy.defed.network/defaultAvatars/player_male_2.png',
]

export enum CARD_RARITY {
  NORMAL = 0,
  RARE = 1,
  EPIC = 2,
  LEGENDARY = 3,
}

export const ReferralReward = {
  invitee: {
    solAmount: 50,
    faithAmount: 5000,
  },
  inviter: {
    solAmount: 50,
    faithAmount: 5000,
  },
}

export const NewbieReward = {
  solAmount: 20,
  faithAmount: 10000,
}

export const MeltRule = [
  {
    rarity: CARD_RARITY.NORMAL,
    faithCoin: 12,
  },
  {
    rarity: CARD_RARITY.RARE,
    faithCoin: 45,
  },
  {
    rarity: CARD_RARITY.EPIC,
    faithCoin: 200,
  },
  {
    rarity: CARD_RARITY.LEGENDARY,
    faithCoin: 1800,
  },
]

export interface ICraftRule {
  targetRarity: CARD_RARITY
  requiredCards: {
    rarity: CARD_RARITY
    count: number
  }
  requiredFaithCoin: number
  baseSuccessRate: number // 基础成功率
  maxSuccessRate: number // 最大成功率
}

export const CraftRule: Array<ICraftRule> = [
  {
    targetRarity: CARD_RARITY.RARE,
    requiredCards: {
      rarity: CARD_RARITY.NORMAL,
      count: 2,
    },
    requiredFaithCoin: 51,
    baseSuccessRate: 0.5,
    maxSuccessRate: 0.7,
  },
  {
    targetRarity: CARD_RARITY.EPIC,
    requiredCards: {
      rarity: CARD_RARITY.RARE,
      count: 2,
    },
    requiredFaithCoin: 256,
    baseSuccessRate: 0.2,
    maxSuccessRate: 0.4,
  },
  {
    targetRarity: CARD_RARITY.LEGENDARY,
    requiredCards: {
      rarity: CARD_RARITY.EPIC,
      count: 2,
    },
    requiredFaithCoin: 2100,
    baseSuccessRate: 0.1,
    maxSuccessRate: 0.3,
  },
]

export const SignInReward = [
  {
    solAmount: 1,
    faithAmount: 100,
  },
  {
    solAmount: 3,
    faithAmount: 300,
  },
  {
    solAmount: 6,
    faithAmount: 600,
  },
  {
    solAmount: 10,
    faithAmount: 1000,
  },
  {
    solAmount: 15,
    faithAmount: 1500,
  },
  {
    solAmount: 21,
    faithAmount: 2100,
  },
  {
    solAmount: 28,
    faithAmount: 2800,
  },
]
