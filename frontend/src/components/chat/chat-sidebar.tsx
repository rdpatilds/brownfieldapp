"use client";

import { MessageSquare, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

import { ConversationItem } from "./conversation-item";

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

interface ChatSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onRenameConversation: (id: string, title: string) => void;
  onDeleteConversation: (id: string) => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

function SidebarContent({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onRenameConversation,
  onDeleteConversation,
}: Omit<ChatSidebarProps, "isMobileOpen" | "onMobileClose">) {
  const sorted = [...conversations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 border-primary/30 hover:bg-primary/10 hover:text-primary"
          onClick={onNewChat}
        >
          <Plus className="size-4" />
          New Chat
        </Button>
      </div>
      <ScrollArea className="flex-1 px-2">
        {sorted.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 px-4 py-8 text-center text-sm">
            <MessageSquare className="size-8 opacity-50" />
            <p>No conversations yet</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {sorted.map((conv) => (
              <ConversationItem
                key={conv.id}
                id={conv.id}
                title={conv.title}
                isActive={conv.id === activeConversationId}
                onSelect={onSelectConversation}
                onRename={onRenameConversation}
                onDelete={onDeleteConversation}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export function ChatSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onRenameConversation,
  onDeleteConversation,
  isMobileOpen,
  onMobileClose,
}: ChatSidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="bg-sidebar hidden h-full w-72 border-r md:block">
        <SidebarContent
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={onSelectConversation}
          onNewChat={onNewChat}
          onRenameConversation={onRenameConversation}
          onDeleteConversation={onDeleteConversation}
        />
      </aside>

      {/* Mobile sidebar */}
      <Sheet
        open={isMobileOpen}
        onOpenChange={(open) => {
          if (!open) {
            onMobileClose();
          }
        }}
      >
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Chat history</SheetTitle>
          <SidebarContent
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelectConversation={(id) => {
              onSelectConversation(id);
              onMobileClose();
            }}
            onNewChat={() => {
              onNewChat();
              onMobileClose();
            }}
            onRenameConversation={onRenameConversation}
            onDeleteConversation={onDeleteConversation}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
