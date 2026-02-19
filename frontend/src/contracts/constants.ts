export const LOW_BALANCE_THRESHOLD = 3;
export const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
export const ALLOWED_EXTENSIONS = [".md", ".txt"] as const;

export interface TokenPack {
  id: string;
  name: string;
  tokens: number;
  priceInCents: number;
  description: string;
}

export const TOKEN_PACKS: readonly TokenPack[] = [
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
