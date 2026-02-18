"use client";

import { Bot, FileText } from "lucide-react";
import { useEffect, useRef } from "react";

import { useAutoScroll } from "@/hooks/use-auto-scroll";
import type { ChatSource } from "@/hooks/use-chat";

import { MessageBubble } from "./message-bubble";

interface Message {
  id: string;
  role: string;
  content: string;
  sources?: ChatSource[] | undefined;
}

interface MessageListProps {
  messages: Message[];
  streamingContent: string;
  streamingSources?: ChatSource[] | undefined;
  isStreaming: boolean;
}

export function MessageList({
  messages,
  streamingContent,
  streamingSources,
  isStreaming,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollToBottom, isScrolledToBottom } = useAutoScroll(containerRef);
  const prevMessageCountRef = useRef(messages.length);

  // Auto-scroll when new messages are added (e.g., user sends a message)
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      scrollToBottom();
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, scrollToBottom]);

  // Auto-scroll during streaming when user hasn't scrolled up
  useEffect(() => {
    if (isScrolledToBottom()) {
      const el = containerRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }
  });

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl py-4">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            role={message.role}
            content={message.content}
            sources={message.sources}
          />
        ))}
        {isStreaming && streamingContent && (
          <div className="flex gap-3 px-4 py-3">
            <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-full">
              <Bot className="text-muted-foreground size-4" />
            </div>
            <div className="max-w-[80%]">
              <div className="bg-muted text-foreground rounded-2xl px-4 py-2.5">
                <p className="text-sm whitespace-pre-wrap">
                  {streamingContent}
                  <span className="streaming-cursor ml-0.5 inline-block h-4 w-1.5 align-middle" />
                </p>
              </div>
              {streamingSources && streamingSources.length > 0 && (
                <div className="mt-2 space-y-1" data-testid="streaming-source-references">
                  <p className="text-muted-foreground flex items-center gap-1 text-xs font-medium">
                    <FileText className="size-3" />
                    Sources
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {streamingSources.map((source) => (
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
          </div>
        )}
        {isStreaming && !streamingContent && (
          <div className="flex gap-3 px-4 py-3">
            <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-full">
              <Bot className="text-muted-foreground size-4" />
            </div>
            <div className="bg-muted max-w-[80%] rounded-2xl px-4 py-2.5">
              <div className="flex items-center gap-1">
                <span className="bg-primary/60 size-1.5 animate-bounce rounded-full [animation-delay:0ms]" />
                <span className="bg-primary/60 size-1.5 animate-bounce rounded-full [animation-delay:150ms]" />
                <span className="bg-primary/60 size-1.5 animate-bounce rounded-full [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
