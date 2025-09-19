import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-test-notifications',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="test-container">
      <h2>🔔 Notification Test Tool</h2>
      
      <div class="test-section">
        <h3>Current User Info</h3>
        <button (click)="getCurrentUser()" class="btn btn-primary">👤 Get Current User</button>
        <div *ngIf="currentUser" class="result success">
          ✅ User: {{currentUser.name}} (ID: {{currentUser._id}})
        </div>
      </div>

      <div class="test-section">
        <h3>Test Notification</h3>
        <button (click)="sendTestNotification()" class="btn btn-warning" [disabled]="!currentUser">
          🔔 Send Test Notification
        </button>
      </div>

      <div class="test-section">
        <h3>Check Notifications</h3>
        <button (click)="checkNotifications()" class="btn btn-info">📋 Check My Notifications</button>
        <div *ngIf="notifications.length > 0" class="result success">
          <h4>📊 Found {{notifications.length}} notifications:</h4>
          <div *ngFor="let notification of notifications; let i = index" class="notification-item">
            {{i + 1}}. {{notification.type}}: {{notification.message}}
            <small>({{notification.createdAt | date:'short'}})</small>
          </div>
        </div>
        <div *ngIf="notificationsChecked && notifications.length === 0" class="result warning">
          📭 No notifications found
        </div>
      </div>

      <div class="test-section">
        <h3>Debug Logs</h3>
        <div class="logs">
          <div *ngFor="let log of logs" [class]="'log log-' + log.type">
            <strong>{{log.timestamp}}:</strong> {{log.message}}
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .test-container {
      max-width: 800px;
      margin: 20px auto;
      padding: 20px;
      font-family: Arial, sans-serif;
    }
    
    .test-section {
      margin: 20px 0;
      padding: 15px;
      border: 1px solid #ddd;
      border-radius: 8px;
    }
    
    .btn {
      padding: 10px 20px;
      margin: 10px 5px;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-weight: bold;
    }
    
    .btn-primary { background: #007bff; color: white; }
    .btn-warning { background: #ffc107; color: black; }
    .btn-info { background: #17a2b8; color: white; }
    .btn:disabled { background: #ccc; cursor: not-allowed; }
    
    .result {
      margin: 10px 0;
      padding: 10px;
      border-radius: 5px;
    }
    
    .success { background: #d4edda; border: 1px solid #c3e6cb; }
    .warning { background: #fff3cd; border: 1px solid #ffeaa7; }
    .error { background: #f8d7da; border: 1px solid #f5c6cb; }
    
    .notification-item {
      margin: 5px 0;
      padding: 8px;
      background: #f8f9fa;
      border-left: 3px solid #007bff;
    }
    
    .logs {
      max-height: 300px;
      overflow-y: auto;
      background: #f8f9fa;
      padding: 10px;
      border-radius: 5px;
    }
    
    .log {
      margin: 2px 0;
      font-size: 12px;
    }
    
    .log-info { color: #333; }
    .log-success { color: #28a745; }
    .log-error { color: #dc3545; }
    .log-warning { color: #ffc107; }
  `]
})
export class TestNotificationsComponent {
  currentUser: any = null;
  notifications: any[] = [];
  notificationsChecked = false;
  logs: any[] = [];

  constructor(
    private authService: AuthService
  ) {}

  log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    this.logs.push({ message, type, timestamp });
    console.log(`[${timestamp}] ${message}`);
    
    // Keep only last 20 logs
    if (this.logs.length > 20) {
      this.logs = this.logs.slice(-20);
    }
  }

  getCurrentUser() {
    this.log('📡 Getting current user info...');
    
    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        this.currentUser = user;
        this.log(`✅ Current user: ${user.name} (ID: ${user._id})`, 'success');
      },
      error: (error) => {
        this.log(`❌ Error getting user: ${error.message}`, 'error');
      }
    });
  }

  sendTestNotification() {
    if (!this.currentUser) {
      this.log('❌ Please get current user first!', 'error');
      return;
    }

    this.log('📤 Sending test notification...');
    
    const notificationData = {
      mentorId: this.currentUser._id,
      studentName: 'Test Student',
      amount: 25,
      currency: 'USD'
    };

    // Payment service removed - this would send a test notification
    this.log('⚠️ Payment service not available - notifications functionality removed', 'warning');
  }

  checkNotifications() {
    this.log('📋 Checking notifications...');
    
    this.authService.getBookingNotifications().subscribe({
      next: (response) => {
        this.notificationsChecked = true;
        if (response.success) {
          this.notifications = response.data;
          this.log(`📊 Found ${response.data.length} notifications`, 'success');
        } else {
          this.log(`❌ Failed to get notifications`, 'error');
        }
      },
      error: (error) => {
        this.notificationsChecked = true;
        this.log(`❌ Error checking notifications: ${error.message}`, 'error');
      }
    });
  }
}
