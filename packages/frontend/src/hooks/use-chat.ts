"use client";

import type {
  ChatErrorPayload,
  ChatSource,
  ConversationCreatedPayload,
  SourcesPayload,
  StreamChunkPayload,
  StreamDonePayload,
  StreamErrorPayload,
  TokenConsumedPayload,
  TokenRefundedPayload,
} from "@chatapp/shared";
import { CLIENT_EVENTS, SERVER_EVENTS } from "@chatapp/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api-client";
import { disconnectSocket, getSocket } from "@/lib/socket";
import { useLocalStorage } from "./use-local-storage";

interface UseChatOptions {
  onTokenRefunded?: () => void;
  onBalanceUpdate?: (balance: number) => void;
}

interface ChatMessage {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  sources?: ChatSource[] | undefined;
}

function makeTempMessage(conversationId: string, role: string, content: string): ChatMessage {
  return {
    id: `${role}-${Date.now()}`,
    conversationId,
    role,
    content,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export type { ChatSource };

export function useChat(options: UseChatOptions = {}) {
  const {
    items: conversations,
    addItem,
    removeItem,
    updateItem,
  } = useLocalStorage("chat-conversations");
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingSources, setStreamingSources] = useState<ChatSource[]>([]);
  const skipNextFetchRef = useRef(false);
  const streamingContentRef = useRef("");
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const activeConvIdRef = useRef(activeConversationId);
  activeConvIdRef.current = activeConversationId;

  // Fetch messages when selecting a conversation (REST call to backend)
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }

    const fetchMessages = async () => {
      setIsLoadingMessages(true);
      try {
        const res = await apiFetch(`/api/chat/conversations/${activeConversationId}/messages`);
        if (res.ok) {
          const data = (await res.json()) as { messages: ChatMessage[] };
          setMessages(data.messages);
        }
      } catch {
        toast.error("Failed to load messages");
      } finally {
        setIsLoadingMessages(false);
      }
    };

    void fetchMessages();
  }, [activeConversationId]);

  // Setup socket listeners
  useEffect(() => {
    let mounted = true;

    const setup = async () => {
      let socket: Awaited<ReturnType<typeof getSocket>> | undefined;
      try {
        socket = await getSocket();
      } catch {
        return;
      }

      if (!mounted) {
        return;
      }

      socket.on(SERVER_EVENTS.TOKEN_CONSUMED, (payload: TokenConsumedPayload) => {
        optionsRef.current.onBalanceUpdate?.(payload.remainingBalance);
      });

      socket.on(SERVER_EVENTS.CONVERSATION_CREATED, (payload: ConversationCreatedPayload) => {
        skipNextFetchRef.current = true;
        setActiveConversationId(payload.conversationId);
        addItem({
          id: payload.conversationId,
          title: payload.title,
          updatedAt: new Date().toISOString(),
        });
        setMessages((prev) =>
          prev.map((m) =>
            m.conversationId === "" ? { ...m, conversationId: payload.conversationId } : m,
          ),
        );
      });

      socket.on(SERVER_EVENTS.SOURCES, (payload: SourcesPayload) => {
        setStreamingSources(payload.sources);
      });

      socket.on(SERVER_EVENTS.STREAM_CHUNK, (payload: StreamChunkPayload) => {
        streamingContentRef.current += payload.content;
        setStreamingContent(streamingContentRef.current);
      });

      socket.on(SERVER_EVENTS.STREAM_DONE, (_payload: StreamDonePayload) => {
        const finalContent = streamingContentRef.current;
        if (finalContent) {
          setMessages((prev) => {
            const convId = activeConvIdRef.current ?? "";
            const assistantMessage: ChatMessage = {
              ...makeTempMessage(convId, "assistant", finalContent),
            };
            return [...prev, assistantMessage];
          });
        }
        setIsStreaming(false);
        setStreamingContent("");
        setStreamingSources([]);
        streamingContentRef.current = "";
      });

      socket.on(SERVER_EVENTS.STREAM_ERROR, (payload: StreamErrorPayload) => {
        toast.error(payload.message);
        setIsStreaming(false);
        setStreamingContent("");
        setStreamingSources([]);
        streamingContentRef.current = "";
      });

      socket.on(SERVER_EVENTS.TOKEN_REFUNDED, (payload: TokenRefundedPayload) => {
        toast.info(payload.message);
        optionsRef.current.onTokenRefunded?.();
      });

      socket.on(SERVER_EVENTS.ERROR, (payload: ChatErrorPayload) => {
        toast.error(payload.message);
        setIsStreaming(false);
        setStreamingContent("");
        streamingContentRef.current = "";
      });
    };

    void setup();

    return () => {
      mounted = false;
      disconnectSocket();
    };
  }, [addItem]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (isStreaming || !content.trim()) {
        return;
      }

      setIsStreaming(true);
      setStreamingContent("");
      setStreamingSources([]);
      streamingContentRef.current = "";

      const tempUserMessage = makeTempMessage(activeConversationId ?? "", "user", content);
      setMessages((prev) => [...prev, tempUserMessage]);

      try {
        const socket = await getSocket();
        socket.emit(CLIENT_EVENTS.SEND_MESSAGE, {
          content,
          conversationId: activeConversationId ?? undefined,
        });

        if (activeConversationId) {
          updateItem(activeConversationId, { updatedAt: new Date().toISOString() });
        }
      } catch {
        toast.error("Failed to send message");
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMessage.id));
        setIsStreaming(false);
      }
    },
    [activeConversationId, isStreaming, updateItem],
  );

  const abortStream = useCallback(async () => {
    try {
      const socket = await getSocket();
      socket.emit(CLIENT_EVENTS.ABORT_STREAM);
    } catch {
      // Ignore
    }
    setIsStreaming(false);
    setStreamingContent("");
    setStreamingSources([]);
    streamingContentRef.current = "";
  }, []);

  const selectConversation = useCallback(
    (id: string) => {
      void abortStream();
      setActiveConversationId(id);
      setStreamingContent("");
    },
    [abortStream],
  );

  const createNewChat = useCallback(() => {
    void abortStream();
    setActiveConversationId(null);
    setMessages([]);
    setStreamingContent("");
  }, [abortStream]);

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      try {
        const res = await apiFetch(`/api/chat/conversations/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
        if (res.ok) {
          updateItem(id, { title });
        }
      } catch {
        toast.error("Failed to rename conversation");
      }
    },
    [updateItem],
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await apiFetch(`/api/chat/conversations/${id}`, { method: "DELETE" });
        removeItem(id);
        if (activeConversationId === id) {
          setActiveConversationId(null);
          setMessages([]);
        }
      } catch {
        toast.error("Failed to delete conversation");
      }
    },
    [activeConversationId, removeItem],
  );

  return {
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
  };
}
