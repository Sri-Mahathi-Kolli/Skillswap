import { Injectable, ErrorHandler } from '@angular/core';
import { BehaviorSubject, Subject, Observable, of, catchError, timeout, retry } from 'rxjs';
import { AuthService } from './auth.service';
import { SocketService } from './socket.service';

export interface AppHealthStatus {
  isHealthy: boolean;
  authService: boolean;
  socketService: boolean;
  localStorage: boolean;
  memoryUsage: number;
  activeSubscriptions: number;
  errors: string[];
  lastError?: string;
  lastErrorTime?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class AppStabilityService {
  private healthStatusSubject = new BehaviorSubject<AppHealthStatus>({
    isHealthy: true,
    authService: true,
    socketService: true,
    localStorage: true,
    memoryUsage: 0,
    activeSubscriptions: 0,
    errors: []
  });

  private errorSubject = new Subject<string>();
  private recoverySubject = new Subject<void>();
  private subscriptionCount = 0;
  private errorCount = 0;
  private readonly MAX_ERRORS = 10;
  private readonly ERROR_RESET_INTERVAL = 30000; // 30 seconds

  public healthStatus$ = this.healthStatusSubject.asObservable();
  public error$ = this.errorSubject.asObservable();
  public recovery$ = this.recoverySubject.asObservable();

  constructor(
    private authService: AuthService,
    private socketService: SocketService
  ) {
    this.startHealthMonitoring();
    this.startErrorResetTimer();
  }

  // Track subscription lifecycle
  trackSubscription(): () => void {
    this.subscriptionCount++;
    this.updateHealthStatus();
    
    return () => {
      this.subscriptionCount--;
      this.updateHealthStatus();
    };
  }

  // Safe localStorage operations
  safeLocalStorageGet(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      this.reportError(`localStorage get failed for ${key}: ${error}`);
      return null;
    }
  }

  safeLocalStorageSet(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      this.reportError(`localStorage set failed for ${key}: ${error}`);
      return false;
    }
  }

  safeLocalStorageRemove(key: string): boolean {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      this.reportError(`localStorage remove failed for ${key}: ${error}`);
      return false;
    }
  }

  // Safe service operations
  safeAuthOperation<T>(operation: () => Observable<T>): Observable<T> {
    return operation().pipe(
      timeout(10000), // 10 second timeout
      retry(2), // Retry twice
      catchError(error => {
        this.reportError(`Auth operation failed: ${error.message}`);
        return of(null as T);
      })
    );
  }

  safeSocketOperation<T>(operation: () => T): T | null {
    try {
      return operation();
    } catch (error) {
      this.reportError(`Socket operation failed: ${error}`);
      return null;
    }
  }

  // Error reporting and recovery
  reportError(error: string): void {
    console.warn('🚨 App Stability Error:', error);
    
    this.errorCount++;
    const currentStatus = this.healthStatusSubject.value;
    const errors = [...currentStatus.errors, error];
    
    // Keep only last 10 errors
    if (errors.length > this.MAX_ERRORS) {
      errors.splice(0, errors.length - this.MAX_ERRORS);
    }

    this.healthStatusSubject.next({
      ...currentStatus,
      isHealthy: this.errorCount < 5,
      errors,
      lastError: error,
      lastErrorTime: new Date()
    });

    this.errorSubject.next(error);

    // Auto-recovery for certain errors
    if (error.includes('socket') || error.includes('connection')) {
      this.attemptRecovery();
    }
  }

  // Recovery mechanisms
  private attemptRecovery(): void {
    console.log('🔄 Attempting app recovery...');
    
    // Reset socket connection
    try {
      this.socketService.disconnect();
      setTimeout(() => {
        this.socketService.connect();
      }, 1000);
    } catch (error) {
      console.warn('Socket recovery failed:', error);
    }

    // Clear localStorage if corrupted
    if (this.healthStatusSubject.value.errors.some(e => e.includes('localStorage'))) {
      this.clearCorruptedStorage();
    }

    this.recoverySubject.next();
  }

  private clearCorruptedStorage(): void {
    console.log('🧹 Clearing potentially corrupted localStorage...');
    const keysToPreserve = ['accessToken', 'token', 'user'];
    
    try {
      const allKeys = Object.keys(localStorage);
      allKeys.forEach(key => {
        if (!keysToPreserve.includes(key)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Failed to clear localStorage:', error);
    }
  }

  // Health monitoring
  private startHealthMonitoring(): void {
    setInterval(() => {
      this.updateHealthStatus();
    }, 5000); // Check every 5 seconds
  }

  private updateHealthStatus(): void {
    const currentStatus = this.healthStatusSubject.value;
    
    // Check localStorage health
    let localStorageHealthy = true;
    try {
      localStorage.setItem('health_check', 'test');
      localStorage.removeItem('health_check');
    } catch (error) {
      localStorageHealthy = false;
    }

    // Check memory usage
    const memoryUsage = this.getMemoryUsage();

    // Check service health
    const authHealthy = this.checkAuthServiceHealth();
    const socketHealthy = this.checkSocketServiceHealth();

    const isHealthy = localStorageHealthy && authHealthy && socketHealthy && this.errorCount < 5;

    this.healthStatusSubject.next({
      ...currentStatus,
      isHealthy,
      authService: authHealthy,
      socketService: socketHealthy,
      localStorage: localStorageHealthy,
      memoryUsage,
      activeSubscriptions: this.subscriptionCount
    });
  }

  private checkAuthServiceHealth(): boolean {
    try {
      // Check if auth service is responsive
      const token = this.authService.getToken();
      return token !== null && token !== undefined;
    } catch (error) {
      return false;
    }
  }

  private checkSocketServiceHealth(): boolean {
    try {
      return this.socketService.getConnectionStatus();
    } catch (error) {
      return false;
    }
  }

  private getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize / (performance as any).memory.jsHeapSizeLimit;
    }
    return 0;
  }

  private startErrorResetTimer(): void {
    setInterval(() => {
      if (this.errorCount > 0) {
        this.errorCount = Math.max(0, this.errorCount - 1);
        console.log('🔄 Error count reset, current count:', this.errorCount);
      }
    }, this.ERROR_RESET_INTERVAL);
  }

  // Public recovery methods
  forceRecovery(): void {
    console.log('🔄 Force recovery initiated...');
    this.errorCount = 0;
    this.attemptRecovery();
  }

  getHealthStatus(): AppHealthStatus {
    return this.healthStatusSubject.value;
  }

  isAppHealthy(): boolean {
    return this.healthStatusSubject.value.isHealthy;
  }

  // Debug methods
  debugAppHealth(): void {
    const status = this.getHealthStatus();
    console.log('🔍 App Health Status:', status);
    console.log('🔍 Active Subscriptions:', this.subscriptionCount);
    console.log('🔍 Error Count:', this.errorCount);
  }
} 