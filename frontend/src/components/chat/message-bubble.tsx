"use client";

import { Bot, FileText, User } from "lucide-react";
import type { ChatSource } from "@/hooks/use-chat";
import { cn } from "@/lib/utils";

import { MarkdownContent } from "./markdown-content";

interface MessageBubbleProps {
  role: string;
  content: string;
  sources?: ChatSource[] | undefined;
}

export function MessageBubble({ role, content, sources }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={cn("flex gap-3 px-4 py-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="bg-muted ring-primary/20 flex size-8 shrink-0 items-center justify-center rounded-full ring-1">
          <Bot className="text-muted-foreground size-4" />
        </div>
      )}
      <div className={cn("max-w-[80%]", isUser ? "" : "")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5",
            isUser
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "bg-muted text-foreground",
          )}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">{content}</p>
          ) : (
            <MarkdownContent content={content} />
          )}
        </div>
        {!isUser && sources && sources.length > 0 && (
          <div className="mt-2 space-y-1" data-testid="source-references">
            <p className="text-muted-foreground flex items-center gap-1 text-xs font-medium">
              <FileText className="size-3" />
              Sources
            </p>
            <div className="flex flex-wrap gap-1.5">
              {sources.map((source) => (
                <span
                  key={source.index}
                  className="bg-muted/60 text-muted-foreground inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ring-1 ring-border/50"
                  title={source.source}
                >
                  <span className="text-primary font-medium">[{source.index}]</span>
                  {source.title}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      {isUser && (
        <div className="bg-primary flex size-8 shrink-0 items-center justify-center rounded-full">
          <User className="text-primary-foreground size-4" />
        </div>
      )}
    </div>
  );
}
