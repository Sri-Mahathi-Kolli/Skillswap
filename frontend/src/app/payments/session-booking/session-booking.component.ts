import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { PaymentService } from '../../services/payment.service';
import { StripeCheckoutComponent } from '../stripe-checkout/stripe-checkout.component';
import { PaymentsRefreshService } from '../../services/payments-refresh.service';

@Component({
  selector: 'app-session-booking',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatSelectModule,
    MatFormFieldModule,
    MatIconModule,
    StripeCheckoutComponent
  ],
  template: `
    <div class="booking-container">
      <button mat-raised-button color="accent" (click)="testNotification()" style="margin-bottom: 16px;">
        Test Notification
      </button>
      <mat-card class="booking-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>event</mat-icon>
            Book a Session with {{mentorName}}
          </mat-card-title>
        </mat-card-header>

        <mat-card-content>
          <div class="mentor-info">
            <h3>{{mentorName}}</h3>
            <p>Select your session duration and proceed to payment.</p>
          </div>

          <div class="duration-selection">
            <h4>Session Duration</h4>
            <mat-form-field appearance="outline" style="width: 100%;">
              <mat-label>Choose Duration</mat-label>
              <mat-select [(value)]="selectedDuration" (selectionChange)="onDurationChange()">
                <mat-option 
                  *ngFor="let option of durationOptions" 
                  [value]="option.duration"
                  [disabled]="false">
                  {{option.label}}
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <div *ngIf="selectedDuration" class="session-summary">
            <h4>Session Summary</h4>
            <div class="summary-details">
              <div class="detail-row">
                <span>Mentor:</span>
                <span>{{mentorName}}</span>
              </div>
              <div class="detail-row">
                <span>Duration:</span>
                <span>{{selectedDuration}} minutes</span>
              </div>
              <div class="detail-row">
                <span>Price:</span>
                <span class="price">{{getSelectedPrice() === 0 ? 'Free' : '$' + getSelectedPrice()}}</span>
              </div>
            </div>
          </div>

          <div class="booking-actions">
            <button 
              mat-button 
              (click)="goBack()"
              class="back-button">
              <mat-icon>arrow_back</mat-icon>
              Back to Skills
            </button>

            <button 
              mat-raised-button 
              color="primary"
              (click)="proceedToPayment()"
              [disabled]="!selectedDuration"
              class="book-button">
              <mat-icon>{{getSelectedPrice() === 0 ? 'event' : 'payment'}}</mat-icon>
              {{getSelectedPrice() === 0 ? 'Book Free Session' : 'Proceed to Payment'}}
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Stripe Checkout Component (hidden by default) -->
      <app-stripe-checkout
        *ngIf="showCheckout"
        [mentorId]="mentorId"
        [mentorName]="mentorName"
        [duration]="selectedDuration"
        [amount]="getSelectedPrice()"
        (paymentSuccess)="onPaymentSuccess($event)"
        (paymentError)="onPaymentError($event)"
        (stripeRedirect)="onStripeRedirect()">
      </app-stripe-checkout>
    </div>
  `,
  styles: [`
    .booking-container {
      max-width: 600px;
      margin: 20px auto;
      padding: 20px;
    }

    .booking-card {
      width: 100%;
    }

    mat-card-title {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #333;
    }

    .mentor-info {
      margin-bottom: 30px;
      text-align: center;
    }

    .mentor-info h3 {
      color: #333;
      margin-bottom: 10px;
    }

    .mentor-info p {
      color: #666;
    }

    .duration-selection {
      margin-bottom: 30px;
    }

    .duration-selection h4 {
      margin-bottom: 15px;
      color: #333;
    }

    .session-summary {
      background-color: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }

    .session-summary h4 {
      margin: 0 0 15px 0;
      color: #333;
    }

    .summary-details {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }

    .detail-row:last-child {
      border-bottom: none;
      font-weight: bold;
    }

    .detail-row .price {
      color: #4caf50;
      font-weight: bold;
    }

    .booking-actions {
      display: flex;
      gap: 15px;
      justify-content: space-between;
    }

    .back-button {
      flex: 1;
    }

    .book-button {
      flex: 2;
      padding: 12px 20px;
    }

    ::ng-deep .mat-mdc-form-field {
      width: 100%;
    }
  `]
})
export class SessionBookingComponent implements OnInit {
  onStripeRedirect(): void {
    this.showCheckout = false;
  }
  testNotification(): void {
    const notifyPayload = {
      mentorId: this.mentorObjectId,
      studentName: localStorage.getItem('userName') || 'Test User',
      amount: 99,
      duration: 30,
      sessionId: 'test-session-id',
      studentEmail: localStorage.getItem('userEmail') || '',
      currency: 'USD'
    };
    console.log('[FRONTEND-NOTIFY][Test] Sending test notification:', notifyPayload);
    this.paymentService.sendPaymentNotification(notifyPayload).subscribe({
      next: (result) => {
        console.log('[FRONTEND-NOTIFY][Test] Notification API response:', result);
        alert('Test notification sent!');
      },
      error: (err) => {
        console.error('[FRONTEND-NOTIFY][Test] Failed to send notification:', err);
        alert('Failed to send test notification.');
      }
    });
  }
  mentorId: string = '';
  mentorObjectId: string = '';
  mentorName: string = '';
  selectedDuration: number = 30;
  showCheckout = false;
  
