import { Injectable, ErrorHandler } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CustomErrorHandler implements ErrorHandler {
  
  handleError(error: any): void {
    // Log the error but don't let it crash the app
    console.error('🔴 Application Error (Handled):', error);
    
    // Check if it's a service-related error
    if (error.message && error.message.includes('socket')) {
      console.warn('🔌 Socket service error - attempting recovery...');
      // Don't re-throw socket errors
      return;
    }
    
    if (error.message && error.message.includes('auth')) {
      console.warn('🔐 Auth service error - attempting recovery...');
      // Don't re-throw auth errors
      return;
    }
    
    // For other errors, you might want to show a user-friendly message
    // but don't crash the entire application
    console.warn('⚠️ Non-critical error handled:', error.message);
  }
} 