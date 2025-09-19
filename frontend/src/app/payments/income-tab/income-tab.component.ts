import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { PaymentService, Transaction, IncomeAnalysis } from '../../services/payment.service';
import { PaymentsRefreshService } from '../../services/payments-refresh.service';
import { MatPaginatorModule } from '@angular/material/paginator';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-income-tab',
  standalone: true,
  imports: [
    CommonModule, 
    MatCardModule, 
    MatIconModule, 
    MatButtonModule, 
    MatTableModule,
    MatSelectModule,
    MatFormFieldModule,
    FormsModule,
    MatPaginatorModule
  ],
  template: `
    <div class="income-container">
      <!-- Income Analysis Chart -->
      <mat-card class="analysis-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>trending_up</mat-icon>
            Income Analysis
          </mat-card-title>
          <div class="period-selector">
            <mat-form-field appearance="outline">
              <mat-label>Analysis Period</mat-label>
              <mat-select [(value)]="selectedPeriod" (selectionChange)="onPeriodChange()">
                <mat-option value="daily">Daily (Last 30 days)</mat-option>
                <mat-option value="weekly">Weekly (Last 12 weeks)</mat-option>
                <mat-option value="monthly">Monthly (Last 12 months)</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </mat-card-header>
        
        <mat-card-content>
          <div class="analysis-summary">
            <div class="summary-item">
              <h4>Total Income</h4>
              <p class="amount">\${{getTotalIncome() | number:'1.2-2'}}</p>
            </div>
            <div class="summary-item">
              <h4>Average per {{selectedPeriod}}</h4>
              <p class="amount">\${{getAverageIncome() | number:'1.2-2'}}</p>
            </div>
            <div class="summary-item">
              <h4>Sessions Completed</h4>
              <p class="amount">{{incomeTransactions.length}}</p>
            </div>
          </div>

          <!-- Simple Bar Chart -->
          <ng-container *ngIf="chartDataArray.length > 0">
            <div class="chart-container">
              <h4>Income Trend</h4>
              <div class="simple-chart">
                <div *ngFor="let item of chartDataArray" class="chart-bar">
                  <div 
                    class="bar" 
                    [style.height.px]="getBarHeight(item.amount)"
                    [title]="item.label + ': $' + (item.amount | number:'1.2-2')">
                  </div>
                  <span class="bar-label">{{formatLabel(item.label)}}</span>
                </div>
              </div>
            </div>
          </ng-container>
        </mat-card-content>
      </mat-card>

      <!-- Income Transactions -->
      <mat-card class="transactions-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>payments</mat-icon>
            Income Transactions
          </mat-card-title>
        </mat-card-header>
        
        <mat-card-content>
          <div class="transactions-table">
            <table mat-table [dataSource]="pagedIncomeTransactions" class="full-width-table">
              <!-- Date Column -->
              <ng-container matColumnDef="date">
                <th mat-header-cell *matHeaderCellDef>Date</th>
                <td mat-cell *matCellDef="let transaction">
                  {{transaction.date | date:'MMM dd, yyyy HH:mm'}}
                </td>
              </ng-container>

              <!-- Description Column -->
              <ng-container matColumnDef="description">
                <th mat-header-cell *matHeaderCellDef>Session Details</th>
                <td mat-cell *matCellDef="let transaction">
                  <div class="session-details">
                    <span class="description">{{transaction.description}}</span>
                    <small *ngIf="transaction.sessionId" class="session-id">Session ID: {{transaction.sessionId}}</small>
                  </div>
                </td>
              </ng-container>

              <!-- Amount Column -->
              <ng-container matColumnDef="amount">
                <th mat-header-cell *matHeaderCellDef>Amount</th>
                <td mat-cell *matCellDef="let transaction">
                  <div class="income-amount">
                    <span>+\${{transaction.amount | number:'1.2-2'}}</span>
                  </div>
                </td>
              </ng-container>

              <!-- Status Column -->
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let transaction">
                  <div class="status-badge" [ngClass]="transaction.status">
                    <mat-icon>{{getStatusIcon(transaction.status)}}</mat-icon>
                    <span>{{transaction.status | titlecase}}</span>
                  </div>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
            </table>

            <div *ngIf="incomeTransactions.length === 0" class="no-income">
              <mat-icon>monetization_on</mat-icon>
              <h3>No income yet</h3>
              <p>Start teaching sessions to see your income here!</p>
            </div>

            <mat-paginator 
              [length]="incomeTransactions.length"
              [pageSize]="pageSize"
              [pageIndex]="pageIndex"
              [pageSizeOptions]="[5, 10, 20]"
              (page)="onPageChange($event)">
            </mat-paginator>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .income-container {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    mat-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    mat-card-title {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #333;
    }

    .period-selector mat-form-field {
      min-width: 200px;
    }

    .analysis-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
      padding: 20px;
      background-color: #f8f9fa;
      border-radius: 8px;
    }

    .summary-item {
      text-align: center;
    }

    .summary-item h4 {
      margin: 0 0 8px 0;
      font-size: 14px;
      color: #666;
      font-weight: 500;
    }

    .summary-item .amount {
      margin: 0;
      font-size: 24px;
      font-weight: bold;
      color: #4caf50;
    }

    .chart-container {
      margin-top: 20px;
    }

    .chart-container h4 {
      margin: 0 0 20px 0;
      color: #333;
    }

    .simple-chart {
      display: flex;
      align-items: end;
      justify-content: space-between;
      height: 200px;
      padding: 20px;
      background-color: #fafafa;
      border-radius: 8px;
      gap: 5px;
    }

    .chart-bar {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
      max-width: 40px;
    }

    .bar {
      background: linear-gradient(180deg, #4caf50 0%, #66bb6a 100%);
      width: 100%;
      border-radius: 4px 4px 0 0;
      min-height: 4px;
      transition: all 0.3s ease;
      cursor: pointer;
    }

    .bar:hover {
      opacity: 0.8;
    }

    .bar-label {
      font-size: 10px;
      color: #666;
      margin-top: 8px;
      text-align: center;
      transform: rotate(-45deg);
      transform-origin: center;
      white-space: nowrap;
    }

    .transactions-table {
      overflow-x: auto;
    }

    .full-width-table {
      width: 100%;
    }

    .session-details {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .session-details .description {
      font-weight: 500;
    }

    .session-details .session-id {
      color: #666;
      font-size: 12px;
    }

    .income-amount {
      font-weight: bold;
      font-size: 14px;
      color: #4caf50;
    }

    .status-badge {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }

    .status-badge.completed {
      background-color: #e8f5e8;
      color: #4caf50;
    }

    .status-badge.pending {
      background-color: #fff3e0;
      color: #ff9800;
    }

    .status-badge.failed {
      background-color: #ffeaea;
      color: #f44336;
    }

    .no-income {
      text-align: center;
      padding: 40px 20px;
      color: #666;
    }

    .no-income mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
      color: #ccc;
    }

    .no-income h3 {
      margin: 0 0 8px 0;
      font-size: 18px;
    }

    .no-income p {
      margin: 0;
      font-size: 14px;
    }

    ::ng-deep .mat-mdc-table {
      background: transparent;
    }

    ::ng-deep .mat-mdc-header-row {
      background-color: #f5f5f5;
    }

    ::ng-deep .mat-mdc-row:hover {
      background-color: #f9f9f9;
    }
  `]
})
export class IncomeTabComponent implements OnInit {
  chartData: any[] = [];
  allTransactions: Transaction[] = [];
  incomeTransactions: Transaction[] = [];
  pagedIncomeTransactions: Transaction[] = [];
  pageSize = 10;
  pageIndex = 0;

