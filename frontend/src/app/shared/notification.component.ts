import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, Notification } from '../services/notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="notifications-container">
      <div 
        *ngFor="let notification of notifications" 
        class="notification" 
        [ngClass]="'notification-' + notification.type">
        <div class="notification-content" (click)="removeNotification(notification.id)">
          <span class="notification-icon">
            <i [ngClass]="getIconClass(notification.type)"></i>
          </span>
          <span class="notification-message">{{ notification.message }}</span>
        </div>
        <div class="notification-close" 
             (click)="closeNotification($event, notification.id)"
             (mousedown)="closeNotification($event, notification.id)"
             title="Close notification">
          ×
        </div>
      </div>
    </div>
  `,
  styles: [`
    .notifications-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      max-width: 400px;
    }

    .notification {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      margin-bottom: 8px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      cursor: pointer;
      transition: all 0.3s ease;
      animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .notification:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
    }

    .notification-success {
      background-color: #d4edda;
      border-left: 4px solid #28a745;
      color: #155724;
    }

    .notification-error {
      background-color: #f8d7da;
      border-left: 4px solid #dc3545;
      color: #721c24;
    }

    .notification-warning {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      color: #856404;
    }

    .notification-info {
      background-color: #d1ecf1;
      border-left: 4px solid #17a2b8;
      color: #0c5460;
    }

    .notification-content {
      display: flex;
      align-items: center;
      flex: 1;
    }

    .notification-icon {
      margin-right: 8px;
      font-size: 16px;
    }

    .notification-message {
      flex: 1;
      font-weight: 500;
    }

    .notification-close {
      background: rgba(0, 0, 0, 0.1);
      border: 1px solid rgba(0, 0, 0, 0.2);
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      margin-left: 8px;
      border-radius: 50%;
      color: inherit;
      flex-shrink: 0;
    }

    .notification-close:hover {
      background: rgba(0, 0, 0, 0.2);
      transform: scale(1.1);
      border-color: rgba(0, 0, 0, 0.4);
    }

    .fa-check-circle { color: #28a745; }
    .fa-exclamation-triangle { color: #ffc107; }
    .fa-times-circle { color: #dc3545; }
    .fa-info-circle { color: #17a2b8; }
  `]
})
export class NotificationComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  private subscription: Subscription = new Subscription();

  constructor(private notificationService: NotificationService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.subscription = this.notificationService.notifications$.subscribe(
      notifications => {
        console.log('📢 Notifications updated:', notifications);
        this.notifications = notifications;
      }
    );
    
    // Add a global function for testing
    (window as any).testNotification = () => {
      console.log('🧪 Testing notification...');
      this.notificationService.showSuccess('Test notification - click X to close!', 0); // 0 = no auto-dismiss
    };
    
    (window as any).clearAllNotifications = () => {
      console.log('🗑️ Clearing all notifications...');
      this.notificationService.clearAll();
    };
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  removeNotification(id: string): void {
    console.log('🗑️ Removing notification:', id);
    this.notificationService.removeNotification(id);
  }

  closeNotification(event: Event, id: string): void {
    console.log('✖️ Close button clicked for notification:', id);
    console.log('Event:', event);
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    
    // Check if notification exists before removal
    const notificationExists = this.notifications.find(n => n.id === id);
    console.log('📋 Notification exists:', notificationExists);
    console.log('📋 Current notifications before removal:', this.notifications.length);
    
    // Force immediate removal from local array first
    this.notifications = this.notifications.filter(n => n.id !== id);
    console.log('📋 Local notifications after filter:', this.notifications.length);
    
    // Then remove from service
    this.notificationService.removeNotification(id);
    
    // Force change detection
    this.cdr.detectChanges();
    
    setTimeout(() => {
      console.log('📋 Final notifications count:', this.notifications.length);
      this.cdr.detectChanges();
    }, 100);
  }

  getIconClass(type: string): string {
    switch (type) {
      case 'success': return 'fa fa-check-circle';
      case 'error': return 'fa fa-times-circle';
      case 'warning': return 'fa fa-exclamation-triangle';
      case 'info': return 'fa fa-info-circle';
      default: return 'fa fa-info-circle';
    }
  }
}
