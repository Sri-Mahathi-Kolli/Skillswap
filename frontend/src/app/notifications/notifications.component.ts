import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../core/services/auth.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.component.html'
})
export class NotificationsComponent implements OnInit, OnDestroy {
  user: any;
  pendingRequests: any[] = [];
  bookingNotifications: any[] = [];
  senders: { [id: string]: any } = {};
  refreshInterval: any;
  isRefreshing: boolean = false;

  constructor(private authService: AuthService, private router: Router) {}

  async ngOnInit(): Promise<void> {
    // Wait for authentication to be restored
    const isAuthenticated = await this.authService.waitForAuth();
    
    if (isAuthenticated) {
      this.refreshUser();
      // Only start auto-refresh if there are pending requests
      this.startAutoRefresh();
    }
  }

  private startAutoRefresh(): void {
    // Clear any existing interval first
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    // Start auto-refresh for notifications (always running)
    this.refreshInterval = setInterval(() => {
      console.log('🔄 Auto-refreshing notifications...');
      this.refreshUser();
    }, 5000); // Check every 5 seconds for new notifications
  }

  private stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  refreshUser() {
    // Check if user is still authenticated
    if (!this.authService.isAuthenticated()) {
      console.log('❌ User not authenticated, redirecting to login');
      this.router.navigate(['/login']);
      return;
    }
    
    // Set loading state
    this.isRefreshing = true;
    console.log('🔄 Refreshing notifications...');
    
    // Get fresh user data without clearing authentication
    this.authService.getCurrentUser().subscribe({
      next: user => {
        this.user = user;
        let pending = (user?.connectionRequests || []).filter((r: any) => r.status === 'pending');
        
        // Remove duplicates by keeping only the most recent request from each sender
        const uniqueRequests = new Map();
        pending.forEach(request => {
          const senderId = request.from;
          const existingRequest = uniqueRequests.get(senderId);
          
          if (!existingRequest || new Date(request.createdAt) > new Date(existingRequest.createdAt)) {
            uniqueRequests.set(senderId, request);
          }
        });
        
        this.pendingRequests = Array.from(uniqueRequests.values());
        
        // Manage auto-refresh based on pending requests
        if (this.pendingRequests.length > 0) {
          this.startAutoRefresh();
        } else {
          this.stopAutoRefresh();
        }
        
        // Fetch sender information for display
        this.pendingRequests.forEach(req => {
          if (req.from && (!this.senders[req.from] || typeof this.senders[req.from] !== 'object')) {
            this.authService.getUserById(req.from).subscribe({
              next: sender => {
                this.senders[req.from] = sender;
              },
              error: () => {
                this.senders[req.from] = { name: req.from }; // fallback to ID
              }
            });
          }
        });
        
        // Fetch booking notifications
        this.fetchBookingNotifications();
        
        // Reset loading state
        this.isRefreshing = false;
      },
      error: err => {
        // Reset loading state on error
        this.isRefreshing = false;
        
        if (err.status === 401) {
          this.stopAutoRefresh();
          this.router.navigate(['/login']);
        }
      }
    });
  }

  fetchBookingNotifications() {
    console.log('🔔 Fetching booking notifications...');
    this.authService.getBookingNotifications().subscribe({
      next: (response) => {
        console.log('📡 Booking notifications API response:', response);
        if (response.success) {
          console.log('📊 Raw notifications data:', response.data);
          
          // Log each notification's data structure
          response.data.forEach((notification, index) => {
            console.log(`Notification ${index + 1}:`, {
              type: notification.type,
              message: notification.message,
              data: notification.data,
              studentName: notification.data?.studentName,
              amount: notification.data?.amount
            });
          });
          
          this.bookingNotifications = response.data.filter((notification: any) => 
            (notification.type === 'new_session_booking' || notification.type === 'payment_received') && !notification.isRead
          );
          console.log('� All notifications from backend:', response.data);
          console.log('�🔔 Filtered booking notifications:', this.bookingNotifications);
          console.log(`📊 Total unread booking notifications: ${this.bookingNotifications.length}`);
        } else {
          console.warn('⚠️ Booking notifications API returned success=false:', response);
        }
      },
      error: (error) => {
        console.error('❌ Error fetching booking notifications:', error);
      }
    });
  }

  markNotificationAsRead(notificationId: string) {
    this.authService.markNotificationAsRead(notificationId).subscribe({
      next: () => {
        // Update the notification status to read instead of removing it
        const notification = this.bookingNotifications.find(
          notification => notification._id === notificationId
        );
        if (notification) {
          notification.isRead = true;
        }
      },
      error: (error) => {
        console.error('Error marking notification as read:', error);
      }
    });
  }

