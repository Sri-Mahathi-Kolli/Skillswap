import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { User } from '../core/services/auth.service';

export interface ChatMessage {
  id: string;
  content: string;
  sender: {
    id: string;
    name: string;
    photo?: string;
  };
  receiver: string;
  conversationId: string;
  timestamp: Date;
  isRead: boolean;
  isPending?: boolean;
  isFailed?: boolean;
  attachments?: any[];
  clientMessageId?: string; // For deduplication
}

export interface Conversation {
  id: string;
  messages: ChatMessage[];
  lastMessage?: ChatMessage;
  unreadCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class ChatStateService {
  private conversationsSubject = new BehaviorSubject<Map<string, ChatMessage[]>>(new Map());
  private selectedConversationSubject = new BehaviorSubject<string>('');
  private selectedUserSubject = new BehaviorSubject<User | null>(null);
  private typingUsersSubject = new BehaviorSubject<Set<string>>(new Set());

  public conversations$ = this.conversationsSubject.asObservable();
  public selectedConversation$ = this.selectedConversationSubject.asObservable();
  public selectedUser$ = this.selectedUserSubject.asObservable();
  public typingUsers$ = this.typingUsersSubject.asObservable();

  constructor() {}

  // Conversation Management
  setConversation(conversationId: string, messages: ChatMessage[]): void {
    const conversations = this.conversationsSubject.value;
    conversations.set(conversationId, messages);
    this.conversationsSubject.next(conversations);
  }

  getConversation(conversationId: string): ChatMessage[] {
    return this.conversationsSubject.value.get(conversationId) || [];
  }

  addMessageToConversation(conversationId: string, message: ChatMessage): void {
    const conversations = this.conversationsSubject.value;
    const messages = conversations.get(conversationId) || [];
    
    // Check for duplicates
    const isDuplicate = messages.some(m => m.id === message.id);
    if (!isDuplicate) {
      messages.push(message);
      conversations.set(conversationId, messages);
      this.conversationsSubject.next(conversations);
    }
  }

  updateMessageInConversation(conversationId: string, messageId: string, updates: Partial<ChatMessage>): void {
    const conversations = this.conversationsSubject.value;
    const messages = conversations.get(conversationId) || [];
    const messageIndex = messages.findIndex(m => m.id === messageId);
    
    if (messageIndex !== -1) {
      messages[messageIndex] = { ...messages[messageIndex], ...updates };
      conversations.set(conversationId, messages);
      this.conversationsSubject.next(conversations);
    }
  }

  clearConversation(conversationId: string): void {
    const conversations = this.conversationsSubject.value;
    conversations.set(conversationId, []);
    this.conversationsSubject.next(conversations);
  }

  // Selected Conversation Management
  setSelectedConversation(conversationId: string): void {
    this.selectedConversationSubject.next(conversationId);
  }

  getSelectedConversation(): string {
    return this.selectedConversationSubject.value;
  }

  // Selected User Management
  setSelectedUser(user: User | null): void {
    this.selectedUserSubject.next(user);
  }

  getSelectedUser(): User | null {
    return this.selectedUserSubject.value;
  }

  // Typing Indicators
  addTypingUser(userName: string): void {
    const typingUsers = this.typingUsersSubject.value;
    typingUsers.add(userName);
    this.typingUsersSubject.next(typingUsers);
  }

  removeTypingUser(userName: string): void {
    const typingUsers = this.typingUsersSubject.value;
    typingUsers.delete(userName);
    this.typingUsersSubject.next(typingUsers);
  }

  clearTypingUsers(): void {
    this.typingUsersSubject.next(new Set());
  }

  // Utility Methods
  getCurrentMessages(): ChatMessage[] {
    const conversationId = this.getSelectedConversation();
    return this.getConversation(conversationId);
  }

  isMessageFromCurrentUser(message: ChatMessage, currentUser: User): boolean {
    const messageSenderId = message.sender?.id;
    const currentUserId = currentUser.id || currentUser._id;
    return messageSenderId === currentUserId;
  }

  // Cleanup
  reset(): void {
    this.conversationsSubject.next(new Map());
    this.selectedConversationSubject.next('');
    this.selectedUserSubject.next(null);
    this.typingUsersSubject.next(new Set());
  }
} 