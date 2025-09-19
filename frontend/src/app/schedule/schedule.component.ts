// ...existing code...
  // ...existing code...
import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CalendarView, CalendarEvent as AngularCalendarEvent } from 'angular-calendar';
import { MatDialog } from '@angular/material/dialog';
import { ScheduleService, Session, CreateSessionRequest, TimeSlot } from '../services/schedule.service';
import { AuthService, User } from '../core/services/auth.service';
import { SocketService } from '../core/services/socket.service';
import { ZoomService } from '../services/zoom.service';
import { TimezoneService } from '../services/timezone.service';
import * as moment from 'moment-timezone';
import { Subject, Subscription } from 'rxjs';
import { addDays } from 'date-fns';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatMomentDateModule } from '@angular/material-moment-adapter';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatCheckboxModule,
    MatIconModule,
    MatTabsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatMomentDateModule,
    MatTooltipModule
  ],
  templateUrl: './schedule.component.html',
  styleUrls: ['./schedule.component.css']
})
export class ScheduleComponent implements OnInit, OnDestroy {
  view: CalendarView = CalendarView.Month;
  showConnectNow = false;
  // Properties for month/year picker
  showMonthYearPicker = false;
  pickerMonth = new Date().getMonth();
  pickerYear = new Date().getFullYear();

  // Skills for dropdown
  skills: any[] = [];

  setMonthYear(month: number, year: number) {
    this.viewDate = new Date(year, month, 1);
    this.showMonthYearPicker = false;
  }

  clearFilters() {
    this.eventFilter = { skill: '', status: '', search: '' };
    if (typeof this.applyEventFilters === 'function') {
      this.applyEventFilters();
    }
  }

  getAvailableSkills() {
    // Return unique skills from calendarEvents or skills array
    const allSkills = this.skills.length ? this.skills : this.calendarEvents.map(e => e.meta?.skill).filter(Boolean);
    return Array.from(new Set(allSkills));
  }

  hasActiveFilters() {
    return !!(this.eventFilter.skill || this.eventFilter.status || this.eventFilter.search);
  }
  todayString: string = new Date().toISOString().split('T')[0];
  eventFilter: any = { skill: '', status: '', search: '' };
  zoomConnectionLoading: boolean = false;
  userTimezone: string = '';
  eventFormModel: any = {};
  pollIntervalId: any;
  private socketSubscriptions: Subscription[] = [];
  loading: boolean = false;
  errorMessage: string = '';
  currentUser: any = null;
  sessions: any[] = [];
  calendarEvents: any[] = [];
  refresh = { next: (_: any) => {} };
  availableSessions: any[] = [];
  upcomingSessions: any[] = [];
  selectedDate: Date = new Date();
  viewDate: Date = new Date();
  newSession: any = {};
  selectedSession: any = null;
  showCreatePanel: boolean = false;
  sessionFormModel: any = {};
  successMessage: string = '';
  selectedEventForEdit: any = null;
  isEditing: boolean = false;
  zoomConnected: boolean = false;
  
  // Manual sync properties for free accounts
  showManualSyncModal: boolean = false;
  showInvitationSyncModal: boolean = false;
  manualSyncForm: any = {
    topic: '',
    startTime: '',
    duration: 60,
    meetingId: '',
    joinUrl: '',
    password: '',
    timezone: 'UTC'
  };
  invitationSyncForm: any = {
    invitationText: ''
  };
  searchFilters: any = {};
  selectedEvent: any = null;

  CalendarView = CalendarView;
  @ViewChild('eventDialog') eventDialog: any;
  @ViewChild('inviteBtn') inviteBtn: any;
  @ViewChild('inviteDialog') inviteDialog: any;
  constructor(
    private scheduleService: ScheduleService,
    private authService: AuthService,
    private socketService: SocketService,
    private zoomService: ZoomService,
    private timezoneService: TimezoneService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
  this.view = this.CalendarView.Month;
  console.log('🚀 ScheduleComponent ngOnInit started');
    
    // ZOOM STATE DEBUG - Let's see what's in localStorage at the very start
    console.log('🔍 ==> ZOOM STATE DEBUG START <==');
    console.log('🔍 localStorage available:', typeof localStorage !== 'undefined');
    if (typeof localStorage !== 'undefined') {
      console.log('🔍 All localStorage keys:', Object.keys(localStorage));
      console.log('🔍 zoomConnected value in localStorage:', localStorage.getItem('zoomConnected'));
      console.log('🔍 accessToken value in localStorage:', localStorage.getItem('accessToken') ? 'EXISTS' : 'NOT FOUND');
    }
    console.log('🔍 Initial component zoomConnected state:', this.zoomConnected);
    console.log('🔍 ==> ZOOM STATE DEBUG END <==');
    
    // Test timezone conversion
    this.testTimezoneConversion();
    
    // Initialize timezone service first
    this.initializeTimezoneService();
    
    // Load user data
    this.loadUserData();
    
    // Restore Zoom connection state from localStorage first
    console.log('🔍 Restoring Zoom connection state...');
    this.restoreZoomConnectionState();
    console.log('🔍 After restore - zoomConnected state:', this.zoomConnected);
    
    // Check Zoom connection status on init
    console.log('🔍 Checking Zoom connection on init...');
    this.checkZoomConnection();
    
    // Load sessions after user data is loaded
    setTimeout(() => {
      this.loadSessionsFromBackend();
    }, 1000);
    
    // Setup socket event listeners for real-time session updates
    this.setupSocketListeners();
    
    console.log('✅ ScheduleComponent ngOnInit completed');
  }

  // Test method to debug timezone conversion
  private testTimezoneConversion(): void {
    console.log('🧪 TESTING TIMEZONE CONVERSION');
    
    // Test case: August 2, 2025 at 1:30 AM
    const testYear = 2025;
    const testMonth = 8;
    const testDay = 2;
    const testHour = 1;
    const testMinute = 30;
    const testAMPM = 'AM';
    const testTimezone = 'America/New_York'; // Example timezone
    
    console.log('🧪 Test input:', {
      year: testYear,
      month: testMonth,
      day: testDay,
      hour: testHour,
      minute: testMinute,
      ampm: testAMPM,
      timezone: testTimezone
    });
    
    try {
      const testDate = this.timezoneService.createDateWithTime(
        testYear, testMonth, testDay, testHour, testMinute, testAMPM, testTimezone
      );
      
      console.log('🧪 Test result UTC:', testDate.toISOString());
      console.log('🧪 Test result toString:', testDate.toString());
      
      // Test converting back to the timezone
      const testBackToTimezone = moment.tz(testDate, testTimezone);
      console.log('🧪 Test back to timezone:', testBackToTimezone.format('YYYY-MM-DD HH:mm'));
      
    } catch (error) {
      console.error('🧪 Test failed:', error);
    }
    
    console.log('🧪 TIMEZONE CONVERSION TEST COMPLETED');
  }

  // Test method to debug calendar event conversion
  private testCalendarEventConversion(session: any, calendarEvent: any): void {
    console.log('🧪 TESTING CALENDAR EVENT CONVERSION');
    console.log('🧪 Original session startTime:', session.startTime);
    console.log('🧪 Original session endTime:', session.endTime);
    console.log('🧪 Calendar event start:', calendarEvent.start);
    console.log('🧪 Calendar event end:', calendarEvent.end);
    console.log('🧪 User timezone:', this.userTimezone);
    
    // Test formatting the times
    const formattedStart = this.formatEventTimeInUserTimezone(calendarEvent.start, this.userTimezone);
    const formattedEnd = this.formatEventTimeInUserTimezone(calendarEvent.end, this.userTimezone);
    
    console.log('🧪 Formatted start:', formattedStart);
    console.log('🧪 Formatted end:', formattedEnd);
    console.log('🧪 CALENDAR EVENT CONVERSION TEST COMPLETED');
  }

  private initializeTimezoneService(): void {
    console.log('🌍 Initializing timezone service...');
    
    // Get timezones list
    this.timezoneService.getTimezones().subscribe({
      next: (zones) => {
        this.timezones = zones;
        console.log('✅ Timezones loaded:', zones.length);
      },
      error: (error) => {
        console.error('❌ Error loading timezones:', error);
        this.timezones = [];
      }
    });
    
    // Set user timezone with normalization
    this.timezoneService.userTimezone$.subscribe({
      next: (tz) => {
        const normalizedTz = this.timezoneService.normalizeTimezone(tz || this.timezoneService.getUserTimezone());
        this.userTimezone = normalizedTz;
        this.eventFormModel.timezone = normalizedTz;
        console.log('✅ User timezone set (normalized):', normalizedTz);
      },
      error: (error) => {
        console.error('❌ Error setting user timezone:', error);
        this.userTimezone = 'UTC';
        this.eventFormModel.timezone = 'UTC';
      }
    });
  }

  ngOnDestroy(): void {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
    }
    
