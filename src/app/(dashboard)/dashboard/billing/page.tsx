"use client";

import { Zap } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TOKEN_PACKS } from "@/features/billing/constants";

interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: string;
  referenceId: string | null;
  description: string;
  balanceAfter: number;
  createdAt: string;
  updatedAt: string;
}

interface TransactionResponse {
  items: Transaction[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

function formatPrice(priceInCents: number): string {
  return `$${(priceInCents / 100).toFixed(2)}`;
}

function formatTransactionType(type: string): string {
  switch (type) {
    case "signup_bonus":
      return "Signup Bonus";
    case "chat_message":
      return "Chat Message";
    case "purchase":
      return "Purchase";
    case "refund":
      return "Refund";
    default:
      return type;
  }
}

export default function BillingPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<TransactionResponse["pagination"] | null>(null);
  const [page, setPage] = useState(1);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [buyingPackId, setBuyingPackId] = useState<string | null>(null);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const res = await fetch("/api/billing/balance");
        if (res.ok) {
          const data = (await res.json()) as { balance: number };
          setBalance(data.balance);
        }
      } catch {
        toast.error("Failed to load balance");
      } finally {
        setIsLoadingBalance(false);
      }
    };
    void fetchBalance();
  }, []);

  useEffect(() => {
    const fetchTransactions = async () => {
      setIsLoadingTransactions(true);
      try {
        const res = await fetch(`/api/billing/transactions?page=${page}&pageSize=20`);
        if (res.ok) {
          const data = (await res.json()) as TransactionResponse;
          setTransactions(data.items);
          setPagination(data.pagination);
        }
      } catch {
        toast.error("Failed to load transactions");
      } finally {
        setIsLoadingTransactions(false);
      }
    };
    void fetchTransactions();
  }, [page]);

  const handleBuyPack = useCallback(async (packId: string) => {
    setBuyingPackId(packId);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { url: string };
        window.location.href = data.url;
      } else {
        toast.error("Failed to start checkout");
      }
    } catch {
      toast.error("Failed to start checkout");
    } finally {
      setBuyingPackId(null);
    }
  }, []);

  const handleManageBilling = useCallback(async () => {
    setIsOpeningPortal(true);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
      });
      if (res.ok) {
        const data = (await res.json()) as { url: string };
        window.location.href = data.url;
      } else {
        toast.error("Failed to open billing portal");
      }
    } catch {
      toast.error("Failed to open billing portal");
    } finally {
      setIsOpeningPortal(false);
    }
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Billing</h1>
        <p className="text-muted-foreground mt-1">Manage your tokens and purchases</p>
      </div>

      {/* Balance */}
      <Card>
        <CardHeader>
          <CardTitle>Token Balance</CardTitle>
          <CardDescription>Each AI conversation turn costs 1 token</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingBalance ? (
            <Skeleton className="h-12 w-24" />
          ) : (
            <div className="flex items-center gap-3">
              <Zap className="text-primary size-8" />
              <span className="text-4xl font-bold">{balance}</span>
              <span className="text-muted-foreground text-lg">tokens</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Token Packs */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Buy Tokens</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {TOKEN_PACKS.map((pack) => (
            <Card key={pack.id}>
              <CardHeader>
                <CardTitle>{pack.name}</CardTitle>
                <CardDescription>{pack.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-2xl font-bold">{formatPrice(pack.priceInCents)}</span>
                <Button
                  onClick={() => void handleBuyPack(pack.id)}
                  disabled={buyingPackId !== null}
                >
                  {buyingPackId === pack.id ? "Loading..." : "Buy"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Manage Billing */}
      <div>
        <Button
          variant="outline"
          onClick={() => void handleManageBilling()}
          disabled={isOpeningPortal}
        >
          {isOpeningPortal ? "Opening..." : "Manage Billing"}
        </Button>
      </div>

      {/* Transaction History */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Transaction History</h2>
        <Card>
          <CardContent className="p-0">
            {isLoadingTransactions ? (
              <div className="space-y-3 p-6">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-muted-foreground p-6 text-center text-sm">No transactions yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm">
                      <th className="px-6 py-3 font-medium">Date</th>
                      <th className="px-6 py-3 font-medium">Type</th>
                      <th className="px-6 py-3 font-medium">Amount</th>
                      <th className="px-6 py-3 font-medium">Description</th>
                      <th className="px-6 py-3 font-medium">Balance After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="border-b last:border-0">
                        <td className="px-6 py-3 text-sm">
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-3 text-sm">{formatTransactionType(tx.type)}</td>
                        <td className="px-6 py-3 text-sm">
                          <span className={tx.amount > 0 ? "text-green-600" : "text-red-600"}>
                            {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                          </span>
                        </td>
                        <td className="text-muted-foreground px-6 py-3 text-sm">
                          {tx.description}
                        </td>
                        <td className="px-6 py-3 text-sm">{tx.balanceAfter}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <span className="text-muted-foreground text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= pagination.totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
