import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

export interface User {
  id: string;
  _id?: string; // MongoDB ID for compatibility
  name: string;
  email: string;
  bio?: string;
  photo?: string;
  location?: string;
  timezone?: string;
  availability?: any[];
  skills?: any[];
  averageRating?: number;
  totalReviews?: number;
  sessionsCompleted?: number;
  credits?: number;
  isPremium?: boolean;
  badges?: any[];
  referralCode?: string;
  isOnline?: boolean;
  lastSeen?: Date;
  createdAt?: Date;
  // Additional properties for compatibility
  connections?: string[];
  connectionRequests?: any[];
  connectionCount?: number;
  connectionStatus?: string;
  title?: string;
  about?: string;
  phone?: string;
  website?: string;
  paymentSettings?: {
    enablePayments?: boolean;
    hourlyRate?: number;
    currency?: string;
    freeSessionsOffered?: number;
    paymentRequired?: boolean;
  };
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user: User;
  accessToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  referralCode?: string;
}

export interface ProfileUpdateRequest {
  name?: string;
  bio?: string;
  photo?: string;
  location?: string;
  timezone?: string;
  availability?: any[];
  paymentSettings?: {
    enablePayments?: boolean;
    hourlyRate?: number;
    currency?: string;
    freeSessionsOffered?: number;
    paymentRequired?: boolean;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$ = this.isLoadingSubject.asObservable();

  private readonly API_URL = `${environment.apiUrl}/auth`;

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.checkAuthStatus();
  }

  // Check if user is already authenticated
  private checkAuthStatus(): void {
    if (isPlatformBrowser(this.platformId)) {
      const token = this.getAccessToken();
      if (token) {
        // Check if token is expired first
        if (this.isTokenExpired()) {
          console.log('Token is expired, attempting refresh...');
          this.refreshToken().subscribe({
            next: (response) => {
              this.setAccessToken(response.accessToken);
              // After successful refresh, get user data
              this.getCurrentUser().subscribe({
                next: (user) => {
                  this.setCurrentUser(user);
                  console.log('Authentication restored after token refresh');
                },
                error: (error) => {
                  console.error('Failed to get user after token refresh:', error);
                  this.clearAuthData();
                }
              });
            },
            error: (error) => {
              console.error('Token refresh failed:', error);
              this.clearAuthData();
            }
          });
        } else {
          // Token is valid, get user data
          console.log('Token is valid, getting user data...');
          this.getCurrentUser().subscribe({
            next: (user) => {
              this.setCurrentUser(user);
              console.log('Authentication restored successfully');
            },
            error: (error) => {
              console.error('Failed to get user data:', error);
              this.clearAuthData();
            }
          });
        }
      } else {
        console.log('No token found, user not authenticated');
        // Ensure we're not authenticated
        this.currentUserSubject.next(null);
        this.isAuthenticatedSubject.next(false);
      }
    }
  }

  // Method to wait for authentication to be restored
  waitForAuth(): Promise<boolean> {
    return new Promise((resolve) => {
      // If already authenticated, resolve immediately
      if (this.isAuthenticated()) {
        resolve(true);
        return;
      }

      // If no token, resolve as not authenticated
      if (!this.getAccessToken()) {
        resolve(false);
        return;
      }

      // Wait for authentication to be restored
      const subscription = this.isAuthenticated$.subscribe(isAuthenticated => {
        if (isAuthenticated) {
          subscription.unsubscribe();
          resolve(true);
        }
      });

      // Reduced timeout to 1.5 seconds to prevent excessive waiting
      setTimeout(() => {
        subscription.unsubscribe();
        resolve(false);
      }, 1500);
    });
  }

  // Register new user
  register(request: FormData): Observable<AuthResponse> {
    this.isLoadingSubject.next(true);
    
    return this.http.post<AuthResponse>(`${this.API_URL}/register`, request).pipe(
      tap(response => {
        if (response.success) {
          this.setAccessToken(response.accessToken);
          this.setCurrentUser(response.user);
        }
      }),
      catchError(this.handleError),
      tap(() => this.isLoadingSubject.next(false))
    );
  }

  // Login user
  login(request: LoginRequest): Observable<AuthResponse> {
    this.isLoadingSubject.next(true);
    
    return this.http.post<AuthResponse>(`${this.API_URL}/login`, request).pipe(
      tap(response => {
        if (response.success) {
          this.setAccessToken(response.accessToken);
          this.setCurrentUser(response.user);
        }
      }),
      catchError(this.handleError),
      tap(() => this.isLoadingSubject.next(false))
    );
  }

