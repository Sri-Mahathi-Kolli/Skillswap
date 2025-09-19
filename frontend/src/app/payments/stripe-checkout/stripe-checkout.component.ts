import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';
import { PaymentService } from '../../services/payment.service';
import { PaymentsRefreshService } from '../../services/payments-refresh.service';
import { environment } from '../../../environments/environment';

declare var Stripe: any;

@Component({
  selector: 'app-stripe-checkout',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div *ngIf="loading" class="loading-state">
      <mat-spinner></mat-spinner>
      <p>Processing your payment...</p>
    </div>

    <div *ngIf="error" class="error-state">
      <mat-icon>error</mat-icon>
      <h3>Payment Failed</h3>
      <p>{{error}}</p>
      <button mat-raised-button color="primary" (click)="retryPayment()">
        Try Again
      </button>
    </div>

    <div *ngIf="success" class="success-state">
      <mat-icon>check_circle</mat-icon>
      <h3>Payment Successful!</h3>
      <p>Your session has been booked successfully. The mentor has been notified.</p>
      <div class="action-buttons">
        <button mat-raised-button color="primary" (click)="goToPayments()">
          View Payments
        </button>
      </div>
    </div>
  `,
  styles: [`
    .checkout-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 60vh;
      padding: 20px;
    }

    .checkout-card {
      max-width: 500px;
      width: 100%;
    }

    mat-card-title {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #333;
    }

    .session-details {
      margin-bottom: 30px;
      padding: 20px;
      background-color: #f8f9fa;
      border-radius: 8px;
    }

    .session-details h3 {
      margin: 0 0 15px 0;
      color: #333;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }

    .detail-row:last-child {
      border-bottom: none;
    }

    .detail-row .amount {
      font-weight: bold;
      color: #4caf50;
      font-size: 18px;
    }

    .loading-state {
      text-align: center;
      padding: 40px 20px;
    }

    .loading-state mat-spinner {
      margin: 0 auto 20px auto;
    }

    .error-state {
      text-align: center;
      padding: 40px 20px;
      color: #f44336;
    }

    .error-state mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
    }

    .error-state h3 {
      margin: 0 0 10px 0;
    }

    .error-state p {
      margin: 0 0 20px 0;
      color: #666;
    }

    .success-state {
      text-align: center;
      padding: 40px 20px;
      color: #4caf50;
    }

    .success-state mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
    }

    .success-state h3 {
      margin: 0 0 10px 0;
    }

    .success-state p {
      margin: 0 0 20px 0;
      color: #666;
    }

    .action-buttons {
      display: flex;
      gap: 10px;
      justify-content: center;
    }

    .card-label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: #333;
    }

    #card-element {
      padding: 20px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      margin-bottom: 20px;
      background-color: #fff;
      transition: border-color 0.3s ease;
    }

    #card-element:focus-within {
      border-color: #4caf50;
      box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
    }

    .card-errors {
      color: #f44336;
      font-size: 14px;
      margin-bottom: 16px;
      min-height: 20px;
    }

    .payment-actions {
      text-align: center;
    }

    .payment-actions button {
      padding: 12px 30px;
      font-size: 16px;
      min-width: 200px;
    }

    .payment-actions button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `]
})
export class StripeCheckoutComponent implements OnInit, OnDestroy {
  @Output() stripeRedirect = new EventEmitter<void>();
  error: string = '';
  success: boolean = false;
  processing: boolean = false;
  sessionData: any = null;
  constructor(
    private paymentService: PaymentService,
    private paymentsRefresh: PaymentsRefreshService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  sendPaymentNotification(transaction: any): void {
    const studentName = transaction.userName || transaction.clientName;
    const notifyPayload = {
      mentorId: transaction.mentorId,
      studentName,
      amount: transaction.amount,
      duration: transaction.duration,
      sessionId: transaction.sessionId
    };
    console.log('[FRONTEND-NOTIFY][Stripe] Sending payment notification:', notifyPayload);
    this.paymentService.sendPaymentNotification(notifyPayload).subscribe({
      next: (result) => {
        console.log('[FRONTEND-NOTIFY][Stripe] Notification API response:', result);
      },
      error: (error) => {
        console.error('[FRONTEND-NOTIFY][Stripe] Failed to send notification:', error);
      }
    });
  }
  @Input() mentorId: string = '';
  @Input() mentorName: string = '';
  @Input() duration: number = 30;
  @Input() amount: number = 0;
  @Output() paymentSuccess = new EventEmitter<any>();
  @Output() paymentError = new EventEmitter<any>();

  stripe: any;
  
  loading = false;
    // Check if this is a return from Stripe checkout
  ngOnInit(): void {
    // Check if we are returning from Stripe with a sessionId in the route
    const sessionId = this.route.snapshot.paramMap.get('sessionId');
    if (sessionId) {
      this.loading = true;
      this.paymentService.verifyPayment(sessionId).subscribe({
        next: (result) => {
          this.loading = false;
          if (result && result.success) {
            this.success = true;
            this.paymentsRefresh.triggerRefresh();
          } else {
            this.error = 'Payment not completed or failed. If you believe this is an error, please contact support.';
          }
        },
        error: (err) => {
          this.loading = false;
          this.error = 'Failed to verify payment. Please refresh or contact support.';
        }
      });
    } else {
      // Only initialize Stripe, do not verify payment from frontend
      this.initializeStripe();
    }
  }

  initializeStripe(): void {
    // Check if we're in a secure context (HTTPS)
    if (!environment.production && location.protocol === 'http:') {
      console.warn('Stripe.js integration over HTTP. For production, use HTTPS.');
    }
    // Only load Stripe.js and set up Stripe Checkout
    if (typeof Stripe !== 'undefined') {
      this.stripe = Stripe(environment.stripePublishableKey);
      // Now Stripe is ready, trigger payment
      this.autoTriggerPayment();
    } else {
      this.loadStripeScript()
        .then(() => {
          this.stripe = Stripe(environment.stripePublishableKey);
          // Now Stripe is ready, trigger payment
          this.autoTriggerPayment();
        })
        .catch((error) => {
          console.error('Failed to load Stripe:', error);
          this.error = 'Failed to load payment system. Please check your internet connection and try again.';
        });
    }
  }

  autoTriggerPayment(): void {
    if (this.mentorId && this.amount && this.amount > 0 && this.duration) {
      this.handlePayment();
    }
  }

  loadStripeScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if Stripe is already loaded
      if (typeof Stripe !== 'undefined') {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.async = true;
      script.crossOrigin = 'anonymous';
  // script.integrity removed due to invalid value. For production, use the official hash from Stripe documentation.

      script.onload = () => {
        console.log('Stripe.js loaded successfully');
        resolve();
      };

      script.onerror = (error) => {
        console.error('Failed to load Stripe.js:', error);
        reject(new Error('Failed to load Stripe.js'));
      };

      // Remove any existing Stripe scripts to avoid conflicts
      const existingScript = document.querySelector('script[src*="js.stripe.com"]');
      if (existingScript) {
        existingScript.remove();
      }

      document.head.appendChild(script);
    });
  }



  handlePayment(): void {
    // Validate required data
    if (!this.mentorId || !this.amount || this.amount <= 0) {
      this.error = 'Invalid payment information. Please check mentor and amount details.';
      return;
    }

    if (!this.stripe) {
      this.error = 'Payment system not initialized. Please refresh the page and try again.';
      return;
    }

    this.processing = true;
    this.paymentService.createPaymentSession({
      mentorId: this.mentorId,
      amount: this.amount,
      duration: this.duration
    }).subscribe({
      next: (session: any) => {
        this.sessionData = session;
        this.processing = false;
  // Emit event to parent to hide this component before redirect
  this.stripeRedirect.emit();
        this.stripe.redirectToCheckout({ sessionId: session.sessionId }).then((result: any) => {
          if (result.error) {
            this.error = result.error.message || 'Payment failed. Please try again.';
            console.error('Stripe redirect error:', result.error);
          }
        });
      },
      error: (error) => {
        this.processing = false;
        if (error.status === 409 && (error.error?.message?.includes('Duplicate payment') || error.error?.error?.includes('already been processed'))) {
          this.error = 'This payment has already been processed. Please check your payment history.';
        } else {
          this.error = 'Failed to create payment session. Please check your connection and try again.';
        }
        console.error('Payment session error:', error);
      }
    });
  }

  retryPayment(): void {
    this.error = '';
    this.success = false;
    this.processing = false;
    this.initializeStripe();
  }

  goToSchedule(): void {
    this.router.navigate(['/schedule']);
  }

  goToPayments(): void {
    this.router.navigate(['/payments']);
  }

  ngOnDestroy(): void {
    // Remove any remaining Stripe scripts to prevent conflicts
    const stripeScripts = document.querySelectorAll('script[src*="js.stripe.com"]');
    stripeScripts.forEach(script => script.remove());
  }
}