  get chartDataArray(): any[] {
    return Array.isArray(this.chartData) ? this.chartData : [];
  }

  get incomeTransactionsArray(): Transaction[] {
    return Array.isArray(this.incomeTransactions) ? this.incomeTransactions : [];
  }

  incomeAnalysis: IncomeAnalysis | null = {
    daily: [],
    weekly: [],
    monthly: []
  };
  displayedColumns: string[] = ['date', 'description', 'amount', 'status'];
  selectedPeriod: 'daily' | 'weekly' | 'monthly' = 'daily';

  constructor(private paymentService: PaymentService, private paymentsRefresh: PaymentsRefreshService, private authService: AuthService) { }

  ngOnInit(): void {
    this.loadIncomeData();
    this.paymentsRefresh.refresh$.subscribe(() => {
      this.loadIncomeData();
    });
  }

  loadIncomeData(): void {
    // Load all transactions and filter for income
    const user = this.authService.getCurrentUserValue();
    const userId = user?.id || user?._id || '';
    this.paymentService.getTransactionHistory().subscribe({
      next: (transactions) => {
        this.allTransactions = Array.isArray(transactions) ? transactions.map((tx: any) => {
          let type = '';
          if (tx.mentorId === userId || tx.mentorDetails?._id === userId) {
            type = 'income';
          } else if (tx.userId?._id === userId) {
            type = 'expense';
          }
          return {
            ...tx,
            type,
            date: tx.createdAt || tx.date,
            description: tx.metadata?.sessionType
              ? `Session: ${tx.metadata.sessionType}${tx.clientName ? ' for ' + tx.clientName : ''}`
              : (tx.clientName ? `Session for ${tx.clientName}` : 'Income'),
            status: tx.status || 'completed'
          };
        }) : [];
        this.incomeTransactions = this.allTransactions.filter((t: any) => t.type === 'income');
        this.pageIndex = 0;
        this.updatePagedIncomeTransactions();
      },
      error: (error) => {
        console.error('Error loading transactions:', error);
        this.allTransactions = [];
        this.incomeTransactions = [];
        this.pagedIncomeTransactions = [];
        this.pageIndex = 0;
      }
    });

    // Load income analysis
    this.loadIncomeAnalysis();
  }

