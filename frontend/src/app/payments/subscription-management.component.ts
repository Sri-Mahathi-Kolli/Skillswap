import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentService, Subscription } from '../services/payment.service';

@Component({
  selector: 'app-subscription-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="subscription-management">
      <h4>Subscription Management</h4>
      
      <div *ngIf="loading" class="text-center">
        <div class="spinner-border" role="status">
          <span class="sr-only">Loading...</span>
        </div>
      </div>

      <div *ngIf="!loading && subscriptions.length === 0" class="alert alert-info">
        <h5>No Active Subscriptions</h5>
        <p>You don't have any active subscriptions. Subscribe to premium features to get started!</p>
      </div>

      <div *ngIf="!loading && subscriptions.length > 0" class="subscriptions-list">
        <div *ngFor="let subscription of subscriptionsArray" class="subscription-card card mb-3">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <h5 class="card-title">{{ subscription.plan.name }}</h5>
                <p class="card-text">
                  <strong>{{ formatCurrency(subscription.plan.amount, subscription.plan.currency) }}</strong>
                  per month
                </p>
                <p class="text-muted">
                  Current period: {{ formatDate(subscription.current_period_start) }} - 
                  {{ formatDate(subscription.current_period_end) }}
                </p>
              </div>
              <div>
                <span [class]="'badge ' + getStatusBadgeClass(subscription.status)">
                  {{ subscription.status | titlecase }}
                </span>
              </div>
            </div>
            <div class="mt-3">
              <button 
                *ngIf="subscription.status === 'active'"
                class="btn btn-outline-danger btn-sm"
                (click)="cancelSubscription(subscription.id)"
                [disabled]="loading">
                Cancel Subscription
              </button>
            </div>
          </div>
        </div>
      </div>

      <div *ngIf="errorMessage" class="alert alert-danger">
        {{ errorMessage }}
      </div>

      <div *ngIf="successMessage" class="alert alert-success">
        {{ successMessage }}
      </div>
    </div>
  `,
  styles: [`
    .subscription-card {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
    }

    .badge.bg-success {
      background-color: #28a745 !important;
    }

    .badge.bg-warning {
      background-color: #ffc107 !important;
      color: #212529 !important;
    }

    .badge.bg-danger {
      background-color: #dc3545 !important;
    }

    .subscription-management {
      padding: 1rem;
    }
  `]
})
export class SubscriptionManagementComponent implements OnInit {
  subscriptions: any[] = [];
  loading = false;
  errorMessage = '';
  successMessage = '';

  constructor(private paymentService: PaymentService) {}

  ngOnInit(): void {
    this.loadSubscriptions();
  }

  loadSubscriptions(): void {
    this.loading = true;
    this.paymentService.getSubscriptions().subscribe({
      next: (subscriptions) => {
        this.subscriptions = subscriptions;
      },
      error: (error) => {
        console.error('Error loading subscriptions:', error);
        this.errorMessage = 'Failed to load subscriptions';
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  cancelSubscription(subscriptionId: string): void {
    if (!confirm('Are you sure you want to cancel this subscription?')) {
      return;
    }

    this.loading = true;
    this.paymentService.cancelSubscription(subscriptionId).subscribe({
      next: () => {
        this.successMessage = 'Subscription cancelled successfully';
        this.loadSubscriptions();
      },
      error: (error) => {
        console.error('Error cancelling subscription:', error);
        this.errorMessage = 'Failed to cancel subscription';
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  formatCurrency(amount: number | string, currency: string = 'usd'): string {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(numAmount / 100);
  }

  formatDate(dateInput: string | number): string {
    const date = typeof dateInput === 'number' ? new Date(dateInput * 1000) : new Date(dateInput);
    return date.toLocaleDateString();
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'active':
        return 'bg-success';
      case 'past_due':
        return 'bg-warning';
      case 'canceled':
        return 'bg-danger';
      default:
        return 'bg-secondary';
    }
  }

  get subscriptionsArray(): any[] {
    return Array.isArray(this.subscriptions) ? this.subscriptions : [];
  }
}
