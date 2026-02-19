"use client";

import { MessageSquare } from "lucide-react";
import { useCallback, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { useChat } from "@/hooks/use-chat";
import { useTokens } from "@/hooks/use-tokens";

import { ChatHeader } from "./chat-header";
import { ChatInput } from "./chat-input";
import { ChatSidebar } from "./chat-sidebar";
import { MessageList } from "./message-list";

export function ChatLayout() {
  const { balance, isLowBalance, hasTokens, refreshBalance, updateBalance } = useTokens();

  const {
    conversations,
    activeConversationId,
    messages,
    isStreaming,
    isLoadingMessages,
    streamingContent,
    streamingSources,
    sendMessage,
    selectConversation,
    createNewChat,
    renameConversation,
    deleteConversation,
  } = useChat({
    onTokenRefunded: refreshBalance,
    onBalanceUpdate: updateBalance,
  });

  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const activeTitle = conversations.find((c) => c.id === activeConversationId)?.title ?? null;

  const toggleSidebar = useCallback(() => {
    setIsMobileOpen((prev) => !prev);
  }, []);

  const closeMobile = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  const hasMessages = messages.length > 0 || isStreaming;

  return (
    <div className="flex h-screen">
      <ChatSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={selectConversation}
        onNewChat={createNewChat}
        onRenameConversation={renameConversation}
        onDeleteConversation={deleteConversation}
        isMobileOpen={isMobileOpen}
        onMobileClose={closeMobile}
      />

      <div className="chat-gradient-bg flex flex-1 flex-col">
        <ChatHeader
          title={activeTitle}
          onToggleSidebar={toggleSidebar}
          tokenBalance={balance}
          isLowBalance={isLowBalance}
        />

        {isLoadingMessages && activeConversationId ? (
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl space-y-4 py-4">
              <div className="flex gap-3 px-4 py-3">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <Skeleton className="h-16 w-3/4 rounded-2xl" />
              </div>
              <div className="flex flex-row-reverse gap-3 px-4 py-3">
                <Skeleton className="h-10 w-1/2 rounded-2xl" />
              </div>
              <div className="flex gap-3 px-4 py-3">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <Skeleton className="h-24 w-2/3 rounded-2xl" />
              </div>
              <div className="flex flex-row-reverse gap-3 px-4 py-3">
                <Skeleton className="h-10 w-2/5 rounded-2xl" />
              </div>
            </div>
          </div>
        ) : hasMessages ? (
          <MessageList
            messages={messages}
            streamingContent={streamingContent}
            streamingSources={streamingSources}
            isStreaming={isStreaming}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
            <div className="bg-primary/10 flex size-16 items-center justify-center rounded-2xl">
              <MessageSquare className="text-primary size-8" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-semibold">How can I help you today?</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Start a conversation by typing a message below.
              </p>
            </div>
          </div>
        )}

        <ChatInput onSend={sendMessage} disabled={isStreaming} hasTokens={hasTokens} />
      </div>
    </div>
  );
}
