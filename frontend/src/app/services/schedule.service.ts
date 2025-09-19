import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Session {
  _id?: string;
  id?: string;
  title: string;
  description: string;
  skill: string; // Changed from skillId to match backend
  host: string | {
    _id: string;
    name: string;
    email: string;
    photo?: string;
  }; // Can be string (ID) or populated object
  participants: Array<{
    user?: string | {
      _id: string;
      name: string;
      email: string;
      photo?: string;
    };
    email?: string;
    role: 'learner' | 'mentor' | 'observer';
    joinedAt?: Date;
    leftAt?: Date;
    rating?: number;
    feedback?: string;
  }>;
  maxParticipants: number;
  startTime: string;
  endTime: string;
  duration: number; // in minutes
  timezone: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';
  meetingStatus?: 'not-started' | 'live' | 'ended';
  actualStartTime?: string;
  actualEndTime?: string;
  hostJoinedAt?: string;
  sessionType: 'one-on-one' | 'group' | 'workshop';
  price: number;
  currency: string;
  paymentStatus: 'pending' | 'paid' | 'refunded' | 'failed';
  zoomMeeting?: {
    meetingId: string;
    joinUrl: string;
    startUrl: string;
    password?: string;
  };
  createdAt: string;
  updatedAt: string;
  
  // Populated fields (for backward compatibility)
  hostDetails?: {
    _id: string;
    name: string;
    email: string;
    photo?: string;
  };
  participantDetails?: Array<{
    user: {
      _id: string;
      name: string;
      email: string;
      photo?: string;
    };
    role: string;
    joinedAt?: Date;
  }>;
}

export interface CreateSessionRequest {
  title: string;
  description: string;
  skill: string; // Changed from skillId to match backend
  startTime: string;
  endTime: string;
  price: number;
  currency?: string;
  timezone?: string;
  sessionType?: 'one-on-one' | 'group' | 'workshop';
  maxParticipants?: number;
  difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  tags?: string[] | string;
  attendees?: string[]; // Array of attendee email addresses
}

export interface BookSessionRequest {
  sessionId: string;
  studentId: string;
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  timezone: string;
  available: boolean;
  sessionId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ScheduleService {
  private apiUrl = 'http://localhost:3000/api/sessions';

  constructor(private http: HttpClient) {}

  // Create a new session (teacher)
  createSession(sessionData: CreateSessionRequest): Observable<Session> {
    return this.http.post<Session>(`${this.apiUrl}`, sessionData);
  }

  // Get all sessions
  getSessions(): Observable<Session[]> {
    return this.http.get<Session[]>(`${this.apiUrl}`);
  }

  // Get sessions by teacher
  getTeacherSessions(teacherId: string): Observable<Session[]> {
    return this.http.get<Session[]>(`${this.apiUrl}/teacher/${teacherId}`);
  }

  // Get sessions by student
  getStudentSessions(studentId: string): Observable<Session[]> {
    return this.http.get<Session[]>(`${this.apiUrl}/student/${studentId}`);
  }

  // Get a specific session
  getSession(sessionId: string): Observable<Session> {
    return this.http.get<Session>(`${this.apiUrl}/${sessionId}`);
  }

  // Book a session (student)
  bookSession(bookingData: BookSessionRequest): Observable<Session> {
    return this.http.post<Session>(`${this.apiUrl}/${bookingData.sessionId}/book`, {
      studentId: bookingData.studentId
    });
  }

  // Cancel a session
  cancelSession(sessionId: string, reason?: string): Observable<Session> {
    return this.http.post<Session>(`${this.apiUrl}/${sessionId}/cancel`, {
      reason
    });
  }

  // Update session status
  updateSessionStatus(sessionId: string, status: Session['status']): Observable<Session> {
    return this.http.put<Session>(`${this.apiUrl}/${sessionId}/status`, {
      status
    });
  }

  // Update session
  updateSession(sessionId: string, updateData: Partial<CreateSessionRequest>): Observable<Session> {
    return this.http.put<Session>(`${this.apiUrl}/${sessionId}`, updateData);
  }

  // Delete a session
  deleteSession(sessionId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${sessionId}`);
  }

  // Get available time slots for a teacher
  getAvailableTimeSlots(teacherId: string, date: string): Observable<TimeSlot[]> {
    return this.http.get<TimeSlot[]>(`${this.apiUrl}/availability/${teacherId}`, {
      params: { date }
    });
  }

  // Set teacher availability
  setAvailability(teacherId: string, timeSlots: TimeSlot[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/availability/${teacherId}`, {
      timeSlots
    });
  }

  // Get teacher availability
  getTeacherAvailability(teacherId: string, startDate: string, endDate: string): Observable<TimeSlot[]> {
    return this.http.get<TimeSlot[]>(`${this.apiUrl}/availability/${teacherId}/range`, {
      params: { startDate, endDate }
    });
  }

  // Search available sessions
  searchSessions(filters: {
    skillId?: string;
    teacherId?: string;
    date?: string;
    minPrice?: number;
    maxPrice?: number;
    duration?: number;
  }): Observable<Session[]> {
    return this.http.get<Session[]>(`${this.apiUrl}/search`, {
      params: filters as any
    });
  }

  // Get upcoming sessions
  getUpcomingSessions(userId: string, limit: number = 10): Observable<Session[]> {
    return this.http.get<Session[]>(`${this.apiUrl}/upcoming/${userId}`, {
      params: { limit: limit.toString() }
    });
  }

  // Get session history
  getSessionHistory(userId: string, page: number = 1, limit: number = 20): Observable<{
    sessions: Session[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return this.http.get<any>(`${this.apiUrl}/history/${userId}`, {
      params: { page: page.toString(), limit: limit.toString() }
    });
  }

  // Reschedule session
  rescheduleSession(sessionId: string, newStartTime: string, newEndTime: string): Observable<Session> {
    return this.http.put<Session>(`${this.apiUrl}/${sessionId}/reschedule`, {
      startTime: newStartTime,
      endTime: newEndTime
    });
  }

  // Add meeting URL to session
  addMeetingUrl(sessionId: string, meetingUrl: string, meetingId?: string): Observable<Session> {
    return this.http.post<Session>(`${this.apiUrl}/${sessionId}/meeting-url`, {
      meetingUrl,
      meetingId
    });
  }

  // Get session statistics
  getSessionStats(userId: string): Observable<{
    totalSessions: number;
    completedSessions: number;
    cancelledSessions: number;
    totalEarnings: number;
    averageRating: number;
  }> {
    return this.http.get<any>(`${this.apiUrl}/stats/${userId}`);
  }

  // Send session reminder
  sendSessionReminder(sessionId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${sessionId}/reminder`, {});
  }

  // Get session participants
  getSessionParticipants(sessionId: string): Observable<{
    teacher: any;
    student?: any;
  }> {
    return this.http.get<any>(`${this.apiUrl}/${sessionId}/participants`);
  }

  // Start meeting (Host only)
  startMeeting(sessionId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${sessionId}/start-meeting`, {});
  }

  // End meeting (Host only)
  endMeeting(sessionId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${sessionId}/end-meeting`, {});
  }
} 