  // Refresh access token
  refreshToken(): Observable<{ accessToken: string }> {
    return this.http.post<{ success: boolean; accessToken: string }>(`${this.API_URL}/refresh`, {}).pipe(
      map(response => {
        if (response.success) {
          this.setAccessToken(response.accessToken);
          return { accessToken: response.accessToken };
        }
        throw new Error('Token refresh failed');
      }),
      catchError(this.handleError)
    );
  }

  // Get current user
  getCurrentUser(): Observable<User> {
    return this.http.get<{ success: boolean; user: User }>(`${environment.apiUrl}/users/me`).pipe(
      map(response => {
        if (response.success) {
          return response.user;
        }
        throw new Error('Failed to get current user');
      }),
      catchError(this.handleError)
    );
  }

  // Update user profile
  updateProfile(request: ProfileUpdateRequest | FormData): Observable<User> {
    this.isLoadingSubject.next(true);
    
    return this.http.put<{ success: boolean; user: User }>(`${environment.apiUrl}/users/me`, request).pipe(
      map(response => {
        if (response.success) {
          this.setCurrentUser(response.user);
          return response.user;
        }
        throw new Error('Failed to update profile');
      }),
      catchError(this.handleError),
      tap(() => this.isLoadingSubject.next(false))
    );
  }

  // Change password
  changePassword(currentPassword: string, newPassword: string): Observable<{ success: boolean; message: string }> {
    this.isLoadingSubject.next(true);
    
    return this.http.post<{ success: boolean; message: string }>(`${this.API_URL}/change-password`, {
      currentPassword,
      newPassword
    }).pipe(
      catchError(this.handleError),
      tap(() => this.isLoadingSubject.next(false))
    );
  }

  resetPassword(email: string, oldPassword: string, newPassword: string): Observable<{ success: boolean; message: string }> {
    this.isLoadingSubject.next(true);
    
    return this.http.post<{ success: boolean; message: string }>(`${this.API_URL}/reset-password`, {
      email,
      oldPassword,
      newPassword
    }).pipe(
      catchError(this.handleError),
      tap(() => this.isLoadingSubject.next(false))
    );
  }

  // Get user by ID (public profile)
  getUserById(userId: string): Observable<User> {
    return this.http.get<{ success: boolean; user: User }>(`${environment.apiUrl}/users/${userId}`).pipe(
      map(response => {
        if (response.success) {
          return response.user;
        }
        throw new Error('Failed to get user');
      }),
      catchError(this.handleError)
    );
  }

  // Get booking notifications
  getBookingNotifications(): Observable<{ success: boolean; data: any[] }> {
    console.log('📡 AuthService: Fetching booking notifications from API...');
    const url = `${environment.apiUrl}/users/notifications`;
    console.log('🔗 API URL:', url);
    
    return this.http.get<{ success: boolean; data: any[] }>(url).pipe(
      tap(response => {
        console.log('📡 AuthService: Booking notifications API response:', response);
      }),
      catchError((error) => {
        console.error('❌ AuthService: Error fetching booking notifications:', error);
        return this.handleError(error);
      })
    );
  }

  // Mark notification as read
  markNotificationAsRead(notificationId: string): Observable<{ success: boolean; message: string }> {
    return this.http.patch<{ success: boolean; message: string }>(
      `${environment.apiUrl}/users/notifications/${notificationId}/read`, 
      {}
    ).pipe(
      catchError(this.handleError)
    );
  }

  // Logout user
  logout(): void {
    this.http.post<{ success: boolean }>(`${this.API_URL}/logout`, {}).subscribe();
    this.clearAuthData();
  }

  // Delete account
  deleteAccount(password: string): Observable<{ success: boolean; message: string }> {
    this.isLoadingSubject.next(true);
    
    return this.http.post<{ success: boolean; message: string }>(`${this.API_URL}/delete-account`, {
      password
    }).pipe(
      tap(response => {
        if (response.success) {
          this.clearAuthData();
        }
      }),
      catchError(this.handleError),
      tap(() => this.isLoadingSubject.next(false))
    );
  }

  // Get current user synchronously
  getCurrentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  // Check if user is premium
  isPremium(): boolean {
    const user = this.getCurrentUserValue();
    return user?.isPremium || false;
  }

  // Get access token
  getAccessToken(): string | null {
    return isPlatformBrowser(this.platformId) ? localStorage.getItem('accessToken') : null;
  }

