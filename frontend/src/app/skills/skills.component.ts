// Export a dummy notificationStore for profile.component.ts import
export const notificationStore: { [key: string]: any[] } = {};
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService, User } from '../core/services/auth.service';
import { ConnectionService, ConnectionRequest } from '../services/connection.service';
import { Router } from '@angular/router';
import { SkillsService } from '../services/skills.service';
import { SocketService } from '../core/services/socket.service';
import { getPhotoUrl, onImgError } from '../utils/image-utils';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { ImagePreviewDialogComponent } from '../shared/image-preview-dialog.component';
import { PaymentService } from '../services/payment.service';

interface Expert {
  id: string;
  name: string;
  title: string;
  avatar: string;
  connections: number;
  completed: number;
  paymentSettings?: {
    enablePayments: boolean;
    hourlyRate: number;
    currency: string;
    freeSessionsOffered: number;
    paymentRequired: boolean;
  };
  customPricing?: { duration: number; amount: number }[];
}

interface SkillCard {
  id: string;
  name: string;
  category: string;
  description: string;
  rating: number;
  price: number;
  tags: string[];
  expert: Expert;
}

@Component({
  selector: 'app-skills',
  standalone: true,
  imports: [FormsModule, CommonModule, MatDialogModule, MatButtonModule],
  templateUrl: './skills.component.html',
  styleUrls: ['./skills.component.css']
})
export class SkillsComponent implements OnInit, OnDestroy {
  // Helper to get up to 3 tags from first 1-2 skills for an expert
  getExpertTags(expertId: string): string[] {
    const skills = this.expertSkills[expertId] || [];
    let tags: string[] = [];
    for (let i = 0; i < Math.min(skills.length, 2); i++) {
      tags = tags.concat(skills[i].tags.slice(0, 2));
      if (tags.length >= 3) break;
    }
    return tags.slice(0, 3);
  }


  hasPaidOption(expert: Expert): boolean {
    return !!(expert.customPricing && expert.customPricing.some(p => p.amount > 0));
  }
  // Add missing property for suggestedSkills
  suggestedSkills: SkillCard[] = [];
  // Add missing methods for template
  onSearch() {
    // Implement search logic or leave empty for now
    // This can trigger filtering if needed
  }

  onCategoryChange() {
    // Implement category filter logic or leave empty for now
  }

  onLevelChange() {
    // Implement level filter logic or leave empty for now
  }

  onImgError(event: Event) {
  // Fallback image logic
  const target = event.target as HTMLImageElement;
  if (target) target.src = 'default-avatar.png';
  }

  connectWithExpert(skill: SkillCard) {
    if (!this.currentUser) {
      alert('Please log in to connect with experts');
      return;
    }

    const expertId = skill.expert.id;
    const status = this.connectionStatuses[expertId];
    const userRole = this.userRoles[expertId];

    // Handle different connection states
    if (status === 'accepted') {
      // Already connected, no action needed
      return;
    } else if (status === 'pending') {
      if (userRole === 'recipient') {
        // Accept the incoming request
        this.acceptConnectionRequest(expertId);
      } else {
        // Request already sent, no action needed
        return;
      }
    } else {
      // Send new connection request
      this.sendConnectionRequest(expertId, skill.expert.name);
    }
  }

  // New method that works directly with Expert object
  connectWithExpertDirect(expert: Expert) {
    if (!this.currentUser) {
      alert('Please log in to connect with experts');
      return;
    }

    const expertId = expert.id;
    const status = this.connectionStatuses[expertId];
    const userRole = this.userRoles[expertId];

    console.log(`🔗 Connecting with ${expert.name} (${expertId})`);
    console.log(`Current status: ${status}, userRole: ${userRole}`);

    // Unify Connect Back logic
    if (status === 'accepted' && userRole === 'recipient') {
      // User is the recipient and wants to Connect Back
      this.sendConnectionBackRequest(expert);
      return;
    }
    if (status === 'accepted') {
      // Already connected, no action needed
      console.log('Already connected');
      return;
    } else if (status === 'pending') {
      if (userRole === 'recipient') {
        // Accept the incoming request
        console.log('Accepting incoming request');
        this.acceptConnectionRequest(expertId);
      } else {
        // Request already sent, no action needed
        console.log('Request already sent');
        return;
      }
    } else {
      // Send new connection request
      console.log('Sending new connection request');
      this.sendConnectionRequest(expertId, expert.name);
    }
  }

