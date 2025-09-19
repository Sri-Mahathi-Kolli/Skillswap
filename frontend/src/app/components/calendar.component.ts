import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TimezoneService, Timezone, CalendarEvent, TimeSlot } from '../services/timezone.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="calendar-container">
      <div class="calendar-header">
        <button (click)="previousMonth()">&lt;</button>
        <h2>{{ getMonthYear() }}</h2>
        <button (click)="nextMonth()">&gt;</button>
      </div>
      
      <div class="calendar-body">
        <div class="calendar-weekdays">
          <div *ngFor="let day of weekDays" class="weekday">{{ day }}</div>
        </div>
        
        <div class="calendar-grid">
          <div *ngFor="let week of calendarWeeks" class="calendar-week">
            <div *ngFor="let day of week" 
                 class="calendar-day"
                 [class.other-month]="day.otherMonth"
                 [class.today]="day.isToday"
                 [class.selected]="day.isSelected"
                 [class.has-events]="day.hasEvents"
                 (click)="selectDate(day.date)">
              <span class="day-number">{{ day.dayNumber }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="time-slots" *ngIf="selectedDate">
        <h3>Time Slots for {{ formatSelectedDate() }}</h3>
        <div class="time-slot-list">
          <div *ngFor="let slot of timeSlots" 
               class="time-slot"
               [class.available]="slot.available"
               (click)="selectTimeSlot(slot)">
            {{ formatTime(slot.startTime) }} - {{ formatTime(slot.endTime) }}
            <span *ngIf="!slot.available" class="unavailable">(Unavailable)</span>
          </div>
        </div>
      </div>
      
      <div class="event-details" *ngIf="selectedEvent">
        <div class="event-dialog">
          <div class="event-header">
            <h3>{{ selectedEvent.title }}</h3>
            <button class="close-btn" (click)="selectedEvent = null">&times;</button>
          </div>
          <div class="event-content">
            <p><strong>Time:</strong> {{ formatEventTime(selectedEvent) }}</p>
            <p><strong>Duration:</strong> {{ getEventDuration(selectedEvent) }}</p>
            <p *ngIf="selectedEvent.description"><strong>Description:</strong> {{ selectedEvent.description }}</p>
            <p *ngIf="selectedEvent.location"><strong>Location:</strong> {{ selectedEvent.location }}</p>
            <p *ngIf="selectedEvent.meetingUrl">
              <strong>Meeting:</strong> 
              <div class="meeting-status">
                <div class="status-info">
                  <span class="status-message">{{ getMeetingJoinStatus(selectedEvent).message }}</span>
                </div>
                <button 
                  class="join-btn"
                  [class.disabled]="!getMeetingJoinStatus(selectedEvent).canJoin"
                  [disabled]="!getMeetingJoinStatus(selectedEvent).canJoin"
                  (click)="joinMeeting(selectedEvent)">
                  {{ getMeetingJoinStatus(selectedEvent).buttonText }}
                </button>
              </div>
            </p>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./calendar.component.css']
})
export class CalendarComponent implements OnInit {
  @Input() events: CalendarEvent[] = [];
  @Input() timeSlots: TimeSlot[] = [];
  @Output() dateSelected = new EventEmitter<Date>();
  @Output() timeSlotSelected = new EventEmitter<TimeSlot>();
  @Output() eventSelected = new EventEmitter<CalendarEvent>();

  timezones: Timezone[] = [];
  selectedTimezone: string = '';
  currentDate: Date = new Date();
  selectedDate: Date | null = null;
  selectedEvent: CalendarEvent | null = null;
  calendarWeeks: any[][] = [];
  
  weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  constructor(private timezoneService: TimezoneService) {}

  ngOnInit(): void {
    this.loadTimezones();
    this.selectedTimezone = this.timezoneService.getUserPreferredTimezone();
    this.generateCalendar();
  }

  loadTimezones(): void {
    this.timezoneService.getTimezones().subscribe(timezones => {
      this.timezones = timezones;
    });
  }

  onTimezoneChange(): void {
    this.generateCalendar();
    this.updateTimeSlots();
  }

