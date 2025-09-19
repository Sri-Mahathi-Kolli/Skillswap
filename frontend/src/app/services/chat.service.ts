import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Message {
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
}

export interface Conversation {
  id: string;
  participants: string[];
  lastMessage?: Message;
  unreadCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  /**
   * Create a new conversation with given participants
   */
  createConversation(participants: string[]): Observable<Conversation> {
    return this.http.post<Conversation>(`${this.apiUrl}/chat/conversations`, { participants });
  }
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getConversations(): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(`${this.apiUrl}/chat/conversations`);
  }

  getMessages(conversationId: string): Observable<Message[]> {
    return this.http.get<Message[]>(`${this.apiUrl}/chat/messages/${conversationId}`);
  }

  sendMessage(conversationId: string, content: string, messageType: string = 'text', clientMessageId?: string, attachments?: any[]): Observable<Message> {
    return this.http.post<Message>(`${this.apiUrl}/chat/messages`, {
      conversationId,
      content,
      messageType,
      clientMessageId,
      attachments
    });
  }

  markAsRead(conversationId: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/chat/conversations/${conversationId}/read`, {});
  }

  clearConversation(conversationId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/chat/conversations/${conversationId}`);
  }

  clearConversationForAll(conversationId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/chat/conversations/${conversationId}?clearForAll=true`);
  }
} 