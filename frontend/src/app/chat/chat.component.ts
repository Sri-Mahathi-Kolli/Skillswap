// ...existing code...

// Place this method inside the ChatComponent class:

  // Show notification if message is from another user and not in the open chat
import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ChatService } from '../services/chat.service';
import { SocketService } from '../core/services/socket.service';
import { AuthService, User } from '../core/services/auth.service';
import { ChatStateService, ChatMessage } from '../services/chat-state.service';
import { FileUploadService, FileUploadResponse } from '../services/file-upload.service';
import { ConnectionService, Connection } from '../services/connection.service';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { getPhotoUrl, onImgError } from '../utils/image-utils';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class ChatComponent implements OnInit, OnDestroy {
  // Helper to find connection object for a given userId
  private routeUserId: string | null = null;
  private getConnectionWithUser(userId: string): any {
    if (!this.currentUser || !(this as any).connections) return null;
    return (this as any).connections.find((conn: any) => {
      if (!conn || !conn.requester || !conn.recipient) return false;
      const currentUserId = this.currentUser?.id ?? this.currentUser?._id;
      const requesterId = conn.requester?._id;
      const recipientId = conn.recipient?._id;
      const otherUserId = requesterId === currentUserId ? recipientId : requesterId;
      return otherUserId === userId;
    });
  }
  // --- Blue tick (read receipt) logic ---
  private markMessagesAsRead(conversationId: string) {
    if (!this.currentUser || !conversationId) return;
    const userId = this.currentUser.id || this.currentUser._id || '';
    if (!userId) return;
    // Find unread messages not sent by current user
    const messages = this.conversations.get(conversationId) || [];
    const unread = messages.filter(m => !m.isRead && !this.isMessageFromCurrentUser(m));
    if (unread.length > 0) {
      console.log('[BlueTick][ChatComponent] markMessagesAsRead: emitting message_read for', conversationId, userId);
      // Emit read event via socket
      this.socketService.emitMessageRead(conversationId, userId);
      // Optionally update UI immediately
      unread.forEach(m => (m.isRead = true));
      this.cdr.detectChanges();
    }
  }

  private handleMessagesRead(data: { conversationId: string; readerId: string }) {
    console.log('[BlueTick] handleMessagesRead event received:', data);
    // Mark all messages in this conversation as read if they were sent to the reader
    const messages = this.conversations.get(data.conversationId) || [];
    let updated = false;
    messages.forEach(m => {
      let senderId = '';
      if (typeof m.sender === 'object' && m.sender !== null) {
        senderId = m.sender.id || '';
      } else if (typeof m.sender === 'string') {
        senderId = m.sender;
      }
      const senderName = (typeof m.sender === 'object' && m.sender !== null && m.sender.name) ? m.sender.name : (typeof m.sender === 'string' ? m.sender : '');
      const currentUserId = this.currentUser?.id || this.currentUser?._id || '';
      const currentUserName = this.currentUser?.name || '';
      console.log('[BlueTick][Debug] Checking message:', { m, senderId, senderName, readerId: data.readerId, currentUserId, currentUserName });
      if ((senderId !== data.readerId && senderId !== currentUserId && senderName !== data.readerId && senderName !== currentUserName) && !m.isRead) {
        console.log('[BlueTick][Debug] Marking as read:', { messageId: m.id, senderId, senderName, readerId: data.readerId, currentUserId, currentUserName });
        m.isRead = true;
        updated = true;
      }
    });
    if (updated) {
      console.log('[BlueTick] Updating messages as read for conversation:', data.conversationId);
      // Replace the array and the Map reference to force Angular change detection
      const newMessages = [...messages];
      const newConversations = new Map(this.conversations);
      newConversations.set(data.conversationId, newMessages);
      this.conversations = newConversations;
      this.cdr.detectChanges();
      // Debug: print updated messages for this conversation
      console.log('[BlueTick] Messages after update:', [...newMessages]);
    }
  }
  // Show notification if message is from another user and not in the open chat
  private handleNewMessageNotification(message: any) {
    console.log('[Notification] handleNewMessageNotification called', message);
    // [BlueTick] markMessagesAsRead called for', conversationId, this.currentUser
    // [BlueTick] handleMessagesRead event received', data
    const senderId = message.sender?.id || message.sender?._id;
    const isFromOtherUser = this.currentUser && senderId !== (this.currentUser.id || this.currentUser._id);
    if (isFromOtherUser) {
      // Browser notification
      if (window.Notification) {
        if (Notification.permission === 'granted') {
          new Notification(`${message.sender?.name || 'New message'}`, {
            body: message.content || 'You have a new message',
            icon: message.sender?.photo || 'default-avatar.png'
          });
        } else if (Notification.permission === 'default') {
          Notification.requestPermission();
        }
      }
      // Play sound
      this.notificationAudio.currentTime = 0;
      this.notificationAudio.play().catch(() => {});
    }
  }
  private readonly NOTIFICATION_SOUND_URL = 'https://notificationsounds.com/storage/sounds/file-sounds-1152-pristine.mp3';
  private notificationAudio: HTMLAudioElement;
  @ViewChild('messagesContainer', { static: false }) messagesContainer!: ElementRef;

  // User management
  currentUser: User | null = null;
  users: User[] = [];
  selectedUser: User | null = null;
  connectionStatus: string | null = null;
  
  // User priority tracking
  userLastActivity: Map<string, Date> = new Map();
  private readonly ACTIVITY_STORAGE_KEY = 'chat_user_activity';
  
  // Chat management
  conversations: Map<string, ChatMessage[]> = new Map();
  selectedConversationId: string = '';
  // ...existing code...
  isLoadingConversation: boolean = false;
  loadingConversations: Set<string> = new Set();
  
  // Message handling
  newMessage = '';
  searchTerm = '';
  filteredUsers: User[] = [];
  isLoading = false;
  errorMessage = '';
  
  // Debounced search
  private searchSubject = new Subject<string>();
  
  // UI state
  showUserList = true;
  isTyping = false;
  typingUsers: Set<string> = new Set();
  
  // File handling
  selectedFiles: File[] = [];
  
  // Clear messages dialog
  showClearDialog = false;
  isClearingMessages = false;
  
  // Manage mode properties
  isManageMode = false;
  selectedUsersForRemoval = new Set<string>();
  manageSearchTerm = '';
  
  // New conversation tracking
  newConversations: Set<string> = new Set();
  
  // Subscriptions
  private subscriptions: any[] = [];
  private isInitialized = false;
  
  // NUCLEAR DEDUPLICATION: Track all processed messages globally
  private static processedMessages = new Set<string>();
  private static messageProcessingQueue = new Set<string>();
  public isSendingMessage = false;
  
  // Status refresh timer
  private statusRefreshTimer: any = null;

  // State persistence keys
  private readonly SELECTED_USER_KEY = 'chat_selected_user';
  private readonly SELECTED_CONVERSATION_KEY = 'chat_selected_conversation';
  private readonly CONVERSATIONS_KEY = 'chat_conversations';
  private readonly USER_LIST_KEY = 'chat_user_list';

  constructor(
    private route: ActivatedRoute,
    private chatService: ChatService,
    public socketService: SocketService,
    private authService: AuthService,
    private fileUploadService: FileUploadService,
    private connectionService: ConnectionService,
    private cdr: ChangeDetectorRef
  ) {
    this.notificationAudio = new Audio(this.NOTIFICATION_SOUND_URL);
  }

  ngOnInit() {
    // Request notification permission on load
    if (window.Notification) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
    console.log('🚀 ChatComponent ngOnInit started');
    console.log('🔌 Socket connection status:', this.socketService.getConnectionStatus());
    console.log('🔌 Socket connection info:', this.socketService.getConnectionInfo());
    
    this.setupDebouncedSearch();
    this.setupPageVisibilityListener();
    this.loadCurrentUser();
    
    // Connect to socket service
    console.log('🔌 Connecting to socket service...');
    this.socketService.connect();
    
    console.log('👤 Loading current user...');
    
    // Subscribe to user changes
    this.subscriptions.push(
      this.authService.currentUser$.subscribe(user => {
        console.log('👤 Current user subscription received:', user);
        if (user && !this.isInitialized) {
          this.currentUser = user;
          this.initializeChat();
        }
      })
    );

    this.route.paramMap.subscribe(params => {
      const userId = params.get('userId');
      if (userId) {
        const trySelectUser = () => {
          let user = this.users.find(u => u.id === userId || u._id === userId);
          if (!user) {
            // If user not found, fetch real user data from backend
            this.authService.getUserById(userId).subscribe({
              next: (realUser) => {
                if (realUser) {
                  // Always restore user to sidebar when navigating from Skills page
                  const removedKey = 'removed_user_ids';
                  let removedUserIds: string[] = [];
                  const existingRemoved = localStorage.getItem(removedKey);
                  if (existingRemoved) {
                    try {
                      removedUserIds = JSON.parse(existingRemoved);
                    } catch {}
                  }
                  removedUserIds = removedUserIds.filter(id => id !== userId);
                  localStorage.setItem(removedKey, JSON.stringify(removedUserIds));
                  const alreadyExists = this.users.some(u => u.id === realUser.id || u._id === realUser._id);
                  if (!alreadyExists) {
                    this.users.push(realUser);
                  }
                  this.filteredUsers = [...this.users];
                  user = realUser;
                  this.selectUser(user);
                  console.log('Fetched and selected real user for chat:', user);
                } else {
                  // Fallback to default if backend returns nothing
                  const tempUser: User = {
                    id: userId,
                    _id: userId,
                    name: 'Unknown User',
                    email: 'unknown@skillswap.com',
                    photo: 'default-avatar.png',
                    isOnline: false,
                    lastSeen: undefined,
                    connectionCount: 0,
                    connectionStatus: 'none',
                    bio: '',
                    skills: [],
                    location: '',
                    phone: '',
                  };
                  const alreadyExists = this.users.some(u => u.id === tempUser.id || u._id === tempUser._id);
                  if (!alreadyExists) {
                    this.users.push(tempUser);
                  }
                  this.filteredUsers = [...this.users];
                  user = tempUser;
                  this.selectUser(user);
                  console.log('Fallback: selected temp user for chat:', user);
                }
              },
              error: (err) => {
                this.errorMessage = 'Unable to fetch user data.';
                console.error('Chat error:', err);
                alert('Unable to start chat with this user. Please check connection status or contact support.');
              }
            }); // <-- Correctly close the subscribe callback here
            return;
          }
          if (user) {
            try {
              this.selectUser(user);
              console.log('Attempting to start chat with user:', user);
            } catch (err) {
              this.errorMessage = 'Unable to start chat with this user.';
              console.error('Chat error:', err);
              alert('Unable to start chat with this user. Please check connection status or contact support.');
            }
          }
        };
        trySelectUser();
      }
    }); // <-- Correctly close the route.paramMap.subscribe callback
  }

  private setupDebouncedSearch() {
    this.subscriptions.push(
      this.searchSubject.pipe(
        debounceTime(300),
        distinctUntilChanged()
      ).subscribe(searchTerm => {
        this.performSearch(searchTerm);
      })
    );
  }

  private setupPageVisibilityListener() {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Force a status update when page becomes visible
        this.socketService.forceStatusUpdate();
        // Also refresh user status
        this.fetchInitialUserStatus();
      }
    };

    const handleBeforeUnload = () => {
      // Clean up any pending operations
    };

    const handleFocus = () => {
      // Check if socket is still connected and force update if needed
      if (!this.socketService.getConnectionStatus()) {
        this.socketService.forceReconnect();
      } else {
        this.socketService.forceStatusUpdate();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('focus', handleFocus);

    // Cleanup listeners on destroy
    this.subscriptions.push({
      unsubscribe: () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('focus', handleFocus);
      }
    });
  }

  private loadCurrentUser() {
    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        this.currentUser = user;
        if (user && !this.isInitialized) {
          this.initializeChat();
        }
      },
      error: (error) => {
        console.error('Error loading current user:', error);
      }
    });
  }

  private initializeChat() {
    if (this.isInitialized) return;
    
    console.log('🎯 Initializing chat...');
    this.isInitialized = true;
    
    // Socket is already connected in ngOnInit, just setup listeners
    this.setupSocketListeners();
    console.log('👥 Loading users...');
    this.loadUsers();
    this.startStatusRefresh();
    
    // Restore saved state if available
    this.restoreChatState();
  }

  private setupSocketListeners() {
    // Clear any existing subscriptions first
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
    console.log('[Socket] Setting up messagesRead$ subscription');
    // Listen for messages_read (blue tick) events
    this.subscriptions.push(
      this.socketService.messagesRead$.subscribe(data => {
        console.log('[BlueTick][ChatComponent] messagesRead$ subscription fired:', data);
        this.handleMessagesRead(data);
      })
    );
    // Fallback: Listen for global BlueTickMessagesRead event in case Angular observable fails
    if (typeof window !== 'undefined') {
      window.addEventListener('BlueTickMessagesRead', (event: any) => {
        console.log('[BlueTick][ChatComponent] Fallback global BlueTickMessagesRead event received:', event.detail);
        this.handleMessagesRead(event.detail);
      });
    }
    console.log('🔌 Setting up socket listeners...');
    // Listen for new messages
    this.subscriptions.push(
      this.socketService.message$.subscribe(message => {
        this.handleNewMessage(message);
        this.handleNewMessageNotification(message);
      })
    );
    
    // Listen for message sent confirmations
    this.subscriptions.push(
      this.socketService.messageSent$.subscribe(confirmation => {
        this.handleMessageSent(confirmation);
      })
    );
    
    // Listen for message errors
    this.subscriptions.push(
      this.socketService.messageError$.subscribe(error => {
        this.handleMessageError(error);
      })
    );
    
    // Listen for typing events
    this.subscriptions.push(
      this.socketService.typing$.subscribe(typingEvent => {
        this.handleTypingEvent(typingEvent);
      })
    );
    
    // Listen for user status updates
    this.subscriptions.push(
      this.socketService.userStatus$.subscribe(status => {
        this.updateUserStatus(status);
      })
    );
    
    // Listen for connection status updates
    this.subscriptions.push(
      this.socketService.connectionStatusUpdate$.subscribe(update => {
        this.handleConnectionStatusUpdate(update);
      })
    );
    
    // Listen for new connection requests/acceptions
    this.subscriptions.push(
      this.socketService.connectionRequestAccepted$.subscribe(accepted => {
        this.handleNewConnection(accepted);
      })
    );
    
    // Listen for socket connection status changes
    this.subscriptions.push(
      this.socketService.connectionStatus$.subscribe(isConnected => {
        if (isConnected && !this.isInitialized) {
          console.log('🔌 Socket connected, initializing chat...');
          this.initializeChat();
        }
      })
    );
    
    console.log('🔌 Socket listeners setup complete');
  }

  private loadUsers() {
    this.isLoading = true;
    console.log('👥 Loading users for current user:', this.currentUser?.id || this.currentUser?._id);
    this.connectionService.getUserConnections(this.currentUser?.id || this.currentUser?._id || '').subscribe({
      next: (response) => {
        console.log('🔗 Raw connection response:', response);
        if (response.success && response.data) {
          const connections = response.data.connections || response.data || [];
          console.log('🔗 All connections:', connections.length);
          // Extract users from all connections (not just accepted)
          const userMap = new Map();
          connections.forEach((conn: any, index: number) => {
            const currentUserId = this.currentUser?.id || this.currentUser?._id;
            const otherUser = conn.requester._id === currentUserId 
              ? conn.recipient 
              : conn.requester;
            const userId = otherUser._id;
            if (!userMap.has(userId)) {
              userMap.set(userId, {
                ...otherUser,
                id: otherUser._id,
                connectionStatus: conn.status,
                connectionCount: connections.length
              });
            }
          });
          // Filter out removed users
          let removedUserIds: string[] = [];
          const removedKey = 'removed_user_ids';
          const existingRemoved = localStorage.getItem(removedKey);
          if (existingRemoved) {
            try {
              removedUserIds = JSON.parse(existingRemoved);
            } catch {}
          }
          // Convert map values to array and filter out current user and removed users
          const currentUserId = (this.currentUser?.id || this.currentUser?._id)?.toString();
          this.users = Array.from(userMap.values()).filter(user => {
            const uid = (user.id || user._id)?.toString();
            return uid && uid !== currentUserId && !isUserRemoved(uid);
          });
          // Restore users from localStorage if present, but skip removed users
          const storedUsers = localStorage.getItem(this.USER_LIST_KEY);
          let storedOrderIds: string[] | null = null;
          if (storedUsers) {
            try {
              const parsedUsers = JSON.parse(storedUsers);
              storedOrderIds = parsedUsers.map((u: any) => u.id || u._id);
              parsedUsers.forEach((u: any) => {
                const userId = u.id || u._id;
                if (!this.users.some(user => user.id === userId || user._id === userId) && !isUserRemoved(userId)) {
                  this.users.push(u);
                }
              });
              console.log('Restored users from localStorage:', parsedUsers);
            } catch (e) {
              console.error('Failed to parse stored users:', e);
            }
          }
          // After all users are loaded, sort them to match localStorage order if available
          if (storedOrderIds && storedOrderIds.length) {
            const idSet = new Set(storedOrderIds);
            const ordered = storedOrderIds
              .map(id => this.users.find(u => (u.id === id || u._id === id)))
              .filter(u => !!u);
            const rest = this.users.filter(u => {
              const uid = u.id;
              const uuid = u._id;
              return !(uid && idSet.has(uid)) && !(uuid && idSet.has(uuid));
            });
            this.users = [...ordered, ...rest];
          }
          // Ensure selectedUser is always present in users list
          if (this.selectedUser) {
            const userId = this.selectedUser.id || this.selectedUser._id;
            const alreadyExists = this.users.some(u => u.id === userId || u._id === userId);
            if (!alreadyExists) {
              this.users.unshift(this.selectedUser);
              console.log('Added selectedUser to users after load:', this.selectedUser);
            }
          }
          // Deduplicate users by id/_id after all additions
          const seen = new Set();
          this.users = this.users.filter(u => {
            const uid = u.id || u._id;
            if (seen.has(uid)) return false;
            seen.add(uid);
            return true;
          });
          this.filteredUsers = [...this.users];
          this.isLoading = false;
          this.restoreSelectedUser();
          this.fetchInitialUserStatus();
          this.cdr.detectChanges();
          // --- Patch: select user from route param after users load ---
          if (this.routeUserId) {
            const user = this.users.find(u => u.id === this.routeUserId || u._id === this.routeUserId);
            if (user) {
              this.selectUser(user);
            }
          }
        }
      },
      error: (error) => {
        console.error('❌ Error loading users:', error);
        this.isLoading = false;
        this.errorMessage = 'Failed to load users. Please try again.';
      }
    });
  }

  private fetchInitialUserStatus() {
    if (this.users.length === 0) return;
    
    // Get user IDs
    const userIds = this.users.map(user => user.id || user._id).filter((id): id is string => Boolean(id));
    
    if (userIds.length === 0) return;
    
    // Fetch user status from backend
    this.authService.getUsersOnlineStatus(userIds).subscribe({
      next: (userStatuses) => {
        // Check if userStatuses is valid before processing
        if (!userStatuses || !Array.isArray(userStatuses)) {
          console.warn('Invalid user statuses received:', userStatuses);
          return;
        }
        
        // Update user status
        userStatuses.forEach(status => {
          const user = this.users.find(u => 
            (u.id === status.userId || u._id === status.userId)
          );
          
          if (user) {
            user.isOnline = status.isOnline;
            user.lastSeen = status.lastSeen;
          }
        });
        
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error fetching user status:', error);
      }
    });
  }

  private updateUserStatus(status: any) {
    const user = this.users.find(u => 
      u.id === status.userId || u._id === status.userId
    );
    
    if (user) {
      const wasOnline = user.isOnline;
      user.isOnline = status.isOnline;
      user.lastSeen = status.lastSeen;
      
      // Also update selectedUser if it's the same user
      if (this.selectedUser && 
          (this.selectedUser.id === status.userId || this.selectedUser._id === status.userId)) {
        this.selectedUser.isOnline = status.isOnline;
        this.selectedUser.lastSeen = status.lastSeen;
      }
      
      this.cdr.detectChanges();
    }
  }

  // Periodically refresh user online status for accuracy
  private startStatusRefresh() {
    // Clear any existing timer
    if (this.statusRefreshTimer) {
      clearInterval(this.statusRefreshTimer);
    }
    
    // Refresh user status every 30 seconds
    this.statusRefreshTimer = setInterval(() => {
      this.fetchInitialUserStatus();
    }, 30000);
    
    // Also refresh the full user list every 2 minutes to catch new connections
    setInterval(() => {
      this.loadUsers();
    }, 120000);
  }

  private syncSelectedUserStatus() {
    if (this.selectedUser) {
      const user = this.users.find(u => 
        u.id === this.selectedUser?.id || u._id === this.selectedUser?._id
      );
      
      if (user) {
        this.selectedUser.isOnline = user.isOnline;
        this.selectedUser.lastSeen = user.lastSeen;
      }
    }
  }

  // Manual refresh method for user list and status
  public manualRefresh(): void {
    this.socketService.forceStatusUpdate();
    this.fetchInitialUserStatus();
    this.loadUsers();
    this.cdr.detectChanges();
  }

  // Force refresh all user statuses
  public forceRefreshAllStatuses(): void {
    // Force socket status update
    this.socketService.forceStatusUpdate();
    
    // Fetch fresh user status from backend
    if (this.users.length > 0) {
      const userIds = this.users.map(user => user.id || user._id).filter((id): id is string => Boolean(id));
      
      if (userIds.length > 0) {
        this.authService.getUsersOnlineStatus(userIds).subscribe({
          next: (userStatuses) => {
            // Check if userStatuses is valid before processing
            if (!userStatuses || !Array.isArray(userStatuses)) {
              console.warn('Force refresh - Invalid user statuses received:', userStatuses);
              return;
            }
            
            // Update user status
            userStatuses.forEach(status => {
              const user = this.users.find(u => 
                (u.id === status.userId || u._id === status.userId)
              );
              
              if (user) {
                user.isOnline = status.isOnline;
                user.lastSeen = status.lastSeen;
              }
            });
            
            this.cdr.detectChanges();
          },
          error: (error) => {
            console.error('Error force refreshing user status:', error);
          }
        });
      }
    }
  }



  private handleNewMessage(message: any) {
    // Move user to top of sidebar when message received
    const sidebarSenderId = message.sender?.id || message.sender?._id;
    const sidebarReceiverId = message.receiver?.id || message.receiver?._id;
    let sidebarChatUserId = sidebarSenderId;
    // If current user is sender, move receiver; if current user is receiver, move sender
    const sidebarCurrentUserId = (this.currentUser?.id || this.currentUser?._id)?.toString();
    if (sidebarSenderId === sidebarCurrentUserId) {
      sidebarChatUserId = sidebarReceiverId;
    }
    if (sidebarChatUserId) {
      const idx = this.users.findIndex(u => u.id === sidebarChatUserId || u._id === sidebarChatUserId);
      if (idx > -1) {
        const userObj = this.users.splice(idx, 1)[0];
        this.users.unshift(userObj);
        // Deduplicate users by id/_id
        const seen = new Set();
        this.users = this.users.filter(u => {
          const uid = u.id || u._id;
          if (seen.has(uid)) return false;
          seen.add(uid);
          return true;
        });
        this.filteredUsers = [...this.users];
        try {
          localStorage.setItem(this.USER_LIST_KEY, JSON.stringify(this.users));
        } catch (e) {
          console.error('Failed to persist users:', e);
        }
      }
    }
    // Create a unique identifier for this message to prevent duplicates
    const messageId = message._id || message.id || `${message.sender?.id || message.sender?._id}_${message.timestamp}_${message.content}`;
    
    console.log('📨 Received new message via socket:', {
      messageId,
      conversationId: message.conversationId,
      sender: message.sender?.name,
      content: message.content,
      isCurrentConversation: this.selectedConversationId === message.conversationId
    });
    
    // Check if we've already processed this message recently (within last 5 seconds)
    const now = Date.now();
    const fiveSecondsAgo = now - 5000;
    
    if (ChatComponent.processedMessages.has(messageId)) {
      console.log('🚫 Skipping duplicate message (processed recently):', messageId);
      return;
    }
    
    // Add message to conversation
    const conversationId = message.conversationId;
    let messages = this.conversations.get(conversationId) || [];
    
    // Check if message already exists in the conversation
    const existingMessage = messages.find(m => {
      const mId = (m as any)._id || m.id;
      const messageIdToCheck = message._id || message.id;
      return mId === messageIdToCheck;
    });
    
    if (existingMessage) {
      console.log('🚫 Message already exists in conversation:', messageId);
      return;
    }
    
    // Mark message as processed
    ChatComponent.processedMessages.add(messageId);
    
    // Add message to conversation - create a new array to trigger change detection
    const updatedMessages = [...messages, message];
    this.conversations.set(conversationId, updatedMessages);
    
    console.log('✅ Message added to conversation. Total messages:', updatedMessages.length);
    
    // Check if this is a new conversation (from someone not in our users list)
    const senderId = message.sender?.id || message.sender?._id;
    const isNewConversation = !this.users.find(u => (u.id === senderId || u._id === senderId));
    
    if (isNewConversation && senderId) {
      // Prevent adding self to users list
      const currentUserId = (this.currentUser?.id || this.currentUser?._id)?.toString();
      if (senderId !== currentUserId) {
        console.log('🆕 New conversation detected from user:', message.sender?.name);
        // Add the sender to our users list if they're not already there
        const newUser = {
          id: senderId,
          _id: senderId,
          name: message.sender?.name || 'Unknown User',
          email: message.sender?.email || 'unknown@example.com',
          photo: message.sender?.photo,
          isOnline: message.sender?.isOnline || false,
          lastSeen: new Date(),
          connectionCount: 1,
          connectionStatus: 'accepted'
        };
        this.users.push(newUser);
        this.filteredUsers = [...this.users];
        // Mark this conversation as new
        this.newConversations.add(conversationId);
        console.log('👥 Added new user to list:', newUser.name);
      }
    }
    
    // Mark conversation as new if not currently selected
    if (this.selectedConversationId !== conversationId) {
      this.newConversations.add(conversationId);
      console.log('🔔 New message in conversation:', conversationId);
    }
    
    // Scroll to bottom if this is the current conversation
    if (this.selectedConversationId === conversationId) {
      this.scrollToBottom();
      // If the current user is the receiver, mark messages as read immediately
      const currentUserId = (this.currentUser?.id || this.currentUser?._id)?.toString();
      const receiverId = message.receiver?.id || message.receiver?._id || message.receiver;
      if (currentUserId && receiverId && currentUserId === receiverId) {
        this.markMessagesAsRead(conversationId);
      }
    }
    // Force change detection to update UI
    this.cdr.markForCheck();
    this.cdr.detectChanges();
    setTimeout(() => {
      this.cdr.detectChanges();
    }, 10);
  }

  private handleMessageSent(confirmation: any) {
    this.isSendingMessage = false;
  }

  private handleMessageError(error: any) {
    console.error('Message error:', error);
    this.isSendingMessage = false;
    this.errorMessage = 'Failed to send message. Please try again.';
  }

  private handleTypingEvent(typingEvent: any) {
    if (typingEvent.conversationId === this.selectedConversationId) {
      if (typingEvent.isTyping) {
        this.typingUsers.add(typingEvent.userName);
      } else {
        this.typingUsers.delete(typingEvent.userName);
      }
      this.cdr.detectChanges();
    }
  }

  private handleConnectionStatusUpdate(update: any) {
    console.log('🔗 Connection status update:', update);
    // Refresh user list when connection status changes
    this.loadUsers();
  }

  private handleNewConnection(accepted: any) {
    console.log('🔗 New connection accepted:', accepted);
    // Refresh user list when new connection is made
    this.loadUsers();
  }

  selectUser(user: any) {
    // Deduplicate users by id/_id to prevent sidebar glitches when clicking
    const seen = new Set();
    this.users = this.users.filter(u => {
      const uid = u.id || u._id;
      if (seen.has(uid)) return false;
      seen.add(uid);
      return true;
    });
    this.filteredUsers = [...this.users];
  // Debug: Print participant IDs and generated conversation ID
  const currentUserId = this.currentUser?.id || this.currentUser?._id;
  const otherUserId = user.id || user._id;
  console.log('[DEBUG][selectUser] Participants:', currentUserId, otherUserId);
  const debugSortedIds = [currentUserId, otherUserId].sort();
  const debugConversationId = `${debugSortedIds[0]}_${debugSortedIds[1]}`;
  console.log('[DEBUG][selectUser] Sorted IDs:', debugSortedIds, 'Generated conversationId:', debugConversationId);
    // Check if this is the same user already selected
    if (this.selectedUser && 
        (this.selectedUser.id === user.id || this.selectedUser._id === user._id) &&
        this.selectedConversationId === this.generateConversationId(user)) {
      console.log('🔄 Same user already selected, skipping');
      return;
    }

    // Clear error message and set loading indicator
    this.errorMessage = '';
    this.isLoadingConversation = true;

    console.log('👤 Selecting user:', user.name, 'User ID:', user.id || user._id);
    console.log('👤 Current user:', this.currentUser?.name, 'Current user ID:', this.currentUser?.id || this.currentUser?._id);

    // Always add user to left chat list if not present
    const userId = user.id || user._id;
    if (userId) {
      const alreadyExists = this.users.some(u => u.id === userId || u._id === userId);
      if (!alreadyExists) {
        this.users.push(user);
        console.log('Added selected user to chat list:', user);
      }
      this.clearNewConversationIndicator(userId);
    }
    this.selectedUser = user;

    // Generate conversation ID
    const conversationId = this.generateConversationId(user);
    this.selectedConversationId = conversationId;

    // Always restore user to sidebar when selected
    const removedKey = 'removed_user_ids';
    let removedUserIds: string[] = [];
    const existingRemoved = localStorage.getItem(removedKey);
    if (existingRemoved) {
      try {
        removedUserIds = JSON.parse(existingRemoved);
      } catch {}
    }
    if (userId && removedUserIds.includes(userId)) {
      removedUserIds = removedUserIds.filter(id => id !== userId);
      localStorage.setItem(removedKey, JSON.stringify(removedUserIds));
      console.log('User restored to sidebar from selectUser:', userId);
    }

    // Check if conversation exists in backend before loading messages
    this.chatService.getMessages(conversationId).subscribe({
      next: (messages) => {
        if (messages.length > 0) {
          this.conversations.set(conversationId, messages);
          this.newConversations.delete(conversationId);
          this.loadExistingMessages(conversationId);
          this.isLoadingConversation = false;
        } else {
          // No messages, try to create conversation in backend
          const currentUserId = this.currentUser?.id || this.currentUser?._id;
          const otherUserId = user.id || user._id;
          this.chatService.createConversation([currentUserId, otherUserId]).subscribe({
            next: (conv) => {
              this.selectedConversationId = conv.id;
              this.conversations.set(conv.id, []);
              this.newConversations.add(conv.id);
              this.loadExistingMessages(conv.id);
              this.isLoadingConversation = false;
            },
            error: (err) => {
              console.error('Failed to create conversation:', err);
              this.errorMessage = 'Unable to start chat. Please try again.';
              this.isLoadingConversation = false;
            }
          });
        }
      },
      error: (err) => {
        console.error('Error checking conversation:', err);
        this.errorMessage = 'Unable to load chat. Please try again.';
        this.isLoadingConversation = false;
      }
    });

    // Join conversation
    this.joinConversation();

    // Force multiple change detection cycles to ensure UI updates
    this.cdr.detectChanges();
    setTimeout(() => {
      this.cdr.detectChanges();
      console.log('🔍 Selected user after timeout:', this.selectedUser);
      this.getSendButtonState(); // Debug send button state
    }, 100);
    setTimeout(() => {
      this.cdr.detectChanges();
      this.getSendButtonState(); // Debug send button state again
    }, 200);
  }

  private generateConversationId(user: User): string {
    if (!this.currentUser) throw new Error('Current user not available');
    const userId1 = this.currentUser.id || this.currentUser._id || '';
    const userId2 = user.id || user._id || '';
    
    // Sort IDs to ensure consistent conversation ID
    const sortedIds = [userId1, userId2].sort();
    const conversationId = `${sortedIds[0]}_${sortedIds[1]}`;
    
    return conversationId;
  }

  private loadExistingMessages(conversationId: string) {
    // Prevent duplicate loading of the same conversation
    if (this.loadingConversations.has(conversationId)) {
      console.log('🔄 Already loading conversation:', conversationId);
      return;
    }
    
    console.log('📥 Loading messages for conversation:', conversationId);
    
    this.loadingConversations.add(conversationId);
    this.isLoading = true;
    
    this.chatService.getMessages(conversationId).subscribe({
      next: (messages) => {
        console.log('📨 Received messages:', messages.length, 'for conversation:', conversationId);
        
        if (messages.length > 0) {
          this.conversations.set(conversationId, messages);
          console.log('💾 Stored messages in conversation map');
        } else {
          // Start new conversation
          this.startNewConversation(conversationId);
          console.log('🆕 Started new conversation (no existing messages)');
        }
        
        this.loadingConversations.delete(conversationId);
        this.isLoading = false;
        // Mark messages as read (emit read receipt)
        setTimeout(() => {
          this.markMessagesAsRead(conversationId);
        }, 200);
        // Single change detection call is sufficient
        this.cdr.detectChanges();
        // Scroll to bottom after a brief delay to ensure DOM is updated
        setTimeout(() => {
          this.scrollToBottom();
        }, 50);
      },
      error: (error) => {
        console.error('❌ Error loading messages:', error);
        this.loadingConversations.delete(conversationId);
        this.isLoading = false;
        this.errorMessage = 'Failed to load messages. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }

  private startNewConversation(conversationId: string) {
  this.conversations.set(conversationId, []);
  this.newConversations.add(conversationId);
  }

  private joinConversation() {
    if (this.selectedUser && this.selectedConversationId) {
      const otherUserId = this.selectedUser.id || this.selectedUser._id;
      if (otherUserId) {
        console.log('🔌 Joining conversation:', this.selectedConversationId, 'with user:', otherUserId);
        console.log('🔌 Socket connection status:', this.socketService.getConnectionStatus());
        
        // Ensure socket is connected before joining
        if (this.socketService.getConnectionStatus()) {
          this.socketService.joinConversation(this.selectedConversationId, otherUserId);
          console.log('✅ Successfully joined conversation room');
        } else {
          console.log('⚠️ Socket not connected, attempting to connect...');
          this.socketService.connect();
          // Try to join after a short delay
          setTimeout(() => {
            if (this.socketService.getConnectionStatus()) {
              this.socketService.joinConversation(this.selectedConversationId, otherUserId);
              console.log('✅ Successfully joined conversation room after delay');
            } else {
              console.error('❌ Failed to connect socket for conversation join');
            }
          }, 1000);
        }
      }
    }
  }

  async sendMessage() {
    // Move selected user to top of sidebar when sending message
    if (this.selectedUser) {
      const userId = this.selectedUser.id || this.selectedUser._id;
      const idx = this.users.findIndex(u => u.id === userId || u._id === userId);
      if (idx > -1) {
        const userObj = this.users.splice(idx, 1)[0];
        this.users.unshift(userObj);
        // Deduplicate users by id/_id
        const seen = new Set();
        this.users = this.users.filter(u => {
          const uid = u.id || u._id;
          if (seen.has(uid)) return false;
          seen.add(uid);
          return true;
        });
        this.filteredUsers = [...this.users];
        try {
          localStorage.setItem(this.USER_LIST_KEY, JSON.stringify(this.users));
        } catch (e) {
          console.error('Failed to persist users:', e);
        }
      }
    }
    if ((!this.newMessage.trim() && this.selectedFiles.length === 0) || !this.selectedUser || !this.currentUser) {
      return;
    }
    // Prevent multiple simultaneous sends
    if (this.isSendingMessage) {
      return;
    }
    this.isSendingMessage = true;
    const messageContent = this.newMessage.trim();
    const conversationId = this.selectedConversationId;
    const filesToSend = [...this.selectedFiles];
    // Clear message input and files immediately for better UX
    this.newMessage = '';
    this.selectedFiles = [];
    this.cdr.detectChanges();

    try {
      if (filesToSend.length > 0) {
        // Upload all files and send as attachments
        const uploadPromises = filesToSend.map(file => this.fileUploadService.uploadFileSimple(file).toPromise());
        const uploadedFiles = (await Promise.all(uploadPromises)).filter((f): f is FileUploadResponse => !!f);
        const attachments = uploadedFiles.map(f => ({
          filename: f.filename,
          originalName: f.originalName,
          mimetype: f.mimetype,
          size: f.size,
          url: f.url
        }));
        this.chatService.sendMessage(conversationId, messageContent, attachments.length > 0 ? 'attachment' : 'text', undefined, attachments).subscribe({
          next: (message) => {
            console.log('✅ Message with attachments sent successfully');
            this.isSendingMessage = false;
            this.scrollToBottom();
            this.cdr.detectChanges();
          },
          error: (error) => {
            console.error('❌ Error sending message with attachments:', error);
            this.errorMessage = 'Failed to send message. Please try again.';
            this.isSendingMessage = false;
            this.cdr.detectChanges();
          }
        });
      } else {
        // Send text-only message
        this.chatService.sendMessage(conversationId, messageContent).subscribe({
          next: (message) => {
            console.log('✅ Message sent successfully');
            this.isSendingMessage = false;
            this.scrollToBottom();
            this.cdr.detectChanges();
          },
          error: (error) => {
            console.error('❌ Error sending message:', error);
            this.errorMessage = 'Failed to send message. Please try again.';
            this.isSendingMessage = false;
            this.cdr.detectChanges();
          }
        });
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);
      this.errorMessage = 'Failed to send message. Please try again.';
      this.isSendingMessage = false;
      this.cdr.detectChanges();
    }
  }

  onTyping() {
    if (this.selectedConversationId) {
      this.socketService.sendTypingIndicator(this.selectedConversationId, true);
      
      // Stop typing indicator after 2 seconds
      setTimeout(() => {
        this.socketService.sendTypingIndicator(this.selectedConversationId, false);
      }, 2000);
    }
  }

  onEnterKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  private scrollToBottom(force: boolean = false) {
    setTimeout(() => {
      if (this.messagesContainer) {
        const element = this.messagesContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    }, 100);
  }

  public forceScrollToBottom() {
    this.scrollToBottom(true);
  }

  getPhotoUrl(photo?: string): string {
    return getPhotoUrl(photo);
  }

  onImageError(event: any) {
    onImgError(event);
  }

  onAttachmentImageError(event: any, attachment: any) {
    console.error('❌ Attachment image error:', attachment);
    onImgError(event);
  }

  // File handling methods
  openFileInput() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = 'image/*,.pdf,.doc,.docx,.txt';
    fileInput.onchange = (event: any) => this.onFileSelected(event);
    fileInput.click();
  }

  onFileSelected(event: any) {
    const files = event.target.files;
    if (files) {
      this.selectedFiles = Array.from(files);
    }
  }

  removeSelectedFile(index: number) {
    this.selectedFiles.splice(index, 1);
  }

  openAttachment(attachment: any) {
    if (attachment.type === 'image') {
      window.open(attachment.url, '_blank');
    } else {
      this.downloadAttachment(attachment);
    }
  }

  downloadAttachment(attachment: any) {
  // Always use the backend download endpoint for all attachments
  // Always use the filename property for downloads
  const filename = attachment.filename;
  if (!filename) return;
  // Use absolute URL for reliability
  const backendUrl = 'http://localhost:3000';
  const downloadUrl = `${backendUrl}/api/files/download/${filename}?originalName=${encodeURIComponent(attachment.originalName || attachment.name || filename)}`;
  // Open in new tab to avoid browser blocking and CORS issues
  window.open(downloadUrl, '_blank');
  }

  // Clear messages methods
  showClearMessagesDialog() {
    this.showClearDialog = true;
  }

  cancelClearMessages() {
    this.showClearDialog = false;
  }

  confirmClearMessages() {
    if (this.selectedConversationId) {
      this.isClearingMessages = true;
      console.log('🧹 Clearing conversation for me (API call):', this.selectedConversationId);
      this.chatService.clearConversation(this.selectedConversationId).subscribe({
        next: () => {
          console.log('✅ Conversation cleared for me on backend:', this.selectedConversationId);
          // Remove from newConversations so UI does not show as new
          this.newConversations.delete(this.selectedConversationId);
          // Reload messages from backend to reflect cleared state
          this.loadExistingMessages(this.selectedConversationId);
          this.showClearDialog = false;
          this.isClearingMessages = false;
        },
        error: (error) => {
          console.error('❌ Error clearing conversation:', error);
          this.errorMessage = 'Failed to clear conversation. Please try again.';
          this.showClearDialog = false;
          this.isClearingMessages = false;
        }
      });
    }
  }

  toggleUserList() {
    this.showUserList = !this.showUserList;
  }

  onSearchInput(event: any) {
    const searchTerm = event.target.value;
    this.searchSubject.next(searchTerm);
  }

  private performSearch(searchTerm: string) {
    this.searchTerm = searchTerm;
    if (!searchTerm.trim()) {
      this.filteredUsers = [...this.users];
      // Always include selectedUser if not present
      if (this.selectedUser) {
        const userId = this.selectedUser.id || this.selectedUser._id;
        if (!this.filteredUsers.some(u => u.id === userId || u._id === userId)) {
          this.filteredUsers = [this.selectedUser, ...this.filteredUsers];
        }
      }
      return;
    }
    const lowerSearchTerm = searchTerm.toLowerCase();
    this.filteredUsers = this.users.filter(user =>
      user.name.toLowerCase().includes(lowerSearchTerm) ||
      user.email.toLowerCase().includes(lowerSearchTerm)
    );
    // Always include selectedUser if not present
    if (this.selectedUser) {
      const userId = this.selectedUser.id || this.selectedUser._id;
      if (!this.filteredUsers.some(u => u.id === userId || u._id === userId)) {
        this.filteredUsers = [this.selectedUser, ...this.filteredUsers];
      }
    }
  }

  public hasNewConversation(userId: string | undefined): boolean {
    if (!userId) return false;
    const conversationId = this.generateConversationId({ id: userId, _id: userId } as User);
    return this.newConversations.has(conversationId);
  }

  public hasAnyNewConversations(): boolean {
    return this.newConversations.size > 0;
  }

  public clearNewConversationIndicator(userId: string | undefined) {
    if (!userId) return;
    const conversationId = this.generateConversationId({ id: userId, _id: userId } as User);
    this.newConversations.delete(conversationId);
  }

  getCurrentMessages(): any[] {
    if (!this.selectedConversationId) {
      return [];
    }
    const messages = this.conversations.get(this.selectedConversationId) || [];
    return [...messages].sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeA - timeB;
    });
  }

  isNewConversation(): boolean {
    return this.selectedConversationId ? this.newConversations.has(this.selectedConversationId) : false;
  }

  getConversationKeys(): string {
    return Array.from(this.conversations.keys()).join(', ');
  }

  // Debug method to check send button state
  getSendButtonState(): string {
    const hasMessage = this.newMessage.trim().length > 0;
    const hasFiles = this.selectedFiles.length > 0;
    const hasSelectedUser = !!this.selectedUser;
    const isSending = this.isSendingMessage;
    
    // Only log occasionally to reduce overhead
    if (Math.random() < 0.05) { // Log only 5% of calls
      console.log('🔘 Send button state:', {
        hasMessage,
        hasFiles,
        hasSelectedUser,
        isSending,
        newMessage: this.newMessage,
        selectedUser: this.selectedUser?.name,
        selectedUserId: this.selectedUser?.id || this.selectedUser?._id,
        selectedConversationId: this.selectedConversationId
      });
    }
    
    return `Message: ${hasMessage}, Files: ${hasFiles}, User: ${hasSelectedUser}, Sending: ${isSending}`;
  }

  formatTime(timestamp: Date | string): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  formatLastSeen(timestamp: Date | string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
    return `${Math.floor(diffInMinutes / 1440)} days ago`;
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getTypingUsersText(): string {
    const typingUsersArray = Array.from(this.typingUsers);
    if (typingUsersArray.length === 0) return '';
    if (typingUsersArray.length === 1) return `${typingUsersArray[0]} is typing...`;
    return `${typingUsersArray.join(', ')} are typing...`;
  }

  isMessageFromCurrentUser(message: any): boolean {
    if (!this.currentUser || !message) return false;
    const currentUserId = (this.currentUser.id || this.currentUser._id || '').toString();
    let messageSenderId = '';
    if (message.sender && typeof message.sender === 'object') {
      messageSenderId = (message.sender.id || message.sender._id || '').toString();
    } else {
      messageSenderId = (message.sender || '').toString();
    }
    // Compare as strings, ignore case
    return currentUserId.toLowerCase() === messageSenderId.toLowerCase();
  }

  // TrackBy function for message list to improve rendering performance
  trackByMessageId(index: number, message: any): string {
    return message._id || message.id || `${message.timestamp}-${index}`;
  }

  // TrackBy function for user list to improve rendering performance
  trackByUserId(index: number, user: any): string {
    return user.id || user._id || index.toString();
  }

  toggleManageMode() {
    this.isManageMode = true;
    this.selectedUsersForRemoval.clear();
  }

  exitManageMode() {
    this.isManageMode = false;
    this.selectedUsersForRemoval.clear();
    this.manageSearchTerm = '';
  }

  getFilteredUsersForManage(): User[] {
    if (!this.manageSearchTerm.trim()) {
      return this.users;
    }
    
    const lowerSearchTerm = this.manageSearchTerm.toLowerCase();
    return this.users.filter(user =>
      user.name.toLowerCase().includes(lowerSearchTerm) ||
      user.email.toLowerCase().includes(lowerSearchTerm)
    );
  }

  isUserSelectedForRemoval(user: User): boolean {
    const userId = user.id || user._id;
    return userId ? this.selectedUsersForRemoval.has(userId) : false;
  }

  toggleUserSelection(user: User) {
    const userId = user.id || user._id;
    if (!userId) return;
    
    if (this.selectedUsersForRemoval.has(userId)) {
      this.selectedUsersForRemoval.delete(userId);
    } else {
      this.selectedUsersForRemoval.add(userId);
    }
  }

  selectAllUsers() {
    this.selectedUsersForRemoval.clear();
    this.getFilteredUsersForManage().forEach(user => {
      const userId = user.id || user._id;
      if (userId) {
        this.selectedUsersForRemoval.add(userId);
      }
    });
  }

  deselectAllUsers() {
    this.selectedUsersForRemoval.clear();
  }

  removeSelectedUsers() {
    if (this.selectedUsersForRemoval.size === 0) return;
    const userIdsToRemove = Array.from(this.selectedUsersForRemoval);
    let completed = 0;
    // Track removed user IDs in localStorage
    let removedUserIds: string[] = [];
    const removedKey = 'removed_user_ids';
    const existingRemoved = localStorage.getItem(removedKey);
    if (existingRemoved) {
      try {
        removedUserIds = JSON.parse(existingRemoved);
      } catch {}
    }
    userIdsToRemove.forEach(userId => {
      if (!removedUserIds.includes(userId)) removedUserIds.push(userId);
    });
    localStorage.setItem(removedKey, JSON.stringify(removedUserIds));
    userIdsToRemove.forEach(userId => {
      // Find the conversationId for this user
      const conversationId = this.generateConversationId({ id: userId, _id: userId } as User);
      // Delete conversation from backend
      this.chatService.clearConversation(conversationId).subscribe({
        next: () => {
          // Remove connection from backend
          const connection = this.getConnectionWithUser(userId);
          if (connection && connection._id) {
            this.connectionService.withdrawConnectionRequest(connection._id).subscribe({
              next: () => {
                // Remove user from local list
                this.users = this.users.filter(user => (user.id || user._id) !== userId);
                // Deduplicate users after removal
                const seen = new Set();
                this.users = this.users.filter(u => {
                  const uid = u.id || u._id;
                  if (seen.has(uid)) return false;
                  seen.add(uid);
                  return true;
                });
                this.filteredUsers = [...this.users];
                // Update localStorage immediately after removal
                try {
                  localStorage.setItem(this.USER_LIST_KEY, JSON.stringify(this.users));
                } catch (e) {
                  console.error('Failed to persist users:', e);
                }
                completed++;
                if (completed === userIdsToRemove.length) {
                  this.selectedUsersForRemoval.clear();
                  this.isManageMode = false;
                  this.cdr.detectChanges();
                }
              },
              error: () => {
                completed++;
                if (completed === userIdsToRemove.length) {
                  this.selectedUsersForRemoval.clear();
                  this.isManageMode = false;
                  this.cdr.detectChanges();
                }
              }
            });
          } else {
            // Remove user from local list if no connection found
            this.users = this.users.filter(user => (user.id || user._id) !== userId);
            // Deduplicate users after removal
            const seen = new Set();
            this.users = this.users.filter(u => {
              const uid = u.id || u._id;
              if (seen.has(uid)) return false;
              seen.add(uid);
              return true;
            });
            this.filteredUsers = [...this.users];
            // Update localStorage
            try {
              localStorage.setItem(this.USER_LIST_KEY, JSON.stringify(this.users));
            } catch (e) {
              console.error('Failed to persist users:', e);
            }
            completed++;
            if (completed === userIdsToRemove.length) {
              this.selectedUsersForRemoval.clear();
              this.isManageMode = false;
              this.cdr.detectChanges();
            }
          }
        },
        error: () => {
          completed++;
          if (completed === userIdsToRemove.length) {
            this.selectedUsersForRemoval.clear();
            this.isManageMode = false;
            this.cdr.detectChanges();
          }
        }
      });
    });
  }

  // State persistence methods
  private saveChatState() {
    try {
      const chatState = {
        selectedUser: this.selectedUser,
        selectedConversationId: this.selectedUser ? this.generateConversationId(this.selectedUser) : '',
        conversations: Array.from(this.conversations.entries()),
        users: this.users
      };
      
      localStorage.setItem(this.CONVERSATIONS_KEY, JSON.stringify(chatState));
    } catch (error) {
      console.error('Error saving chat state:', error);
    }
  }

  private restoreChatState() {
    try {
      const savedState = localStorage.getItem(this.CONVERSATIONS_KEY);
      if (!savedState) {
        console.log('🔄 No saved chat state found');
        return;
      }
      
      const chatState = JSON.parse(savedState);
      console.log('🔄 Restoring chat state:', chatState);
      
      if (chatState.selectedUser && chatState.selectedConversationId) {
        // Store the selected user and conversation ID for later matching
        this.selectedConversationId = chatState.selectedConversationId;
        
        if (chatState.conversations) {
          this.conversations = new Map(chatState.conversations);
          console.log('💾 Restored conversations:', Array.from(this.conversations.entries()));
        }
        
        if (chatState.users) {
          this.users = chatState.users;
          this.filteredUsers = [...this.users];
          console.log('👥 Restored users:', this.users.length);
        }
        
        // Don't set selectedUser yet - wait for users to be loaded from server
        console.log('⏳ Waiting for users to be loaded before restoring selected user');
        this.cdr.detectChanges();
      }
    } catch (error) {
      console.error('Error restoring chat state:', error);
    }
  }

  private restoreSelectedUser() {
    // --- Patch: skip restore if user was selected via route param or click ---
    if (this.selectedUser) {
      // User was already selected explicitly, skip restore
      return;
    }
    if (this.routeUserId) {
      const user = this.users.find(u => u.id === this.routeUserId || u._id === this.routeUserId);
      if (user) {
        this.selectUser(user);
        return;
      }
    }
    // Fallback to previous restore logic
    try {
      const savedState = localStorage.getItem(this.CONVERSATIONS_KEY);
      if (!savedState) return;
      const chatState = JSON.parse(savedState);
      if (!chatState.selectedUser || !chatState.selectedConversationId) return;
      console.log('🔍 Trying to restore selected user:', chatState.selectedUser);
      console.log('🔍 Available users:', this.users.map(u => `${u.name} (${u.id})`));
      const savedUserId = chatState.selectedUser.id || chatState.selectedUser._id;
      const matchingUser = this.users.find(user => {
        const userId = user.id || user._id;
        return userId === savedUserId;
      });
      if (matchingUser) {
        console.log('✅ Found matching user, restoring selection:', matchingUser.name);
        this.selectedUser = matchingUser;
        const restoreCurrentUserId = this.currentUser?.id || this.currentUser?._id;
        const restoreOtherUserId = matchingUser.id || matchingUser._id;
        const restoreSortedIds = [restoreCurrentUserId, restoreOtherUserId].sort();
        const restoreConversationId = `${restoreSortedIds[0]}_${restoreSortedIds[1]}`;
        console.log('[DEBUG][restoreSelectedUser] Sorted IDs:', restoreSortedIds, 'Generated conversationId:', restoreConversationId);
        const correctConversationId = this.generateConversationId(matchingUser);
        console.log('🔍 Saved conversation ID:', chatState.selectedConversationId);
        console.log('🔍 Correct conversation ID:', correctConversationId);
        if (chatState.selectedConversationId !== correctConversationId) {
          console.log('⚠️ Conversation ID mismatch, using correct ID');
          this.selectedConversationId = correctConversationId;
        }
        this.cdr.detectChanges();
        this.getSendButtonState();
        console.log('📥 Loading messages for restored conversation:', this.selectedConversationId);
        this.loadExistingMessages(this.selectedConversationId);
        this.joinConversation();
        this.getSendButtonState();
      } else {
        console.log('❌ No matching user found for saved selected user');
        this.selectedConversationId = '';
        this.cdr.detectChanges();
      }
    } catch (error) {
      console.error('Error restoring selected user:', error);
    }
  }

  private stopStatusRefresh() {
    if (this.statusRefreshTimer) {
      clearInterval(this.statusRefreshTimer);
      this.statusRefreshTimer = null;
    }
  }

  ngOnDestroy() {
    // Stop status refresh timer
    this.stopStatusRefresh();
    
    // Disconnect socket service
    this.socketService.disconnect();
    
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach(sub => {
      if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
    });
    
    // Save chat state
    this.saveChatState();
  }
}

// Helper function to check if a user is in the removed list
const removedKey = 'removed_user_ids';
function isUserRemoved(userId: string): boolean {
  const existingRemoved = localStorage.getItem(removedKey);
  if (existingRemoved) {
    try {
      const removedUserIds = JSON.parse(existingRemoved);
      return removedUserIds.includes(userId);
    } catch {}
  }
  return false;
}