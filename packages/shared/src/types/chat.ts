export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewConversation {
  id?: string;
  userId: string;
  title: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewMessage {
  id?: string;
  conversationId: string;
  role: string;
  content: string;
}

export interface ChatSource {
  index: number;
  title: string;
  source: string;
}
