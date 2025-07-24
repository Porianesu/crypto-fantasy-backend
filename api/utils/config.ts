export enum CARD_RARITY {
  NORMAL = 0,
  RARE = 1,
  EPIC = 2,
  LEGENDARY = 3,
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
