import { Component, OnInit } from '@angular/core';
import { AuthService } from './core/services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-test-user',
  imports: [CommonModule],
  template: `
    <div style="padding: 20px; background: #f5f5f5; border-radius: 8px; margin: 20px;">
      <h2>🔍 Current User Debug Info</h2>
      
      <div *ngIf="currentUser" style="background: white; padding: 15px; border-radius: 5px; margin: 10px 0;">
        <h3>👤 Current User:</h3>
        <p><strong>Name:</strong> {{ currentUser.name }}</p>
        <p><strong>Email:</strong> {{ currentUser.email }}</p>
        <p><strong>ID:</strong> {{ currentUser._id || currentUser.id }}</p>
        <p><strong>Connection Requests:</strong> {{ currentUser.connectionRequests?.length || 0 }}</p>
        <p><strong>Pending Requests:</strong> {{ getPendingCount() }}</p>
      </div>

      <div *ngIf="currentUser?.connectionRequests?.length > 0" style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 10px 0;">
        <h3>📝 Connection Requests:</h3>
        <div *ngFor="let req of currentUser.connectionRequests" style="background: white; padding: 10px; margin: 5px 0; border-radius: 3px;">
          <p><strong>From:</strong> {{ req.from }}</p>
          <p><strong>Status:</strong> {{ req.status }}</p>
          <p><strong>Message:</strong> {{ req.message || 'No message' }}</p>
          <p><strong>Created:</strong> {{ req.createdAt | json }}</p>
        </div>
      </div>

      <div *ngIf="!currentUser?.connectionRequests?.length" style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 10px 0;">
        <h3>⚠️ No Connection Requests Found</h3>
        <p>This means either:</p>
        <ul>
          <li>You're not logged in as a user who receives requests</li>
          <li>There are no pending requests for your account</li>
          <li>There's an issue with the data fetching</li>
        </ul>
        <p><strong>Expected recipients:</strong> mahiiiiiiiiiiiiiii (3 requests), bunny (1 request), rakesh varma sundari (1 request)</p>
      </div>

      <button (click)="refreshUser()" style="background: #2196f3; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
        🔄 Refresh User Data
      </button>
    </div>
  `,
  standalone: true
})
export class TestUserComponent implements OnInit {
  currentUser: any = null;

  constructor(private authService: AuthService) {}

  ngOnInit() {
    this.refreshUser();
  }

  refreshUser() {
    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        console.log('🔍 Test component - Current user:', user);
        this.currentUser = user;
      },
      error: (error) => {
        console.error('❌ Error getting current user:', error);
      }
    });
  }

  getPendingCount(): number {
    return this.currentUser?.connectionRequests?.filter((r: any) => r.status === 'pending').length || 0;
  }
} 