  generateCalendar(): void {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    this.calendarWeeks = [];
    let currentWeek: any[] = [];
    
    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      
      const dayData = {
        date: new Date(currentDate),
        dayNumber: currentDate.getDate(),
        otherMonth: currentDate.getMonth() !== month,
        isToday: this.isToday(currentDate),
        isSelected: this.selectedDate && this.isSameDate(currentDate, this.selectedDate),
        hasEvents: this.hasEventsForDate(currentDate)
      };
      
      currentWeek.push(dayData);
      
      if (currentWeek.length === 7) {
        this.calendarWeeks.push(currentWeek);
        currentWeek = [];
      }
    }
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return this.isSameDate(date, today);
  }

  isSameDate(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  hasEventsForDate(date: Date): boolean {
    return this.events.some(event => this.isSameDate(event.start, date));
  }

  selectDate(date: Date): void {
    this.selectedDate = new Date(date);
    this.dateSelected.emit(this.selectedDate);
    this.generateCalendar();
    this.updateTimeSlots();
  }

  selectTimeSlot(slot: TimeSlot): void {
    if (slot.available) {
      this.timeSlotSelected.emit(slot);
    }
  }

  previousMonth(): void {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.generateCalendar();
  }

  nextMonth(): void {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    this.generateCalendar();
  }

  getMonthYear(): string {
    return this.currentDate.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  }

  getCurrentTime(): string {
    return this.timezoneService.formatDateWithTimezone(
      new Date(), 
      this.selectedTimezone, 
      'time'
    );
  }

  formatSelectedDate(): string {
    if (!this.selectedDate) return '';
    return this.timezoneService.formatDateWithTimezone(
      this.selectedDate, 
      this.selectedTimezone, 
      'full'
    );
  }

  formatTime(dateInput: string | Date): string {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return this.timezoneService.formatDateWithTimezone(
      date, 
      this.selectedTimezone, 
      'time'
    );
  }

  formatEventTime(event: CalendarEvent): string {
    const start = this.timezoneService.formatDateWithTimezone(
      event.start, 
      this.selectedTimezone, 
      'short'
    );
    const end = this.timezoneService.formatDateWithTimezone(
      event.end, 
      this.selectedTimezone, 
      'time'
    );
    return `${start} - ${end}`;
  }

  getEventDuration(event: CalendarEvent): string {
    const duration = this.timezoneService.calculateDuration(event.start, event.end);
    if (duration.hours > 0) {
      return `${duration.hours}h ${duration.minutes}m`;
    }
    return `${duration.minutes}m`;
  }

  getTimezoneAbbreviation(timezone: string): string {
    return this.timezoneService.getTimezoneAbbreviation(timezone);
  }

  updateTimeSlots(): void {
    if (this.selectedDate) {
      // Generate time slots for the selected date
      const slots = this.timezoneService.generateTimeSlots(
        this.selectedDate, 
        this.selectedTimezone, 
        9, // start hour
        17, // end hour
        60 // interval minutes
      );
      
      // Mark slots as booked if they have events
      slots.forEach(slot => {
        slot.available = !this.events.some(event => 
          this.timezoneService.doTimeSlotsOverlap(slot, {
            startTime: event.start.toISOString(),
            endTime: event.end.toISOString(),
            timezone: event.timezone,
            available: true
          })
        );
      });
      
      this.timeSlots = slots;
    }
  }

  // Public method to add events
  addEvent(event: CalendarEvent): void {
    this.events.push(event);
    this.generateCalendar();
    this.updateTimeSlots();
  }

  // Public method to remove events
  removeEvent(eventId: string): void {
    this.events = this.events.filter(event => event.id !== eventId);
    this.generateCalendar();
    this.updateTimeSlots();
  }

  getPhotoUrl(photo: string): string {
  if (!photo) return 'default-avatar.png';
    // If photo is already a full URL or starts with /uploads, return as is
    if (photo.startsWith('http') || photo.startsWith('/uploads')) {
      return photo;
    }
    // Otherwise, prepend your API URL
    return `${environment.apiUrl}/${photo}`;
  }

  onImgError(event: Event) {
    const img = event.target as HTMLImageElement;
    const currentSrc = img.src;
    
    // Prevent infinite loops by checking if we're already trying to load the default avatar
    if (!currentSrc.includes('default-avatar.png')) {
      img.src = 'default-avatar.png';
    } else {
      // Default avatar also failed, hide the image to prevent further attempts
      img.style.display = 'none';
    }
  }

  // Smart join meeting method
  joinMeeting(event: CalendarEvent): void {
    if (!event.meetingUrl) {
      alert('No meeting URL available for this event');
      return;
    }

    // Get current user info
    const currentUser = this.getCurrentUser();
    if (!currentUser) {
      alert('User not found. Please log in again.');
      return;
    }

    // Check if user is the host (using meta.host if available)
    const isHost = event.meta?.host?.email === currentUser.email;
    
    // For now, just use the meeting URL since we don't have separate start/join URLs
    // In a real implementation, you'd check if the user is host and use appropriate URL
    window.open(event.meetingUrl, '_blank', 'noopener,noreferrer');
  }

  // Get current user info (placeholder - you'll need to inject auth service)
  private getCurrentUser(): { email: string; name: string } | null {
    try {
      const userStr = localStorage.getItem('currentUser');
      if (userStr) {
        return JSON.parse(userStr);
      }
      return null;
    } catch (error) {
      console.warn('Could not get user info:', error);
      return null;
    }
  }

  // Check if meeting is ready to join
  isMeetingReadyToJoin(event: CalendarEvent): boolean {
    if (!event.start) return false;
    
    const now = new Date();
    const meetingStart = new Date(event.start);
    const meetingEnd = new Date(event.end || new Date(meetingStart.getTime() + 30 * 60000));
    
    // Allow joining 5 minutes before start time
    const earlyJoinTime = new Date(meetingStart.getTime() - 5 * 60000);
    
    return now >= earlyJoinTime && now <= meetingEnd;
  }

  // Get meeting join status
  getMeetingJoinStatus(event: CalendarEvent): {
    canJoin: boolean;
    status: string;
    message: string;
    buttonText: string;
  } {
    if (!event.start) {
      return {
        canJoin: false,
        status: 'no-time',
        message: 'Meeting time not set',
        buttonText: 'Join Meeting'
      };
    }

    const now = new Date();
    const meetingStart = new Date(event.start);
    const meetingEnd = new Date(event.end || new Date(meetingStart.getTime() + 30 * 60000));
    const earlyJoinTime = new Date(meetingStart.getTime() - 5 * 60000);
    
    const currentUser = this.getCurrentUser();
    const isHost = currentUser && event.meta?.host?.email === currentUser.email;
    
    if (now < earlyJoinTime) {
      const timeUntilStart = Math.ceil((meetingStart.getTime() - now.getTime()) / 60000);
      return {
        canJoin: false,
        status: 'waiting',
        message: `Meeting starts in ${timeUntilStart} minutes`,
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
} 