  updatePagedIncomeTransactions(): void {
    const start = this.pageIndex * this.pageSize;
    this.pagedIncomeTransactions = this.incomeTransactions.slice(start, start + this.pageSize);
  }

  onPageChange(event: any): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.updatePagedIncomeTransactions();
  }

  loadIncomeAnalysis(): void {
    this.paymentService.getIncomeAnalysis(this.selectedPeriod).subscribe({
      next: (analysis) => {
        this.incomeAnalysis = analysis;
        this.updateChartData();
      },
      error: (error) => {
        console.error('Error loading income analysis:', error);
        this.incomeAnalysis = null;
        this.chartData = [];
      }
    });
  }

  onPeriodChange(): void {
    this.loadIncomeAnalysis();
  }

  updateChartData(): void {
    // Use filtered income transactions for chart data
    if (!this.incomeTransactions || this.incomeTransactions.length === 0) {
      this.chartData = [];
      return;
    }
    // Group by selected period
    const groupBy = (arr: any[], keyFn: (t: any) => string) => {
      const map = new Map<string, number>();
      arr.forEach(t => {
        const key = keyFn(t);
        map.set(key, (map.get(key) || 0) + (t.amount || 0));
      });
      return Array.from(map.entries()).map(([label, amount]) => ({ label, amount }));
    };
    switch (this.selectedPeriod) {
      case 'daily':
        this.chartData = groupBy(this.incomeTransactions, t => new Date(t.date).toISOString().slice(0, 10));
        break;
      case 'weekly':
        this.chartData = groupBy(this.incomeTransactions, t => {
          const d = new Date(t.date);
          const year = d.getFullYear();
          const week = Math.ceil((((d.getTime() - new Date(year, 0, 1).getTime()) / 86400000) + new Date(year, 0, 1).getDay() + 1) / 7);
          return `${year}-W${week}`;
        });
        break;
      case 'monthly':
        this.chartData = groupBy(this.incomeTransactions, t => {
          const d = new Date(t.date);
          return `${d.getFullYear()}-${('0' + (d.getMonth() + 1)).slice(-2)}`;
        });
        break;
    }
  }

  getTotalIncome(): number {
    // Use filtered income transactions for total
    return this.incomeTransactions.reduce((total, t) => total + (t.amount || 0), 0);
  }

  getAverageIncome(): number {
    if (this.incomeTransactions.length === 0) return 0;
    return this.getTotalIncome() / this.incomeTransactions.length;
  }

  getBarHeight(amount: number): number {
    if (this.chartData.length === 0) return 0;
    const maxAmount = Math.max(...this.chartData.map(item => item.amount));
    if (maxAmount === 0) return 4;
    return Math.max(4, (amount / maxAmount) * 160);
  }

  formatLabel(label: string): string {
    if (this.selectedPeriod === 'daily') {
      return new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return label;
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'completed':
        return 'check_circle';
      case 'pending':
        return 'schedule';
      case 'failed':
        return 'error';
      default:
        return 'help';
    }
  }
}
