"use client";

import { Menu, Zap } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface ChatHeaderProps {
  title: string | null;
  onToggleSidebar: () => void;
  tokenBalance: number | null;
  isLowBalance: boolean;
}

export function ChatHeader({
  title,
  onToggleSidebar,
  tokenBalance,
  isLowBalance,
}: ChatHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border/50 bg-background/80 px-4 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <Menu className="size-5" />
        </Button>
        <h1 className="truncate text-lg font-semibold">{title ?? "New Chat"}</h1>
      </div>
      <div className="flex items-center gap-3">
        {tokenBalance === null ? (
          <Skeleton className="h-6 w-16 rounded-full" />
        ) : (
          <Badge
            variant={isLowBalance ? "destructive" : "secondary"}
            className="gap-1"
            aria-label="Token balance"
          >
            <Zap className="size-3" />
            {tokenBalance}
          </Badge>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
