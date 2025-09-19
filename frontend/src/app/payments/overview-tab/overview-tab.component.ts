import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { PaymentService } from '../../services/payment.service';
import { PaymentsRefreshService } from '../../services/payments-refresh.service';

@Component({
  selector: 'app-overview-tab',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, RouterModule],
  template: `
    <div class="overview-container">
      <div class="stats-grid">
        <mat-card class="stat-card income-card">
          <mat-card-content>
            <div class="stat-icon">
              <mat-icon>trending_up</mat-icon>
            </div>
            <div class="stat-info">
              <h3>Total Income</h3>
              <p class="amount">\${{totalIncome | number:'1.2-2'}}</p>
              <span class="period">This month</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card expense-card">
          <mat-card-content>
            <div class="stat-icon">
              <mat-icon>trending_down</mat-icon>
            </div>
            <div class="stat-info">
              <h3>Total Spent</h3>
              <p class="amount">\${{totalSpent | number:'1.2-2'}}</p>
              <span class="period">This month</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card sessions-card">
          <mat-card-content>
            <div class="stat-icon">
              <mat-icon>school</mat-icon>
            </div>
            <div class="stat-info">
              <h3>Sessions Booked</h3>
              <p class="amount">{{sessionsBooked}}</p>
              <span class="period">This month</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card taught-card">
          <mat-card-content>
            <div class="stat-icon">
              <mat-icon>person</mat-icon>
            </div>
            <div class="stat-info">
              <h3>Sessions Taught</h3>
              <p class="amount">{{sessionsTaught}}</p>
              <span class="period">This month</span>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <div class="recent-activity">
        <mat-card>
          <mat-card-header>
            <mat-card-title>
              <mat-icon>history</mat-icon>
              Recent Activity
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="activity-list">
              <div *ngFor="let activity of recentActivitiesArray" class="activity-item">
                <div class="activity-icon" [ngClass]="activity.type">
                  <mat-icon>{{activity.icon}}</mat-icon>
                </div>
                <div class="activity-details">
                  <p class="activity-description">
                    <ng-container *ngIf="activity.type === 'income' && activity.clientName">
                      <a [routerLink]="['/profile', activity.userId?._id || activity.userId]" class="profile-link">Session taught to: {{activity.clientName}}</a>
                    </ng-container>
                    <ng-container *ngIf="activity.type === 'expense' && activity.mentorName">
                      <a [routerLink]="['/profile', activity.mentorId?._id || activity.mentorId]" class="profile-link">Paid to: {{activity.mentorName}}</a>
                    </ng-container>
                    <ng-container *ngIf="!activity.clientName && !activity.mentorName">
                      {{activity.description}}
                    </ng-container>
                  </p>
                  <span class="activity-date">{{activity.date | date:'short'}}</span>
                </div>
                <div class="activity-amount" [ngClass]="activity.type">
                  <span *ngIf="activity.amount">
                    {{activity.type === 'income' ? '+' : '-'}}\${{activity.amount | number:'1.2-2'}}
                  </span>
                </div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .overview-container {
      padding: 20px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .stat-card {
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      transition: transform 0.2s ease;
    }

    .stat-card:hover {
      transform: translateY(-2px);
    }

    .stat-card mat-card-content {
      display: flex;
      align-items: center;
      padding: 20px;
    }

    .stat-icon {
      margin-right: 15px;
      padding: 12px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .income-card .stat-icon {
      background-color: #e8f5e8;
      color: #4caf50;
    }

    .expense-card .stat-icon {
      background-color: #ffeaea;
      color: #f44336;
    }

    .sessions-card .stat-icon {
      background-color: #e3f2fd;
      color: #2196f3;
    }

    .taught-card .stat-icon {
      background-color: #fff3e0;
      color: #ff9800;
    }

    .stat-info h3 {
      margin: 0 0 8px 0;
      color: #333;
      font-size: 14px;
      font-weight: 500;
    }

    .stat-info .amount {
      margin: 0 0 4px 0;
      font-size: 24px;
      font-weight: bold;
      color: #333;
    }

    .stat-info .period {
      color: #666;
      font-size: 12px;
    }

    .recent-activity {
      margin-top: 30px;
    }

    .activity-list {
      max-height: 400px;
      overflow-y: auto;
    }

    .activity-item {
      display: flex;
      align-items: center;
      padding: 15px 0;
      border-bottom: 1px solid #f0f0f0;
    }

    .activity-item:last-child {
      border-bottom: none;
    }

    .activity-icon {
      margin-right: 15px;
      padding: 8px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .activity-icon.income {
      background-color: #e8f5e8;
      color: #4caf50;
    }

    .activity-icon.expense {
      background-color: #ffeaea;
      color: #f44336;
    }

    .activity-details {
      flex: 1;
    }

    .activity-description {
      margin: 0 0 4px 0;
      color: #333;
      font-size: 14px;
    }

    .activity-date {
      color: #666;
      font-size: 12px;
    }

    .activity-amount {
      font-weight: bold;
      font-size: 14px;
    }

    .activity-amount.income {
      color: #4caf50;
    }

    .activity-amount.expense {
      color: #f44336;
    }
  `]
})
export class OverviewTabComponent implements OnInit {
  totalIncome = 0;
  totalSpent = 0;
  sessionsBooked = 0;
  sessionsTaught = 0;
  recentActivities: any[] = [];
  get recentActivitiesArray(): any[] {
    return Array.isArray(this.recentActivities) ? this.recentActivities : [];
  }