  // Navigate to user profile (same as skills page)
  viewUserProfile(userId: string, userName: string = 'this user') {
    if (userId) {
      console.log('🔗 Navigating to user profile:', userId);
      this.router.navigate(['/profile', userId]);
    } else {
      console.warn('⚠️ No user ID provided for profile navigation');
      alert('Unable to navigate to profile - user ID not available');
    }
  }

  acceptRequest(requestId: string) {
    console.log('🔍 Accepting request with ID:', requestId);
    console.log('🔍 Request object:', this.pendingRequests.find(req => req._id === requestId));
    
    this.authService.respondToConnectionRequest(requestId, 'accepted').subscribe({
      next: (response) => {
        console.log('✅ Accept request successful:', response);
        // Refresh current user data to get updated connections
        this.authService.getCurrentUser().subscribe(user => {
          this.user = user;
          let pending = (user?.connectionRequests || []).filter((r: any) => r.status === 'pending');
          
          // Remove duplicates by keeping only the most recent request from each sender
          const uniqueRequests = new Map();
          pending.forEach(request => {
            const senderId = request.from;
            const existingRequest = uniqueRequests.get(senderId);
            
            if (!existingRequest || new Date(request.createdAt) > new Date(existingRequest.createdAt)) {
              uniqueRequests.set(senderId, request);
            }
          });
          
          this.pendingRequests = Array.from(uniqueRequests.values());
          alert('Connection accepted!');
          
          // Update the current user in the auth service to ensure all components get the updated data
          this.authService.setCurrentUser(user);
          
          // Reload connection statuses in SkillsComponent if available
          if ((window as any).skillsComponentRef && typeof (window as any).skillsComponentRef.reloadConnectionStatuses === 'function') {
            (window as any).skillsComponentRef.reloadConnectionStatuses();
          }
          
          // Force immediate refresh of notifications
          setTimeout(() => this.refreshUser(), 500);
        });
      },
      error: (error) => {
        console.error('❌ Accept request failed:', error);
        alert('Failed to accept request: ' + (error.error?.message || error.message || 'Unknown error'));
      }
    });
  }

  rejectRequest(requestId: string) {
    console.log('🔍 Rejecting request with ID:', requestId);
    console.log('🔍 Request object:', this.pendingRequests.find(req => req._id === requestId));
    
    this.authService.respondToConnectionRequest(requestId, 'rejected').subscribe({
      next: (response) => {
        console.log('✅ Reject request successful:', response);
        // Refresh current user data to get updated connections
        this.authService.getCurrentUser().subscribe(user => {
          this.user = user;
          let pending = (user?.connectionRequests || []).filter((r: any) => r.status === 'pending');
          
          // Remove duplicates by keeping only the most recent request from each sender
          const uniqueRequests = new Map();
          pending.forEach(request => {
            const senderId = request.from;
            const existingRequest = uniqueRequests.get(senderId);
            
            if (!existingRequest || new Date(request.createdAt) > new Date(existingRequest.createdAt)) {
              uniqueRequests.set(senderId, request);
            }
          });
          
          this.pendingRequests = Array.from(uniqueRequests.values());
          alert('Connection rejected.');
          
          // Update the current user in the auth service to ensure all components get the updated data
          this.authService.setCurrentUser(user);
          
          // Reload connection statuses in SkillsComponent if available
          if ((window as any).skillsComponentRef && typeof (window as any).skillsComponentRef.reloadConnectionStatuses === 'function') {
            (window as any).skillsComponentRef.reloadConnectionStatuses();
          }
          
          // Force immediate refresh of notifications
          setTimeout(() => this.refreshUser(), 500);
        });
      },
      error: (error) => {
        console.error('❌ Reject request failed:', error);
        alert('Failed to reject request: ' + (error.error?.message || error.message || 'Unknown error'));
      }
    });
  }

  getSendersCount(): number {
    return Object.keys(this.senders).length;
  }

  scheduleSession(notification: any): void {
    console.log('🎯 Schedule session clicked for notification:', notification);
    
    // Store session data for the schedule page
    const sessionData = {
      studentId: notification.data?.studentId,
      studentName: notification.data?.studentName,
      amount: notification.data?.amount,
      currency: notification.data?.currency,
      notificationId: notification._id
    };
    
    localStorage.setItem('pendingSessionData', JSON.stringify(sessionData));
    
    // Navigate to schedule page
    this.router.navigate(['/schedule']);
  }
} 