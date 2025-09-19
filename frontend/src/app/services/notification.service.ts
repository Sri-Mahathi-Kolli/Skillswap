import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();

  private notifications: Notification[] = [];

  constructor() {}

  showSuccess(message: string, duration: number = 5000): void {
    this.addNotification({
      message,
      type: 'success',
      duration
    });
  }

  showError(message: string, duration: number = 7000): void {
    this.addNotification({
      message,
      type: 'error',
      duration
    });
  }

  showWarning(message: string, duration: number = 6000): void {
    this.addNotification({
      message,
      type: 'warning',
      duration
    });
  }

  showInfo(message: string, duration: number = 5000): void {
    this.addNotification({
      message,
      type: 'info',
      duration
    });
  }

  private addNotification(notification: Omit<Notification, 'id' | 'timestamp'>): void {
    const newNotification: Notification = {
      ...notification,
      id: this.generateId(),
      timestamp: new Date()
    };

    this.notifications = [...this.notifications, newNotification];
    this.notificationsSubject.next(this.notifications);

    // Auto-remove notification after duration
    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        this.removeNotification(newNotification.id);
      }, notification.duration);
    }
  }

  removeNotification(id: string): void {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.notificationsSubject.next(this.notifications);
  }

  clearAll(): void {
    this.notifications = [];
    this.notificationsSubject.next(this.notifications);
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}
