import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from './services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  async canActivate(): Promise<boolean | UrlTree> {
    // If already authenticated, allow access immediately
    if (this.authService.isAuthenticated()) {
      return true;
    }

    // If no token exists, redirect to auth immediately
    if (!this.authService.getAccessToken()) {
      return this.router.parseUrl('/auth');
    }

    // If token exists but not authenticated, wait for restoration
    const isAuthenticated = await this.authService.waitForAuth();
    
    if (isAuthenticated) {
      return true;
    }
    
    // If authentication restoration failed, redirect to auth
    return this.router.parseUrl('/auth');
  }
} 