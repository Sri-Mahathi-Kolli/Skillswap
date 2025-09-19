import { Component, OnInit } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { PaymentService, Transaction } from '../../services/payment.service';
import { PaymentsRefreshService } from '../../services/payments-refresh.service';
import { MatPaginatorModule } from '@angular/material/paginator';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-history-tab',
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
    MatPaginatorModule,
    RouterModule
  ],
  templateUrl: './history-tab.component.html',
  styleUrls: ['./history-tab.component.scss']
})
export class HistoryTabComponent implements OnInit {
  displayedColumns: string[] = [
    'fromName',
    'fromEmail',
    'toName',
    'toEmail',
    'amount',
    'duration',
    'currency',
    'createdAt',
    'status'
  ];
  transactions: any[] = [];
  pagedTransactions: any[] = [];
  pageSize = 10;
  pageIndex = 0;
  totalTransactions = 0;

  currentUserId: string = '';
  constructor(
    private paymentService: PaymentService,
    private authService: AuthService,
    private paymentsRefresh: PaymentsRefreshService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadHistoryData();
    this.paymentsRefresh.refresh$.subscribe(() => {
      this.loadHistoryData();
    });
  }

  loadHistoryData(): void {
    const user = this.authService.getCurrentUserValue();
    this.currentUserId = user?.id || user?._id || '';
    this.loadTransactions();
  }

  loadTransactions(): void {
    this.paymentService.getTransactionHistory().subscribe({
      next: (transactions: any[]) => {
        // Only show completed payments
        const completedTx = Array.isArray(transactions)
          ? transactions.filter((tx: any) => tx.status === 'completed')
          : [];
        // Add type for +/-, based on current user
        this.transactions = completedTx.map((tx: any) => {
          let type = 'expense';
          if (tx.userId?._id === this.currentUserId || tx.userId === this.currentUserId) type = 'expense';
          else if (tx.mentorDetails?._id === this.currentUserId || tx.mentorId === this.currentUserId) type = 'income';
          return { ...tx, type };
        });
        this.totalTransactions = this.transactions.length;
        this.updatePagedTransactions();
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading transactions:', error);
        this.transactions = [];
        this.pagedTransactions = [];
        this.totalTransactions = 0;
        this.cdr.detectChanges();
      }
    });
  }

  updatePagedTransactions(): void {
    const start = this.pageIndex * this.pageSize;
    this.pagedTransactions = this.transactions.slice(start, start + this.pageSize);
  }

  onPageChange(event: any): void {
  this.pageIndex = event.pageIndex;
  this.pageSize = event.pageSize;
  this.loadTransactions();
  }
}
