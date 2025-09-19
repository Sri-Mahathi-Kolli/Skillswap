import { Component, OnInit, ViewChild, ElementRef, Inject, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TimezoneService, Timezone } from '../services/timezone.service';
import { AuthService, User } from '../core/services/auth.service';
import { debounceTime, Subject } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { notificationStore } from '../skills/skills.component';
import { SkillsService } from '../services/skills.service';
import { environment } from '../../environments/environment';
import { getPhotoUrl, onImgError } from '../utils/image-utils';
import { ConnectionService } from '../services/connection.service';
import { PaymentSettingsComponent } from './payment-settings.component';

// Define a Skill type that includes tagsString for edit mode
interface Skill {
  id?: string;
  name: string;
  level: string;
  description: string;
  tags: string[];
  tagsString?: string;
}

// Define a Notification type for clarity (move this outside the class)
export interface Notification {
  id: number;
  message: string;
  seen: boolean;
  type?: string;
  status?: string;
  from?: string;
}

declare global {
  interface Window {
    allUsers?: any[];
    connectionStatuses?: { [key: string]: string };
  }
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule, CommonModule, MatIconModule, PaymentSettingsComponent],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  @ViewChild('photoInput') photoInput!: ElementRef<HTMLInputElement>;
  editMode = false;
  originalUser: any = null;
  timezones: Timezone[] = [];
  currentUser: User | null = null;
  successMessage = '';
  errorMessage = '';
  photoPreview: string | null = null;
  public skillSearch: string = '';
  private skillSearchSubject = new Subject<string>();
  public currentPage: number = 1;
  public pageSize: number = 5;
  editingSkillIndex: number | null = null;
  photoFile: File | null = null;
  user: any;
  getPhotoUrl = getPhotoUrl;
  onImgError = onImgError;
  isOwnProfile = false;
  connectionStatus: string | null = null;
  connectionDetails: any = null;
  
  defaultSkills: Skill[] = [
    {
      name: 'JavaScript',
      level: 'Expert',
      description: 'Advanced knowledge of modern JavaScript including ES6+, TypeScript, and frameworks.',
      tags: ['ES6+', 'TypeScript', 'React', 'Angular']
    },
    {
      name: 'Python',
      level: 'Intermediate',
      description: 'Experience with Python for backend development and data analysis.',
      tags: ['Django', 'Flask', 'Pandas', 'NumPy']
    },
    {
      name: 'UI/UX Design',
      level: 'Beginner',
      description: 'Basic understanding of design principles and user experience.',
      tags: ['Figma', 'Adobe XD', 'Prototyping']
    }
  ];

  // Properties for the add/edit skill form
  newSkillName = '';
  newSkillLevel = '';
  newSkillDescription = '';
  newSkillTags = '';

  get notifications(): Notification[] {
    const userId = this.user && this.user.id ? String(this.user.id) : '';
    return notificationStore[userId] || [];
  }

  get unseenNotificationCount(): number {
    return this.notifications.filter(n => !n.seen).length;
  }

  showUnseenNotifications() {
    const unseen = this.notifications.filter(n => !n.seen);
    if (unseen.length === 0) {
      alert('No new notifications!');
      return;
    }
    // For connection requests, show accept button in a real app. For demo, just mark as seen.
    alert('Unseen notifications:\n' + unseen.map(n => n.message).join('\n'));
    // Mark all as seen
    this.notifications.forEach(n => { n.seen = true; });
  }

  // For demo: Accept the first pending connection request
  acceptFirstConnectionRequest() {
    const req = this.notifications.find(n => n.type === 'connection-request' && !n.seen);
    if (req) {
      req.seen = true;
      req.status = 'accepted';
      const senderId = req.from ? String(req.from) : null;
      if (senderId) {
        // Simulate updating the sender's connections count (frontend only)
        const allUsers = window.allUsers;
        if (allUsers) {
          const sender = allUsers.find((u: any) => u.id === senderId);
          if (sender) {
            // Don't manually update sender's connections - let the backend handle it
            // The backend already correctly updates only the requester's connections
          }
        }
        // If the sender is the current user, don't manually update their connections array
        // The backend already handles this correctly
        if (this.currentUser && this.currentUser.id === senderId) {
          // Don't manually update currentUser.connections - let the backend handle it
        }
        // Simulate updating connection status in the sender's UI (frontend only)
        const connectionStatuses = window.connectionStatuses;
        if (connectionStatuses) {
          connectionStatuses[String(this.user.id)] = 'connected';
        }
        // Send notification to sender
        const notifStore: { [key: string]: any[] } = notificationStore as { [key: string]: any[] };
        if (!notifStore[senderId]) notifStore[senderId] = [];
        notifStore[senderId].push({
          id: Date.now(),
          message: `Your connection request to ${this.user.name} was accepted!`,
          seen: false,
          type: 'connection-accepted',
          status: 'connected',
          from: String(this.user.id)
        });
        // TODO: In the future, call the backend to update both users' connection counts and statuses
        // this.connectionService.acceptConnectionRequest(req.id).subscribe(...);
        alert('Connection accepted! Sender has been notified and connection status updated.');
      } else {
        alert('Sender information missing. Cannot notify sender.');
      }
    } else {
      alert('No pending connection requests to accept.');
    }
  }

  get pendingConnectionRequests() {
    return (this.user?.connectionRequests || []).filter((r: any) => r.status === 'pending');
  }

  acceptRequest(requestId: string) {
    this.authService.respondToConnectionRequest(requestId, 'accepted').subscribe(() => {
      this.user.connectionRequests = this.user.connectionRequests.map((r: any) =>
        r._id === requestId ? { ...r, status: 'accepted' } : r
      );
      alert('Connection accepted!');
    });
  }

  rejectRequest(requestId: string) {
    this.authService.respondToConnectionRequest(requestId, 'rejected').subscribe(() => {
      this.user.connectionRequests = this.user.connectionRequests.map((r: any) =>
        r._id === requestId ? { ...r, status: 'rejected' } : r
      );
      alert('Connection rejected.');
    });
  }

  goToNotifications() {
    this.router.navigate(['/notifications']);
  }

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private timezoneService: TimezoneService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private skillsService: SkillsService,
    private router: Router,
    private connectionService: ConnectionService
  ) {
    this.timezoneService.getTimezones().subscribe(zones => {
      this.timezones = zones;
    });
    this.skillSearchSubject.pipe(debounceTime(300)).subscribe(value => {
      this.skillSearch = value;
      this.currentPage = 1;
    });
  }

  public get paginatedSkills(): Skill[] {
    // Ensure skills is always an array
    if (!Array.isArray(this.user.skills)) {
      this.user.skills = [];
    }
    
    let filtered = this.user.skills;
    if (this.skillSearch) {
      const search = this.skillSearch.toLowerCase();
      filtered = filtered.filter((skill: Skill) =>
        skill.name.toLowerCase().includes(search) ||
        skill.level.toLowerCase().includes(search) ||
        skill.description.toLowerCase().includes(search) ||
        (Array.isArray(skill.tags) && skill.tags.join(',').toLowerCase().includes(search))
      );
    }
    if (this.editMode) return filtered;
    const start = (this.currentPage - 1) * this.pageSize;
    return filtered.slice(start, start + this.pageSize);
  }

  public get totalPages(): number {
    return Math.ceil((this.user.skills?.length || 0) / this.pageSize) || 1;
  }

  public nextPage(): void {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }
  public prevPage(): void {
    if (this.currentPage > 1) this.currentPage--;
  }
  public onSkillSearchChange(value: string): void {
    this.skillSearchSubject.next(value);
  }

  // Utility to map backend skill fields to frontend model
  private mapSkill(skill: any): Skill {
    return {
      ...skill,
      id: skill.id || skill._id || undefined,
      name: skill.name || skill.skillName || '',
      level: skill.level || '',
      description: skill.description || '',
      tags: skill.tags || [],
      category: skill.category || 'General',
    };
  }

  private ensureUserStructure(user: any): any {
    return {
      ...user,
      skills: Array.isArray(user?.skills) ? user.skills.map((skill: any) => ({
        ...skill,
        tags: Array.isArray(skill.tags) ? skill.tags : []
      })) : [],
      tags: Array.isArray(user?.tags) ? user.tags : [],
      name: user?.name || '',
      email: user?.email || '',
      timezone: user?.timezone || ''
    };
  }

  ngOnInit(): void {
    console.log('Profile component initialized');
    
    // Initialize user with default empty structure
    this.user = {
      skills: [],
      tags: [],
      name: '',
      email: '',
      timezone: ''
    };
    
    // Set up debounced search
    this.skillSearchSubject.pipe(
      debounceTime(300)
    ).subscribe(searchTerm => {
      this.skillSearch = searchTerm;
    });

    // Load timezones
    this.timezoneService.getTimezones().subscribe(timezones => {
      this.timezones = timezones;
    });

    // Get current user
    this.authService.currentUser$.subscribe(user => {
      console.log('Current user in profile:', user);
      this.currentUser = user;
    });

    // Get route params to determine if viewing own profile or another user's
    this.route.params.subscribe(params => {
      const userId = params['userId'];
      console.log('Route params userId:', userId);
      
      if (userId) {
        // Viewing another user's profile
        this.isOwnProfile = false;
        this.authService.getUserById(userId).subscribe({
          next: (user) => {
            console.log('Loaded user profile:', user);
            this.user = this.ensureUserStructure(user);
            this.loadUserProfile();
            this.checkConnectionStatus(userId);
          },
          error: (error) => {
            console.error('Error loading user profile:', error);
          }
        });
      } else {
        // Viewing own profile
        this.isOwnProfile = true;
        this.authService.currentUser$.subscribe(user => {
          console.log('Loading own profile:', user);
          this.user = this.ensureUserStructure(user);
          this.loadUserProfile();
        });
      }
    });

    // Add debug methods to window object for console access
    (window as any).profileComponent = this;
    (window as any).refreshUserData = () => this.refreshUserData();
    (window as any).checkConnectionStatus = (userId: string) => this.checkConnectionStatus(userId);
    (window as any).sendConnectionRequest = () => this.sendConnectionRequest();
    (window as any).messageUser = () => this.messageUser();
    (window as any).getConnectionButtonText = () => this.getConnectionButtonText();
    (window as any).getConnectionButtonClass = () => this.getConnectionButtonClass();
    (window as any).onConnectionButtonClick = () => this.onConnectionButtonClick();
  }
  

  loadUserProfile(): void {
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.currentUser = user;
        this.user.timezone = user.timezone || this.timezoneService.getUserTimezone();
      }
    });
  }

  // Refresh user data from server
  refreshUserData(): void {
    console.log('🔄 Refreshing user data from server...');
    this.authService.getCurrentUser().subscribe({
      next: (freshUser) => {
        console.log('✅ Fresh user data received:', freshUser);
        this.user = freshUser;
        this.authService.setCurrentUser(freshUser);
        console.log('📊 Updated connection count:', this.user.connections?.length || 0);
      },
      error: (error) => {
        console.error('❌ Error refreshing user data:', error);
      }
    });
  }

  saveAbout() {
    // TODO: Save to backend
    console.log('Saving about:', this.user.about);
  }

  saveTimezone() {
    if (this.currentUser) {
      this.authService.updateProfile({ timezone: this.user.timezone }).subscribe({
        next: (updatedUser) => {
          console.log('Timezone saved:', this.user.timezone);
          this.currentUser = updatedUser;
        },
        error: (error) => {
          console.error('Error saving timezone:', error);
        }
      });
    }
  }

  enterEditMode() {
    this.editMode = true;
    this.originalUser = JSON.parse(JSON.stringify(this.user));
    // Add tagsString for editing tags as comma-separated string
    this.user.skills.forEach((skill: any) => {
      skill.tagsString = Array.isArray(skill.tags) ? skill.tags.join(', ') : '';
    });
  }
  cancelEdit() {
    this.editMode = false;
    this.user = JSON.parse(JSON.stringify(this.originalUser));
    this.successMessage = '';
    this.errorMessage = '';
  }
  onSave() {
    console.log('=== SAVE PROFILE ===');
    console.log('User authenticated:', this.authService.isAuthenticated());
    console.log('Current user:', this.authService.getCurrentUserValue());
    console.log('User data to save:', this.user);
    
    if (!this.user) {
      this.errorMessage = 'No user data to save.';
      return;
    }

    const formData = new FormData();
    
    // Add basic profile fields
    if (this.user.name) formData.append('name', this.user.name);
    if (this.user.title) formData.append('title', this.user.title);
    if (this.user.location) formData.append('location', this.user.location);
    if (this.user.bio) formData.append('bio', this.user.bio);
    if (this.user.about) formData.append('about', this.user.about);
    if (this.user.phone) formData.append('phone', this.user.phone);
    if (this.user.website) formData.append('website', this.user.website);
    if (this.user.timezone) formData.append('timezone', this.user.timezone);
    
    // Add photo if selected
    if (this.photoFile) {
      formData.append('photo', this.photoFile);
    }

    console.log('FormData contents:');
    for (let [key, value] of formData.entries()) {
      console.log(`${key}:`, value);
    }

      this.authService.updateProfile(formData).subscribe({
      next: (response) => {
        console.log('Profile update response:', response);
        this.user = response;
        this.editMode = false;
        this.successMessage = 'Profile updated successfully!';
        this.errorMessage = '';
        setTimeout(() => {
          this.successMessage = '';
        }, 3000);
      },
      error: (error) => {
        console.error('Profile update error:', error);
        this.errorMessage = error.error?.message || 'Failed to update profile.';
      }
    });
  }

  addSkill(newSkill: Skill) {
    if (!Array.isArray(this.user.skills)) this.user.skills = [];
    this.user.skills.push(newSkill);
    // Optionally, update the backend here
  }

  editSkill(index: number, updatedSkill: Skill) {
    if (Array.isArray(this.user.skills) && index >= 0 && index < this.user.skills.length) {
      this.user.skills[index] = updatedSkill;
      // Optionally, update the backend here
    }
  }

  removeSkill(index: number) {
    if (Array.isArray(this.user.skills) && index >= 0 && index < this.user.skills.length) {
      const skill = this.user.skills[index];
      const skillId = skill.id || skill._id;
      if (!skillId) {
        this.errorMessage = 'Skill ID not found.';
        return;
      }
      this.skillsService.deleteUserSkill(skillId).subscribe({
        next: () => {
          this.user.skills.splice(index, 1);
          this.successMessage = 'Skill deleted successfully!';
        },
        error: () => {
          this.errorMessage = 'Failed to delete skill in backend.';
        }
      });
    }
  }

  triggerPhotoUpload() {
    this.photoInput.nativeElement.click();
  }
  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.photoFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        this.photoPreview = reader.result as string;
        // Do NOT set this.user.photo here; only use photoPreview for preview
      };
      reader.readAsDataURL(file);
        }

        // Upload photo to backend (Cloudinary)
        if (this.photoFile) {
          this.authService.uploadProfilePhoto(this.photoFile).subscribe({
            next: (response) => {
              this.user.photo = response.url;
              this.successMessage = 'Profile photo updated!';
              setTimeout(() => this.successMessage = '', 3000);
            },
            error: (err) => {
              this.errorMessage = err.error?.message || 'Failed to upload photo.';
            }
          });
        }
  }

  addSkillFromForm() {
    console.log('=== ADD SKILL FROM FORM ===');
    console.log('User authenticated:', this.authService.isAuthenticated());
    console.log('Current user:', this.authService.getCurrentUserValue());
    console.log('Token exists:', !!this.authService.getAccessToken());
    
    // Defensive: check for undefined or empty
    if (!this.newSkillName || !this.newSkillName.trim() || !this.newSkillLevel || !this.newSkillLevel.trim()) {
      this.errorMessage = 'Skill name and level are required.';
      return;
    }
    // Backend expects 'name' and 'level'
    const newSkill = {
      name: this.newSkillName.trim(),
      level: this.newSkillLevel,
      description: this.newSkillDescription,
      tags: this.newSkillTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
    };
    
    console.log('=== SKILL FORM SUBMISSION ===');
    console.log('Form data - newSkillName:', this.newSkillName);
    console.log('Form data - newSkillLevel:', this.newSkillLevel);
    console.log('Form data - newSkillDescription:', this.newSkillDescription);
    console.log('Form data - newSkillTags:', this.newSkillTags);
    console.log('Processed newSkill object:', newSkill);

    if (this.editingSkillIndex !== null) {
      // Edit mode logic (unchanged)
      const skill = this.user.skills[this.editingSkillIndex];
      const skillId = skill.id || skill._id;
      console.log('Editing skill:', skill);
      console.log('Skill ID:', skillId);
      console.log('Editing skill index:', this.editingSkillIndex);
      
      if (!skillId) {
        this.errorMessage = 'Skill ID not found. Cannot update skill.';
        return;
      }
      
      this.user.skills[this.editingSkillIndex] = { ...newSkill, id: skillId };
      console.log('Sending skill update with ID:', skillId);
      console.log('Skill data being sent:', newSkill);
      
      this.skillsService.updateUserSkill(skillId, newSkill).subscribe({
        next: (updatedSkill) => {
          console.log('Received updated skill from backend:', updatedSkill);
          // Map updated skill for UI
          this.user.skills[this.editingSkillIndex!] = this.mapSkill(updatedSkill);
          this.successMessage = 'Skill updated successfully!';
          this.clearSkillForm();
          this.editingSkillIndex = null;
        },
        error: (error) => {
          console.error('Error updating skill:', error);
          this.errorMessage = error.error?.message || 'Failed to update skill.';
        }
      });
    } else {
      // Add mode logic
      console.log('Adding new skill to backend...');
      this.authService.addUserSkill(newSkill).subscribe({
        next: (response) => {
          console.log('Received response from backend:', response);
          // Add the new skill to the user's skills array
          if (!Array.isArray(this.user.skills)) this.user.skills = [];
          this.user.skills.push(this.mapSkill(response));
          this.successMessage = 'Skill added successfully!';
          this.clearSkillForm();
        },
        error: (error) => {
          console.error('Error adding skill:', error);
          this.errorMessage = error.error?.message || 'Failed to add skill.';
        }
      });
    }
  }

  editSkillFromForm(index: number) {
    const skill = this.user.skills[index];
    this.newSkillName = skill.name;
    this.newSkillLevel = skill.level;
    this.newSkillDescription = skill.description;
    this.newSkillTags = Array.isArray(skill.tags) ? skill.tags.join(', ') : '';
    this.editingSkillIndex = index;
  }

  private clearSkillForm() {
    this.newSkillName = '';
    this.newSkillLevel = '';
    this.newSkillDescription = '';
    this.newSkillTags = '';
  }

  clearSkillSearch(input: HTMLInputElement) {
    this.skillSearch = '';
    this.onSkillSearchChange('');
    setTimeout(() => input.focus(), 0);
  }

  checkConnectionStatus(userId: string) {
    // Use the existing ConnectionService to get connection status
    this.connectionService.getConnectionStatus(userId).subscribe({
      next: (response) => {
        if (response.success) {
          const status = response.data.status;
          const areConnected = response.data.areConnected;
          const userRole = response.data.userRole;
          
          // Store the connection details for use in button logic
          this.connectionDetails = {
            status,
            areConnected,
            userRole,
            isRequester: userRole === 'requester',
            isRecipient: userRole === 'recipient'
          };
          
          if (areConnected) {
            this.connectionStatus = 'accepted';
          } else if (status === 'pending') {
            this.connectionStatus = 'pending';
          } else {
            this.connectionStatus = null;
          }
        }
      },
      error: (error) => {
        console.error('Error checking connection status:', error);
        this.connectionStatus = null;
        this.connectionDetails = null;
      }
    });
  }

  sendConnectionRequest() {
    if (!this.user || this.isOwnProfile) return;
    
    const connectionRequest = {
      recipientId: this.user.id || this.user._id,
      message: `Hi! I'd like to connect with you.`,
      skillContext: 'Profile connection'
    };
    
    this.connectionService.sendConnectionRequest(connectionRequest).subscribe({
      next: () => {
        this.connectionStatus = 'pending';
        alert('Connection request sent!');
      },
      error: (err) => {
        alert('Failed to send connection request: ' + (err.error?.error || err.message));
      }
    });
  }

  messageUser() {
    if (!this.user || this.isOwnProfile) return;
    
    // Navigate to chat page with the specific user ID
    const userId = this.user.id || this.user._id;
    this.router.navigate(['/chat', userId]);
  }

  getConnectionButtonText(): string {
    const userRole = this.connectionDetails?.userRole;
    
    // Debug logging
    console.log(`🔘 Profile button text for ${this.user?.name} (${this.user?.id || this.user?._id}):`, {
      status: this.connectionStatus,
      userRole,
      currentUser: this.currentUser?.name
    });
    
    switch (this.connectionStatus) {
      case 'accepted':
        // If current user is the recipient (receiver), show "Connect Back"
        if (userRole === 'recipient') {
          return 'Connect Back';
        }
        return 'Message';
      case 'pending':
        // Don't show "Accept Request" on profile page - this should be handled in notifications/connections page
        if (userRole === 'recipient') {
          return 'Request Pending'; // Changed from "Accept Request" to "Request Pending"
        }
        return 'Request Sent';
      case 'rejected':
        return 'Connect';
      default:
        return 'Connect';
    }
  }



  getConnectionButtonClass(): string {
    const userRole = this.connectionDetails?.userRole;
    
    switch (this.connectionStatus) {
      case 'accepted':
        // If current user is the recipient (receiver), use different styling for "Connect Back"
        if (userRole === 'recipient') {
          return 'btn btn-info'; // Different color for "Connect Back"
        }
        return 'btn btn-success';
      case 'pending':
        // Use disabled styling for pending requests on profile page
        if (userRole === 'recipient') {
          return 'btn btn-secondary'; // Gray/disabled styling for "Request Pending"
        }
        return 'btn btn-warning';
      case 'rejected':
        return 'btn btn-primary';
      default:
        return 'btn btn-primary';
    }
  }

  onConnectionButtonClick() {
    const userRole = this.connectionDetails?.userRole;
    
    if (this.connectionStatus === 'accepted') {
      if (userRole === 'recipient') {
        // User is the recipient and wants to "Connect Back"
        this.sendConnectionBackRequest();
      } else {
        // User is the requester and wants to message
        this.messageUser();
      }
    } else if (this.connectionStatus === 'pending') {
      if (userRole === 'recipient') {
        // Don't allow accepting requests from profile page - redirect to notifications
        alert('Please check your notifications to accept connection requests.');
        this.router.navigate(['/notifications']);
      } else {
        // User is the requester and request is already sent
        alert('Connection request already sent!');
      }
    } else {
      this.sendConnectionRequest();
    }
  }

  private sendConnectionBackRequest() {
    if (!this.user || this.isOwnProfile) return;
    
    const connectionRequest = {
      recipientId: this.user.id || this.user._id,
      message: `Hi! I'd like to connect back with you.`,
      skillContext: 'Connect Back'
    };
    
    this.connectionService.sendConnectionRequest(connectionRequest).subscribe({
      next: () => {
        this.connectionStatus = 'pending';
        alert('Connection request sent back!');
      },
      error: (err) => {
        alert('Failed to send connection request back: ' + (err.error?.error || err.message));
      }
    });
  }

  private acceptPendingRequest() {
    if (!this.user || this.isOwnProfile) return;
    
    // Get received connection requests to find the pending one for this user
    this.connectionService.getConnectionRequests('received', 'pending').subscribe({
      next: (response) => {
        const pendingRequest = response.data.connections?.find((request: any) => 
          request.requester._id === (this.user.id || this.user._id) || 
          request.requester.id === (this.user.id || this.user._id)
        );
        
        if (pendingRequest) {
          // Accept the connection request
          this.connectionService.acceptConnectionRequest(pendingRequest._id).subscribe({
            next: (acceptResponse) => {
              console.log('✅ Connection request accepted:', acceptResponse);
              
              // Update local status immediately
              this.connectionStatus = 'accepted';
              this.connectionDetails = {
                ...this.connectionDetails,
                status: 'accepted',
                userRole: 'recipient'
              };
              
              // Show success message
              alert('Connection request accepted successfully!');
              
              // Refresh connection status to get updated data
              setTimeout(() => {
                this.checkConnectionStatus(this.user.id || this.user._id);
              }, 1000);
            },
            error: (err) => {
              console.error('❌ Error accepting connection request:', err);
              alert('Failed to accept connection request: ' + (err.error?.message || err.message));
            }
          });
        } else {
          alert('No pending connection request found for this user.');
        }
      },
      error: (err) => {
        console.error('❌ Error getting pending requests:', err);
        alert('Failed to get pending requests: ' + (err.error?.message || err.message));
      }
    });
  }

  // Method to check if user has pending connection requests
  hasPendingConnectionRequests(): boolean {
    if (!this.currentUser || !this.currentUser.connectionRequests) {
      return false;
    }
    return this.currentUser.connectionRequests.some((request: any) => request.status === 'pending');
  }

  // Method to get count of pending connection requests
  getPendingConnectionRequestCount(): number {
    if (!this.currentUser || !this.currentUser.connectionRequests) {
      return 0;
    }
    return this.currentUser.connectionRequests.filter((request: any) => request.status === 'pending').length;
  }

  // Handle payment settings changes
  onPaymentSettingsChange(settings: any): void {
    console.log('Payment settings updated:', settings);
    // The settings are automatically saved by the PaymentSettingsComponent
  }

}
