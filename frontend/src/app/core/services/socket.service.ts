import { Injectable, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
import { io, Socket } from 'socket.io-client';

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

export interface TypingEvent {
  conversationId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
}

export interface UserStatusEvent {
  userId: string;
  isOnline: boolean;
  lastSeen: Date;
}

@Injectable({
  providedIn: 'root'
})
export class SocketService implements OnDestroy {
  // Blue tick (read receipt) support
  private messagesReadSubject = new Subject<{ conversationId: string; readerId: string }>();
  public messagesRead$ = this.messagesReadSubject.asObservable();
  private static instanceCount = 0;
  private instanceId: number;
  private socket: Socket | null = null;
  private isConnected = false;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private reconnectTimer: any = null;
  private connectionCheckTimer: any = null;
  private heartbeatTimer: any = null;

  private messageSubject = new Subject<Message>();
  private typingSubject = new Subject<TypingEvent>();
  private userStatusSubject = new Subject<UserStatusEvent>();
  private connectionStatusSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new Subject<string>();
  private messageSentSubject = new Subject<any>();
  private messageErrorSubject = new Subject<any>();
  private connectionRequestResponseSubject = new Subject<any>();
  private connectionStatusUpdateSubject = new Subject<any>();
  private connectionRequestReceivedSubject = new Subject<any>();
  private connectionRequestSentSubject = new Subject<any>();
  private connectionRequestAcceptedSubject = new Subject<any>();
  private sessionUpdatedSubject = new Subject<any>();
  private sessionDeletedSubject = new Subject<any>();
  private meetingStatusUpdatedSubject = new Subject<any>();
  
  // Track recent messages to prevent duplicates
  private recentMessages = new Set<string>();
  private readonly MESSAGE_DEDUP_WINDOW = 5000; // 5 seconds

  public message$ = this.messageSubject.asObservable();
  public typing$ = this.typingSubject.asObservable();
  public userStatus$ = this.userStatusSubject.asObservable();
  public connectionStatus$ = this.connectionStatusSubject.asObservable();
  public error$ = this.errorSubject.asObservable();
  public messageSent$ = this.messageSentSubject.asObservable();
  public messageError$ = this.messageErrorSubject.asObservable();
  public connectionRequestResponse$ = this.connectionRequestResponseSubject.asObservable();
  public connectionStatusUpdate$ = this.connectionStatusUpdateSubject.asObservable();
  public connectionRequestReceived$ = this.connectionRequestReceivedSubject.asObservable();
  public connectionRequestSent$ = this.connectionRequestSentSubject.asObservable();
  public connectionRequestAccepted$ = this.connectionRequestAcceptedSubject.asObservable();
  public sessionUpdated$ = this.sessionUpdatedSubject.asObservable();
  public sessionDeleted$ = this.sessionDeletedSubject.asObservable();
  public meetingStatusUpdated$ = this.meetingStatusUpdatedSubject.asObservable();

  constructor(private authService: AuthService) {
    SocketService.instanceCount++;
    this.instanceId = SocketService.instanceCount;
    
    // Only subscribe to user changes once
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.connect();
      } else {
        this.disconnect();
      }
    });
  }

  connect(): void {
    // Prevent duplicate connections
    if (this.socket && this.isConnected) {
      return;
    }
    
    if (this.isConnecting) {
      return;
    }
    
    // If there's an existing socket but not connected, clean it up
    if (this.socket && !this.isConnected) {
      this.socket.removeAllListeners();
      this.socket.close();
      this.socket = null;
    }
    
    let token = localStorage.getItem('accessToken');
    if (!token) {
      token = localStorage.getItem('token');
    }
    
    if (!token) {
      console.error('No authentication token found for socket connection');
      return;
    }

    this.isConnecting = true;

    try {
      const socketUrl = environment.apiUrl.replace('/api', '');
      
      this.socket = io(socketUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true,
        reconnection: false, // We'll handle reconnection manually
        reconnectionAttempts: 0,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000
      });
      this.socket.on('connect', () => {
        const user = this.authService.getCurrentUserValue ? this.authService.getCurrentUserValue() : null;
        const userId = user && (user._id || user.id) ? (user._id || user.id) : 'unknown';
        const socketId = this.socket && this.socket.id ? this.socket.id : 'unknown';
        console.log('[SocketService] Connected. Socket ID:', socketId, 'User ID:', userId);
      });
      
      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to create socket connection:', error);
      this.errorSubject.next('Socket connection failed');
      this.isConnecting = false;
    }
  }

  disconnect(): void {
    // Clear any pending timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.connectionCheckTimer) {
      clearInterval(this.connectionCheckTimer);
      this.connectionCheckTimer = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.connectionStatusSubject.next(false);
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) {
      console.log('❌ SocketService: No socket available for event listeners');
      return;
    }
    console.log('🔌 SocketService: Setting up event listeners...');
    this.socket.removeAllListeners();
    this.socket.on('connect', () => {
      this.isConnected = true;
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.connectionStatusSubject.next(true);
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.startConnectionHealthCheck();
      this.startHeartbeat();
    });
    this.socket.on('disconnect', (reason: string) => {
      this.isConnected = false;
      this.isConnecting = false;
      this.connectionStatusSubject.next(false);
      if (this.connectionCheckTimer) {
        clearInterval(this.connectionCheckTimer);
        this.connectionCheckTimer = null;
      }
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }
      this.reconnect();
    });
    this.socket.on('connect_error', (error: any) => {
      console.error('Connection error:', error);
      this.isConnecting = false;
      this.errorSubject.next('Connection failed');
      if (this.reconnectAttempts < this.maxReconnectAttempts) this.reconnect();
    });
    this.socket.on('new_message', (data: { message: Message }) => {
      const messageKey = `${data.message.id}_${data.message.conversationId}`;
      if (this.recentMessages.has(messageKey)) return;
      this.recentMessages.add(messageKey);
      setTimeout(() => {
        this.recentMessages.delete(messageKey);
      }, this.MESSAGE_DEDUP_WINDOW);
      this.messageSubject.next(data.message);
    });
    this.socket.on('user_typing', (data: TypingEvent) => {
      this.typingSubject.next(data);
    });
    this.socket.on('user_online', (data: UserStatusEvent) => {
      this.userStatusSubject.next(data);
    });
    this.socket.on('user_offline', (data: UserStatusEvent) => {
      this.userStatusSubject.next(data);
    });
    this.socket.on('message_sent', (data: any) => {
      this.messageSentSubject.next(data);
    });
    this.socket.on('message_error', (data: any) => {
      this.messageErrorSubject.next(data);
    });
    this.socket.on('connection_request_response', (data: any) => {
      this.connectionRequestResponseSubject.next(data);
    });
    this.socket.on('connection_status_update', (data: any) => {
      this.connectionStatusUpdateSubject.next(data);
    });
    this.socket.on('connection_request_received', (data: any) => {
      this.connectionRequestReceivedSubject.next(data);
    });
    this.socket.on('connection_request_sent', (data: any) => {
      this.connectionRequestSentSubject.next(data);
    });
    this.socket.on('connection_request_accepted', (data: any) => {
      this.connectionRequestAcceptedSubject.next(data);
    });
    this.socket.on('session_updated', (data: any) => {
      console.log('🔄 Session updated event received:', data);
      this.sessionUpdatedSubject.next(data);
    });
    this.socket.on('session_deleted', (data: any) => {
      console.log('🗑️ Session deleted event received:', data);
      this.sessionDeletedSubject.next(data);
    });
    this.socket.on('meeting_status_updated', (data: any) => {
      console.log('🎯 Meeting status updated event received:', data);
      this.meetingStatusUpdatedSubject.next(data);
    });
    this.socket.on('test_message_response', (data: any) => {
      console.log('🔌 Test message response received:', data);
    });
    // Blue tick (read receipt) event
    this.socket.on('messages_read', (data: { conversationId: string; readerId: string }) => {
      console.log('[BlueTick][SocketService] messages_read event received:', data);
      const result = this.messagesReadSubject.next(data);
      console.log('[BlueTick][SocketService] messagesReadSubject.next called, result:', result);
      // Emit a custom event for debugging
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('BlueTickMessagesRead', { detail: data }));
      }
    });
    console.log('🔌 SocketService: Event listeners setup complete');
  }

  emitMessageRead(conversationId: string, readerId: string) {
    if (this.socket && this.socket.connected) {
      console.log('[BlueTick][SocketService] Emitting message_read:', { conversationId, readerId });
      this.socket.emit('message_read', { conversationId, readerId });
    }
  }
    

  private reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    this.reconnectTimer = setTimeout(() => {
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.connect();
    }, delay);
  }

  private startConnectionHealthCheck(): void {
    if (this.connectionCheckTimer) {
      clearInterval(this.connectionCheckTimer);
    }
    
    this.connectionCheckTimer = setInterval(() => {
      if (this.socket && !this.socket.connected) {
        console.log('🔌 Socket connection lost, attempting reconnect');
        this.reconnect();
      } else if (this.socket && this.socket.connected) {
        console.log('🔌 Socket connection healthy');
      }
    }, 5000); // Check every 5 seconds (reduced from 10 seconds)
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    
    // Send heartbeat every 15 seconds to keep connection alive
    this.heartbeatTimer = setInterval(() => {
      if (this.socket && this.socket.connected) {
        this.socket.emit('heartbeat');
      } else {
        this.reconnect();
      }
    }, 15000); // 15 seconds
  }

  joinConversation(conversationId: string, otherUserId: string): void {
    if (this.socket && this.socket.connected) {
      console.log('🔌 SocketService: Joining conversation:', conversationId, 'with user:', otherUserId);
      this.socket.emit('join_conversation', { conversationId, otherUserId });
      console.log('🔌 SocketService: join_conversation event emitted');
    } else {
      console.error('🔌 SocketService: Cannot join conversation - socket not connected');
    }
  }

  sendMessage(conversationId: string, content: string, messageType: string = 'text', attachments: any[] = []): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('send_message', { conversationId, content, messageType, attachments });
    }
  }

  sendTypingIndicator(conversationId: string, isTyping: boolean): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('typing', { conversationId, isTyping });
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected && this.socket ? (this.socket.connected || false) : false;
  }

  forceReconnect(): void {
    this.reconnectAttempts = 0;
    this.disconnect();
    setTimeout(() => {
      this.connect();
    }, 1000);
  }

  // Force a status update by sending a heartbeat
  forceStatusUpdate(): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('heartbeat');
    } else {
      this.connect();
    }
  }

  getConnectionInfo(): any {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      socketId: this.socket?.id,
      instanceId: this.instanceId
    };
  }



  ngOnDestroy(): void {
    this.disconnect();
  }
} 