import { Component } from '@angular/core';
import { AuthService } from './core/services/auth.service';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-test-login',
  imports: [CommonModule, RouterLink],
  template: `
    <div style="padding: 20px; background: #e8f5e8; border-radius: 8px; margin: 20px;">
      <h2>🧪 Test Login - Users with Pending Requests</h2>
      
      <div style="background: white; padding: 15px; border-radius: 5px; margin: 10px 0;">
        <h3>📋 Available Test Users:</h3>
        <div style="margin: 10px 0;">
          <p><strong>mahiiiiiiiiiiiiiii</strong> (mahi&#64;gmail.com) - <span style="color: green;">3 pending requests</span></p>
          <button (click)="loginAs('mahi@gmail.com', 'password123')" style="background: #4caf50; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; margin-left: 10px;">
            Login
          </button>
        </div>
        
        <div style="margin: 10px 0;">
          <p><strong>bunny</strong> (bunny&#64;gmail.com) - <span style="color: green;">1 pending request</span></p>
          <button (click)="loginAs('bunny@gmail.com', 'password123')" style="background: #4caf50; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; margin-left: 10px;">
            Login
          </button>
        </div>
        
        <div style="margin: 10px 0;">
          <p><strong>rakesh varma sundari</strong> (rakesh&#64;gmail.com) - <span style="color: green;">1 pending request</span></p>
          <button (click)="loginAs('rakesh@gmail.com', 'password123')" style="background: #4caf50; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; margin-left: 10px;">
            Login
          </button>
        </div>
        
        <div style="margin: 10px 0;">
          <p><strong>Mahathi</strong> (mahathi&#64;gmail.com) - <span style="color: orange;">0 pending requests (sender)</span></p>
          <button (click)="loginAs('mahathi@gmail.com', 'password123')" style="background: #ff9800; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; margin-left: 10px;">
            Login
          </button>
        </div>
      </div>

      <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 10px 0;">
        <h3>💡 Instructions:</h3>
        <ol>
          <li>Click "Login" for any user above</li>
          <li>After login, you'll be redirected to the notifications page</li>
          <li>Users with pending requests should see notifications</li>
          <li>Users without pending requests will see "No pending requests"</li>
        </ol>
        <p><strong>Or manually navigate to:</strong> <a routerLink="/notifications" style="color: #2196f3; text-decoration: underline;">/notifications</a></p>
      </div>

      <div *ngIf="loginStatus" style="background: #d4edda; padding: 10px; border-radius: 5px; margin: 10px 0;">
        {{ loginStatus }}
      </div>
    </div>
  `,
  standalone: true
})
export class TestLoginComponent {
  loginStatus: string = '';

  constructor(private authService: AuthService, private router: Router) {}

  loginAs(email: string, password: string) {
    console.log('🔍 Login button clicked for:', email);
    this.loginStatus = `Logging in as ${email}...`;
    
    console.log('🔍 Calling authService.login with:', { email, password });
    
    this.authService.login({ email, password }).subscribe({
      next: (response) => {
        console.log('✅ Login response:', response);
        if (response?.success) {
          this.loginStatus = `✅ Successfully logged in as ${email}! Redirecting...`;
          setTimeout(() => {
            this.router.navigate(['/notifications']);
          }, 1000);
        } else {
          this.loginStatus = `❌ Login failed for ${email}`;
        }
      },
      error: (error) => {
        console.error('❌ Login error:', error);
        this.loginStatus = `❌ Login error for ${email}: ${error.message || error}`;
      }
    });
  }
} 