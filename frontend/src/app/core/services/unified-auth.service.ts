import { environment } from '../../../environments/environment';
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of, throwError, catchError, timeout, retry } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { AppStabilityService } from './app-stability.service';

export interface User {
  id: string;
  _id?: string; // MongoDB ID for backward compatibility
  name: string;
  email: string;
  photo?: string;
  bio?: string;
  location?: string;
  timezone?: string;
  connections: string[];
  connectionRequests: string[];
  sessionsCompleted: number;
  sessionsHosted: number;
  skills?: any[];
  availability?: any[];
  isOnline?: boolean;
  lastSeen?: Date;
  connectionCount?: number; // For backward compatibility
  connectionStatus?: string; // For backward compatibility
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  title?: string;
  location?: string;
  timezone?: string;
  about?: string;
  skills?: string[];
}

export interface ProfileUpdateRequest {
  name?: string;
  bio?: string;
  photo?: string;
  location?: string;
  timezone?: string;
  availability?: any[];
}

@Injectable({
  providedIn: 'root'
})
export class UnifiedAuthService {
  private apiUrl = environment.apiUrl;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$ = this.isLoadingSubject.asObservable();

  private isLoggingOut = false; // Prevent multiple logout calls
  private tokenRefreshTimer: any = null;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object,
    private stabilityService: AppStabilityService
  ) {
    this.initializeAuth();
  }

  private initializeAuth(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Check for existing token and validate it
      const token = this.getToken();
      if (token) {
        this.validateAndLoadUser(token);
      }
    }
  }

  // Token management with stability checks
  getToken(): string | null {
    return this.stabilityService.safeLocalStorageGet('accessToken') || 
           this.stabilityService.safeLocalStorageGet('token');
  }

  setToken(token: string): boolean {
    const success1 = this.stabilityService.safeLocalStorageSet('accessToken', token);
    const success2 = this.stabilityService.safeLocalStorageSet('token', token); // Backward compatibility
    return success1 && success2;
  }

  removeToken(): boolean {
    const success1 = this.stabilityService.safeLocalStorageRemove('accessToken');
    const success2 = this.stabilityService.safeLocalStorageRemove('token');
    return success1 && success2;
  }

  // Authentication methods with error handling
  login(credentials: LoginRequest): Observable<any> {
    this.setLoading(true);
    
    return this.stabilityService.safeAuthOperation(() => 
      this.http.post<any>(`${this.apiUrl}/auth/login`, credentials)
    ).pipe(
      catchError(error => {
        this.setLoading(false);
        this.stabilityService.reportError(`Login failed: ${error.message}`);
        return throwError(() => error);
      })
    );
  }

  register(userData: RegisterRequest): Observable<any> {
    this.setLoading(true);
    
    return this.stabilityService.safeAuthOperation(() => 
      this.http.post<any>(`${this.apiUrl}/auth/register`, userData)
    ).pipe(
      catchError(error => {
        this.setLoading(false);
        this.stabilityService.reportError(`Registration failed: ${error.message}`);
        return throwError(() => error);
      })
    );
  }

  logout(): void {
    if (this.isLoggingOut) return;
    
    this.isLoggingOut = true;
    console.log('🔄 Logging out user...');

    // Clear all timers
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }

    // Clear user data
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.setLoading(false);

    // Remove token
    this.removeToken();

    // Clear any stored data
    this.stabilityService.safeLocalStorageRemove('user');
    this.stabilityService.safeLocalStorageRemove('chat_conversations');
    this.stabilityService.safeLocalStorageRemove('chat_user_activity');

    this.isLoggingOut = false;
    console.log('✅ Logout completed');
  }

  // User management with stability
  getCurrentUser(): Observable<User> {
    return this.stabilityService.safeAuthOperation(() => 
      this.http.get<User>(`${this.apiUrl}/auth/me`)
    ).pipe(
      catchError(error => {
        this.stabilityService.reportError(`Get current user failed: ${error.message}`);
        return of(null as any);
      })
    );
  }

  updateProfile(updates: ProfileUpdateRequest): Observable<any> {
    return this.stabilityService.safeAuthOperation(() => 
      this.http.put<any>(`${this.apiUrl}/auth/profile`, updates)
    ).pipe(
      catchError(error => {
        this.stabilityService.reportError(`Profile update failed: ${error.message}`);
        return throwError(() => error);
      })
    );
  }

  getAllUsers(): Observable<User[]> {
    return this.stabilityService.safeAuthOperation(() => 
      this.http.get<User[]>(`${this.apiUrl}/auth/users`)
    ).pipe(
      catchError(error => {
        this.stabilityService.reportError(`Get all users failed: ${error.message}`);
        return of([]);
      })
    );
  }

  getUserById(userId: string): Observable<User> {
    return this.stabilityService.safeAuthOperation(() => 
      this.http.get<User>(`${this.apiUrl}/auth/users/${userId}`)
    ).pipe(
      catchError(error => {
        this.stabilityService.reportError(`Get user by ID failed: ${error.message}`);
        return of(null as any);
      })
    );
  }

  getUserByEmail(email: string): Observable<User> {
    return this.stabilityService.safeAuthOperation(() => 
      this.http.get<User>(`${this.apiUrl}/auth/users/email/${email}`)
    ).pipe(
      catchError(error => {
        this.stabilityService.reportError(`Get user by email failed: ${error.message}`);
        return of(null as any);
      })
    );
  }

  // Connection management
  sendConnectionRequest(userId: string): Observable<any> {
    return this.stabilityService.safeAuthOperation(() => 
      this.http.post<any>(`${this.apiUrl}/connections/send-request`, { recipient: userId })
    ).pipe(
      catchError(error => {
        this.stabilityService.reportError(`Send connection request failed: ${error.message}`);
        return throwError(() => error);
      })
    );
  }

  respondToConnectionRequest(requestId: string, response: 'accepted' | 'rejected'): Observable<any> {
    return this.stabilityService.safeAuthOperation(() => 
      this.http.post<any>(`${this.apiUrl}/connections/${response}`, { requestId })
    ).pipe(
      catchError(error => {
        this.stabilityService.reportError(`Respond to connection request failed: ${error.message}`);
        return throwError(() => error);
      })
    );
  }

  // Token refresh
  refreshToken(): Observable<any> {
    return this.stabilityService.safeAuthOperation(() => 
      this.http.post<any>(`${this.apiUrl}/auth/refresh`, {})
    ).pipe(
      catchError(error => {
        this.stabilityService.reportError(`Token refresh failed: ${error.message}`);
        this.logout(); // Force logout on refresh failure
        return throwError(() => error);
      })
    );
  }

  // Utility methods
  private setLoading(loading: boolean): void {
    this.isLoadingSubject.next(loading);
  }

  private validateAndLoadUser(token: string): void {
    this.getCurrentUser().subscribe({
      next: (user) => {
        if (user) {
          this.currentUserSubject.next(user);
          this.isAuthenticatedSubject.next(true);
          this.setupTokenRefresh();
        } else {
          this.logout();
        }
      },
      error: (error) => {
        console.warn('Token validation failed:', error);
        this.logout();
      }
    });
  }

  private setupTokenRefresh(): void {
    // Refresh token every 50 minutes (assuming 1-hour expiry)
    this.tokenRefreshTimer = setInterval(() => {
      this.refreshToken().subscribe({
        next: (response) => {
          if (response.token) {
            this.setToken(response.token);
          }
        },
        error: (error) => {
          console.warn('Token refresh failed:', error);
          this.logout();
        }
      });
    }, 50 * 60 * 1000); // 50 minutes
  }

  // Public getters
  getCurrentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  isLoading(): boolean {
    return this.isLoadingSubject.value;
  }

  // Additional methods for backward compatibility
  setCurrentUser(user: User): void {
    this.currentUserSubject.next(user);
    this.isAuthenticatedSubject.next(true);
  }

  getAccessToken(): string | null {
    return this.getToken();
  }

  addUserSkill(skill: any): Observable<any> {
    return this.stabilityService.safeAuthOperation(() => 
      this.http.post<any>(`${this.apiUrl}/auth/skills`, skill)
    ).pipe(
      catchError(error => {
        this.stabilityService.reportError(`Add user skill failed: ${error.message}`);
        return throwError(() => error);
      })
    );
  }

  // Add missing methods for backward compatibility
  getUsersOnlineStatus(userIds: string[]): Observable<any> {
    return this.stabilityService.safeAuthOperation(() =>
      this.http.post<any>(`${this.apiUrl}/auth/users/online-status`, { userIds })
    ).pipe(
      catchError(error => {
        this.stabilityService.reportError(`Get users online status failed: ${error.message}`);
        return throwError(() => error);
      })
    );
  }

  // Overload for FormData profile updates
  updateProfileFormData(formData: FormData): Observable<any> {
    return this.stabilityService.safeAuthOperation(() =>
      this.http.post<any>(`${this.apiUrl}/auth/profile`, formData)
    ).pipe(
      catchError(error => {
        this.stabilityService.reportError(`Update profile failed: ${error.message}`);
        return throwError(() => error);
      })
    );
  }

  // Add missing methods for backward compatibility
  resetPassword(email: string, oldPassword: string, newPassword: string): Observable<any> {
    return this.stabilityService.safeAuthOperation(() =>
      this.http.post<any>(`${this.apiUrl}/auth/reset-password`, { email, oldPassword, newPassword })
    ).pipe(
      catchError(error => {
        this.stabilityService.reportError(`Reset password failed: ${error.message}`);
        return throwError(() => error);
      })
    );
  }

  // Overload for FormData registration
  registerFormData(formData: FormData): Observable<any> {
    return this.stabilityService.safeAuthOperation(() =>
      this.http.post<any>(`${this.apiUrl}/auth/register`, formData)
    ).pipe(
      catchError(error => {
        this.stabilityService.reportError(`Registration failed: ${error.message}`);
        return throwError(() => error);
      })
    );
  }

  // Debug methods
  debugAuthState(): void {
    console.log('🔍 Auth Debug Info:');
    console.log('🔍 Current User:', this.getCurrentUserValue());
    console.log('🔍 Is Authenticated:', this.isAuthenticated());
    console.log('🔍 Token:', this.getToken() ? 'Present' : 'Missing');
    console.log('🔍 Is Logging Out:', this.isLoggingOut);
  }
} 