  // Set access token
  private setAccessToken(token: string): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('accessToken', token);
    }
  }

  // Make setCurrentUser public for components that need it
  setCurrentUser(user: User): void {
    this.currentUserSubject.next(user);
    this.isAuthenticatedSubject.next(true);
  }

  // Clear current user data (public method)
  clearCurrentUser(): void {
    this.currentUserSubject.next(null);
  }

  // Clear authentication data
  private clearAuthData(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('accessToken');
      // Clear Zoom connection state on logout
      localStorage.removeItem('zoomConnected');
      console.log('🗑️ Cleared Zoom connection state on logout');
    }
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
  }

  // Handle errors
  private handleError = (error: any): Observable<never> => {
    let errorMessage = 'An error occurred';
    
    if (error.status === 429) {
      errorMessage = 'Too many requests. Please wait a moment and try again.';
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    console.error('Auth service error:', error);
    return throwError(() => new Error(errorMessage));
  };

  // Get auth headers
  getAuthHeaders(): HttpHeaders {
    const token = this.getAccessToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // Check if token is expired
  isTokenExpired(): boolean {
    const token = this.getAccessToken();
    if (!token) return true;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiryTime = payload.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      
      // Check if token is actually expired (not 5 minutes before)
      return currentTime >= expiryTime;
    } catch (error) {
      return true; // If we can't parse the token, consider it expired
    }
  }

  // Additional methods for compatibility
  isLoggedIn(): boolean {
    return this.isAuthenticated();
  }

  getToken(): string | null {
    return this.getAccessToken();
  }

  getAllUsers(): Observable<User[]> {
    return this.http.get<{ success: boolean; users: User[] }>(`${environment.apiUrl}/users`).pipe(
      map(response => {
        if (response.success) {
          return response.users;
        }
        throw new Error('Failed to get users');
      }),
      catchError(this.handleError)
    );
  }

  getUsersOnlineStatus(userIds: string[]): Observable<any> {
    return this.http.post<{ success: boolean; data: { userStatuses: any } }>(`${environment.apiUrl}/users/online-status`, { userIds }).pipe(
      map(response => {
        if (response.success && response.data && response.data.userStatuses) {
          // Convert the statusMap object to an array format expected by the frontend
          const statusMap = response.data.userStatuses;
          const statusArray = Object.keys(statusMap).map(userId => ({
            userId: userId,
            isOnline: statusMap[userId].isOnline,
            lastSeen: statusMap[userId].lastSeen,
            name: statusMap[userId].name
          }));
          return statusArray;
        }
        throw new Error('Failed to get online status');
      }),
      catchError(this.handleError)
    );
  }

  sendConnectionRequest(userId: string): Observable<any> {
    return this.http.post<{ success: boolean; message: string }>(`${environment.apiUrl}/connections/send`, {
      recipientId: userId
    }, { headers: this.getAuthHeaders() }).pipe(
      map(response => {
        if (response.success) {
          return response;
        }
        throw new Error('Failed to send connection request');
      }),
      catchError(this.handleError)
    );
  }

  respondToConnectionRequest(requestId: string, response: 'accept' | 'reject' | 'accepted' | 'rejected'): Observable<any> {
    // Convert 'accepted'/'rejected' to 'accept'/'reject' for backend compatibility
    const backendResponse = response === 'accepted' ? 'accept' : response === 'rejected' ? 'reject' : response;
    
    return this.http.put<{ success: boolean; message: string }>(`${environment.apiUrl}/users/me/connection-requests/${requestId}`, { response: backendResponse }).pipe(
      map(response => {
        if (response.success) {
          return response;
        }
        throw new Error('Failed to respond to connection request');
      }),
      catchError(this.handleError)
    );
  }

  addUserSkill(skillData: any): Observable<any> {
    return this.http.post<{ success: boolean; user: User }>(`${environment.apiUrl}/users/me/skills`, skillData).pipe(
      map(response => {
        if (response.success) {
          this.setCurrentUser(response.user);
          return response.user;
        }
        throw new Error('Failed to add skill');
      }),
      catchError(this.handleError)
    );
  }

  // Upload profile photo to Cloudinary via backend
  uploadProfilePhoto(photo: File): Observable<{ success: boolean; url: string; user: User }> {
    const formData = new FormData();
    formData.append('photo', photo);
    return this.http.post<{ success: boolean; url: string; user: User }>(`${environment.apiUrl}/users/profile/upload-photo`, formData, {
      headers: { Authorization: `Bearer ${this.getAccessToken()}` }
    });
  }
}