  // Dedicated Connect Back request for skills page (unified with profile)
  private sendConnectionBackRequest(expert: Expert) {
    const expertId = expert.id;
    const request: ConnectionRequest = {
      recipientId: expertId,
      message: `Hi! I'd like to connect back with you.`,
      skillContext: 'Connect Back'
    };
    this.connectionService.sendConnectionRequest(request).subscribe({
      next: () => {
        this.connectionStatuses[expertId] = 'pending';
        this.userRoles[expertId] = 'requester';
        this.pendingConnections[expertId] = true;
        this.cdr.detectChanges();
        alert('Connection request sent back!');
      },
      error: (err) => {
        this.connectionStatuses[expertId] = null;
        this.cdr.detectChanges();
        alert('Failed to send connection request back: ' + (err.error?.error || err.message));
      }
    });
  }

  // New method for messaging expert directly
  messageExpertDirect(expert: Expert) {
    const connectionStatus = this.connectionStatuses[expert.id];
    if (connectionStatus === 'accepted') {
      this.router.navigate(['/chat', expert.id]);
    } else {
      // For now, just navigate to chat (the chat component can handle non-connected users)
      this.router.navigate(['/chat', expert.id]);
    }
  }

  // New methods that work directly with Expert object for button states
  getExpertConnectionButtonText(expert: Expert): string {
    const status = this.connectionStatuses[expert.id];
    const userRole = this.userRoles[expert.id];
    switch (status) {
      case 'sending':
        return 'Sending...';
      case 'accepting':
        return 'Accepting...';
      case 'accepted':
        if (userRole === 'recipient') return 'Connect Back';
        if (userRole === 'requester') return 'Connected';
        return 'Connected';
      case 'pending':
        if (userRole === 'recipient') return 'Accept Request';
        if (userRole === 'requester') return 'Request Sent';
        return 'Request Sent';
      case 'rejected':
      case 'withdrawn':
        return 'Connect';
      default:
        return 'Connect';
    }
  }

  getExpertConnectionButtonClass(expert: Expert): string {
    const status = this.connectionStatuses[expert.id];
    const userRole = this.userRoles[expert.id];
    switch (status) {
      case 'sending':
      case 'accepting':
        return 'btn btn-warning disabled';
      case 'accepted':
        if (userRole === 'recipient') return 'btn btn-info';
        return 'btn btn-success';
      case 'pending':
        if (userRole === 'recipient') return 'btn btn-success';
        return 'btn btn-warning';
      case 'rejected':
      case 'withdrawn':
        return 'btn btn-primary';
      default:
        return 'btn btn-primary';
    }
  }

  isExpertConnectionDisabled(expert: Expert): boolean {
    const status = this.connectionStatuses[expert.id];
    const userRole = this.userRoles[expert.id];
    
    // Disable during sending or accepting
    if (status === 'sending' || status === 'accepting') return true;
    
    // Enable for accepting requests or connecting back
    if (status === 'accepted' && userRole === 'recipient') return false;
    if (status === 'pending' && userRole === 'recipient') return false;
    
    // Disable if already connected or request already sent
    return status === 'accepted' || (status === 'pending' && userRole === 'requester');
  }