    // Unsubscribe from socket events
    this.socketSubscriptions.forEach(sub => sub.unsubscribe());
    this.socketSubscriptions = [];
  }

  private setupSocketListeners(): void {
    console.log('🔌 Setting up socket listeners for session updates...');
    
    // Listen for session updates
    const sessionUpdatedSub = this.socketService.sessionUpdated$.subscribe({
      next: (data: any) => {
        console.log('🔄 Session updated notification received:', data);
        
        if (data.session) {
          // Find and update the session in our local array
          const sessionIndex = this.sessions.findIndex(s => s._id === data.session._id);
          if (sessionIndex !== -1) {
            this.sessions[sessionIndex] = data.session;
            console.log('✅ Updated session in local array');
          } else {
            // Session not found locally, add it
            this.sessions.push(data.session);
            console.log('✅ Added new session to local array');
          }
          
          // Refresh the calendar view
          this.updateCalendarEvents();
          this.refresh.next({});
          
          // Show notification if this update is from another user
          const currentUserId = this.currentUser?.id || this.currentUser?._id;
          if (data.updatedBy && data.updatedBy !== currentUserId) {
            console.log('📢 Session updated by another user:', data.updatedBy);
            // You can add a toast notification here if needed
          }
        }
      },
      error: (error) => {
        console.error('❌ Error in session updated listener:', error);
      }
    });
    this.socketSubscriptions.push(sessionUpdatedSub);
    
    // Listen for session deletions
    const sessionDeletedSub = this.socketService.sessionDeleted$.subscribe({
      next: (data: any) => {
        console.log('🗑️ Session deleted notification received:', data);
        
        if (data.sessionId) {
          // Remove the session from our local array
          const sessionIndex = this.sessions.findIndex(s => s._id === data.sessionId);
          if (sessionIndex !== -1) {
            this.sessions.splice(sessionIndex, 1);
            console.log('✅ Removed session from local array');
            
            // Refresh the calendar view
            this.updateCalendarEvents();
            this.refresh.next({});
            
            // Show notification if this deletion is from another user
            const currentUserId = this.currentUser?.id || this.currentUser?._id;
            if (data.deletedBy && data.deletedBy !== currentUserId) {
              console.log('📢 Session deleted by another user:', data.deletedBy);
              // You can add a toast notification here if needed
            }
          }
        }
      },
      error: (error) => {
        console.error('❌ Error in session deleted listener:', error);
      }
    });
    this.socketSubscriptions.push(sessionDeletedSub);
    
    // Listen for meeting status updates
    const meetingStatusSub = this.socketService.meetingStatusUpdated$.subscribe({
      next: (data: any) => {
        console.log('🎯 Meeting status updated notification received:', data);
        
        if (data.sessionId) {
          // Find and update the session meeting status
          const sessionIndex = this.sessions.findIndex(s => s._id === data.sessionId);
          if (sessionIndex !== -1) {
            this.sessions[sessionIndex].meetingStatus = data.meetingStatus;
            if (data.type === 'meeting_started') {
              this.sessions[sessionIndex].actualStartTime = new Date().toISOString();
            } else if (data.type === 'meeting_ended') {
              this.sessions[sessionIndex].actualEndTime = new Date().toISOString();
            }
            console.log('✅ Updated meeting status in local array');
            
            // Refresh the calendar view
            this.updateCalendarEvents();
            this.refresh.next({});
            
            // Show notification
            console.log('📢 Meeting status updated:', data.message);
            // You can add a toast notification here if needed
          }
        }
      },
      error: (error) => {
        console.error('❌ Error in meeting status updated listener:', error);
      }
    });
    this.socketSubscriptions.push(meetingStatusSub);
    
    console.log('✅ Socket listeners setup complete');
  }

  loadSessionsFromBackend(): void {
    console.log('🔄 Loading sessions from backend...');
    this.loading = true;
    this.errorMessage = '';
    
    // Get current user ID for filtering
    const currentUserId = this.currentUser?.id || this.currentUser?._id;
    
    if (!currentUserId) {
      console.error('❌ No current user found for session loading');
      this.errorMessage = 'Please log in to view your schedule';
      this.loading = false;
      return;
    }
    
    console.log('👤 Loading sessions for user:', currentUserId);
    
    // Use the user-specific sessions endpoint
    this.scheduleService.getSessions().subscribe({
      next: (sessions: Session[]) => {
        console.log('📅 Received sessions from backend:', sessions.length);
        
        // Store sessions in the sessions array for lookup
        this.sessions = sessions;
        console.log('✅ Sessions loaded from backend:', this.sessions.length, 'sessions.');
        
        if (sessions.length === 0) {
          console.log('📅 No sessions found in database');
          this.calendarEvents = [];
          this.refresh.next({});
          this.loading = false;
          return;
        }
        
        // Convert backend sessions to calendar events using timezone service
        this.calendarEvents = sessions.map(session => {
          try {
            const calendarEvent = this.timezoneService.createCalendarEvent(session, this.userTimezone);
            
            // Test the conversion for the first session
            if (sessions.indexOf(session) === 0) {
              this.testCalendarEventConversion(session, calendarEvent);
            }
            
            // Add additional metadata that might not be in the timezone service
            const hostName = typeof session.host === 'object' ? session.host.name : 'Unknown Host';
            
            // Get participant names (both user objects and email-based participants)
            const participantNames: string[] = [];
            
            // Add host name
            if (hostName && hostName !== 'Unknown Host') {
              participantNames.push(hostName);
            }
            
            // Add participant names from populated user objects
            if (session.participants && Array.isArray(session.participants)) {
              session.participants.forEach(participant => {
                if (participant.user && typeof participant.user === 'object' && participant.user.name) {
                  participantNames.push(participant.user.name);
                } else if (participant.email) {
                  // For email-based participants, show the email
                  participantNames.push(participant.email);
                }
              });
            }
            
            // Also check participantDetails for backward compatibility
            if (session.participantDetails && Array.isArray(session.participantDetails)) {
              session.participantDetails.forEach(p => {
                if (p.role === 'learner' && typeof p.user === 'object' && p.user.name) {
                  participantNames.push(p.user.name);
                }
              });
            }
            
            const attendees = participantNames.filter(Boolean).join(', ');
            
            // Ensure meta object exists and add sessionId
            if (!calendarEvent.meta) {
              calendarEvent.meta = {};
            }
            
            calendarEvent.meta.sessionId = session._id || session.id;
            calendarEvent.meta.hostId = typeof session.host === 'object' ? session.host._id : session.host;
            calendarEvent.meta.host = typeof session.host === 'object' ? session.host : session.hostDetails;
            calendarEvent.meta.attendees = attendees;
            calendarEvent.meta.meetingUrl = session.zoomMeeting?.joinUrl;
            calendarEvent.meta.description = session.description;
            calendarEvent.meta.skill = session.skill;
            calendarEvent.meta.price = session.price;
            calendarEvent.meta.sessionType = session.sessionType;
            calendarEvent.meta.maxParticipants = session.maxParticipants;
            
            // Add meeting status fields - default to 'not-started' if not present
            calendarEvent.meta.meetingStatus = session.meetingStatus || 'not-started';
            calendarEvent.meta.actualStartTime = session.actualStartTime ? new Date(session.actualStartTime) : undefined;
            calendarEvent.meta.actualEndTime = session.actualEndTime ? new Date(session.actualEndTime) : undefined;
            calendarEvent.meta.hostJoinedAt = session.hostJoinedAt ? new Date(session.hostJoinedAt) : undefined;
            
            // Store the full session object for easy access
            calendarEvent.meta.session = session;
            
            console.log('📅 Created calendar event with sessionId:', calendarEvent.meta.sessionId, 'for event:', calendarEvent.title);
            
            return calendarEvent as AngularCalendarEvent;
          } catch (error) {
            console.error('❌ Error creating calendar event for session:', session._id, error);
            return null;
          }
        }).filter((event): event is AngularCalendarEvent => event !== null); // Remove any null events
        
        console.log('📅 Converted to calendar events:', this.calendarEvents.length);
        console.log('📅 Calendar events:', this.calendarEvents.map(e => ({ title: e.title, start: e.start })));
        
        this.refresh.next({});
        
        // Auto-scroll to events if they exist
        if (this.calendarEvents.length > 0) {
          console.log(`📅 Loaded ${this.calendarEvents.length} events into calendar`);
          setTimeout(() => {
            this.scrollToEvents();
          }, 100);
        } else {
          console.log('📅 No events found in database');
        }
      },
      error: (error) => {
        console.error('❌ Error loading sessions:', error);
        console.error('❌ Error details:', error.error);
        console.error('❌ Error status:', error.status);
        
        if (error.status === 401) {
          this.errorMessage = 'Your session has expired. Please log in again.';
        } else if (error.status === 403) {
          this.errorMessage = 'You do not have permission to view sessions.';
        } else if (error.status === 404) {
          this.errorMessage = 'Sessions not found.';
        } else if (error.status >= 500) {
          this.errorMessage = 'Server error. Please try again later.';
        } else {
          this.errorMessage = 'Failed to load events. Please try again.';
        }
        
        this.calendarEvents = [];
        this.refresh.next({});
      },
      complete: () => {
        this.loading = false;
        console.log('✅ Session loading completed');
      }
    });
  }

  loadUserData(): void {
    console.log('🔄 Loading user data...');
    
    // Check authentication status first
    if (!this.authService.isLoggedIn()) {
      console.log('❌ User not logged in');
      this.errorMessage = 'Please log in to access the schedule';
      return;
    }
    
    this.authService.currentUser$.subscribe({
      next: (user) => {
        console.log('👤 User data loaded:', user);
        this.currentUser = user;
        if (user) {
          console.log('✅ User authenticated, loading sessions...');
          // Load sessions after user is authenticated
          this.loadSessionsFromBackend();
          if (user.id) {
            this.loadTeacherSessions(user.id);
          }
        } else {
          console.log('❌ No user found, user not authenticated');
          this.errorMessage = 'User data not available. Please log in again.';
        }
      },
      error: (error) => {
        console.error('❌ Error loading user data:', error);
        this.errorMessage = 'Failed to load user data. Please refresh the page.';
      }
    });
  }

  loadSessions(): void {
    this.loading = true;
    this.scheduleService.getSessions().subscribe({
      next: (sessions) => {
        this.sessions = sessions;
        this.availableSessions = sessions.filter(s => s.participants.length === 1); // Only host, no learners
        this.updateCalendarEvents();
      },
      error: (error) => {
        console.error('Error loading sessions:', error);
        this.errorMessage = 'Failed to load sessions';
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  loadTeacherSessions(teacherId: string): void {
    this.scheduleService.getTeacherSessions(teacherId).subscribe({
      next: (sessions) => {
        // Filter teacher's sessions
        this.updateCalendarEvents();
      },
      error: (error) => {
        console.error('Error loading teacher sessions:', error);
      }
    });
  }

  loadUpcomingSessions(): void {
    if (this.currentUser && this.currentUser.id) {
      this.scheduleService.getUpcomingSessions(this.currentUser.id, 5).subscribe({
        next: (sessions) => {
          this.upcomingSessions = sessions;
        },
        error: (error) => {
          console.error('Error loading upcoming sessions:', error);
        }
      });
    }
  }

  updateCalendarEvents(): void {
    this.calendarEvents = this.sessions.map(session => {
      const calendarEvent = this.timezoneService.createCalendarEvent(session, this.userTimezone);
      
      // Ensure meta object exists
      if (!calendarEvent.meta) {
        calendarEvent.meta = {};
      }
      
      // Add meeting status fields - ensure they're always present
      calendarEvent.meta.meetingStatus = session.meetingStatus || 'not-started';
      calendarEvent.meta.actualStartTime = session.actualStartTime ? new Date(session.actualStartTime) : undefined;
      calendarEvent.meta.actualEndTime = session.actualEndTime ? new Date(session.actualEndTime) : undefined;
      calendarEvent.meta.hostJoinedAt = session.hostJoinedAt ? new Date(session.hostJoinedAt) : undefined;
      calendarEvent.meta.session = session;
      
      return calendarEvent;
    });
  }

  onDateSelected(date: Date): void {
    this.selectedDate = date;
    this.viewDate = date;
  }

  onTimeSlotSelected(slot: TimeSlot): void {
    // Convert string dates to Date objects before formatting
    const startTime = new Date(slot.startTime);
    const endTime = new Date(slot.endTime);
    
    // Validate the dates
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      this.errorMessage = 'Invalid time slot dates';
      return;
    }
    
    this.newSession.startTime = this.formatDateTimeLocal(startTime);
    this.newSession.endTime = this.formatDateTimeLocal(endTime);
  }

  // Panel logic
  selectSession(session: Session) {
    this.selectedSession = session;
    this.showCreatePanel = false;
    this.sessionFormModel = { ...session, participants: '', recurrence: 'none', reminder: 'none', zoom: !!session.zoomMeeting?.joinUrl };
  }
  closePanel() {
    this.selectedSession = null;
    this.showCreatePanel = false;
    this.resetSessionFormModel();
  }

  resetSessionFormModel() {
    this.eventFormModel = {
      title: '',
      attendees: [] as string[],
      date: '',
      startHour: 9,
      startMinute: 0,
      startAMPM: 'AM',
      duration: 30,
      timezone: 'UTC',
      allDay: false,
      online: false,
      inPerson: false,
      location: '',
      recurrence: 'none',
      description: '',
      skill: '',
      // price: 0, // Commented out for future use
      sessionType: 'one-on-one',
      difficulty: 'beginner',
      maxParticipants: 10,
      tags: ''
    };
  }

  onTimezoneChange() {
    // Normalize the selected timezone
    const normalizedTz = this.timezoneService.normalizeTimezone(this.eventFormModel.timezone);
    this.eventFormModel.timezone = normalizedTz;
    console.log('🌍 Timezone changed to (normalized):', normalizedTz);
  }

  // Recurrence logic (basic example)
  getRecurrenceDates(start: Date, end: Date, type: string, count: number = 5): { start: Date, end: Date }[] {
    const dates: { start: Date, end: Date }[] = [];
    for (let i = 0; i < count; i++) {
      let nextStart = new Date(start);
      let nextEnd = new Date(end);
      if (type === 'daily') {
        nextStart.setDate(start.getDate() + i);
        nextEnd.setDate(end.getDate() + i);
      } else if (type === 'weekly') {
        nextStart.setDate(start.getDate() + i * 7);
        nextEnd.setDate(end.getDate() + i * 7);
      } else if (type === 'monthly') {
        nextStart.setMonth(start.getMonth() + i);
        nextEnd.setMonth(end.getMonth() + i);
      }
      dates.push({ start: new Date(nextStart), end: new Date(nextEnd) });
    }
    return dates;
  }

  // Conflict detection
  hasConflict(start: Date, end: Date, participants: string[]): boolean {
    console.log('🔍 Checking for conflicts...');
    console.log('📅 New event time:', start, 'to', end);
    console.log('👥 Participants to check:', participants);
    console.log('📋 Existing sessions count:', this.sessions.length);
    
    // Check for overlap with existing sessions for current user or invited participants
    const hasConflict = this.sessions.some(session => {
      const sessionStart = new Date(session.startTime);
      const sessionEnd = new Date(session.endTime);
      const overlap = (start < sessionEnd && end > sessionStart);
      
      // Check host and participants
      const involved: string[] = [];
      
      // Add host
      if (typeof session.host === 'string') {
        involved.push(session.host);
      } else if (session.host && typeof session.host === 'object' && session.host._id) {
        involved.push(session.host._id);
      } else if (session.host && typeof session.host === 'object' && session.host.email) {
        involved.push(session.host.email);
      }
      
      // Add participants
      if (session.participants && Array.isArray(session.participants)) {
        session.participants.forEach(p => {
          if (p.user && typeof p.user === 'string') {
            involved.push(p.user);
          } else if (p.user && typeof p.user === 'object' && p.user._id) {
            involved.push(p.user._id);
          } else if (p.user && typeof p.user === 'object' && p.user.email) {
            involved.push(p.user.email);
          }
          // Also check email field directly
          if (p.email) {
            involved.push(p.email);
          }
        });
      }
      
      const conflict = overlap && involved.some(id => participants.includes(id));
      if (conflict) {
        console.log('⚠️ Conflict found with session:', session.title, 'Involved:', involved);
      }
      
      return conflict;
    });
    
    console.log('🔍 Conflict check result:', hasConflict);
    return hasConflict;
  }

  // Create or update session with recurrence, reminders, and invites
  createSession(eventForm: any): void {
    try {
      console.log('🚀 createSession called with eventForm:', eventForm);
      console.log('👤 currentUser:', this.currentUser);
      console.log('🔐 isAuthenticated:', this.authService.isAuthenticated());
      console.log('🔐 isLoggedIn:', this.authService.isLoggedIn());
    
      // Enhanced authentication check
      if (!this.authService.isLoggedIn()) {
        console.log('❌ User not logged in');
        this.errorMessage = 'You must be logged in to create a session';
        return;
      }
      
      if (!this.currentUser) {
        console.log('❌ No current user data');
        this.errorMessage = 'User data not loaded. Please refresh the page and try again.';
        return;
      }
    
      console.log('🔍 Checking required fields...');
      console.log('📝 Title:', this.eventFormModel.title, '| Trimmed:', this.eventFormModel.title?.trim());
      console.log('📅 Date:', this.eventFormModel.date);
      console.log('⏱️ Duration:', this.eventFormModel.duration);
      console.log('🕐 Start Hour:', this.eventFormModel.startHour);
      console.log('🕐 Start Minute:', this.eventFormModel.startMinute);
      console.log('🕐 Start AM/PM:', this.eventFormModel.startAMPM);
      
      // Use the improved validation method
      if (!this.validateSessionForm()) {
        console.log('❌ Form validation failed');
        return;
      }
      
      console.log('✅ Required fields check passed');
      
      // Set default skill if not provided
      if (!this.eventFormModel.skill) {
        this.eventFormModel.skill = 'general';
      }
      console.log('🔧 Setting default skill:', this.eventFormModel.skill);
      
      // Debug: Log the entire eventFormModel to see what's wrong
      console.log('🔍 DEBUG - Full eventFormModel:', this.eventFormModel);
      console.log('🔍 DEBUG - startHour type:', typeof this.eventFormModel.startHour);
      console.log('🔍 DEBUG - startHour value:', this.eventFormModel.startHour);
      console.log('🔍 DEBUG - startMinute type:', typeof this.eventFormModel.startMinute);
      console.log('🔍 DEBUG - startMinute value:', this.eventFormModel.startMinute);
      
      // Convert 12-hour time to 24-hour time
      let hour = this.eventFormModel.startHour;
      let minute = this.eventFormModel.startMinute;
      
      // Fix: Ensure hour and minute are proper numbers
      if (typeof hour === 'string') {
        hour = parseInt(hour, 10);
      }
      if (typeof minute === 'string') {
        minute = parseInt(minute, 10);
      }
      
      // Additional safety check for invalid hour values
      if (isNaN(hour) || hour < 1 || hour > 12) {
        console.error('❌ Invalid hour value:', this.eventFormModel.startHour);
        this.errorMessage = 'Invalid hour value. Please select a valid time.';
        return;
      }
      if (isNaN(minute) || minute < 0 || minute > 59) {
        console.error('❌ Invalid minute value:', this.eventFormModel.startMinute);
        this.errorMessage = 'Invalid minute value. Please select a valid time.';
        return;
      }
      
      // Convert to 24-hour format
      let hour24 = hour;
      if (this.eventFormModel.startAMPM === 'PM' && hour < 12) {
        hour24 = hour + 12;
      } else if (this.eventFormModel.startAMPM === 'AM' && hour === 12) {
        hour24 = 0;
      }
      console.log('🕐 Converted hour24:', hour24, 'from', hour, this.eventFormModel.startAMPM);
      
      // Create date properly in user's timezone with AM/PM handling
      const [year, month, day] = this.eventFormModel.date.split('-').map(Number);
      console.log('📅 Date components:', { year, month, day });
      
      // Use the timezone service to create date with proper AM/PM handling
      const startUTC = this.timezoneService.createDateWithTime(
        year, 
        month, 
        day, 
        hour,  // Use original 12-hour format, not hour24
        minute, 
        this.eventFormModel.startAMPM,
        this.eventFormModel.timezone || this.userTimezone || 'UTC'
      );
      console.log('🌍 Start UTC created:', startUTC);
      console.log('🌍 Start UTC ISO string:', startUTC.toISOString());
      console.log('🌍 Start UTC toString:', startUTC.toString());
      console.log('🌍 Form timezone used:', this.eventFormModel.timezone || this.userTimezone || 'UTC');
      console.log('🌍 User timezone:', this.userTimezone);
      console.log('🌍 Form timezone:', this.eventFormModel.timezone);
      
      // Calculate end time in UTC
      const endUTC = new Date(startUTC.getTime() + this.eventFormModel.duration * 60000);
      console.log('🌍 End UTC calculated:', endUTC);
      console.log('🌍 End UTC ISO string:', endUTC.toISOString());
      console.log('🌍 End UTC toString:', endUTC.toString());
      
      // Validate that the event is in the future (compare UTC times)
      const nowUTC = new Date();
      console.log('⏰ Now UTC:', nowUTC);
      if (startUTC < nowUTC) {
        console.log('❌ Event is in the past');
        this.errorMessage = 'Meetings can only be scheduled for future times.';
        return;
      }
      console.log('✅ Event is in the future');
      
      console.log('👥 Processing attendees:', this.eventFormModel.attendees);
      // Filter out the current user's email from attendees to avoid duplication
      const currentUserEmail = this.currentUser.email;
      const participants = (this.eventFormModel.attendees || []).filter(email => email !== currentUserEmail);
      console.log('👥 Processed participants (excluding host):', participants);
      
      // For conflict detection, we need to include the current user's ID
      const conflictParticipants = [this.currentUser.id || this.currentUser._id, ...participants];
      console.log('🔍 Conflict participants:', conflictParticipants);
      
      // Conflict detection (use user timezone times for conflict checking)
      console.log('🔍 About to check for conflicts...');
      if (this.hasConflict(startUTC, endUTC, conflictParticipants)) {
        console.log('❌ Conflict detected, stopping event creation');
        this.errorMessage = 'This time conflicts with another session for you or an invited participant.';
        return;
      }
      console.log('✅ No conflicts detected, proceeding with event creation');
      
      // Recurrence
      let sessionsToCreate = [{ start: startUTC, end: endUTC }];
      if (this.eventFormModel.recurrence !== 'none') {
        sessionsToCreate = this.getRecurrenceDates(startUTC, endUTC, this.eventFormModel.recurrence);
      }
      
      this.loading = true;
      this.errorMessage = '';
      
      const sessionData: CreateSessionRequest = {
        title: this.eventFormModel.title,
        description: this.eventFormModel.description,
        skill: this.eventFormModel.skill,
        startTime: startUTC.toISOString(),
        endTime: endUTC.toISOString(),
        price: 0, // Default price for now (commented out in form for future use)
        currency: 'usd', // Default currency for now (commented out in form for future use)
        sessionType: this.eventFormModel.sessionType as 'one-on-one' | 'group' | 'workshop',
        maxParticipants: this.eventFormModel.maxParticipants,
        difficulty: this.eventFormModel.difficulty as 'beginner' | 'intermediate' | 'advanced' | 'expert',
        tags: this.eventFormModel.tags,
        attendees: participants // Send attendees as separate field
      };
      
      console.log('📤 Sending session data to backend:', sessionData);
      
      console.log('📤 About to call backend createSession...');
      this.scheduleService.createSession(sessionData).subscribe({
        next: (session) => {
          console.log('✅ Session created successfully:', session);
          this.successMessage = `Session "${session.title}" created successfully!`;
          this.resetSessionFormModel();
          this.showCreatePanel = false;
          // Close the dialog
          this.dialog.closeAll();
          // Reload sessions from backend to update calendar
          this.loadSessionsFromBackend();
          this.refresh.next({});
          
          // Show upcoming events after a short delay
          setTimeout(() => {
            this.showUpcomingEvents();
          }, 1000);
          
          // Auto-hide success message after 15 seconds
          setTimeout(() => {
            this.successMessage = '';
          }, 15000);
        },
        error: (error) => {
          console.error('❌ Error creating session:', error);
          console.error('❌ Error details:', error.error);
          console.error('❌ Error status:', error.status);
          console.error('❌ Error message:', error.message);
          
          // Handle authentication errors specifically
          if (error.status === 401) {
            this.errorMessage = 'Your session has expired. Please log in again.';
            // Don't clear the form immediately, let user decide
          } else if (error.status === 403) {
            this.errorMessage = 'You do not have permission to create sessions.';
          } else if (error.status === 400) {
            this.errorMessage = error.error?.message || error.error?.error || 'Invalid session data. Please check your inputs.';
          } else if (error.status >= 500) {
            this.errorMessage = 'Server error. Please try again later.';
          } else {
            this.errorMessage = error.error?.message || error.error?.error || 'Failed to create session';
          }
        },
        complete: () => {
          console.log('🏁 createSession observable completed');
          this.loading = false;
        }
      });
      
      console.log('🏁 createSession completed');
      } catch (error) {
        console.error('💥 Unexpected error in createSession:', error);
        this.errorMessage = 'An unexpected error occurred while creating the session.';
        this.loading = false;
      }
  }

  updateExistingEvent(): void {
    console.log('🔄 UPDATE EVENT - Starting updateExistingEvent');
    console.log('📝 Current eventFormModel:', this.eventFormModel);
    console.log('📅 Form date:', this.eventFormModel.date);
    console.log('🕐 Form startHour:', this.eventFormModel.startHour);
    console.log('🕐 Form startMinute:', this.eventFormModel.startMinute);
    console.log('🕐 Form startAMPM:', this.eventFormModel.startAMPM);
    console.log('🌍 Form timezone:', this.eventFormModel.timezone);
    
    if (!this.selectedEventForEdit) {
      console.log('❌ No selectedEventForEdit found');
      this.errorMessage = 'No event selected for editing';
      return;
    }

    console.log('📋 Selected event for edit:', this.selectedEventForEdit);
    console.log('🆔 Event sessionId:', this.selectedEventForEdit.meta?.sessionId);

    if (!this.selectedEventForEdit.meta?.sessionId) {
      console.error('❌ No sessionId found for event');
      this.errorMessage = 'Cannot update event: Session ID not found';
      return;
    }

    // Check authentication
    if (!this.authService.isLoggedIn()) {
      console.log('❌ User not logged in');
      this.errorMessage = 'Please log in to update events';
      return;
    }
    
    if (!this.currentUser) {
      console.log('❌ No current user data');
      this.errorMessage = 'User data not loaded. Please refresh the page and try again.';
      return;
    }

    // Check if user is the owner of the event
    if (!this.isEventEditable(this.selectedEventForEdit)) {
      console.log('❌ User is not the owner of this event');
      this.errorMessage = 'You can only update events that you created';
      return;
    }

    // Validate form
    if (!this.validateSessionForm()) {
      console.log('❌ Form validation failed');
      return;
    }

    console.log('✅ Form validation passed');

    // Convert 12-hour time to 24-hour time
    let hour = this.eventFormModel.startHour;
    let minute = this.eventFormModel.startMinute;
    
    // Fix: Ensure hour and minute are proper numbers
    if (typeof hour === 'string') {
      hour = parseInt(hour, 10);
    }
    if (typeof minute === 'string') {
      minute = parseInt(minute, 10);
    }
    
    // Additional safety check for invalid hour values
    if (isNaN(hour) || hour < 1 || hour > 12) {
      console.error('❌ Invalid hour value:', this.eventFormModel.startHour);
      this.errorMessage = 'Invalid hour value. Please select a valid time.';
      return;
    }
    if (isNaN(minute) || minute < 0 || minute > 59) {
      console.error('❌ Invalid minute value:', this.eventFormModel.startMinute);
      this.errorMessage = 'Invalid minute value. Please select a valid time.';
      return;
    }
    
    // Convert to 24-hour format
    let hour24 = hour;
    if (this.eventFormModel.startAMPM === 'PM' && hour < 12) {
      hour24 = hour + 12;
    } else if (this.eventFormModel.startAMPM === 'AM' && hour === 12) {
      hour24 = 0;
    }
    console.log('🕐 Converted hour24:', hour24, 'from', hour, this.eventFormModel.startAMPM);

    // Create date with time using the timezone service
    const startTimeUTC = this.timezoneService.createDateWithTime(
      parseInt(this.eventFormModel.date.split('-')[0]), // year
      parseInt(this.eventFormModel.date.split('-')[1]), // month
      parseInt(this.eventFormModel.date.split('-')[2]), // day
      hour,  // Use original 12-hour format, not hour24
      minute,
      this.eventFormModel.startAMPM,
      this.eventFormModel.timezone || this.userTimezone || 'UTC'
    );

    console.log('🌍 startTimeUTC created:', startTimeUTC);
    console.log('🌍 startTimeUTC toString:', startTimeUTC.toString());
    console.log('🌍 startTimeUTC toISOString:', startTimeUTC.toISOString());
    console.log('🌍 startTimeUTC getTime():', startTimeUTC.getTime());
    
    // DEBUG: Let's also check what the user actually selected
    console.log('🔍 DEBUG: User selected time:', {
      date: this.eventFormModel.date,
      hour: this.eventFormModel.startHour,
      minute: this.eventFormModel.startMinute,
      ampm: this.eventFormModel.startAMPM,
      timezone: this.eventFormModel.timezone || this.userTimezone || 'UTC',
      hour24: hour24
    });
    
    // DEBUG: Let's check what this should display as in the user's timezone
    const userTimezone = this.eventFormModel.timezone || this.userTimezone || 'UTC';
    console.log('🔍 DEBUG: Expected display in', userTimezone, ':', startTimeUTC.toLocaleString('en-US', { timeZone: userTimezone }));

    // Calculate end time in UTC
    const endTimeUTC = new Date(startTimeUTC.getTime() + (this.eventFormModel.duration * 60 * 1000));
    console.log('🌍 endTimeUTC calculated:', endTimeUTC);
    console.log('🌍 endTimeUTC toISOString:', endTimeUTC.toISOString());

    // Validate that the event is in the future
    const nowUTC = new Date();
    if (startTimeUTC < nowUTC) {
      console.log('❌ Event is in the past');
      this.errorMessage = 'Meetings can only be scheduled for future times.';
      return;
    }
    console.log('✅ Event is in the future');

    // Process attendees
    const currentUserEmail = this.currentUser.email;
    const participants = (this.eventFormModel.attendees || []).filter(email => email !== currentUserEmail);
    console.log('👥 Processed participants (excluding host):', participants);

    const sessionData = {
      title: this.eventFormModel.title,
      description: this.eventFormModel.description,
      skill: this.eventFormModel.skill || 'programming',
      startTime: startTimeUTC.toISOString(),
      endTime: endTimeUTC.toISOString(),
      timezone: this.eventFormModel.timezone,
      price: 0, // Default price for now (commented out in form for future use)
      maxParticipants: this.eventFormModel.maxParticipants || 10,
      sessionType: this.eventFormModel.sessionType as 'one-on-one' | 'group' | 'workshop',
      difficulty: this.eventFormModel.difficulty as 'beginner' | 'intermediate' | 'advanced' | 'expert',
      tags: this.eventFormModel.tags,
      attendees: participants
    };

    console.log('📤 Session data to be sent to backend:', sessionData);

    this.loading = true;
    this.errorMessage = '';

    this.scheduleService.updateSession(this.selectedEventForEdit.meta.sessionId, sessionData).subscribe({
      next: (response) => {
        console.log('✅ Update successful, response:', response);
        
        // Show success message
        this.successMessage = `Event "${this.eventFormModel.title}" updated successfully!`;
        
        // Reload sessions from backend to update calendar
        this.loadSessionsFromBackend();
        
        // Close dialog and reset state
        this.dialog.closeAll();
        this.selectedEventForEdit = null;
        this.isEditing = false;
        
        // Auto-hide success message after 5 seconds
        setTimeout(() => {
          this.successMessage = '';
        }, 5000);
        
        console.log('✅ Event update completed successfully');
      },
      error: (error) => {
        console.error('❌ Update failed:', error);
        console.error('❌ Error details:', error.error);
        console.error('❌ Error status:', error.status);
        
        if (error.status === 401) {
          this.errorMessage = 'Your session has expired. Please log in again.';
        } else if (error.status === 403) {
          this.errorMessage = 'You do not have permission to update this event.';
        } else if (error.status === 404) {
          this.errorMessage = 'Event not found. It may have been deleted.';
        } else if (error.status === 400) {
          this.errorMessage = error.error?.message || error.error?.error || 'Invalid event data. Please check your inputs.';
        } else if (error.status >= 500) {
          this.errorMessage = 'Server error. Please try again later.';
        } else {
          this.errorMessage = error.error?.message || error.error?.error || 'Failed to update event';
        }
      },
      complete: () => {
        this.loading = false;
        console.log('🏁 updateExistingEvent observable completed');
      }
    });
  }

  updateSession(): void {
    // Similar to createSession, but update the selected session
    // ...
    this.closePanel();
  }

  bookSession(sessionId: string): void {
    if (!this.currentUser) {
      this.errorMessage = 'Please log in to book a session';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.scheduleService.bookSession({
      sessionId,
      studentId: this.currentUser.id || ''
    }).subscribe({
      next: (session) => {
        console.log('Session booked:', session);
        this.successMessage = 'Session booked successfully!';
        this.loadSessions();
        this.loadUpcomingSessions();
      },
      error: (error) => {
        console.error('Error booking session:', error);
        this.errorMessage = error.error?.message || 'Failed to book session';
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  cancelSession(sessionId: string): void {
    if (confirm('Are you sure you want to cancel this session?')) {
      this.loading = true;
      
      this.scheduleService.cancelSession(sessionId).subscribe({
        next: (session) => {
          console.log('Session cancelled:', session);
          this.successMessage = 'Session cancelled successfully!';
          this.loadSessions();
          this.loadUpcomingSessions();
        },
        error: (error) => {
          console.error('Error cancelling session:', error);
          this.errorMessage = 'Failed to cancel session';
        },
        complete: () => {
          this.loading = false;
        }
      });
    }
  }

  createZoomMeeting(sessionId: string): void {
    console.log('🎯 createZoomMeeting called with sessionId:', sessionId);
    console.log('🎯 Available sessions:', this.sessions.map(s => ({ id: s.id, _id: s._id, title: s.title })));
    
    const session = this.sessions.find(s => s.id === sessionId || s._id === sessionId);
    if (!session) {
      console.log('❌ Session not found for ID:', sessionId);
      this.errorMessage = 'Session not found';
      return;
    }
    
    console.log('✅ Found session:', session.title);

    // Check if user is connected to Zoom first
    if (!this.zoomConnected) {
      this.errorMessage = 'You need to connect your Zoom account first. Please click "Connect Zoom" to authorize.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.zoomService.createMeeting(sessionId).subscribe({
      next: (response: any) => {
        console.log('🎯 Zoom meeting response:', response);
        const meeting = response.data || response;
        console.log('🎯 Meeting data:', meeting);
        console.log('🎯 Meeting joinUrl:', meeting.joinUrl);
        console.log('🎯 Meeting meetingId:', meeting.meetingId);
        
        this.scheduleService.addMeetingUrl(sessionId, meeting.joinUrl, meeting.meetingId).subscribe({
          next: (updatedSession) => {
            console.log('🎯 Setting success message with joinUrl:', meeting.joinUrl);
            this.successMessage = `Zoom meeting created and linked to session!\n\nJoin URL: ${meeting.joinUrl || 'URL not available'}`;
            this.loadSessions();
            
            // Show confirmation dialog with smart join option
            const currentUserEmail = this.currentUser?.email;
            const hostEmail = typeof updatedSession.host === 'string' ? '' : updatedSession.host.email;
            const isHost = hostEmail === currentUserEmail;
            
            const joinMessage = isHost 
              ? 'Your Zoom meeting is ready!\n\nAs the host, you can start the meeting now.'
              : 'Your Zoom meeting is ready!\n\nYou can join the meeting when it starts.';
            
            if (window.confirm(joinMessage + '\n\nWould you like to join now?')) {
              this.joinMeeting(updatedSession);
            }
          },
          error: (error: any) => {
            console.error('Error linking meeting to session:', error);
            this.errorMessage = 'Meeting created but failed to link to session';
          }
        });
      },
      error: (error: any) => {
        console.error('Error creating Zoom meeting:', error);
        this.errorMessage = 'Failed to create Zoom meeting. Please try again.';
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  searchSessions(): void {
    this.loading = true;
    
    this.scheduleService.searchSessions(this.searchFilters).subscribe({
      next: (sessions) => {
        this.availableSessions = sessions.filter(s => s.participants.length === 1); // Only host, no learners
      },
      error: (error) => {
        console.error('Error searching sessions:', error);
        this.errorMessage = 'Failed to search sessions';
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  validateSessionForm(): boolean {
    console.log('🔍 Validating session form...');
    
    // Check title
    if (!this.eventFormModel.title?.trim()) {
      this.errorMessage = 'Please enter a session title';
      console.log('❌ Validation failed: Missing title');
      return false;
    }
    
    // Check date
    if (!this.eventFormModel.date) {
      this.errorMessage = 'Please select a date';
      console.log('❌ Validation failed: Missing date');
      return false;
    }
    
    // Check if date is in the past
    const selectedDate = new Date(this.eventFormModel.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      this.errorMessage = 'Please select a future date';
      console.log('❌ Validation failed: Date in the past');
      return false;
    }
    
    // Check duration
    if (!this.eventFormModel.duration || this.eventFormModel.duration <= 0) {
      this.errorMessage = 'Please enter a valid duration';
      console.log('❌ Validation failed: Invalid duration');
      return false;
    }
    
    // Check start time
    if (!this.eventFormModel.startHour || !this.eventFormModel.startMinute || !this.eventFormModel.startAMPM) {
      this.errorMessage = 'Please select a start time';
      console.log('❌ Validation failed: Missing start time');
      return false;
    }
    
    // Check skill
    if (!this.eventFormModel.skill) {
      this.errorMessage = 'Please select a skill/topic';
      console.log('❌ Validation failed: Missing skill');
      return false;
    }
    
    // Check price (can be 0 for free sessions) - Commented out for future use
    /*
    if (this.eventFormModel.price < 0) {
      this.errorMessage = 'Please enter a valid price (can be 0 for free sessions)';
      console.log('❌ Validation failed: Invalid price');
      return false;
    }
    */
    
    // Check max participants
    if (!this.eventFormModel.maxParticipants || this.eventFormModel.maxParticipants <= 0) {
      this.errorMessage = 'Please select a valid number of participants';
      console.log('❌ Validation failed: Invalid max participants');
      return false;
    }
    
    // Check session type
    if (!this.eventFormModel.sessionType) {
      this.errorMessage = 'Please select a session type';
      console.log('❌ Validation failed: Missing session type');
      return false;
    }
    
    console.log('✅ Form validation passed');
    return true;
  }

  resetSessionForm(): void {
    this.newSession = {
      title: '',
      description: '',
      skill: '',
      startTime: '',
      endTime: '',
      price: 0,
      currency: 'usd'
    };
  }

  clearMessages(): void {
    console.log('🧹 Clearing all messages...');
    
    try {
      this.errorMessage = '';
      this.successMessage = '';
      console.log('✅ Messages cleared successfully');
      
    } catch (error) {
      console.error('❌ Error clearing messages:', error);
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return this.timezoneService.formatDateWithTimezone(date, this.userTimezone, 'short');
  }

  formatTime(dateString: string): string {
    const date = new Date(dateString);
    return this.timezoneService.formatDateWithTimezone(date, this.userTimezone, 'time');
  }

  formatDateTimeLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  formatCurrency(amount: number | string, currency: string = 'usd'): string {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(numAmount);
  }

  isSessionBookable(session: Session): boolean {
    return session.participants.length === 1 && session.status === 'scheduled';
  }

  isSessionCancellable(session: Session): boolean {
    return session.status === 'scheduled' || session.status === 'in-progress';
  }

  canCreateZoomMeeting(session: Session): boolean {
    return session.status === 'scheduled' && !session.zoomMeeting?.joinUrl;
  }

  // Get relative time for upcoming sessions
  getRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    return this.timezoneService.formatRelativeTime(date, this.userTimezone);
  }

  // Get timezone abbreviation
  getTimezoneAbbreviation(timezone: string): string {
    return this.timezoneService.getTimezoneAbbreviation(timezone);
  }

  onEventClicked({ event }: { event: AngularCalendarEvent }): void {
    console.log('🎯 Event clicked:', event);
    this.selectedEvent = event;
    this.selectedEventForEdit = event; // Also set selectedEventForEdit for debug methods
  }
  onHourSegmentClicked({ date }: { date: Date }): void {
    this.selectedDate = date;
    this.openCreateEventModal();
  }
  onSidebarDayClicked(day: Date): void {
    console.log('📅 Sidebar day clicked:', day);
    this.selectedDate = day;
    this.viewDate = day;
    this.view = this.CalendarView.Week;
    
    // Get events for the selected date and log them
    const eventsForDay = this.getEventsForSelectedDate();
    console.log(`📅 Events for ${day.toDateString()}:`, eventsForDay.length, eventsForDay.map(e => e.title));
    
    // Trigger change detection
    this.refresh.next({});
  }
  openCreateEventModal(): void {
    console.log('➕ Opening create event modal');
    console.log('✏️ Current editing state - isEditing:', this.isEditing, 'selectedEventForEdit:', this.selectedEventForEdit);
    
    // Check authentication first
    if (!this.authService.isLoggedIn()) {
      console.log('❌ User not logged in, cannot create event');
      this.errorMessage = 'Please log in to create events';
      return;
    }
    
    if (!this.currentUser) {
      console.log('❌ No current user data');
      this.errorMessage = 'User data not loaded. Please refresh the page and try again.';
      return;
    }
    
    // Only reset form if we're NOT editing (creating new event)
    if (!this.isEditing) {
      console.log('🔄 Resetting form for new event creation');
      this.resetEventForm();
    } else {
      console.log('📝 Keeping existing form data for editing');
    }
    
    // Load users for attendee dropdown
    this.loadAllUsers();
    
    // Clear any previous error messages
    this.errorMessage = '';
    
    this.dialog.open(this.eventDialog, {
      width: '80%',
      maxWidth: '1200px',
      height: '80%',
      maxHeight: '800px',
      disableClose: false
    });
  }

  // Add property to store all users for attendee dropdown
  allUsers: User[] = [];

  // Method to load all users for attendee dropdown
  loadAllUsers(): void {
    console.log('👥 Loading users for attendee dropdown...');
    
    // Check authentication first
    if (!this.authService.isLoggedIn()) {
      console.log('❌ User not logged in, cannot load users');
      this.allUsers = [];
      return;
    }
    
    this.authService.getAllUsers().subscribe({
      next: (users: User[]) => {
        this.allUsers = users;
        console.log('✅ Loaded users for attendee dropdown:', users.length);
        
        // Log some user details for debugging
        if (users.length > 0) {
          console.log('👥 Sample users:', users.slice(0, 3).map(u => ({ name: u.name, email: u.email })));
        }
      },
      error: (error) => {
        console.error('❌ Error loading users:', error);
        this.allUsers = [];
        
        // Show user-friendly error message
        if (error.status === 401) {
          console.log('❌ Authentication error loading users');
        } else if (error.status === 403) {
          console.log('❌ Permission error loading users');
        } else {
          console.log('❌ Network error loading users');
        }
      }
    });
  }

  editEvent(event: AngularCalendarEvent): void {
    console.log('✏️ EDIT EVENT - Starting editEvent');
    console.log('📋 Event to edit:', event);
    console.log('🕐 Event start:', event.start);
    console.log('🕐 Event end:', event.end);
    console.log('🕐 Event start toString:', event.start?.toString());
    console.log('🕐 Event end toString:', event.end?.toString());
    
    this.selectedEventForEdit = event;
    this.isEditing = true;

    // Convert UTC times to user timezone for form display
    if (event.start) {
      const startInUserTz = this.timezoneService.convertTimezone(event.start, 'UTC', this.userTimezone);
      console.log('🕐 startInUserTz converted:', startInUserTz);
      console.log('🕐 startInUserTz toString:', startInUserTz.toString());
      
      const startDate = startInUserTz.toISOString().split('T')[0];
      const startHour = startInUserTz.getHours();
      const startMinute = startInUserTz.getMinutes();
      const startAMPM = startHour >= 12 ? 'PM' : 'AM';
      const displayHour = startHour === 0 ? 12 : startHour > 12 ? startHour - 12 : startHour;

      console.log('📅 Form date extracted:', startDate);
      console.log('🕐 Form hour extracted:', displayHour);
      console.log('🕐 Form minute extracted:', startMinute);
      console.log('🕐 Form AM/PM extracted:', startAMPM);

                   this.eventFormModel = {
        title: event.title || '',
        attendees: this.getAttendeesList(),
        date: startDate,
        startHour: displayHour,
        startMinute: startMinute,
        startAMPM: startAMPM,
        duration: event.meta?.duration || 30,
        timezone: this.userTimezone,
        allDay: false,
        online: false,
        inPerson: false,
        location: '',
        recurrence: 'none',
        description: event.meta?.description || '',
        skill: event.meta?.skill || 'programming',
        // price: event.meta?.price || 10, // Commented out for future use
        sessionType: 'one-on-one',
        difficulty: 'beginner',
        maxParticipants: event.meta?.maxParticipants || 10,
        tags: ''
      };
    }

    console.log('📝 Final eventFormModel for edit:', this.eventFormModel);
    console.log('✏️ About to open modal with isEditing:', this.isEditing);
    this.openCreateEventModal();
  }

  deleteEvent(event: AngularCalendarEvent): void {
    console.log('🗑️ DELETE EVENT - Starting deleteEvent');
    console.log('📋 Event to delete:', event);
    console.log('🆔 Event sessionId:', event.meta?.sessionId);
    
    if (!event.meta?.sessionId) {
      console.error('❌ No sessionId found for event');
      this.errorMessage = 'Cannot delete event: Session ID not found';
      return;
    }
    
    // Check authentication
    if (!this.authService.isLoggedIn()) {
      console.log('❌ User not logged in');
      this.errorMessage = 'Please log in to delete events';
      return;
    }
    
    if (!this.currentUser) {
      console.log('❌ No current user data');
      this.errorMessage = 'User data not loaded. Please refresh the page and try again.';
      return;
    }
    
    // Check if user is the owner of the event
    if (!this.isEventEditable(event)) {
      console.log('❌ User is not the owner of this event');
      this.errorMessage = 'You can only delete events that you created';
      return;
    }
    
    // Show confirmation dialog
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      console.log('❌ User cancelled deletion');
      return;
    }
    
    console.log('✅ User confirmed deletion, proceeding...');
    this.loading = true;
    this.errorMessage = '';
    
    // Call the backend to delete the session
    this.scheduleService.deleteSession(event.meta.sessionId).subscribe({
      next: (response) => {
        console.log('✅ Session deleted successfully from database:', response);
        
        // Remove from local calendar events
        this.calendarEvents = this.calendarEvents.filter(e => e !== event);
        this.refresh.next({});
        
        // Clear selected event
        this.selectedEvent = null;
        this.selectedEventForEdit = null;
        
        // Show success message
        this.successMessage = `Event "${event.title}" deleted successfully!`;
        
        // Auto-hide success message after 5 seconds
        setTimeout(() => {
          this.successMessage = '';
        }, 5000);
        
        console.log('✅ Event deletion completed successfully');
      },
      error: (error) => {
        console.error('❌ Error deleting session:', error);
        console.error('❌ Error details:', error.error);
        console.error('❌ Error status:', error.status);
        
        if (error.status === 401) {
          this.errorMessage = 'Your session has expired. Please log in again.';
        } else if (error.status === 403) {
          this.errorMessage = 'You do not have permission to delete this event.';
        } else if (error.status === 404) {
          this.errorMessage = 'Event not found. It may have already been deleted.';
        } else if (error.status >= 500) {
          this.errorMessage = 'Server error. Please try again later.';
        } else {
          this.errorMessage = error.error?.message || error.error?.error || 'Failed to delete event';
        }
      },
      complete: () => {
        this.loading = false;
        console.log('🏁 deleteEvent observable completed');
      }
    });
  }

  closeEventDetails(): void {
    this.selectedEvent = null;
  }

  // Method to properly close the event dialog and reset state
  closeEventDialog(): void {
    console.log('🚪 Closing event dialog...');
    
    try {
      this.isEditing = false;
      this.selectedEventForEdit = null;
      this.errorMessage = '';
      this.successMessage = ''; // Also clear success messages
      
      // Reset form if not editing
      if (!this.isEditing) {
        this.resetEventForm();
      }
      
      // Close all dialogs
      this.dialog.closeAll();
      
      console.log('✅ Event dialog closed successfully');
      console.log('✅ Dialog state reset - isEditing:', this.isEditing, 'selectedEventForEdit:', this.selectedEventForEdit);
      
    } catch (error) {
      console.error('❌ Error closing event dialog:', error);
      // Force close dialogs even if there's an error
      this.dialog.closeAll();
    }
  }

  // Method to force create a new event (reset editing state)
  forceCreateNewEvent(): void {
    console.log('🔄 Force creating new event - resetting editing state');
    
    try {
      this.isEditing = false;
      this.selectedEventForEdit = null;
      this.resetEventForm();
      
      console.log('✅ Editing state reset - isEditing:', this.isEditing, 'selectedEventForEdit:', this.selectedEventForEdit);
      
      // Clear any error or success messages
      this.errorMessage = '';
      this.successMessage = '';
      
      // Open the create event modal
      this.openCreateEventModal();
      
    } catch (error) {
      console.error('❌ Error force creating new event:', error);
      this.errorMessage = 'Error creating new event. Please try again.';
    }
  }

  createEvent(form: any): void {
    console.log('🎯 createEvent called with form:', form);
    console.log('📝 Current eventFormModel:', this.eventFormModel);
    console.log('👤 Current user:', this.currentUser);
    console.log('🔐 Is authenticated:', this.authService.isAuthenticated());
    console.log('✏️ Current editing state - isEditing:', this.isEditing, 'selectedEventForEdit:', this.selectedEventForEdit);
    
    // Check authentication status
    this.checkAuthStatus();
    
    // Use the proper validation method
    if (!this.validateSessionForm()) {
      console.log('❌ Form validation failed');
      return;
    }
    
    console.log('✅ Form validation passed');
    
    // Check if we're editing an existing event
    if (this.isEditing && this.selectedEventForEdit) {
      console.log('✏️ Editing existing event');
      this.updateExistingEvent();
    } else {
      console.log('➕ Creating new event');
      // Call the actual session creation method
      this.createSession(form);
    }
  }

  resetEventForm(): void {
    console.log('🔄 resetEventForm called');
    
    // Get the next hour for default time
    const now = new Date();
    const nextHour = now.getHours() + 1;
    const isPM = nextHour >= 12;
    const displayHour = isPM ? (nextHour > 12 ? nextHour - 12 : 12) : nextHour;
    
    // Get user timezone or default to UTC
    const userTz = this.userTimezone || this.timezoneService.getUserTimezone() || 'UTC';
    
    this.eventFormModel = {
      title: '',
      attendees: [] as string[],
      date: this.todayString, // Default to today
      startHour: displayHour,
      startMinute: 0,
      startAMPM: isPM ? 'PM' : 'AM',
      duration: 30,
      timezone: userTz,
      allDay: false,
      online: false,
      inPerson: false,
      location: '',
      recurrence: 'none',
      description: '',
      skill: 'general', // Set default skill
      // price: 10, // Set default price to pass validation - Commented out for future use
      sessionType: 'one-on-one',
      difficulty: 'beginner',
      maxParticipants: 10,
      tags: ''
    };
    
    this.isEditing = false;
    this.selectedEventForEdit = null;
    this.errorMessage = ''; // Clear any error messages
    
    console.log('✅ Form reset complete - isEditing:', this.isEditing);
    console.log('✅ Form reset complete - timezone:', this.eventFormModel.timezone);
  }

  // Calendar navigation methods
  addDays(date: Date, days: number): Date {
    return addDays(date, days);
  }

  startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  // Custom Calendar Helper Methods
  getViewTitle(): string {
    switch (this.view) {
      case CalendarView.Month:
        return this.viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      case CalendarView.Week:
        const startOfWeek = this.getStartOfWeek(this.viewDate);
        const endOfWeek = this.addDays(startOfWeek, 6);
        return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      case CalendarView.Day:
        return this.viewDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      default:
        return this.viewDate.toLocaleDateString();
    }
  }

  previousPeriod(): void {
    switch (this.view) {
      case CalendarView.Month:
        this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() - 1, 1);
        break;
      case CalendarView.Week:
        this.viewDate = this.addDays(this.viewDate, -7);
        break;
      case CalendarView.Day:
        this.viewDate = this.addDays(this.viewDate, -1);
        break;
    }
  }

  nextPeriod(): void {
    switch (this.view) {
      case CalendarView.Month:
        this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() + 1, 1);
        break;
      case CalendarView.Week:
        this.viewDate = this.addDays(this.viewDate, 7);
        break;
      case CalendarView.Day:
        this.viewDate = this.addDays(this.viewDate, 1);
        break;
    }
  }

  goToToday(): void {
    this.viewDate = new Date();
  }

  setView(view: CalendarView): void {
    this.view = view;
  }

  getWeekDays(): Date[] {
    const startOfWeek = this.getStartOfWeek(this.viewDate);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(this.addDays(startOfWeek, i));
    }
    return days;
  }

  getMonthWeeks(): Date[][] {
    const startOfMonth = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth(), 1);
    const endOfMonth = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() + 1, 0);
    const startOfWeek = this.getStartOfWeek(startOfMonth);
    const endOfWeek = this.getStartOfWeek(endOfMonth);
    
    const weeks: Date[][] = [];
    let currentWeek: Date[] = [];
    let currentDate = new Date(startOfWeek);
    
    while (currentDate <= this.addDays(endOfWeek, 6)) {
           currentWeek.push(new Date(currentDate));
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      currentDate = this.addDays(currentDate, 1);
    }
    
    return weeks;
  }

  getDayNames(): string[] {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  }

  public hours = Array.from({length: 24}, (_, i) => i);
  public minutes = [0, 15, 30, 45];
  public hours12 = Array.from({length: 12}, (_, i) => i + 1); // [1, 2, ..., 12]
  public minutesZoom = [0, 15, 30, 45];
  public ampm = ['AM', 'PM'];

  getHours(): number[] {
    const hours: number[] = [];
    for (let i = 0; i <= 23; i++) {
      hours.push(i);
    }
    return hours;
  }

  getStartOfWeek(date: Date): Date {
    const day = date.getDay();
    return this.addDays(date, -day);
  }

  getDateTime(date: Date, hour: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 0, 0);
  }

  getEventsForDay(day: Date): AngularCalendarEvent[] {
    const startOfDay = this.startOfDay(day);
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    
    return this.calendarEvents.filter(event => {
      const eventStart = event.start ? new Date(event.start) : new Date();
      const eventEnd = event.end ? new Date(event.end) : new Date();
      return eventStart < endOfDay && eventEnd > startOfDay;
    });
  }

  // New method to get events for the selected date specifically
  getEventsForSelectedDate(): AngularCalendarEvent[] {
    return this.getEventsForDay(this.selectedDate);
  }

  // Method to get a formatted summary of the selected date
  getSelectedDateSummary(): string {
    const events = this.getEventsForSelectedDate();
    const dateStr = this.selectedDate.toDateString();
    
    if (events.length === 0) {
      return `No events scheduled for ${dateStr}`;
    } else if (events.length === 1) {
      return `1 event scheduled for ${dateStr}`;
    } else {
      return `${events.length} events scheduled for ${dateStr}`;
    }
  }

  getEventsForDayAndHour(day: Date, hour: number): AngularCalendarEvent[] {
    const startOfHour = this.getDateTime(day, hour);
    const endOfHour = new Date(startOfHour.getTime() + 60 * 60 * 1000);
    
    const events = this.calendarEvents.filter(event => {
      const eventStart = event.start ? new Date(event.start) : new Date();
      const eventEnd = event.end ? new Date(event.end) : new Date();
      return eventStart < endOfHour && eventEnd > startOfHour;
    });
    
    // Debug logging for events at specific hours
    if (events.length > 0) {
      console.log(`📅 Found ${events.length} events for ${day.toDateString()} at ${hour}:00`, events.map(e => e.title));
    }
    
    return events;
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() && 
           date.getFullYear() === today.getFullYear();
  }

  isSameDay(date1: Date, date2: Date): boolean {
    return date1 && date2 &&
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate();
  }

  isSameMonth(date1: Date, date2: Date): boolean {
    return date1 && date2 &&
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth();
  }

  // New methods for attendee management
  getAttendeesList(): string[] {
    if (!this.eventFormModel.attendees) {
      return [];
    }
    // Filter out the current user's email from the displayed attendees list
    const currentUserEmail = this.currentUser?.email;
    return this.eventFormModel.attendees.filter(email => email !== currentUserEmail);
  }

  removeAttendee(attendee: string): void {
    console.log('👤 Removing attendee:', attendee);
    
    try {
      if (!attendee || typeof attendee !== 'string') {
        console.error('❌ Invalid attendee to remove:', attendee);
        return;
      }
      
      // Remove the attendee from the array
      const originalLength = this.eventFormModel.attendees.length;
      this.eventFormModel.attendees = this.eventFormModel.attendees.filter(a => a !== attendee);
      
      if (this.eventFormModel.attendees.length === originalLength) {
        console.log('⚠️ Attendee not found in list:', attendee);
      } else {
        console.log('✅ Attendee removed successfully');
      }
      
      console.log('👤 Remaining attendees:', this.eventFormModel.attendees);
      
    } catch (error) {
      console.error('❌ Error removing attendee:', error);
      this.errorMessage = 'Error removing attendee. Please try again.';
    }
  }

  // Method to get member availability status (mock data for now)
  getMemberAvailability(attendee: string): { available: boolean; timeSlots: string[] } {
    // Mock availability data - in real app, this would come from backend
    const mockAvailability = {
      'john@example.com': { available: true, timeSlots: ['9:00 AM - 10:00 AM', '2:00 PM - 3:00 PM'] },
      'jane@example.com': { available: true, timeSlots: ['9:00 AM - 10:00 AM', '4:00 PM - 5:00 PM'] },
      'bob@example.com': { available: false, timeSlots: ['2:00 PM - 3:00 PM'] }
    };
    
    return mockAvailability[attendee as keyof typeof mockAvailability] || 
           { available: true, timeSlots: ['9:00 AM - 10:00 AM'] };
  }

  // Method to get suggested meeting times
  getSuggestedTimes(): Array<{ time: string; availability: string }> {
    if (!this.eventFormModel.attendees) {
      return [];
    }
    
    const attendees = this.getAttendeesList();
    if (attendees.length === 0) {
      return [];
    }

    // Mock suggested times based on attendee count
    return [
      { time: '9:00 AM - 10:00 AM', availability: 'All available' },
      { time: '2:00 PM - 3:00 PM', availability: `${Math.max(1, attendees.length - 1)} of ${attendees.length} available` },
      { time: '4:00 PM - 5:00 PM', availability: `${Math.max(1, attendees.length - 2)} of ${attendees.length} available` }
    ];
  }

  public timezones: any[] = [];

  getCurrentTimeInUserTimezone(): Date {
    const timezone = this.userTimezone || 'UTC';
    const now = new Date();
    // Convert browser time to user's timezone
    return new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  }

  get availableHours(): number[] {
    const selectedDate = new Date(this.eventFormModel.date);
    const now = this.getCurrentTimeInUserTimezone();
    if (
      selectedDate.getFullYear() === now.getFullYear() &&
      selectedDate.getMonth() === now.getMonth() &&
      selectedDate.getDate() === now.getDate()
    ) {
      // Only show hours >= current hour
      return this.hours12.filter(h => {
        let hour24 = h;
        if (this.eventFormModel.startAMPM === 'PM' && h < 12) hour24 += 12;
        if (this.eventFormModel.startAMPM === 'AM' && h === 12) hour24 = 0;
        return hour24 > now.getHours() || (hour24 === now.getHours());
      });
    }
    return this.hours12;
  }

  get availableMinutes(): number[] {
    const selectedDate = new Date(this.eventFormModel.date);
    const now = this.getCurrentTimeInUserTimezone();
    let hour = this.eventFormModel.startHour;
    if (this.eventFormModel.startAMPM === 'PM' && hour < 12) hour += 12;
    if (this.eventFormModel.startAMPM === 'AM' && hour === 12) hour = 0;
    if (
      selectedDate.getFullYear() === now.getFullYear() &&
      selectedDate.getMonth() === now.getMonth() &&
      selectedDate.getDate() === now.getDate() &&
      hour === now.getHours()
    ) {
      // Only show minutes >= current minute
      return this.minutesZoom.filter(m => m > now.getMinutes());
    }
    return this.minutesZoom;
  }

  isHourDisabled(h: number): boolean {
    const selectedDate = new Date(this.eventFormModel.date);
    const now = this.getCurrentTimeInUserTimezone();
    if (
      selectedDate.getFullYear() === now.getFullYear() &&
      selectedDate.getMonth() === now.getMonth() &&
      selectedDate.getDate() === now.getDate()
    ) {
      let hour24 = h;
      if (this.eventFormModel.startAMPM === 'PM' && h < 12) hour24 += 12;
      if (this.eventFormModel.startAMPM === 'AM' && h === 12) hour24 = 0;
      return hour24 < now.getHours();
    }
    return false;
  }

  isMinuteDisabled(m: number): boolean {
    const selectedDate = new Date(this.eventFormModel.date);
    const now = this.getCurrentTimeInUserTimezone();
    let hour = this.eventFormModel.startHour;
    if (this.eventFormModel.startAMPM === 'PM' && hour < 12) hour += 12;
    if (this.eventFormModel.startAMPM === 'AM' && hour === 12) hour = 0;
    if (
      selectedDate.getFullYear() === now.getFullYear() &&
      selectedDate.getMonth() === now.getMonth() &&
      selectedDate.getDate() === now.getDate() &&
      hour === now.getHours()
    ) {
      return m <= now.getMinutes();
    }
    return false;
  }

  showUpcomingEvents(): void {
    if (this.calendarEvents.length === 0) {
      this.successMessage = 'No upcoming events found.';
      return;
    }
    
    // Get upcoming events (events that haven't started yet)
    const now = new Date();
    const upcomingEvents = this.calendarEvents
      .filter(event => new Date(event.start) > now)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 3); // Show top 3 upcoming events
    
    if (upcomingEvents.length === 0) {
      this.successMessage = 'No upcoming events found.';
      return;
    }
    
    const eventList = upcomingEvents.map(event => {
      const startDate = new Date(event.start);
      const formattedDate = startDate.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
      return `• ${event.title} (${formattedDate})`;
    }).join('\n');
    
    this.successMessage = `Latest Upcoming Events:\n${eventList}`;
  }

  getUpcomingEvents(): AngularCalendarEvent[] {
    if (this.calendarEvents.length === 0) {
      return [];
    }
    
    // Show all events, not just future ones, so users can see their events
    const events = this.calendarEvents
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 10); // Show top 10 events
    
    return events;
  }

  formatEventDate(date: Date | string, eventTimezone?: string): string {
    // Convert UTC date to event's timezone first, then to user's timezone
    const utcDate = new Date(date);
    const targetTimezone = eventTimezone || this.userTimezone;
    const eventDate = this.timezoneService.convertTimezone(utcDate, 'UTC', targetTimezone);
    const now = new Date();
    const diffTime = eventDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return `Today at ${eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `Tomorrow at ${eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else if (diffDays <= 7) {
      return `${eventDate.toLocaleDateString('en-US', { weekday: 'short' })} at ${eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else {
      return eventDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    }
  }

  // New method to format event times in user's timezone
  formatEventTimeInUserTimezone(date: Date | string | undefined, eventTimezone?: string): string {
    console.log('🕐 FORMAT TIME - formatEventTimeInUserTimezone called');
    console.log('📅 Input date:', date);
    console.log('📅 Input date type:', typeof date);
    console.log('🌍 Event timezone:', eventTimezone);
    console.log('🌍 User timezone:', this.userTimezone);
    
    if (!date) {
      console.log('❌ No date provided, returning empty string');
      return '';
    }

    const utcDate = new Date(date);
    console.log('🕐 utcDate created:', utcDate);
    console.log('🕐 utcDate toString:', utcDate.toString());
    console.log('🕐 utcDate toISOString:', utcDate.toISOString());
    
    // Use the event's timezone if provided, otherwise use user's timezone
    const targetTimezone = eventTimezone || this.userTimezone || 'UTC';
    console.log('🌍 Target timezone used:', targetTimezone);
    
    // Use moment-timezone for consistent conversion
    const momentDate = moment.tz(utcDate, targetTimezone);
    const userTzDate = momentDate.toDate();
    
    console.log('🕐 userTzDate converted:', userTzDate);
    console.log('🕐 userTzDate toString:', userTzDate.toString());
    console.log('🕐 momentDate format:', momentDate.format());

    const formatted = userTzDate.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    console.log('🕐 Final formatted result:', formatted);
    return formatted;
  }

  // Helper method to format just the time part (HH:mm)
  formatEventTimeOnly(date: Date | string | undefined, eventTimezone?: string): string {
    if (!date) {
      return '';
    }

    const utcDate = new Date(date);
    const targetTimezone = eventTimezone || this.userTimezone || 'UTC';
    
    // Use moment-timezone for consistent conversion
    const momentDate = moment.tz(utcDate, targetTimezone);
    
    // Return just the time part in HH:mm format
    return momentDate.format('HH:mm');
  }

  getEventDuration(event: AngularCalendarEvent): string {
    if (!event.start || !event.end) return 'Duration unknown';
    
    const start = new Date(event.start);
    const end = new Date(event.end);
    const durationMs = end.getTime() - start.getTime();
    const durationMinutes = Math.round(durationMs / (1000 * 60));
    
    if (durationMinutes < 60) {
      return `${durationMinutes} min`;
    } else if (durationMinutes === 60) {
      return '1 hour';
    } else {
      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours} hours`;
    }
  }

  getEventSkill(event: AngularCalendarEvent): string {
    const session = event.meta?.session;
    if (session?.skill) {
      // Capitalize first letter and make it more readable
      return session.skill.charAt(0).toUpperCase() + session.skill.slice(1);
    }
    return 'General';
  }

  getEventDescription(event: AngularCalendarEvent): string {
    const session = event.meta?.session;
    if (session?.description) {
      // Remove participant info from description and limit length
      let desc = session.description.replace(/\nParticipants:.*$/, '').trim();
      return desc.length > 60 ? desc.substring(0, 60) + '...' : desc;
    }
    return event.meta?.description || 'No description';
  }

  getEventStatus(event: AngularCalendarEvent): string {
    const session = event.meta?.session;
    if (session?.status) {
      return session.status.charAt(0).toUpperCase() + session.status.slice(1);
    }
    return 'Scheduled';
  }

  // Event filtering methods
  applyEventFilters(): void {
    // This method is called when filter values change
    // The filtering is handled in getFilteredUpcomingEvents()
  }

  getFilteredUpcomingEvents(): AngularCalendarEvent[] {
    let filteredEvents = this.getUpcomingEvents();
    
    // Filter by skill
    if (this.eventFilter.skill && this.eventFilter.skill.trim() !== '') {
      filteredEvents = filteredEvents.filter(event => {
        // Check multiple possible locations for skill information
        const skill = event.meta?.session?.skill || 
                     event.meta?.skill || 
                     event.title?.toLowerCase() || 
                     '';
        
        return skill.toLowerCase().includes(this.eventFilter.skill.toLowerCase());
      });
    }
    
    // Filter by status
    if (this.eventFilter.status && this.eventFilter.status.trim() !== '') {
      filteredEvents = filteredEvents.filter(event => {
        // Check multiple possible locations for status information
        const status = event.meta?.session?.status || 
                      event.meta?.status || 
                      'scheduled'; // Default status
        
        return status.toLowerCase() === this.eventFilter.status.toLowerCase();
      });
    }
    
    // Filter by search term
    if (this.eventFilter.search && this.eventFilter.search.trim() !== '') {
      const searchTerm = this.eventFilter.search.toLowerCase().trim();
      filteredEvents = filteredEvents.filter(event => {
        const title = event.title?.toLowerCase() || '';
        const description = event.meta?.description?.toLowerCase() || '';
        const sessionDescription = event.meta?.session?.description?.toLowerCase() || '';
        const skill = event.meta?.session?.skill?.toLowerCase() || '';
        const attendees = event.meta?.attendees?.toLowerCase() || '';
        
        const searchableText = `${title} ${description} ${sessionDescription} ${skill} ${attendees}`;
        
        return searchableText.includes(searchTerm);
      });
    }
    
    return filteredEvents;
  }

  scrollToEvents(): void {
    console.log('📜 Scrolling to events...');
    
    try {
      // Find the first event and scroll to its time slot
      if (this.calendarEvents.length > 0) {
        const firstEvent = this.calendarEvents[0];
        const eventHour = new Date(firstEvent.start).getHours();
        
        console.log('📅 First event hour:', eventHour);
        
        // Scroll to the hour where the event is located
        const calendarContainer = document.querySelector('.calendar-body');
        if (calendarContainer) {
          const hourElement = calendarContainer.querySelector(`[data-hour="${eventHour}"]`);
          if (hourElement) {
            hourElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            console.log('✅ Scrolled to event hour:', eventHour);
          } else {
            console.log('⚠️ Hour element not found for hour:', eventHour);
          }
        } else {
          console.log('⚠️ Calendar container not found');
        }
      } else {
        console.log('📅 No events to scroll to');
      }
      
    } catch (error) {
      console.error('❌ Error scrolling to events:', error);
    }
  }

  scrollToInviteDialog() {
    setTimeout(() => {
      if (this.inviteDialog && this.inviteDialog.nativeElement) {
        this.inviteDialog.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 400);
  }

  isEventEditable(event: AngularCalendarEvent): boolean {
    if (!event || !this.currentUser) {
      return false;
    }
    
    const sessionHostId = event.meta?.hostId || event.meta?.host?._id || event.meta?.host;
    const currentUserId = this.currentUser?.id || this.currentUser?._id;
    
    return sessionHostId && currentUserId && sessionHostId === currentUserId;
  }

  // Add a method to check authentication status
  checkAuthStatus(): void {
    console.log('🔐 Checking authentication status...');
    console.log('👤 Current user:', this.currentUser);
    console.log('🔐 Is authenticated (with side effects):', this.authService.isAuthenticated());
    console.log('🔐 Is logged in (no side effects):', this.authService.isLoggedIn());
    console.log('🎫 Token exists:', !!this.authService.getToken());
    
    if (this.authService.getToken()) {
      console.log('🎫 Token length:', this.authService.getToken()?.length);
      console.log('🎫 Token preview:', this.authService.getToken()?.substring(0, 20) + '...');
    }
    
    // Check if there's a mismatch
    if (this.authService.isLoggedIn() && !this.currentUser) {
      console.warn('⚠️ Token exists but no current user - this might cause issues');
      this.errorMessage = 'User data not loaded. Please refresh the page.';
    }
    
    if (!this.authService.isLoggedIn()) {
      console.log('❌ User not logged in');
      this.errorMessage = 'Please log in to access the schedule';
    }

    // Check Zoom connection if user is logged in
    if (this.authService.isLoggedIn()) {
      this.checkZoomConnection();
    }
  }

  checkZoomConnection(): void {
    console.log('🔍 Starting Zoom connection check...');
    console.log('📊 Current zoomConnected state:', this.zoomConnected);
    console.log('⏳ Current zoomConnectionLoading state:', this.zoomConnectionLoading);
    
    // Check if we have a saved state in localStorage
    const savedState = typeof localStorage !== 'undefined' ? localStorage.getItem('zoomConnected') : null;
    const hasSavedState = savedState !== null;
    console.log('💾 Saved state exists:', hasSavedState, 'Value:', savedState);
    
    // If we have a saved state, trust it and don't override with backend check
    if (hasSavedState) {
      console.log('✅ Using saved localStorage state, skipping backend check to preserve user connection');
      return;
    }
    
    console.log('🔍 No saved state found, checking with backend...');
    this.zoomConnectionLoading = true;
    console.log('⏳ Set zoomConnectionLoading to true');
    
    this.zoomService.isConnected().subscribe({
      next: (response) => {
        console.log('✅ Received Zoom connection response:', response);
        if (response.success) {
          this.zoomConnected = response.data.isConnected;
          this.saveZoomConnectionState(this.zoomConnected); // Save to localStorage
          console.log('🔗 Zoom connection status set to:', this.zoomConnected);
          console.log('📝 Response data:', response.data);
        } else {
          this.zoomConnected = false;
          this.saveZoomConnectionState(false); // Save to localStorage
          console.log('❌ Zoom connection check failed:', response);
        }
      },
      error: (error) => {
        console.error('❌ Error checking Zoom connection:', error);
        console.error('📄 Full error object:', JSON.stringify(error, null, 2));
        this.zoomConnected = false;
        this.saveZoomConnectionState(false); // Save to localStorage
        console.log('❌ Set zoomConnected to false due to error');
      },
      complete: () => {
        this.zoomConnectionLoading = false;
        console.log('🏁 Zoom connection check completed');
        console.log('📊 Final zoomConnected state:', this.zoomConnected);
        console.log('⏳ Final zoomConnectionLoading state:', this.zoomConnectionLoading);
      }
    });
  }

  connectZoom(): void {
    console.log('🔗 Starting Zoom connection process...');
    console.log('📊 Current zoomConnected state before connect:', this.zoomConnected);
    
    this.zoomService.getAuthUrl().subscribe({
      next: (response) => {
        console.log('✅ Received Zoom auth response:', response);
        if (response.success) {
          // For Server-to-Server OAuth, we don't need to open a new window
          // The connection is established directly
          this.zoomConnected = true;
          this.saveZoomConnectionState(true); // Save to localStorage
          this.errorMessage = '';
          console.log('✅ Connected to Zoom successfully!');
          console.log('📝 Connection message:', response.data.message);
          console.log('📊 Updated zoomConnected state to:', this.zoomConnected);
          console.log('💾 State saved to localStorage');
        } else {
          this.errorMessage = 'Failed to connect to Zoom';
          console.log('❌ Zoom connection failed:', response);
        }
      },
      error: (error) => {
        console.error('❌ Error connecting to Zoom:', error);
        console.error('📄 Full error object:', JSON.stringify(error, null, 2));
        if (error.error?.message?.includes('Zoom credentials not configured')) {
          this.errorMessage = 'Zoom integration is not configured. Please contact the administrator to set up Zoom credentials.';
          console.log('⚙️ Zoom credentials not configured');
        } else {
          this.errorMessage = 'Failed to connect to Zoom. Please try again later.';
          console.log('❌ Generic connection error');
        }
      }
    });
  }

  // Save Zoom connection state to localStorage
  private saveZoomConnectionState(isConnected: boolean): void {
    console.log('💾 saveZoomConnectionState() called with:', isConnected);
    if (typeof localStorage !== 'undefined') {
      const valueToSave = JSON.stringify(isConnected);
      localStorage.setItem('zoomConnected', valueToSave);
      console.log('💾 Saved to localStorage - key: zoomConnected, value:', valueToSave);
      
      // Immediately verify it was saved
      const verification = localStorage.getItem('zoomConnected');
      console.log('💾 Verification - retrieved value:', verification);
      console.log('✅ Saved Zoom connection state to localStorage:', isConnected);
    } else {
      console.log('❌ localStorage not available for saving');
    }
  }

  // Restore Zoom connection state from localStorage
  restoreZoomConnectionState(): void {
    console.log('🔄 restoreZoomConnectionState() called');
    if (typeof localStorage !== 'undefined') {
      const savedState = localStorage.getItem('zoomConnected');
      console.log('🔄 Raw savedState from localStorage:', savedState);
      console.log('🔄 Type of savedState:', typeof savedState);
      
      if (savedState !== null) {
        try {
          const parsedState = JSON.parse(savedState);
          console.log('🔄 Parsed savedState:', parsedState);
          console.log('🔄 Type of parsedState:', typeof parsedState);
          
          this.zoomConnected = parsedState;
          console.log('🔄 Set zoomConnected to:', this.zoomConnected);
          console.log('✅ Restored Zoom connection state from localStorage:', this.zoomConnected);
        } catch (error) {
          console.error('❌ Error parsing saved Zoom state:', error);
          this.zoomConnected = false;
        }
      } else {
        console.log('📭 No saved Zoom connection state found in localStorage (value is null)');
        this.zoomConnected = false;
      }
    } else {
      console.log('❌ localStorage not available');
      this.zoomConnected = false;
    }
    
    console.log('🔄 Final zoomConnected state after restore:', this.zoomConnected);
  }

  // Clear Zoom connection state (call this on logout)
  static clearZoomConnectionState(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('zoomConnected');
      console.log('🗑️ Cleared Zoom connection state from localStorage');
    }
  }

  // TEST METHOD - Debug localStorage functionality
  testLocalStorageZoom(): void {
    console.log('🧪 ==> TESTING LOCALSTORAGE ZOOM FUNCTIONALITY <==');
    
    // Test 1: Check if localStorage is available
    console.log('🧪 Test 1: localStorage availability:', typeof localStorage !== 'undefined');
    
    if (typeof localStorage === 'undefined') {
      console.log('❌ localStorage not available - this could be the problem!');
      return;
    }
    
    // Test 2: Save a test value
    console.log('🧪 Test 2: Saving test value...');
    localStorage.setItem('testZoom', 'true');
    const retrievedTest = localStorage.getItem('testZoom');
    console.log('🧪 Test 2 result - saved: true, retrieved:', retrievedTest);
    
    // Test 3: Save actual zoom state as true
    console.log('🧪 Test 3: Saving zoomConnected as true...');
    this.saveZoomConnectionState(true);
    
    // Test 4: Restore zoom state
    console.log('🧪 Test 4: Restoring zoomConnected state...');
    this.restoreZoomConnectionState();
    console.log('🧪 Test 4 result - zoomConnected:', this.zoomConnected);
    
    // Test 5: Save as false and restore
    console.log('🧪 Test 5: Testing false state...');
    this.saveZoomConnectionState(false);
    this.restoreZoomConnectionState();
    console.log('🧪 Test 5 result - zoomConnected:', this.zoomConnected);
    
    // Test 6: Save as true again
    console.log('🧪 Test 6: Setting back to true...');
    this.saveZoomConnectionState(true);
    this.restoreZoomConnectionState();
    console.log('🧪 Test 6 result - zoomConnected:', this.zoomConnected);
    
    // Cleanup test
    localStorage.removeItem('testZoom');
    
    console.log('🧪 ==> TEST COMPLETED <==');
    console.log('🧪 Final state - zoomConnected:', this.zoomConnected);
    console.log('🧪 Final localStorage value:', localStorage.getItem('zoomConnected'));
  }

  // Debug method to manually test Zoom connection
  debugZoomConnection(): void {
    console.log('🐛 === ZOOM DEBUG SESSION START ===');
    console.log('🔍 Current component state:');
    console.log('  - zoomConnected:', this.zoomConnected);
    console.log('  - zoomConnectionLoading:', this.zoomConnectionLoading);
    console.log('  - errorMessage:', this.errorMessage);
    
    console.log('🌐 Testing API endpoints...');
    
    // Test 1: Check if backend is reachable
    console.log('📡 Test 1: Backend connectivity check');
    this.zoomService.isConnected().subscribe({
      next: (response) => {
        console.log('✅ Backend responded to /status:', response);
      },
      error: (error) => {
        console.error('❌ Backend failed to respond to /status:', error);
        console.log('💡 Check if backend is running on http://localhost:3000');
      }
    });
    
    // Test 2: Check auth URL endpoint
    console.log('📡 Test 2: Auth URL endpoint check');
    this.zoomService.getAuthUrl().subscribe({
      next: (response) => {
        console.log('✅ Backend responded to /oauth-url:', response);
      },
      error: (error) => {
        console.error('❌ Backend failed to respond to /oauth-url:', error);
      }
    });
    
    // Test 3: Force refresh Zoom connection status
    console.log('🔄 Test 3: Force refresh connection status');
    this.checkZoomConnection();
    
    console.log('🐛 === ZOOM DEBUG SESSION END ===');
  }

  // Smart join meeting method that handles both hosts and attendees
  joinMeeting(session: Session): void {
    if (!session.zoomMeeting?.joinUrl) {
      this.errorMessage = 'No meeting URL available for this session';
      return;
    }

    // Get current user email
    const currentUserEmail = this.currentUser?.email;
    if (!currentUserEmail) {
      this.errorMessage = 'User email not found. Please log in again.';
      return;
    }

    // Check if user is the host
    const hostEmail = typeof session.host === 'string' ? '' : session.host.email;
    const isHost = hostEmail === currentUserEmail;
    
    // Open the join URL in a new window/tab
    const joinUrl = session.zoomMeeting.joinUrl;
    const popup = window.open(joinUrl, '_blank', 'noopener,noreferrer');
    
    if (!popup) {
      // Fallback if popup is blocked
      window.location.href = joinUrl;
    }

    console.log(`Joining Zoom meeting: ${session.zoomMeeting.meetingId || 'unknown'}, Host: ${isHost}, URL: ${joinUrl}`);
  }

  // Check if meeting is ready to join
  isMeetingReadyToJoin(session: Session): boolean {
    if (!session.startTime) return false;
    
    const now = new Date();
    const meetingStart = new Date(session.startTime);
    const meetingEnd = new Date(meetingStart.getTime() + (session.duration || 30) * 60000);
    
    // Check if user is the host
    const currentUserEmail = this.currentUser?.email;
    const hostEmail = typeof session.host === 'string' ? '' : session.host.email;
    const isHost = hostEmail === currentUserEmail;
    
    // Hosts can start meetings anytime, participants can join 5 minutes before
    if (isHost) {
      return now <= meetingEnd; // Host can start anytime before meeting ends
    } else {
      // Allow joining 5 minutes before start time for participants
      const earlyJoinTime = new Date(meetingStart.getTime() - 5 * 60000);
      return now >= earlyJoinTime && now <= meetingEnd;
    }
  }

  // Get meeting join status with user-friendly messages
  getMeetingJoinStatus(session: Session): {
    canJoin: boolean;
    status: string;
    message: string;
    timeUntilStart?: number;
    buttonText: string;
  } {
    if (!session.startTime) {
      return {
        canJoin: false,
        status: 'no-time',
        message: 'Meeting time not set',
        buttonText: 'Join Meeting'
      };
    }

    const now = new Date();
    const meetingStart = new Date(session.startTime);
    const meetingEnd = new Date(meetingStart.getTime() + (session.duration || 30) * 60000);
    const earlyJoinTime = new Date(meetingStart.getTime() - 5 * 60000);
    
    const currentUserEmail = this.currentUser?.email;
    const hostEmail = typeof session.host === 'string' ? '' : session.host.email;
    const isHost = hostEmail === currentUserEmail;
    
    if (now < earlyJoinTime) {
      const timeUntilStart = Math.ceil((meetingStart.getTime() - now.getTime()) / 60000);
      return {
        canJoin: isHost, // Hosts can start early, participants cannot
        status: 'waiting',
        message: isHost ? `You can start the meeting early (scheduled in ${timeUntilStart} minutes)` : `Meeting starts in ${timeUntilStart} minutes`,
        timeUntilStart,
        buttonText: isHost ? 'Start Meeting' : 'Join Meeting'
      };
    } else if (now >= earlyJoinTime && now <= meetingEnd) {
      return {
        canJoin: true,
        status: 'ready',
        message: 'Meeting is ready to join',
        buttonText: isHost ? 'Start Meeting' : 'Join Meeting'
      };
    } else {
      return {
        canJoin: false,
        status: 'ended',
        message: 'Meeting has ended',
        buttonText: 'Meeting Ended'
      };
    }
  }

  // Helper method to get session from selectedEvent
  getSessionFromEvent(event: AngularCalendarEvent): Session | null {
    if (!event.meta?.sessionId) return null;
    console.log('🔍 Looking for session with ID:', event.meta.sessionId);
    console.log('🔍 Available sessions:', this.sessions.map(s => ({ id: s.id, _id: s._id, title: s.title })));
    
    const session = this.sessions.find(s => 
      s.id === event.meta.sessionId || 
      s._id === event.meta.sessionId
    );
    
    if (session) {
      console.log('✅ Found session:', session.title);
    } else {
      console.log('❌ Session not found for ID:', event.meta.sessionId);
    }
    
    return session || null;
  }

  // Helper method to create zoom meeting from event
  createZoomMeetingFromEvent(event: AngularCalendarEvent): void {
    console.log('🎯 createZoomMeetingFromEvent called with event:', event);
    console.log('🎯 Event meta:', event.meta);
    
    const session = this.getSessionFromEvent(event);
    if (!session) {
      console.log('❌ Session not found for event');
      this.errorMessage = 'Error: Session not found for this event.';
      return;
    }
    
    console.log('✅ Session found:', session.title);
    this.createZoomMeeting(session.id || session._id || '');
  }

  // Helper method to join meeting from event
  joinMeetingFromEvent(event: AngularCalendarEvent): void {
    const session = this.getSessionFromEvent(event);
    if (!session) {
      this.errorMessage = 'Session not found for this event';
      return;
    }
    this.joinMeeting(session);
  }

  // Helper method to check if meeting is ready to join from event
  isMeetingReadyToJoinFromEvent(event: AngularCalendarEvent): boolean {
    const session = this.getSessionFromEvent(event);
    if (!session) return false;
    return this.isMeetingReadyToJoin(session);
  }

  // Helper method to get meeting join status from event
  getMeetingJoinStatusFromEvent(event: AngularCalendarEvent): {
    canJoin: boolean;
    status: string;
    message: string;
    timeUntilStart?: number;
    buttonText: string;
  } {
    const session = this.getSessionFromEvent(event);
    if (!session) {
      return {
        canJoin: false,
        status: 'no-session',
        message: 'Session not found',
        buttonText: 'Join Meeting'
      };
    }
    return this.getMeetingJoinStatus(session);
  }

  openJoinUrl(): void {
    // Extract the join URL from the success message
    if (this.successMessage && this.successMessage.includes('Join URL:')) {
      const urlMatch = this.successMessage.match(/Join URL: (https:\/\/zoom\.us\/j\/[^\s]+)/);
      if (urlMatch && urlMatch[1]) {
        console.log('🎯 Opening join URL:', urlMatch[1]);
        window.open(urlMatch[1], '_blank', 'noopener,noreferrer');
      } else {
        console.log('🎯 No valid URL found in success message:', this.successMessage);
      }
    } else {
      console.log('🎯 No success message or Join URL found');
    }
  }

  openZoomScheduler() {
    console.log('🎯 Opening external Zoom scheduler...');
    
    // Open external Zoom scheduler
    window.open('https://zoom.us/meeting/schedule', '_blank');
    
    // Show message to user about syncing
    this.successMessage = 'Zoom scheduler opened! After creating your meeting in Zoom, click "Sync Zoom Meetings" to import it to your calendar.';
    
    // Auto-hide message after 10 seconds
    setTimeout(() => {
      this.successMessage = '';
    }, 10000);
  }

  // New method to sync Zoom meetings from external Zoom account
  syncZoomMeetings(): void {
    console.log('🔄 Starting Zoom meetings sync...');
    console.log('🔐 Current authentication status:');
    console.log('  - User logged in:', this.authService.isLoggedIn());
    console.log('  - Current user:', this.currentUser);
    console.log('  - Token exists:', !!this.authService.getToken());
    console.log('  - Zoom connected:', this.zoomConnected);
    
    // Check if user is logged in first
    if (!this.authService.isLoggedIn()) {
      this.errorMessage = 'You need to log in first before syncing Zoom meetings.';
      return;
    }
    
    // Check if user is connected to Zoom first
    if (!this.zoomConnected) {
      this.errorMessage = 'You need to connect your Zoom account first. Please click "Connect Zoom" to authorize.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    
    console.log('📡 Calling backend to sync Zoom meetings...');
    console.log('📡 Request URL: http://localhost:3000/api/zoom/sync-meetings');
    console.log('📡 Auth token preview:', this.authService.getToken()?.substring(0, 20) + '...');
    
    // Call backend service to sync meetings
    this.zoomService.syncMeetings().subscribe({
      next: (response: any) => {
        console.log('✅ Sync response:', response);
        
        if (response.success) {
          const syncedCount = response.data?.syncedMeetings?.length || 0;
          this.successMessage = `Successfully synced ${syncedCount} Zoom meeting(s) to your calendar!`;
          
          // Reload calendar events to show the new meetings
          this.loadSessionsFromBackend();
          
          console.log('✅ Zoom meetings synced successfully');
        } else {
          this.errorMessage = response.message || 'Failed to sync Zoom meetings';
        }
      },
      error: (error) => {
        console.error('❌ Error syncing Zoom meetings:', error);
        console.error('❌ Error status:', error.status);
        console.error('❌ Error response:', error.error);
        console.error('❌ Full error object:', JSON.stringify(error, null, 2));
        
        if (error.status === 401) {
          this.errorMessage = 'Your session has expired. Please log in again.';
        } else if (error.status === 403) {
          this.errorMessage = 'You do not have permission to sync meetings.';
        } else if (error.status === 0) {
          this.errorMessage = 'Cannot connect to server. Please check if the backend is running.';
        } else if (error.error?.message?.includes('No meetings found')) {
          this.errorMessage = 'No new Zoom meetings found to sync.';
        } else if (error.error?.message?.includes('Free Zoom accounts do not support')) {
          this.errorMessage = 'Free Zoom accounts do not support automatic meeting sync. Would you like to manually enter your Zoom meeting details?';
          // Show manual sync option for free accounts
          this.showManualSyncForm();
        } else if (error.error && typeof error.error === 'string' && error.error.includes('<!DOCTYPE')) {
          this.errorMessage = 'Server returned an HTML error page instead of JSON. Please check the backend logs for errors.';
        } else {
          this.errorMessage = error.error?.message || error.message || 'Failed to sync Zoom meetings. Please try again.';
        }
      },
      complete: () => {
        this.loading = false;
        
        // Auto-hide success message after 8 seconds
        setTimeout(() => {
          this.successMessage = '';
        }, 8000);
      }
    });
  }

  // Manual sync methods for free Zoom accounts
  showManualSyncForm(): void {
    console.log('📋 Showing manual sync form for free account...');
    
    // Reset form
    this.manualSyncForm = {
      topic: '',
      startTime: '',
      duration: 60,
      meetingId: '',
      joinUrl: '',
      password: '',
      timezone: this.userTimezone || 'UTC'
    };
    
    this.showManualSyncModal = true;
    this.errorMessage = '';
  }

  closeManualSyncForm(): void {
    this.showManualSyncModal = false;
    this.errorMessage = '';
  }

  submitManualSync(): void {
    console.log('📋 Submitting manual sync...', this.manualSyncForm);
    
    // Validate required fields
    if (!this.manualSyncForm.topic.trim()) {
      this.errorMessage = 'Meeting topic is required';
      return;
    }
    
    if (!this.manualSyncForm.startTime) {
      this.errorMessage = 'Meeting start time is required';
      return;
    }
    
    if (!this.manualSyncForm.duration || this.manualSyncForm.duration < 1) {
      this.errorMessage = 'Meeting duration must be at least 1 minute';
      return;
    }
    
    this.loading = true;
    this.errorMessage = '';
    
    // Call backend manual sync endpoint
    this.zoomService.manualSyncMeeting(this.manualSyncForm).subscribe({
      next: (response: any) => {
        console.log('✅ Manual sync response:', response);
        
        if (response.success) {
          this.successMessage = `Meeting "${this.manualSyncForm.topic}" successfully synced to your calendar!`;
          
          // Reload calendar events to show the new meeting
          this.loadSessionsFromBackend();
          
          // Close the modal
          this.closeManualSyncForm();
          
          console.log('✅ Manual sync completed successfully');
        } else {
          this.errorMessage = response.message || 'Failed to sync meeting';
        }
      },
      error: (error) => {
        console.error('❌ Manual sync error:', error);
        
        if (error.status === 409) {
          this.errorMessage = 'This meeting is already synced to your calendar';
        } else if (error.status === 400) {
          this.errorMessage = error.error?.message || 'Please check your meeting details and try again';
        } else {
          this.errorMessage = 'Failed to sync meeting. Please try again.';
        }
      },
      complete: () => {
        this.loading = false;
        
        // Auto-hide success message after 8 seconds
        setTimeout(() => {
          this.successMessage = '';
        }, 8000);
      }
    });
  }

  // Invitation sync methods for free Zoom accounts
  showInvitationSyncForm(): void {
    console.log('🤖 Showing invitation sync form for free account...');
    
    // Reset form
    this.invitationSyncForm = {
      invitationText: ''
    };
    
    this.showInvitationSyncModal = true;
    this.errorMessage = '';
  }

  closeInvitationSyncForm(): void {
    this.showInvitationSyncModal = false;
    this.errorMessage = '';
  }

  submitInvitationSync(): void {
    console.log('🤖 Submitting invitation sync...', this.invitationSyncForm);
    
    // Validate required fields
    if (!this.invitationSyncForm.invitationText.trim()) {
      this.errorMessage = 'Invitation text is required';
      return;
    }
    
    this.loading = true;
    this.errorMessage = '';
    
    // Call backend invitation sync endpoint
    this.zoomService.autoSyncFromInvitation(this.invitationSyncForm.invitationText).subscribe({
      next: (response: any) => {
        console.log('✅ Invitation sync response:', response);
        
        if (response.success) {
          const updateType = response.data?.updateType;
          
          if (updateType === 'attendees_added') {
            this.successMessage = `Meeting "${response.data.meeting?.topic || 'from invitation'}" updated with new attendees!
📅 ${response.data.message}
⏱️ Duration: ${response.data.meeting?.duration || 'Unknown'} minutes
🔗 Join URL: ${response.data.meeting?.joinUrl || 'Not provided'}`;
          } else if (updateType === 'no_changes') {
            this.successMessage = `Meeting "${response.data.meeting?.topic || 'from invitation'}" already up to date!
📅 ${response.data.message}
⏱️ Duration: ${response.data.meeting?.duration || 'Unknown'} minutes`;
          } else {
            // New meeting created
            this.successMessage = `Meeting "${response.data.meeting?.topic || 'from invitation'}" successfully auto-synced to your calendar!
📅 Date: ${response.data.meeting?.start_time || 'Unknown'}
⏱️ Duration: ${response.data.meeting?.duration || 'Unknown'} minutes
🔗 Join URL: ${response.data.meeting?.join_url || 'Not provided'}`;
          }
          
          // Reload calendar events to show the updated/new meeting
          this.loadSessionsFromBackend();
          
          // Close the modal
          this.closeInvitationSyncForm();
          
          console.log('✅ Invitation sync completed successfully');
        } else {
          this.errorMessage = response.message || 'Failed to parse invitation. Please check the format and try again.';
        }
      },
      error: (error) => {
        console.error('❌ Invitation sync error:', error);
        
        // Remove the 409 error handling since we now support updates
        if (error.status === 400) {
          this.errorMessage = error.error?.message || 'Could not parse the invitation text. Please check the format and try again.';
        } else {
          this.errorMessage = 'Failed to sync meeting from invitation. Please try again.';
        }
      },
      complete: () => {
        this.loading = false;
        
        // Auto-hide success message after 10 seconds for invitation sync
        setTimeout(() => {
          this.successMessage = '';
        }, 10000);
      }
    });
  }

  // Meeting control methods
  startMeeting(session: any): void {
    console.log('🚀 startMeeting called');
    console.log('🔍 Raw session parameter:', session);
    console.log('🔍 Session keys:', Object.keys(session || {}));
    console.log('🔍 session._id:', session?._id);
    console.log('🔍 session.sessionId:', session?.sessionId);
    console.log('🔍 session.id:', session?.id);
    
    // Handle both session object and meta object
    const sessionId = session._id || session.sessionId || session.id;
    console.log('🚀 Starting meeting for session:', sessionId);
    
    if (!sessionId) {
      console.error('❌ No session ID found');
      return;
    }
    
    if (!this.isHost(session)) {
      console.error('❌ Only the host can start the meeting');
      return;
    }
    
    this.loading = true;
    
    this.scheduleService.startMeeting(sessionId).subscribe({
      next: (response) => {
        console.log('✅ Meeting started successfully:', response);
        
        // Update local session data
        const sessionIndex = this.sessions.findIndex(s => s._id === sessionId);
        if (sessionIndex !== -1) {
          this.sessions[sessionIndex].meetingStatus = 'live';
          this.sessions[sessionIndex].actualStartTime = new Date().toISOString();
          this.updateCalendarEvents();
          this.refresh.next({});
        }
        
        // Show success message
        this.successMessage = 'Meeting started! Participants can now join.';
        setTimeout(() => this.successMessage = '', 5000);
      },
      error: (error) => {
        console.error('❌ Error starting meeting:', error);
        this.errorMessage = error.error?.message || 'Failed to start meeting';
        setTimeout(() => this.errorMessage = '', 5000);
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  endMeeting(session: any): void {
    // Handle both session object and meta object
    const sessionId = session._id || session.sessionId || session.id;
    console.log('🛑 Ending meeting for session:', sessionId);
    console.log('🔍 Session object:', session);
    
    if (!sessionId) {
      console.error('❌ No session ID found');
      return;
    }
    
    if (!this.isHost(session)) {
      console.error('❌ Only the host can end the meeting');
      return;
    }
    
    this.loading = true;
    
    this.scheduleService.endMeeting(sessionId).subscribe({
      next: (response) => {
        console.log('✅ Meeting ended successfully:', response);
        
        // Update local session data
        const sessionIndex = this.sessions.findIndex(s => s._id === sessionId);
        if (sessionIndex !== -1) {
          this.sessions[sessionIndex].meetingStatus = 'ended';
          this.sessions[sessionIndex].actualEndTime = new Date().toISOString();
          this.updateCalendarEvents();
          this.refresh.next({});
        }
        
        // Show success message
        this.successMessage = 'Meeting ended successfully.';
        setTimeout(() => this.successMessage = '', 5000);
      },
      error: (error) => {
        console.error('❌ Error ending meeting:', error);
        this.errorMessage = error.error?.message || 'Failed to end meeting';
        setTimeout(() => this.errorMessage = '', 5000);
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  // Helper methods for meeting status
  isHost(sessionOrMeta: any): boolean {
    if (!sessionOrMeta || !this.currentUser) return false;
    
    const currentUserId = this.currentUser.id || this.currentUser._id;
    
    // Handle both session object and meta object
    const hostId = sessionOrMeta.hostId || sessionOrMeta.host?._id || sessionOrMeta.host?.id || sessionOrMeta.host;
    
    console.log('🔍 isHost check:', { currentUserId, hostId, sessionOrMeta });
    return currentUserId === hostId;
  }

  isMeetingLive(sessionOrMeta: any): boolean {
    return sessionOrMeta?.meetingStatus === 'live';
  }

  isMeetingNotStarted(sessionOrMeta: any): boolean {
    const meetingStatus = sessionOrMeta?.meetingStatus || 'not-started';
    return meetingStatus === 'not-started';
  }

  isMeetingEnded(session: any): boolean {
    return session.meetingStatus === 'ended';
  }

  canJoinMeeting(session: any): boolean {
    // Participants can join only if meeting is live
    return this.isMeetingLive(session) && session.zoomMeeting?.joinUrl;
  }

  getMeetingStatusText(session: any): string {
    console.log('🔍 getMeetingStatusText called with:', session);
    
    if (!session) {
      console.log('🔍 No session provided, returning default message');
      return '⏳ Meeting not scheduled yet';
    }
    
    // Handle both session object and meta object
    const sessionData = session.meta || session;
    const meetingStatus = sessionData.meetingStatus || 'not-started';
    console.log('🔍 Session data:', sessionData);
    console.log('🔍 Meeting status found:', meetingStatus);
    
    if (this.isHost(session)) {
      if (this.isMeetingNotStarted(session)) {
        return '⏳ Ready to start meeting';
      } else if (this.isMeetingLive(session)) {
        return '🟢 Meeting is live (you are hosting)';
      } else {
        return '🔴 Meeting ended';
      }
    } else {
      if (this.isMeetingNotStarted(session)) {
        return '⏳ Host hasn\'t started the meeting yet';
      } else if (this.isMeetingLive(session)) {
        return '🟢 Meeting is live - You can join now!';
      } else {
        return '🔴 Meeting has ended';
      }
    }
  }

  getMeetingStatusIcon(session: any): string {
    if (this.isMeetingNotStarted(session)) {
      return 'schedule';
    } else if (this.isMeetingLive(session)) {
      return 'videocam';
    } else {
      return 'videocam_off';
    }
  }

  getMeetingStatusColor(session: any): string {
    if (this.isMeetingNotStarted(session)) {
      return 'warn';
    } else if (this.isMeetingLive(session)) {
      return 'primary';
    } else {
      return 'basic';
    }
  }
}
