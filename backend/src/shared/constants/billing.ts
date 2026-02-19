export const FREE_SIGNUP_TOKENS = 10;
export const LOW_BALANCE_THRESHOLD = 3;

export const TOKEN_PACKS = [
  {
    id: "pack-50",
    name: "50 Tokens",
    tokens: 50,
    priceInCents: 500,
    description: "50 AI conversation turns",
  },
  {
    id: "pack-150",
    name: "150 Tokens",
    tokens: 150,
    priceInCents: 1000,
    description: "150 AI conversation turns",
  },
  {
    id: "pack-500",
    name: "500 Tokens",
    tokens: 500,
    priceInCents: 2500,
    description: "500 AI conversation turns",
  },
] as const;

export type TokenPackId = (typeof TOKEN_PACKS)[number]["id"];
