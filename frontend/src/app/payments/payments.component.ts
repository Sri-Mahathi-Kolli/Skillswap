import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { OverviewTabComponent } from './overview-tab/overview-tab.component';
import { HistoryTabComponent } from './history-tab/history-tab.component';
import { IncomeTabComponent } from './income-tab/income-tab.component';

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatCardModule,
    MatIconModule,
    OverviewTabComponent,
    HistoryTabComponent,
    IncomeTabComponent
  ],
  template: `
    <div class="payments-container">
      <div class="payments-header">
        <h2><mat-icon>account_balance_wallet</mat-icon> Payments Dashboard</h2>
        <p>Manage your transactions, income, and payment settings</p>
      </div>

      <mat-tab-group class="payments-tabs" animationDuration="300ms">
        <mat-tab label="Overview">
          <ng-template matTabContent>
            <app-overview-tab></app-overview-tab>
          </ng-template>
        </mat-tab>
        
        <mat-tab label="History">
          <ng-template matTabContent>
            <app-history-tab></app-history-tab>
          </ng-template>
        </mat-tab>
        
        <mat-tab label="Income">
          <ng-template matTabContent>
            <app-income-tab></app-income-tab>
          </ng-template>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .payments-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }

    .payments-header {
      text-align: center;
      margin-bottom: 30px;
    }

    .payments-header h2 {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      color: #333;
      margin-bottom: 10px;
    }

    .payments-header p {
      color: #666;
      font-size: 16px;
    }

    .payments-tabs {
      margin-top: 20px;
    }

    ::ng-deep .mat-mdc-tab-group {
      --mdc-tab-indicator-active-indicator-color: #007bff;
    }

    ::ng-deep .mat-mdc-tab .mdc-tab__text-label {
      color: #333;
    }

    ::ng-deep .mat-mdc-tab-body-content {
      padding: 20px 0;
    }
  `]
})
export class PaymentsComponent implements OnInit {

  constructor() { }

  ngOnInit(): void {
  }

}
