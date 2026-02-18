"use client";

import { LOW_BALANCE_THRESHOLD } from "@chatapp/shared";
import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api-client";

export function useTokens() {
  const [balance, setBalance] = useState<number | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await apiFetch("/api/billing/balance");
      if (res.ok) {
        const data = (await res.json()) as { balance: number };
        setBalance(data.balance);
      }
    } catch {
      // Silently fail — balance will stay null (loading)
    }
  }, []);

  const decrementBalance = useCallback(() => {
    setBalance((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
  }, []);

  const refreshBalance = useCallback(() => {
    void fetchBalance();
  }, [fetchBalance]);

  const updateBalance = useCallback((newBalance: number) => {
    setBalance(newBalance);
  }, []);

  useEffect(() => {
    void fetchBalance();
  }, [fetchBalance]);

  return {
    balance,
    isLowBalance: balance !== null && balance <= LOW_BALANCE_THRESHOLD,
    hasTokens: balance !== null && balance > 0,
    isLoading: balance === null,
    decrementBalance,
    refreshBalance,
    updateBalance,
  };
}
