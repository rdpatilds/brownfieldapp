"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LOW_BALANCE_THRESHOLD } from "@/contracts/constants";

import { apiFetch } from "@/lib/api-client";

export function useTokens() {
  const [balance, setBalance] = useState<number | null>(null);
  const fetchingRef = useRef(false);

  const fetchBalance = useCallback(async () => {
    // Prevent duplicate concurrent fetches (e.g. from rapid mount/unmount cycles)
    if (fetchingRef.current) {
      return;
    }
    fetchingRef.current = true;
    try {
      const res = await apiFetch("/api/billing/balance");
      if (res.ok) {
        const data = (await res.json()) as { balance: number };
        setBalance(data.balance);
      }
    } catch {
      // Silently fail — balance will stay null (loading)
    } finally {
      fetchingRef.current = false;
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
