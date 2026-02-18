export interface TokenBalance {
  userId: string;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewTokenBalance {
  userId: string;
  balance?: number;
}

export interface TokenTransaction {
  id: string;
  userId: string;
  amount: number;
  type: string;
  referenceId: string | null;
  description: string | null;
  balanceAfter: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewTokenTransaction {
  id?: string;
  userId: string;
  amount: number;
  type: string;
  referenceId?: string | null;
  description?: string | null;
  balanceAfter: number;
}

export interface TokenPack {
  id: string;
  name: string;
  tokens: number;
  priceInCents: number;
  description: string;
}