  private sendConnectionRequest(expertId: string, expertName: string) {
    // Immediately update UI to show "Sending..." state
    this.connectionStatuses[expertId] = 'sending';
    this.cdr.detectChanges();

    const request: ConnectionRequest = {
      recipientId: expertId,
      message: `Hi! I'd like to connect and learn from your expertise.`,
      skillContext: 'Skills page connection request'
    };

    this.connectionService.sendConnectionRequest(request).subscribe({
      next: (response) => {
        if (response.success) {
          // Update local state immediately
          this.connectionStatuses[expertId] = 'pending';
          this.userRoles[expertId] = 'requester';
          this.pendingConnections[expertId] = true;
          this.cdr.detectChanges();
          
          console.log(`✅ Connection request sent to ${expertName}`);
          
          // Optional: Show success message
          // alert(`Connection request sent to ${expertName}!`);
        } else {
          // Reset state on failure
          this.connectionStatuses[expertId] = null;
          this.cdr.detectChanges();
          alert(`Failed to send connection request: ${response.message}`);
        }
      },
      error: (error) => {
        // Reset state on error
        this.connectionStatuses[expertId] = null;
        this.cdr.detectChanges();
        console.error('❌ Failed to send connection request:', error);
        if (error?.status === 400 && error?.error?.message === 'Connection request already exists') {
          alert('You have already sent a connection request to this user.');
        } else {
          alert(`Failed to send connection request to ${expertName}`);
        }
      }
    });
  }

  private acceptConnectionRequest(expertId: string) {
    // Immediately update UI to show "Accepting..." state
    this.connectionStatuses[expertId] = 'accepting';
    this.cdr.detectChanges();

    // Get all pending received requests and find the correct one
    this.connectionService.getConnectionRequests('received', 'pending').subscribe({
      next: (response) => {
        if (response.success && response.data) {
          // Try to match both requester and recipient IDs for robustness
          const pendingRequest = response.data.connections.find((conn: any) =>
            conn.requester._id === expertId || conn.recipient._id === expertId
          );
          if (pendingRequest) {
            // Use authService.respondToConnectionRequest for acceptance (like notifications)
            this.authService.respondToConnectionRequest(pendingRequest._id, 'accepted').subscribe({
              next: (acceptResponse: any) => {
                if (acceptResponse.success) {
                  this.connectionStatuses[expertId] = 'accepted';
                  this.userRoles[expertId] = 'recipient';
                  this.pendingConnections[expertId] = false;
                  this.cdr.detectChanges();
                  alert('Connection accepted!');
                  console.log('✅ Connection request accepted');
                } else {
                  this.connectionStatuses[expertId] = 'pending';
                  this.cdr.detectChanges();
                  alert(`Failed to accept connection request: ${acceptResponse.message}`);
                }
              },
              error: (error: any) => {
                this.connectionStatuses[expertId] = 'pending';
                this.cdr.detectChanges();
                alert('Failed to accept connection request: ' + (error.error?.message || error.message || 'Unknown error'));
              }
            });
          } else {
            this.connectionStatuses[expertId] = null;
            this.cdr.detectChanges();
            alert('No pending connection request found');
          }
        } else {
          this.connectionStatuses[expertId] = null;
          this.cdr.detectChanges();
          alert('No pending connection request found');
        }
      },
      error: (error) => {
        this.connectionStatuses[expertId] = 'pending';
        this.cdr.detectChanges();
        alert('Failed to fetch connection requests');
      }
    });
  }

