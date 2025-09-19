import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, catchError, finalize } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface ZoomOAuthUrl {
  oauthUrl: string;
  state: string;
}

export interface ZoomMeeting {
  meetingId: string;
  joinUrl: string;
  startUrl: string;
  password: string;
  hostEmail: string;
}

export interface ZoomMeetingDetails {
  id: string;
  topic: string;
  startTime: string;
  duration: number;
  joinUrl: string;
  startUrl: string;
  password: string;
  status: string;
  hostEmail: string;
}

export interface ZoomUserMeetings {
  meetings: ZoomMeetingDetails[];
  nextPageToken?: string;
  pageCount: number;
  pageSize: number;
  totalRecords: number;
}

export interface ZoomParticipant {
  id: string;
  name: string;
  user_email: string;
  join_time: string;
  leave_time?: string;
}

export interface ZoomRecording {
  id: string;
  recording_type: string;
  download_url: string;
  file_size: number;
  recording_start: string;
  recording_end: string;
}

export interface ZoomStatus {
  isConnected: boolean;
  isExpired: boolean;
  lastConnected?: Date;
}

export interface ZoomSettings {
  maxParticipants: number;
  recordingEnabled: boolean;
  waitingRoomEnabled: boolean;
  joinBeforeHost: boolean;
  muteUponEntry: boolean;
  autoRecording: string;
  watermark: boolean;
  meetingAuthentication: boolean;
  audioOptions: string[];
  videoOptions: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ZoomService {
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$ = this.isLoadingSubject.asObservable();

  private readonly API_URL = `${environment.apiUrl}/zoom`;

  constructor(private http: HttpClient) {}

  // Get OAuth URL for Zoom authorization
  getOAuthUrl(): Observable<ZoomOAuthUrl> {
    return this.http.get<{ success: boolean; data: ZoomOAuthUrl }>(
      `${this.API_URL}/oauth-url`
    ).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        }
        throw new Error('Failed to get OAuth URL');
      }),
      catchError(this.handleError)
    );
  }

  // Create Zoom meeting for session
  createMeeting(sessionId: string): Observable<ZoomMeeting> {
    this.isLoadingSubject.next(true);
    
    return this.http.post<{ success: boolean; data: ZoomMeeting }>(
      `${this.API_URL}/create-meeting`,
      { sessionId }
    ).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        }
        throw new Error('Failed to create Zoom meeting');
      }),
      catchError(this.handleError),
      finalize(() => {
        this.isLoadingSubject.next(false);
      })
    );
  }

  // Update Zoom meeting
  updateMeeting(meetingId: string, sessionId: string): Observable<{ success: boolean; message: string }> {
    this.isLoadingSubject.next(true);
    
    return this.http.put<{ success: boolean; message: string }>(
      `${this.API_URL}/meetings/${meetingId}`,
      { sessionId }
    ).pipe(
      catchError(this.handleError),
      finalize(() => {
        this.isLoadingSubject.next(false);
      })
    );
  }

  // Delete Zoom meeting
  deleteMeeting(meetingId: string, sessionId: string): Observable<{ success: boolean; message: string }> {
    this.isLoadingSubject.next(true);
    
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.API_URL}/meetings/${meetingId}`,
      { body: { sessionId } }
    ).pipe(
      catchError(this.handleError),
      finalize(() => {
        this.isLoadingSubject.next(false);
      })
    );
  }

  // Get meeting details
  getMeetingDetails(meetingId: string): Observable<ZoomMeetingDetails> {
    return this.http.get<{ success: boolean; data: ZoomMeetingDetails }>(
      `${this.API_URL}/meetings/${meetingId}`
    ).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        }
        throw new Error('Failed to get meeting details');
      }),
      catchError(this.handleError)
    );
  }

  // Get user's meetings
  getUserMeetings(pageSize: number = 30, nextPageToken?: string): Observable<ZoomUserMeetings> {
    let params = `?pageSize=${pageSize}`;
    if (nextPageToken) params += `&nextPageToken=${nextPageToken}`;

    return this.http.get<{ success: boolean; data: ZoomUserMeetings }>(
      `${this.API_URL}/meetings${params}`
    ).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        }
        throw new Error('Failed to get user meetings');
      }),
      catchError(this.handleError)
    );
  }

  // Get meeting participants
  getMeetingParticipants(meetingId: string): Observable<ZoomParticipant[]> {
    return this.http.get<{ success: boolean; data: ZoomParticipant[] }>(
      `${this.API_URL}/meetings/${meetingId}/participants`
    ).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        }
        throw new Error('Failed to get meeting participants');
      }),
      catchError(this.handleError)
    );
  }

  // Get meeting recording
  getMeetingRecording(meetingId: string): Observable<ZoomRecording[]> {
    return this.http.get<{ success: boolean; data: ZoomRecording[] }>(
      `${this.API_URL}/meetings/${meetingId}/recording`
    ).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        }
        throw new Error('Failed to get meeting recording');
      }),
      catchError(this.handleError)
    );
  }

  // Disconnect Zoom account
  disconnectAccount(): Observable<{ success: boolean; message: string }> {
    this.isLoadingSubject.next(true);
    
    return this.http.post<{ success: boolean; message: string }>(
      `${this.API_URL}/disconnect`,
      {}
    ).pipe(
      catchError(this.handleError),
      finalize(() => {
        this.isLoadingSubject.next(false);
      })
    );
  }

  // Get Zoom connection status
  getConnectionStatus(): Observable<ZoomStatus> {
    return this.http.get<{ success: boolean; data: ZoomStatus }>(
      `${this.API_URL}/status`
    ).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        }
        throw new Error('Failed to get Zoom status');
      }),
      catchError(this.handleError)
    );
  }

  // Refresh Zoom token manually
  refreshToken(): Observable<{ success: boolean; message: string }> {
    this.isLoadingSubject.next(true);
    
    return this.http.post<{ success: boolean; message: string }>(
      `${this.API_URL}/refresh-token`,
      {}
    ).pipe(
      catchError(this.handleError),
      finalize(() => {
        this.isLoadingSubject.next(false);
      })
    );
  }

  // Get Zoom settings
  getSettings(): Observable<ZoomSettings> {
    return this.http.get<{ success: boolean; data: ZoomSettings }>(
      `${this.API_URL}/settings`
    ).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        }
        throw new Error('Failed to get Zoom settings');
      }),
      catchError(this.handleError)
    );
  }

  // Test Zoom connection
  testConnection(): Observable<{ success: boolean; message: string; data: any }> {
    this.isLoadingSubject.next(true);
    
    return this.http.post<{ success: boolean; message: string; data: any }>(
      `${this.API_URL}/test-connection`,
      {}
    ).pipe(
      catchError(this.handleError),
      finalize(() => {
        this.isLoadingSubject.next(false);
      })
    );
  }

  // Open Zoom OAuth in new window
  openZoomOAuth(): void {
    this.getOAuthUrl().subscribe({
      next: (data) => {
        const width = 500;
        const height = 600;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);

        const popup = window.open(
          data.oauthUrl,
          'zoom_oauth',
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
        );

        if (popup) {
          // Check if popup was closed or redirected
          const checkClosed = setInterval(() => {
            if (popup.closed) {
              clearInterval(checkClosed);
              // Refresh the page or update status
              window.location.reload();
            }
          }, 1000);
        }
      },
      error: (error) => {
        console.error('Failed to get OAuth URL:', error);
      }
    });
  }

  // Enhanced Join Zoom meeting with comprehensive functionality
  joinMeeting(joinUrl: string, password?: string, isHost: boolean = false, meetingId?: string): void {
    try {
      // Validate join URL
      if (!joinUrl || !joinUrl.includes('zoom.us')) {
        throw new Error('Invalid Zoom meeting URL');
      }

      // Add password to URL if provided
      let finalJoinUrl = joinUrl;
      if (password) {
        const separator = joinUrl.includes('?') ? '&' : '?';
        finalJoinUrl += `${separator}pwd=${encodeURIComponent(password)}`;
      }

      // Add user information to URL for better tracking
      const userInfo = this.getCurrentUserInfo();
      if (userInfo) {
        const nameParam = `&uname=${encodeURIComponent(userInfo.name)}`;
        const emailParam = `&email=${encodeURIComponent(userInfo.email)}`;
        finalJoinUrl += nameParam + emailParam;
      }

      // Log the join attempt
      console.log(`Joining Zoom meeting: ${meetingId || 'unknown'}, Host: ${isHost}, URL: ${finalJoinUrl}`);

      // Open in new tab/window
      const popup = window.open(finalJoinUrl, '_blank', 'noopener,noreferrer');
      
      if (!popup) {
        // Fallback if popup is blocked
        window.location.href = finalJoinUrl;
      }

      // Track join attempt
      this.trackJoinAttempt(meetingId, isHost);

    } catch (error) {
      console.error('Error joining Zoom meeting:', error);
      this.showJoinError(error);
    }
  }

  // Start Zoom meeting (for host only)
  startMeeting(startUrl: string, meetingId?: string): void {
    try {
      // Validate start URL
      if (!startUrl || !startUrl.includes('zoom.us')) {
        throw new Error('Invalid Zoom start URL');
      }

      // Add user information
      const userInfo = this.getCurrentUserInfo();
      if (userInfo) {
        const nameParam = `&uname=${encodeURIComponent(userInfo.name)}`;
        const emailParam = `&email=${encodeURIComponent(userInfo.email)}`;
        startUrl += nameParam + emailParam;
      }

      console.log(`Starting Zoom meeting: ${meetingId || 'unknown'}, URL: ${startUrl}`);

      // Open in new tab/window
      const popup = window.open(startUrl, '_blank', 'noopener,noreferrer');
      
      if (!popup) {
        // Fallback if popup is blocked
        window.location.href = startUrl;
      }

      // Track start attempt
      this.trackStartAttempt(meetingId);

    } catch (error) {
      console.error('Error starting Zoom meeting:', error);
      this.showStartError(error);
    }
  }

  // Smart join method that determines if user is host or attendee
  smartJoinMeeting(meetingDetails: ZoomMeetingDetails, currentUserEmail: string): void {
    const isHost = meetingDetails.hostEmail === currentUserEmail;
    
    if (isHost && meetingDetails.startUrl) {
      // Host should use start URL
      this.startMeeting(meetingDetails.startUrl, meetingDetails.id);
    } else {
      // Attendee or host without start URL uses join URL
      this.joinMeeting(meetingDetails.joinUrl, meetingDetails.password, isHost, meetingDetails.id);
    }
  }

  // Smart join meeting via backend API
  smartJoinMeetingAPI(meetingId: string, sessionId: string): Observable<{
    joinUrl: string;
    isHost: boolean;
    meetingId: string;
    sessionId: string;
  }> {
    return this.http.post<{ success: boolean; data: any }>(
      `${this.API_URL}/join-meeting`,
      { meetingId, sessionId }
    ).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        }
        throw new Error('Failed to join meeting');
      }),
      catchError(this.handleError)
    );
  }

  // Get meeting status from backend
  getMeetingStatusAPI(meetingId: string): Observable<{
    status: string;
    message: string;
    canJoin: boolean;
    meetingStart: string;
    meetingEnd: string;
    duration: number;
  }> {
    return this.http.get<{ success: boolean; data: any }>(
      `${this.API_URL}/meeting-status/${meetingId}`
    ).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        }
        throw new Error('Failed to get meeting status');
      }),
      catchError(this.handleError)
    );
  }

  // Check if meeting is ready to join
  isMeetingReadyToJoin(meetingDetails: ZoomMeetingDetails): boolean {
    const now = new Date();
    const meetingStart = new Date(meetingDetails.startTime);
    const meetingEnd = new Date(meetingStart.getTime() + meetingDetails.duration * 60000);
    
    // Allow joining 5 minutes before start time
    const earlyJoinTime = new Date(meetingStart.getTime() - 5 * 60000);
    
    return now >= earlyJoinTime && now <= meetingEnd;
  }

  // Get meeting join status
  getMeetingJoinStatus(meetingDetails: ZoomMeetingDetails): {
    canJoin: boolean;
    status: string;
    message: string;
    timeUntilStart?: number;
  } {
    const now = new Date();
    const meetingStart = new Date(meetingDetails.startTime);
    const meetingEnd = new Date(meetingStart.getTime() + meetingDetails.duration * 60000);
    const earlyJoinTime = new Date(meetingStart.getTime() - 5 * 60000);
    
    if (now < earlyJoinTime) {
      const timeUntilStart = Math.ceil((meetingStart.getTime() - now.getTime()) / 60000);
      return {
        canJoin: false,
        status: 'waiting',
        message: `Meeting starts in ${timeUntilStart} minutes`,
        timeUntilStart
      };
    } else if (now >= earlyJoinTime && now <= meetingEnd) {
      return {
        canJoin: true,
        status: 'ready',
        message: 'Meeting is ready to join'
      };
    } else {
      return {
        canJoin: false,
        status: 'ended',
        message: 'Meeting has ended'
      };
    }
  }

  // Format meeting time
  formatMeetingTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  }

  // Format meeting duration
  formatMeetingDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }

  // Get meeting status color
  getMeetingStatusColor(status: string): string {
    switch (status) {
      case 'waiting':
        return 'warning';
      case 'started':
        return 'success';
      case 'finished':
        return 'secondary';
      default:
        return 'primary';
    }
  }

  // Get meeting status text
  getMeetingStatusText(status: string): string {
    switch (status) {
      case 'waiting':
        return 'Waiting to Start';
      case 'started':
        return 'In Progress';
      case 'finished':
        return 'Finished';
      default:
        return status;
    }
  }

  // Handle errors
  private handleError = (error: any): Observable<never> => {
    let errorMessage = 'An error occurred';
    
    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    console.error('Zoom service error:', error);
    return new Observable(observer => {
      observer.error(new Error(errorMessage));
    });
  };

  // Private helper methods
  private getCurrentUserInfo(): { name: string; email: string } | null {
    try {
      // Get user info from localStorage or auth service
      const userStr = localStorage.getItem('currentUser');
      if (userStr) {
        const user = JSON.parse(userStr);
        return {
          name: user.name || user.displayName || 'Guest',
          email: user.email || ''
        };
      }
      return null;
    } catch (error) {
      console.warn('Could not get user info:', error);
      return null;
    }
  }

  private trackJoinAttempt(meetingId?: string, isHost: boolean = false): void {
    // Track analytics or logging
    console.log(`Join attempt tracked: Meeting ${meetingId}, Host: ${isHost}, Time: ${new Date().toISOString()}`);
  }

  private trackStartAttempt(meetingId?: string): void {
    // Track analytics or logging
    console.log(`Start attempt tracked: Meeting ${meetingId}, Time: ${new Date().toISOString()}`);
  }

  private showJoinError(error: any): void {
    const message = error.message || 'Failed to join meeting';
    // You can implement a toast notification service here
    alert(`Error joining meeting: ${message}`);
  }

  private showStartError(error: any): void {
    const message = error.message || 'Failed to start meeting';
    // You can implement a toast notification service here
    alert(`Error starting meeting: ${message}`);
  }
} 