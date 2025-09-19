import { Injectable } from '@angular/core';
import { SocketService } from './socket.service';
import { Observable, of, catchError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SocketWrapperService {
  
  constructor(private socketService: SocketService) {}
  
  // Wrap all socket operations with error handling
  getConnectionStatus(): boolean {
    try {
      return this.socketService.getConnectionStatus();
    } catch (error) {
      console.warn('🔌 Socket status check failed:', error);
      return false;
    }
  }
  
  connect(): void {
    try {
      this.socketService.connect();
    } catch (error) {
      console.warn('🔌 Socket connect failed:', error);
    }
  }
  
  disconnect(): void {
    try {
      this.socketService.disconnect();
    } catch (error) {
      console.warn('🔌 Socket disconnect failed:', error);
    }
  }
  
  // Wrap observables with error handling
  getConnectionStatus$(): Observable<boolean> {
    try {
      return this.socketService.connectionStatus$.pipe(
        catchError(error => {
          console.warn('🔌 Socket status observable failed:', error);
          return of(false);
        })
      );
    } catch (error) {
      console.warn('🔌 Socket status observable setup failed:', error);
      return of(false);
    }
  }
  
  getMessage$(): Observable<any> {
    try {
      return this.socketService.message$.pipe(
        catchError(error => {
          console.warn('🔌 Socket message observable failed:', error);
          return of(null);
        })
      );
    } catch (error) {
      console.warn('🔌 Socket message observable setup failed:', error);
      return of(null);
    }
  }
  
  // Add other wrapped methods as needed
  joinConversation(conversationId: string, otherUserId: string): void {
    try {
      this.socketService.joinConversation(conversationId, otherUserId);
    } catch (error) {
      console.warn('🔌 Join conversation failed:', error);
    }
  }
  
  sendMessage(conversationId: string, content: string, messageType: string = 'text', attachments: any[] = []): void {
    try {
      this.socketService.sendMessage(conversationId, content, messageType, attachments);
    } catch (error) {
      console.warn('🔌 Send message failed:', error);
    }
  }
} 