  searchSkill(skill: string) {
    // Implement skill search logic or leave empty for now
    this.searchTerm = skill;
  }
  searchTerm = '';
  selectedCategory = '';
  selectedLevel = '';
  categories = [
    { id: 'technology', name: 'Technology', count: 45 },
    { id: 'design', name: 'Design', count: 32 },
    { id: 'business', name: 'Business', count: 28 },
    { id: 'creative', name: 'Creative', count: 23 },
    { id: 'health', name: 'Health & Wellness', count: 19 }
  ];
  popularSkills = ['JavaScript', 'Python', 'UI/UX Design', 'Digital Marketing', 'Photography', 'Cooking'];
  skills: SkillCard[] = [];
  expertSkills: { [expertId: string]: SkillCard[] } = {};
  expertList: Expert[] = [];
  expandedExperts: { [expertId: string]: boolean } = {};
  currentUser: User | null = null;
  connectionStatuses: { [key: string]: string | null } = {};
  userRoles: { [key: string]: 'requester' | 'recipient' | null } = {};
  pendingConnections: { [key: string]: boolean } = {};
  private reloadSubject = new Subject<void>();
  private isLoadingConnectionStatuses = false;
  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private connectionService: ConnectionService,
    private router: Router,
    private skillsService: SkillsService,
    private socketService: SocketService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
  private dialog: MatDialog,
  private paymentService: PaymentService
  ) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.loadSkillsFromBackend();
    });
    if (this.authService.isAuthenticated()) {
      this.loadSkillsFromBackend();
    }
    
    // Handle all connection-related socket events for real-time updates
    this.socketService.connectionRequestResponse$.pipe(
      takeUntil(this.destroy$)
    ).subscribe((data: any) => {
      this.handleConnectionRequestResponse(data);
    });
    
    this.socketService.connectionStatusUpdate$.pipe(
      takeUntil(this.destroy$)
    ).subscribe((data: any) => {
      this.handleConnectionStatusUpdate(data);
    });
    
    // Handle connection request received (when someone sends you a request)
    this.socketService.connectionRequestReceived$.pipe(
      takeUntil(this.destroy$)
    ).subscribe((data: any) => {
      console.log('🔔 Connection request received:', data);
      this.handleConnectionRequestReceived(data);
    });
    
    // Handle connection request sent (when you send a request)
    this.socketService.connectionRequestSent$.pipe(
      takeUntil(this.destroy$)
    ).subscribe((data: any) => {
      console.log('📤 Connection request sent:', data);
      this.handleConnectionRequestSent(data);
    });
    
    // Handle connection request accepted (when someone accepts your request)
    this.socketService.connectionRequestAccepted$.pipe(
      takeUntil(this.destroy$)
    ).subscribe((data: any) => {
      console.log('✅ Connection request accepted:', data);
      this.handleConnectionRequestAccepted(data);
    });
  }

  ngOnDestroy() {
    this.reloadSubject.complete();
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadSkillsFromBackend() {
    this.authService.getAllUsers().subscribe({
      next: (users: any[]) => {
        this.skills = [];
        this.expertSkills = {};
        this.expertList = [];
        users.forEach(user => {
          const currentUserId = this.currentUser?.id || (this.currentUser as any)?._id;
          const userId = user.id || (user as any)._id;
          if (this.currentUser && currentUserId && userId === currentUserId) {
            return;
          }
          if (!Array.isArray(user.skills)) return;
            const expert: Expert = {
              id: user._id || user.id || '',
              name: user.name || '',
              title: user.title || '',
              avatar: getPhotoUrl(user.photo || ''),
              connections: Array.isArray(user.connections) ? user.connections.length : 0,
              completed: user.sessionsCompleted || 0,
              paymentSettings: user.paymentSettings || {
                enablePayments: false,
                hourlyRate: 0,
                currency: 'USD',
                freeSessionsOffered: 0,
                paymentRequired: false
              },
              customPricing: user.customPricing || []
            };
          this.expertList.push(expert);
          this.expertSkills[expert.id] = user.skills.map((skill: any) => ({
            id: skill._id || skill.id || '',
            name: skill.name || '',
            category: skill.category || 'General',
            description: skill.description || '',
            rating: skill.averageRating || 0,
            // Use mentor session rates if available
            customPricing: expert.customPricing || [],
            tags: skill.tags || [],
            expert
          }));
        });
        this.loadConnectionStatuses();
      },
      error: () => {
        this.skills = [];
        this.expertSkills = {};
        this.expertList = [];
      }
    });
  }

  loadConnectionStatuses() {
    if (!this.currentUser || this.isLoadingConnectionStatuses) return;
    this.isLoadingConnectionStatuses = true;
    const uniqueExpertIds = Object.keys(this.expertSkills);
    this.connectionStatuses = {};
    this.userRoles = {};
    this.pendingConnections = {};
    uniqueExpertIds.forEach(expertId => {
      this.connectionService.getConnectionStatus(expertId).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.connectionStatuses[expertId] = response.data.status;
            this.userRoles[expertId] = response.data.userRole || null;
            this.pendingConnections[expertId] = response.data.status === 'pending';
          } else {
            this.connectionStatuses[expertId] = null;
            this.userRoles[expertId] = null;
            this.pendingConnections[expertId] = false;
          }
          this.cdr.detectChanges();
        },
        error: () => {
          this.connectionStatuses[expertId] = null;
          this.userRoles[expertId] = null;
          this.pendingConnections[expertId] = false;
          this.cdr.detectChanges();
        }
      });
    });
    this.isLoadingConnectionStatuses = false;
  }

  get filteredExperts() {
    return this.expertList.filter(expert => {
      const skills = this.expertSkills[expert.id] || [];
      const matchesSearch = !this.searchTerm ||
        expert.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        skills.some(skill => skill.name.toLowerCase().includes(this.searchTerm.toLowerCase()));
      const matchesCategory = !this.selectedCategory ||
        skills.some(skill => skill.category && skill.category.toLowerCase() === this.selectedCategory.toLowerCase());
      return matchesSearch && matchesCategory;
    });
  }

  toggleExpertSkills(expertId: string) {
    this.expandedExperts[expertId] = !this.expandedExperts[expertId];
  }

  getConnectionButtonText(skill: SkillCard): string {
    const status = this.connectionStatuses[skill.expert.id];
    const userRole = this.userRoles[skill.expert.id];
    switch (status) {
      case 'sending':
        return 'Sending...';
      case 'accepting':
        return 'Accepting...';
      case 'accepted':
        if (userRole === 'recipient') return 'Connect Back';
        if (userRole === 'requester') return 'Connected';
        return 'Connected';
      case 'pending':
        if (userRole === 'recipient') return 'Accept Request';
        if (userRole === 'requester') return 'Request Sent';
        return 'Request Sent';
      case 'rejected':
      case 'withdrawn':
        return 'Connect';
      default:
        return 'Connect';
    }
  }

  getConnectionButtonClass(skill: SkillCard): string {
    const status = this.connectionStatuses[skill.expert.id];
    const userRole = this.userRoles[skill.expert.id];
    switch (status) {
      case 'sending':
      case 'accepting':
        return 'btn btn-warning disabled';
      case 'accepted':
        if (userRole === 'recipient') return 'btn btn-info';
        return 'btn btn-success';
      case 'pending':
        if (userRole === 'recipient') return 'btn btn-success';
        return 'btn btn-warning';
      case 'rejected':
      case 'withdrawn':
        return 'btn btn-primary';
      default:
        return 'btn btn-primary';
    }
  }

  isConnectionDisabled(skill: SkillCard): boolean {
    const status = this.connectionStatuses[skill.expert.id];
    const userRole = this.userRoles[skill.expert.id];
    
    // Disable during sending or accepting
    if (status === 'sending' || status === 'accepting') return true;
    
    // Enable for accepting requests or connecting back
    if (status === 'accepted' && userRole === 'recipient') return false;
    if (status === 'pending' && userRole === 'recipient') return false;
    
    // Disable if already connected or request already sent
    return status === 'accepted' || (status === 'pending' && userRole === 'requester');
  }

  clearFilters() {
    this.searchTerm = '';
    this.selectedCategory = '';
    this.selectedLevel = '';
  }

  handleConnectionRequestResponse(data: any) {
    if (data.status === 'accepted') {
      this.connectionStatuses[data.from] = 'accepted';
      this.pendingConnections[data.from] = false;
      this.userRoles[data.from] = 'requester';
      this.cdr.detectChanges();
      setTimeout(() => {
        this.loadConnectionStatuses();
      }, 1000);
    } else if (data.status === 'rejected') {
      this.connectionStatuses[data.from] = 'rejected';
      this.pendingConnections[data.from] = false;
      this.userRoles[data.from] = null;
      this.cdr.detectChanges();
    }
  }

  handleConnectionStatusUpdate(data: any) {
    this.connectionStatuses[data.withUser] = data.status;
    if (data.userRole) {
      this.userRoles[data.withUser] = data.userRole;
    }
    if (data.status === 'accepted') {
      this.pendingConnections[data.withUser] = false;
    } else if (data.status === 'pending') {
      this.pendingConnections[data.withUser] = true;
    } else {
      this.pendingConnections[data.withUser] = false;
    }
    this.cdr.detectChanges();
    setTimeout(() => {
      this.loadConnectionStatuses();
    }, 500);
  }

  // Handle when someone sends you a connection request
  handleConnectionRequestReceived(data: any) {
    console.log('📨 Connection request received from:', data);
    const requesterId = data.requester?._id || data.requesterId;
    if (requesterId) {
      this.connectionStatuses[requesterId] = 'pending';
      this.userRoles[requesterId] = 'recipient'; // You are the recipient
      this.pendingConnections[requesterId] = true;
      this.cdr.detectChanges();
    }
  }

  // Handle when you send a connection request
  handleConnectionRequestSent(data: any) {
    console.log('📤 Connection request sent to:', data);
    const recipientId = data.recipient || data.recipientId;
    if (recipientId) {
      this.connectionStatuses[recipientId] = 'pending';
      this.userRoles[recipientId] = 'requester'; // You are the requester
      this.pendingConnections[recipientId] = true;
      this.cdr.detectChanges();
    }
  }

  // Handle when someone accepts your connection request
  handleConnectionRequestAccepted(data: any) {
    console.log('🎉 Connection request accepted by:', data);
    const accepterId = data.accepter?._id || data.accepterId || data.recipient;
    if (accepterId) {
      this.connectionStatuses[accepterId] = 'accepted';
      this.userRoles[accepterId] = 'requester'; // You were the requester
      this.pendingConnections[accepterId] = false;
      this.cdr.detectChanges();
      
      // Also refresh connection statuses to ensure consistency
      setTimeout(() => {
        this.loadConnectionStatuses();
      }, 500);
    }
  }

  // Accepts either { expert } or SkillCard
  viewProfile(arg: any) {
    const expertId = arg?.expert?.id || arg?.id || (arg?.expertId ?? null);
    if (expertId) {
      this.router.navigate(['/profile', expertId]);
    }
  }

  messageExpert(skill: SkillCard) {
    const connectionStatus = this.connectionStatuses[skill.expert.id];
    if (connectionStatus === 'accepted') {
      this.router.navigate(['/chat', skill.expert.id]);
    } else {
      this.createConnectionAndNavigateToChat(skill);
    }
  }

  private createConnectionAndNavigateToChat(skill: SkillCard) {
    if (!this.currentUser) return;
    // Only navigate to chat, do not send connection request
    this.router.navigate(['/chat', skill.expert.id]);
  }

  onImgErrorHandler(event: Event) {
    onImgError(event);
  }

  openImagePreview(imageUrl: string, expertName: string, event: Event) {
    event?.stopPropagation();
  if (!imageUrl || imageUrl === 'default-avatar.png') return;
    this.dialog.open(ImagePreviewDialogComponent, {
      data: { imageUrl, expertName },
      maxWidth: '90vw',
      maxHeight: '90vh',
      width: 'auto',
      height: 'auto',
      panelClass: 'image-preview-dialog'
    });
  }

  // Book a session with payment
  bookSession(expert: Expert) {
    console.log('[DEBUG] bookSession called for expert:', expert);
    // Use hasPaidOption to determine if payment is required, not enablePayments flag
    if (!this.hasPaidOption(expert)) {
      alert('This expert does not accept paid sessions');
      return;
    }
    // Optionally, get currency for display/logic
    let currency = 'USD';
    if (expert.paymentSettings) {
      if (Object.prototype.hasOwnProperty.call(expert.paymentSettings, 'currency')) {
        currency = (expert.paymentSettings as any).currency || 'USD';
      } else if (
        typeof (expert.paymentSettings as any).paymentSettings === 'object' &&
        (expert.paymentSettings as any).paymentSettings !== null &&
        Object.prototype.hasOwnProperty.call((expert.paymentSettings as any).paymentSettings, 'currency')
      ) {
        currency = (expert.paymentSettings as any).paymentSettings.currency || 'USD';
      }
    }

    // Check if connected first
    const connectionStatus = this.connectionStatuses[expert.id];
    if (connectionStatus !== 'accepted') {
      alert('You must be connected with this expert before booking a paid session');
      return;
    }

    // Use default duration and price (first customPricing entry or fallback)
    let duration = 40;
    let amount = 0;
    if (expert.customPricing && expert.customPricing.length > 0) {
      duration = expert.customPricing[0].duration;
      amount = expert.customPricing[0].amount;
    }

    // Call payment service to create Stripe session and redirect
    this.paymentService.createPaymentSession({
      mentorId: expert.id,
      duration,
      amount,
      currency
    }).subscribe({
      next: (res) => {
        if (res.stripeUrl) {
          window.location.href = res.stripeUrl;
        } else {
          alert('Failed to get Stripe checkout URL.');
        }
      },
      error: (err) => {
        alert('Failed to initiate payment: ' + (err.error?.message || err.message || err));
      }
    });
  }

  // Show pay button for all nonzero paid options, disable if not connected
  isPaymentEnabled(expert: Expert): boolean {
    const hasPaidOption = expert.customPricing && expert.customPricing.some(p => p.amount > 0);
    if (!hasPaidOption) return false;
    const connectionStatus = this.connectionStatuses[expert.id];
    return connectionStatus === 'accepted';
  }

  // Get appropriate CSS class for pay button
  getPayButtonClass(expert: Expert): string {
    const isEnabled = this.isPaymentEnabled(expert);
    return isEnabled ? 'btn btn-success' : 'btn btn-success disabled';
  }

  // Get pay button text based on connection status
  getPayButtonText(expert: Expert): string {
    const hasPaidOption = expert.customPricing && expert.customPricing.some(p => p.amount > 0);
    if (!hasPaidOption) return '';
    const connectionStatus = this.connectionStatuses[expert.id];
    switch (connectionStatus) {
      case 'accepted':
        return 'Pay & Book';
      case 'pending':
        return 'Connect First';
      case 'none':
      default:
        return 'Connect to Pay & Book';
    }
  }

  // Helper to get formatted session rate for display
  getSessionRate(skill: any, duration: number): string {
    if (skill.customPricing && Array.isArray(skill.customPricing)) {
      const entry = skill.customPricing.find((e: any) => e.duration === duration);
      if (entry) {
        return entry.amount > 0 ? `$${entry.amount}` : 'Free';
      }
    }
    return 'Free';
  }

  // Get tooltip text for pay button
  getPayButtonTooltip(expert: Expert): string {
    const hasPaidOption = expert.customPricing && expert.customPricing.some(p => p.amount > 0);
    if (!hasPaidOption) return '';
    const connectionStatus = this.connectionStatuses[expert.id];
    switch (connectionStatus) {
      case 'accepted':
        return 'Book and pay for a session with this expert';
      case 'pending':
        return 'You must be connected to book a paid session';
      case 'none':
      default:
        return 'Connect with this expert first to book a paid session';
    }
  }
}
