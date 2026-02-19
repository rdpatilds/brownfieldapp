"use client";

import { Send } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useCallback, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled: boolean;
  hasTokens?: boolean;
}

export function ChatInput({ onSend, disabled, hasTokens = true }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) {
      return;
    }
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  if (!hasTokens) {
    return (
      <div className="border-t border-border/50 bg-background/80 p-4 backdrop-blur-sm">
        <Card className="mx-auto max-w-3xl">
          <CardContent className="flex flex-col items-center gap-3 py-6">
            <p className="text-muted-foreground text-sm font-medium">You've used all your tokens</p>
            <a href="/dashboard/billing">
              <Button aria-label="Buy more tokens">Buy More Tokens</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="border-t border-border/50 bg-background/80 p-4 backdrop-blur-sm">
      <div className="chat-input-glow mx-auto flex max-w-3xl items-end gap-2 rounded-xl bg-muted/50 p-2">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={disabled}
          className="max-h-32 min-h-10 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          rows={1}
        />
        <Button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          size="icon"
          className="send-button-glow shrink-0"
          aria-label="Send message"
        >
          <Send className="size-4" />
        </Button>
      </div>
      <p className="text-muted-foreground/50 mt-1.5 text-center text-xs">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
