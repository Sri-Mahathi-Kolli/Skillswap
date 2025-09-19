import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  currency: string;
  description: string;
  date: Date;
  status: 'completed' | 'pending' | 'failed';
  sessionId?: string;
  userId?: string;
  mentorId?: string;
  stripeSessionId?: string;
}

export interface OverviewStats {
  totalIncome: number;
  totalSpent: number;
  sessionsBooked: number;
  sessionsTaught: number;
}

export interface IncomeAnalysis {
  daily: { date: string; amount: number }[];
  weekly: { week: string; amount: number }[];
  monthly: { month: string; amount: number }[];
}

export interface PaymentSettings {
  stripeEnabled: boolean;
  pricing: {
    thirtyMin: number;
    sixtyMin: number;
    ninetyMin: number;
  };
  currency: string;
  customPricing?: { duration: number; amount: number }[];
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  // Paginated Transaction History
  getTransactionHistoryPaginated(page: number = 1, limit: number = 10): Observable<any> {
    const url = `${this.apiUrl}/transactions?page=${page}&limit=${limit}`;
    return this.http.get<any>(url, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(res => ({
        ...res,
        transactions: (res.transactions || []).map((tx: any) => ({
          ...tx,
          mentorEmail: tx.mentorEmail || (tx.mentorDetails && tx.mentorDetails.email),
          mentorName: tx.mentorName || (tx.mentorDetails && tx.mentorDetails.name),
          clientEmail: tx.userId?.email || tx.userId?.username || '',
          clientName: tx.userId?.name || tx.userId?.username || '',
        }))
      }))
    );
  }
  // Fetch user details by ObjectId
  getUserById(userId: string): Observable<any> {
    return this.http.get<any>(`${this.usersApiUrl}/${userId}`, {
      headers: this.getAuthHeaders()
    });
  }
  // Get payment settings for any user by ID
  getUserPaymentSettings(userId: string): Observable<PaymentSettings> {
    return this.http.get<any>(`${this.usersApiUrl}/${userId}/payment-settings`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(settings => ({
        stripeEnabled: settings.stripeEnabled ?? false,
        pricing: settings.pricing ?? { thirtyMin: 0, sixtyMin: 0, ninetyMin: 0 },
        currency: settings.currency ?? 'USD',
        customPricing: settings.customPricing ?? []
      }))
    );
  }
  private apiUrl = `${environment.apiUrl}/payments`;
  private usersApiUrl = `${environment.apiUrl}/users`;
  private paymentSettingsSubject = new BehaviorSubject<PaymentSettings | null>(null);
  public paymentSettings$ = this.paymentSettingsSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadPaymentSettings();
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  // Overview Stats
  getOverviewStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/overview`, {
      headers: this.getAuthHeaders()
    }).pipe(
      // Map backend response to UI fields
      tap((stats) => {
        // Optionally process stats here if needed
      })
    );
  }

  getRecentActivities(): Observable<any[]> {
    // Fetch overview and extract recentActivities
    return this.http.get<any>(`${this.apiUrl}/overview`, {
      headers: this.getAuthHeaders()
    }).pipe(
      // Map to recentActivities array
      tap((stats) => {
        // Optionally process activities here if needed
      }),
      // Extract recentActivities
      // Use map if you want to transform the data
      // map(stats => stats.recentActivities || [])
    );
  }

  // Transaction History
  getTransactionHistory(type?: 'income' | 'expense'): Observable<Transaction[]> {
    let url = `${this.apiUrl}/transactions?limit=10000`;
    if (type) {
      url += `&type=${type}`;
    }
    return this.http.get<any>(url, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(res => {
        // Show all transactions, and include mentor/user (client) name/email
        return (res.transactions || []).map((tx: any) => ({
          ...tx,
          mentorEmail: tx.mentorEmail || (tx.mentorDetails && tx.mentorDetails.email),
          mentorName: tx.mentorName || (tx.mentorDetails && tx.mentorDetails.name),
          clientEmail: tx.userId?.email || tx.userId?.username || '',
          clientName: tx.userId?.name || tx.userId?.username || '',
        }));
      })
    );
  }

  // Income Analysis
  getIncomeAnalysis(period: 'daily' | 'weekly' | 'monthly'): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/income-analysis`, {
      headers: this.getAuthHeaders(),
      params: { period }
    });
  }

  getIncomeTransactions(): Observable<Transaction[]> {
    return this.http.get<Transaction[]>(`${this.apiUrl}/transactions`, {
      headers: this.getAuthHeaders(),
      params: { type: 'income' }
    });
  }

  // Payment Settings
  loadPaymentSettings(): void {
    this.http.get<any>(`${this.usersApiUrl}/me/payment-settings`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (settings) => {
        // Ensure customPricing is present
        const mappedSettings: PaymentSettings = {
          stripeEnabled: settings.stripeEnabled ?? false,
          pricing: settings.pricing ?? { thirtyMin: 0, sixtyMin: 0, ninetyMin: 0 },
          currency: settings.currency ?? 'USD',
          customPricing: settings.customPricing ?? []
        };
        this.paymentSettingsSubject.next(mappedSettings);
      },
      error: (error) => {
        console.error('Error loading payment settings:', error);
        // Set default settings if none exist
        this.paymentSettingsSubject.next({
          stripeEnabled: false,
          pricing: {
            thirtyMin: 0,
            sixtyMin: 0,
            ninetyMin: 0
          },
          currency: 'USD',
          customPricing: []
        });
      }
    });
  }

  updatePaymentSettings(settings: PaymentSettings): Observable<PaymentSettings> {
    console.log('💾 Updating payment settings:', settings);
    return this.http.put<PaymentSettings>(`${this.usersApiUrl}/me/payment-settings`, settings, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => console.log('✅ Payment settings saved:', response)),
      catchError(error => {
        console.error('❌ Failed to save payment settings:', error);
        throw error;
      })
    );
  }

  // Stripe Payment
  createPaymentSession(data: {
    mentorId: string;
    duration: number;
    amount: number;
    currency?: string;
    connectionId?: string;
  }): Observable<{ sessionId: string; url?: string; stripeUrl?: string }> {
    return this.http.post<{ sessionId: string; url?: string; stripeUrl?: string }>(`${this.apiUrl}/create-checkout-session`, data, {
      headers: this.getAuthHeaders()
    });
  }

  verifyPayment(sessionId: string): Observable<{ success: boolean; transaction: Transaction }> {
    return this.http.post<{ success: boolean; transaction: Transaction }>(`${this.apiUrl}/verify-payment`, 
      { sessionId }, 
      { headers: this.getAuthHeaders() }
    );
  }

  // Notifications
  sendPaymentNotification(data: {
  mentorId: string;
  studentName: string;
  amount: number;
  duration: number;
  sessionId: string;
  studentEmail?: string;
  currency?: string;
  }): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/send-notification`, data, {
      headers: this.getAuthHeaders()
    });
  }
}