  currentUserId: string = '';
  constructor(private paymentService: PaymentService, private authService: AuthService, private paymentsRefresh: PaymentsRefreshService) { }

  ngOnInit(): void {
    const user = this.authService.getCurrentUserValue();
    this.currentUserId = user?.id || user?._id || '';
    this.loadOverviewData();
    this.paymentsRefresh.refresh$.subscribe(() => {
      this.loadOverviewData();
    });
  }

  loadOverviewData(): void {
    // Use full transaction history for totals
    this.paymentService.getTransactionHistory().subscribe({
      next: (transactions) => {
        const userId = this.currentUserId;
        // Only include completed transactions
        const completedTx = transactions.filter((tx: any) => tx.status === 'completed');
        const mappedTx = completedTx.map((tx: any) => {
          let type = '';
          if (tx.mentorId === userId || tx.mentorDetails?._id === userId) {
            type = 'income';
          } else if (tx.userId?._id === userId) {
            type = 'expense';
          }
          return { ...tx, type };
        });
        this.totalIncome = mappedTx
          .filter((a: any) => a.type === 'income')
          .reduce((sum: number, a: any) => sum + (a.amount || 0), 0);
        this.totalSpent = mappedTx
          .filter((a: any) => a.type === 'expense')
          .reduce((sum: number, a: any) => sum + (a.amount || 0), 0);
        this.sessionsTaught = mappedTx.filter((a: any) => a.type === 'income').length;
        this.sessionsBooked = mappedTx.filter((a: any) => a.type === 'expense').length;

        // Still show recent activities for the activity list
        this.paymentService.getOverviewStats().subscribe({
          next: (stats) => {
            const activities = stats.recentActivities || [];
            this.recentActivities = activities.map((activity: any) => ({
              icon: activity.type === 'income' ? 'school' : 'person',
              type: activity.type,
              description:
                activity.type === 'income'
                  ? (activity.clientName ? `Session taught to: ${activity.clientName}` : 'Session taught')
                  : (activity.mentorName ? `Paid to ${activity.mentorName}` : 'Session booked'),
              amount: activity.amount,
              date: activity.createdAt
            }));
          },
          error: (error) => {
            console.error('Error loading recent activities:', error);
          }
        });
      },
      error: (error) => {
        console.error('Error loading transaction history:', error);
      }
    });
  }
}
