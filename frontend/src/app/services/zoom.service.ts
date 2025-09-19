import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ZoomMeeting {
  id: string;
  topic: string;
  start_time: string;
  duration: number;
  join_url: string;
  password?: string;
  settings: {
    host_video: boolean;
    participant_video: boolean;
    join_before_host: boolean;
    mute_upon_entry: boolean;
    watermark: boolean;
    use_pmi: boolean;
    approval_type: number;
    audio: string;
    auto_recording: string;
  };
}

export interface ZoomUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  type: number;
  pmi: string;
  timezone: string;
  verified: number;
  dept: string;
  created_at: string;
  last_login_time: string;
  last_client_version: string;
  pic_url: string;
  host_key: string;
  jid: string;
  group_ids: string[];
  im_group_ids: string[];
  account_id: string;
  language: string;
  phone_country: string;
  phone_number: string;
  status: string;
}

@Injectable({
  providedIn: 'root'
})
export class ZoomService {
  private apiUrl = 'http://localhost:3000/api/zoom';

  constructor(private http: HttpClient) {}

  // Connect to Zoom using Server-to-Server OAuth
  getAuthUrl(): Observable<{ success: boolean; data: { message: string; connectionType: string } }> {
    return this.http.get<{ success: boolean; data: { message: string; connectionType: string } }>(`${this.apiUrl}/oauth-url`);
  }

  // Handle Zoom OAuth callback
  handleAuthCallback(code: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth-callback`, { code });
  }

  // Get current user's Zoom profile
  getZoomUser(): Observable<ZoomUser> {
    return this.http.get<ZoomUser>(`${this.apiUrl}/user`);
  }

  // Create a new Zoom meeting for a session
  createMeeting(sessionId: string): Observable<ZoomMeeting> {
    return this.http.post<ZoomMeeting>(`${this.apiUrl}/create-meeting`, {
      sessionId
    });
  }

  // Get all meetings for the user
  getMeetings(): Observable<ZoomMeeting[]> {
    return this.http.get<ZoomMeeting[]>(`${this.apiUrl}/meetings`);
  }

  // Get a specific meeting
  getMeeting(meetingId: string): Observable<ZoomMeeting> {
    return this.http.get<ZoomMeeting>(`${this.apiUrl}/meetings/${meetingId}`);
  }

  // Update a meeting
  updateMeeting(meetingId: string, updates: Partial<ZoomMeeting>): Observable<ZoomMeeting> {
    return this.http.put<ZoomMeeting>(`${this.apiUrl}/meetings/${meetingId}`, updates);
  }

  // Delete a meeting
  deleteMeeting(meetingId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/meetings/${meetingId}`);
  }

  // Get meeting participants
  getMeetingParticipants(meetingId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/meetings/${meetingId}/participants`);
  }

  // Get meeting recordings
  getMeetingRecordings(meetingId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/meetings/${meetingId}/recordings`);
  }

  // Create instant meeting
  createInstantMeeting(topic: string): Observable<ZoomMeeting> {
    return this.http.post<ZoomMeeting>(`${this.apiUrl}/meetings/instant`, {
      topic,
      type: 1 // Instant meeting
    });
  }

  // Get meeting analytics
  getMeetingAnalytics(meetingId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/meetings/${meetingId}/analytics`);
  }

  // Check if user is connected to Zoom
  isConnected(): Observable<{ success: boolean; data: { isConnected: boolean; isExpired: boolean; lastConnected?: Date } }> {
    return this.http.get<{ success: boolean; data: { isConnected: boolean; isExpired: boolean; lastConnected?: Date } }>(`${this.apiUrl}/status`);
  }

  // Disconnect from Zoom
  disconnect(): Observable<any> {
    return this.http.post(`${this.apiUrl}/disconnect`, {});
  }

  // Get Zoom webhook events
  getWebhookEvents(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/webhooks`);
  }

  // Create meeting for session
  createSessionMeeting(sessionId: string, topic: string, startTime: string): Observable<ZoomMeeting> {
    return this.http.post<ZoomMeeting>(`${this.apiUrl}/session-meeting`, {
      sessionId,
      topic,
      startTime
    });
  }

  // Sync Zoom meetings from external Zoom account to database
  syncMeetings(): Observable<{ success: boolean; data: { syncedMeetings: any[]; message: string } }> {
    return this.http.post<{ success: boolean; data: { syncedMeetings: any[]; message: string } }>(`${this.apiUrl}/sync-meetings`, {});
  }

  // Manual sync for free accounts - allows users to input their Zoom meeting details
  manualSyncMeeting(meetingDetails: {
    topic: string;
    startTime: string;
    duration: number;
    meetingId?: string;
    joinUrl?: string;
    password?: string;
    timezone?: string;
  }): Observable<{ success: boolean; data: { session: any; meeting: any; message: string } }> {
    console.log('🔄 ZoomService: Making manual sync API call to:', `${this.apiUrl}/sync-manual`);
    console.log('🔄 ZoomService: Meeting details:', meetingDetails);
    
    return this.http.post<{ success: boolean; data: { session: any; meeting: any; message: string } }>(`${this.apiUrl}/sync-manual`, meetingDetails);
  }

  // Auto-sync from Zoom invitation text for free accounts - automatically extracts meeting details from invitation
  autoSyncFromInvitation(invitationText: string): Observable<{ success: boolean; data: { session: any; meeting: any; message: string } }> {
    return this.http.post<{ success: boolean; data: { session: any; meeting: any; message: string } }>(`${this.apiUrl}/sync-invitation`, { invitationText });
  }
} 