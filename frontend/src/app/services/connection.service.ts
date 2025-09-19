import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { tap, catchError } from 'rxjs/operators';

export interface ConnectionRequest {
  recipientId: string;
  message?: string;
  skillContext?: string;
}

export interface Connection {
  _id: string;
  requester: {
    _id: string;
    name: string;
    email: string;
    photo?: string;
    bio?: string;
  };
  recipient: {
    _id: string;
    name: string;
    email: string;
    photo?: string;
    bio?: string;
  };
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  message?: string;
  skillContext?: string;
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string;
  rejectedAt?: string;
  withdrawnAt?: string;
}

export interface ConnectionStatus {
  status: string | null;
  areConnected: boolean;
  canSendRequest: boolean;
  userRole?: 'requester' | 'recipient' | null;
  isRequester: boolean;
  isRecipient: boolean;
}

export interface ConnectionResponse {
  success: boolean;
  message: string;
  data: any;
}

@Injectable({
  providedIn: 'root'
})
export class ConnectionService {
  private apiUrl = `${environment.apiUrl}/connections`;

  constructor(private http: HttpClient) {}

  // Utility: Validate MongoDB ObjectId
  private isValidObjectId(id: string): boolean {
    return /^[a-fA-F0-9]{24}$/.test(id);
  }

  // Send connection request
  sendConnectionRequest(request: ConnectionRequest): Observable<ConnectionResponse> {
    if (!this.isValidObjectId(request.recipientId)) {
      console.warn('ConnectionService: Invalid recipientId, not sending request:', request.recipientId);
      throw new Error('Invalid recipientId for connection request');
    }
    console.log('ConnectionService: Sending request to:', `${this.apiUrl}/send`);
    console.log('ConnectionService: Request data:', request);
    
    // Add more detailed debugging
    console.log('ConnectionService: Full URL:', `${this.apiUrl}/send`);
    console.log('ConnectionService: Making HTTP POST request...');
    
    return this.http.post<ConnectionResponse>(`${this.apiUrl}/send`, request).pipe(
      tap(response => {
        console.log('ConnectionService: ✅ HTTP request successful:', response);
      }),
      catchError(error => {
        console.error('ConnectionService: ❌ HTTP request failed:', error);
        console.error('ConnectionService: Error details:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          error: error.error
        });
        throw error;
      })
    );
  }

  // Accept connection request
  acceptConnectionRequest(connectionId: string): Observable<ConnectionResponse> {
    return this.http.put<ConnectionResponse>(`${this.apiUrl}/${connectionId}/accept`, {});
  }

  // Reject connection request
  rejectConnectionRequest(connectionId: string): Observable<ConnectionResponse> {
    return this.http.put<ConnectionResponse>(`${this.apiUrl}/${connectionId}/reject`, {});
  }

  // Withdraw connection request
  withdrawConnectionRequest(connectionId: string): Observable<ConnectionResponse> {
    return this.http.put<ConnectionResponse>(`${this.apiUrl}/${connectionId}/withdraw`, {});
  }

  // Get connection requests
  getConnectionRequests(type: 'received' | 'sent' = 'received', status?: string, page: number = 1, limit: number = 10): Observable<ConnectionResponse> {
    let url = `${this.apiUrl}/requests?type=${type}&page=${page}&limit=${limit}`;
    if (status) {
      url += `&status=${status}`;
    }
    return this.http.get<ConnectionResponse>(url);
  }

  // Get connection status between two users
  getConnectionStatus(userId: string): Observable<ConnectionResponse> {
    if (!this.isValidObjectId(userId)) {
      console.warn('ConnectionService: Invalid userId for getConnectionStatus:', userId);
      throw new Error('Invalid userId for connection status');
    }
    console.log('ConnectionService: Getting status for user:', userId);
    console.log('ConnectionService: Request URL:', `${this.apiUrl}/status/${userId}`);
    return this.http.get<ConnectionResponse>(`${this.apiUrl}/status/${userId}`);
  }

  // Get user's connections
  getUserConnections(userId: string, page: number = 1, limit: number = 20, includeAllUsers: boolean = false): Observable<ConnectionResponse> {
    let url = `${this.apiUrl}/user/${userId}?page=${page}&limit=${limit}`;
    if (includeAllUsers) {
      url += '&includeAllUsers=true';
    }
    console.log('🔗 ConnectionService: Calling getUserConnections with URL:', url);
    return this.http.get<ConnectionResponse>(url);
  }

  // Check if users are connected
  areUsersConnected(userId: string): Observable<boolean> {
    return new Observable(observer => {
      this.getConnectionStatus(userId).subscribe({
        next: (response) => {
          observer.next(response.data.areConnected);
          observer.complete();
        },
        error: (error) => {
          console.error('Error checking connection status:', error);
          observer.next(false);
          observer.complete();
        }
      });
    });
  }

  // Get pending connection requests count
  getPendingRequestsCount(): Observable<number> {
    return new Observable(observer => {
      this.getConnectionRequests('received', 'pending', 1, 1).subscribe({
        next: (response) => {
          observer.next(response.data.pagination.total);
          observer.complete();
        },
        error: (error) => {
          console.error('Error getting pending requests count:', error);
          observer.next(0);
          observer.complete();
        }
      });
    });
  }

  // Test if connection service is working
  testConnection(): Observable<any> {
    console.log('Testing connection service...');
    return this.http.get(`${this.apiUrl}/test`);
  }

  // Reset all connections (ADMIN ONLY - for testing purposes)
  resetAllConnections(): Observable<ConnectionResponse> {
    console.log('🔄 ConnectionService: Resetting all connections...');
    return this.http.delete<ConnectionResponse>(`${this.apiUrl}/reset`);
  }
} 