  durationOptions: { duration: number; label: string; price: number }[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private paymentService: PaymentService,
    private paymentsRefresh: PaymentsRefreshService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      // Always get mentorId from route params (not current user)
      this.mentorId = params['mentorId'] || '';
      this.mentorName = params['mentorName'] || '';
      // Fetch mentor details to get ObjectId
      this.paymentService.getUserById(this.mentorId).subscribe((mentor: any) => {
        // Use mentor._id if available, fallback to mentorId from params
        this.mentorObjectId = mentor && mentor._id ? mentor._id : this.mentorId;
        this.loadMentorPricing();
      });
    });
  }

  loadMentorPricing(): void {
    // Fetch mentor's payment settings
    this.paymentService.getUserPaymentSettings(this.mentorObjectId).subscribe({
      next: (settings: any) => {
        // Always use only 40min duration for paid and free sessions
        let price = 0;
        if (settings && settings.customPricing && settings.customPricing.length > 0) {
          price = settings.customPricing[0].amount;
        }
        let label = price > 0 ? `40 Minutes - $${price}` : '40 Minutes - Free';
        this.durationOptions = [
          { duration: 40, label, price }
        ];
        this.selectedDuration = 40;
      },
      error: () => {
        // Fallback to 40min duration on error
        this.durationOptions = [
          { duration: 40, label: '40 Minutes - Free', price: 0 }
        ];
        this.selectedDuration = 40;
      }
    });
  }

  onDurationChange(): void {
    // Update the selected duration
  }

  getSelectedPrice(): number {
    const option = this.durationOptions.find(opt => opt.duration === this.selectedDuration);
    return option?.price || 0;
  }

  proceedToPayment(): void {
    if (this.getSelectedPrice() === 0) {
      // Handle free session booking
      this.bookFreeSession();
    } else {
      // Show Stripe checkout
      this.showCheckout = true;
    }
  }

  bookFreeSession(): void {
    // Handle free session booking logic here
    alert('Free session booked successfully! You will receive a confirmation soon.');
    this.paymentsRefresh.triggerRefresh();
    this.router.navigate(['/schedule']);
  }

  onPaymentSuccess(transaction: any): void {
  console.log('Payment successful:', transaction);
  const currentUserId = localStorage.getItem('userId') || '';
  console.log('[PAYMENT-NOTIFY] mentorId (should be mentor):', this.mentorObjectId, 'currentUser (should be payer):', currentUserId);
    // Notify mentor after payment
    const notifyPayload = {
      mentorId: this.mentorObjectId,
      studentName: transaction.userName || transaction.clientName || this.mentorName,
      amount: transaction.amount,
      duration: this.selectedDuration,
      sessionId: transaction.sessionId || transaction.id || '',
      studentEmail: transaction.userEmail || transaction.clientEmail || '',
      currency: transaction.currency || 'USD'
    };
    console.log('[FRONTEND-NOTIFY] Sending payment notification:', notifyPayload);
    this.paymentService.sendPaymentNotification(notifyPayload).subscribe({
      next: (result) => {
        console.log('[FRONTEND-NOTIFY] Notification API response:', result);
      },
      error: (err) => {
        console.error('[FRONTEND-NOTIFY] Failed to notify mentor:', err);
      }
    });
    this.paymentsRefresh.triggerRefresh();
    this.router.navigate(['/schedule']);
  }

  onPaymentError(error: any): void {
    console.error('Payment error:', error);
    alert('Payment failed. Please try again.');
  }

  goBack(): void {
    this.router.navigate(['/skills']);
  }
}
