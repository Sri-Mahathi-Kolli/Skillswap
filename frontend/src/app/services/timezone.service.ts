import { Injectable } from '@angular/core';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import moment from 'moment-timezone';

export interface Timezone {
  name: string;
  offset: string;
  offsetMinutes: number;
  abbreviation: string;
  description: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  timezone: string;
  allDay: boolean;
  description?: string;
  location?: string;
  attendees?: string[];
  meetingUrl?: string;
  meta?: {
    sessionId?: string;
    hostId?: string;
    host?: any;
    skill?: string;
    sessionType?: string;
    difficulty?: string;
    maxParticipants?: number;
    tags?: string;
    attendees?: string;
    allDay?: boolean;
    online?: boolean;
    inPerson?: boolean;
    location?: string;
    recurrence?: string;
    price?: number;
    meetingUrl?: string;
    description?: string;
    meetingStatus?: string;
    actualStartTime?: Date;
    actualEndTime?: Date;
    hostJoinedAt?: Date;
    session?: any;
  };
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
export class TimezoneService {
  private commonTimezones: Timezone[] = [
    // UTC
    { name: 'UTC', offset: '+00:00', offsetMinutes: 0, abbreviation: 'UTC', description: 'Coordinated Universal Time' },
    
    // North America
    { name: 'America/New_York', offset: '-05:00', offsetMinutes: -300, abbreviation: 'EST', description: 'Eastern Time (US & Canada)' },
    { name: 'America/Chicago', offset: '-06:00', offsetMinutes: -360, abbreviation: 'CST', description: 'Central Time (US & Canada)' },
    { name: 'America/Denver', offset: '-07:00', offsetMinutes: -420, abbreviation: 'MST', description: 'Mountain Time (US & Canada)' },
    { name: 'America/Los_Angeles', offset: '-08:00', offsetMinutes: -480, abbreviation: 'PST', description: 'Pacific Time (US & Canada)' },
    { name: 'America/Anchorage', offset: '-09:00', offsetMinutes: -540, abbreviation: 'AKST', description: 'Alaska' },
    { name: 'Pacific/Honolulu', offset: '-10:00', offsetMinutes: -600, abbreviation: 'HST', description: 'Hawaii' },
    { name: 'America/Toronto', offset: '-05:00', offsetMinutes: -300, abbreviation: 'EST', description: 'Eastern Time (Canada)' },
    { name: 'America/Vancouver', offset: '-08:00', offsetMinutes: -480, abbreviation: 'PST', description: 'Pacific Time (Canada)' },
    { name: 'America/Mexico_City', offset: '-06:00', offsetMinutes: -360, abbreviation: 'CST', description: 'Central Time (Mexico)' },
    
    // South America
    { name: 'America/Sao_Paulo', offset: '-03:00', offsetMinutes: -180, abbreviation: 'BRT', description: 'Brasilia' },
    { name: 'America/Argentina/Buenos_Aires', offset: '-03:00', offsetMinutes: -180, abbreviation: 'ART', description: 'Buenos Aires' },
    { name: 'America/Santiago', offset: '-03:00', offsetMinutes: -180, abbreviation: 'CLT', description: 'Santiago' },
    { name: 'America/Lima', offset: '-05:00', offsetMinutes: -300, abbreviation: 'PET', description: 'Lima' },
    
    // Europe
    { name: 'Europe/London', offset: '+00:00', offsetMinutes: 0, abbreviation: 'GMT', description: 'London' },
    { name: 'Europe/Paris', offset: '+01:00', offsetMinutes: 60, abbreviation: 'CET', description: 'Paris' },
    { name: 'Europe/Berlin', offset: '+01:00', offsetMinutes: 60, abbreviation: 'CET', description: 'Berlin' },
    { name: 'Europe/Rome', offset: '+01:00', offsetMinutes: 60, abbreviation: 'CET', description: 'Rome' },
    { name: 'Europe/Madrid', offset: '+01:00', offsetMinutes: 60, abbreviation: 'CET', description: 'Madrid' },
    { name: 'Europe/Amsterdam', offset: '+01:00', offsetMinutes: 60, abbreviation: 'CET', description: 'Amsterdam' },
    { name: 'Europe/Brussels', offset: '+01:00', offsetMinutes: 60, abbreviation: 'CET', description: 'Brussels' },
    { name: 'Europe/Vienna', offset: '+01:00', offsetMinutes: 60, abbreviation: 'CET', description: 'Vienna' },
    { name: 'Europe/Zurich', offset: '+01:00', offsetMinutes: 60, abbreviation: 'CET', description: 'Zurich' },
    { name: 'Europe/Stockholm', offset: '+01:00', offsetMinutes: 60, abbreviation: 'CET', description: 'Stockholm' },
    { name: 'Europe/Oslo', offset: '+01:00', offsetMinutes: 60, abbreviation: 'CET', description: 'Oslo' },
    { name: 'Europe/Copenhagen', offset: '+01:00', offsetMinutes: 60, abbreviation: 'CET', description: 'Copenhagen' },
    { name: 'Europe/Helsinki', offset: '+02:00', offsetMinutes: 120, abbreviation: 'EET', description: 'Helsinki' },
    { name: 'Europe/Warsaw', offset: '+01:00', offsetMinutes: 60, abbreviation: 'CET', description: 'Warsaw' },
    { name: 'Europe/Prague', offset: '+01:00', offsetMinutes: 60, abbreviation: 'CET', description: 'Prague' },
    { name: 'Europe/Budapest', offset: '+01:00', offsetMinutes: 60, abbreviation: 'CET', description: 'Budapest' },
    { name: 'Europe/Bucharest', offset: '+02:00', offsetMinutes: 120, abbreviation: 'EET', description: 'Bucharest' },
    { name: 'Europe/Athens', offset: '+02:00', offsetMinutes: 120, abbreviation: 'EET', description: 'Athens' },
    { name: 'Europe/Istanbul', offset: '+03:00', offsetMinutes: 180, abbreviation: 'TRT', description: 'Istanbul' },
    { name: 'Europe/Moscow', offset: '+03:00', offsetMinutes: 180, abbreviation: 'MSK', description: 'Moscow' },
    { name: 'Europe/Kiev', offset: '+02:00', offsetMinutes: 120, abbreviation: 'EET', description: 'Kiev' },
    
    // Africa
    { name: 'Africa/Cairo', offset: '+02:00', offsetMinutes: 120, abbreviation: 'EET', description: 'Cairo' },
    { name: 'Africa/Johannesburg', offset: '+02:00', offsetMinutes: 120, abbreviation: 'SAST', description: 'Johannesburg' },
    { name: 'Africa/Lagos', offset: '+01:00', offsetMinutes: 60, abbreviation: 'WAT', description: 'Lagos' },
    { name: 'Africa/Casablanca', offset: '+00:00', offsetMinutes: 0, abbreviation: 'WET', description: 'Casablanca' },
    { name: 'Africa/Nairobi', offset: '+03:00', offsetMinutes: 180, abbreviation: 'EAT', description: 'Nairobi' },
    
    // Asia
    { name: 'Asia/Tokyo', offset: '+09:00', offsetMinutes: 540, abbreviation: 'JST', description: 'Tokyo' },
    { name: 'Asia/Shanghai', offset: '+08:00', offsetMinutes: 480, abbreviation: 'CST', description: 'Shanghai' },
    { name: 'Asia/Beijing', offset: '+08:00', offsetMinutes: 480, abbreviation: 'CST', description: 'Beijing' },
    { name: 'Asia/Hong_Kong', offset: '+08:00', offsetMinutes: 480, abbreviation: 'HKT', description: 'Hong Kong' },
    { name: 'Asia/Singapore', offset: '+08:00', offsetMinutes: 480, abbreviation: 'SGT', description: 'Singapore' },
    { name: 'Asia/Bangkok', offset: '+07:00', offsetMinutes: 420, abbreviation: 'ICT', description: 'Bangkok' },
    { name: 'Asia/Manila', offset: '+08:00', offsetMinutes: 480, abbreviation: 'PHT', description: 'Manila' },
    { name: 'Asia/Jakarta', offset: '+07:00', offsetMinutes: 420, abbreviation: 'WIB', description: 'Jakarta' },
    { name: 'Asia/Kuala_Lumpur', offset: '+08:00', offsetMinutes: 480, abbreviation: 'MYT', description: 'Kuala Lumpur' },
    { name: 'Asia/Seoul', offset: '+09:00', offsetMinutes: 540, abbreviation: 'KST', description: 'Seoul' },
    { name: 'Asia/Kolkata', offset: '+05:30', offsetMinutes: 330, abbreviation: 'IST', description: 'Mumbai' },
    { name: 'Asia/Dhaka', offset: '+06:00', offsetMinutes: 360, abbreviation: 'BDT', description: 'Dhaka' },
    { name: 'Asia/Karachi', offset: '+05:00', offsetMinutes: 300, abbreviation: 'PKT', description: 'Karachi' },
    { name: 'Asia/Dubai', offset: '+04:00', offsetMinutes: 240, abbreviation: 'GST', description: 'Dubai' },
    { name: 'Asia/Tashkent', offset: '+05:00', offsetMinutes: 300, abbreviation: 'UZT', description: 'Tashkent' },
    { name: 'Asia/Almaty', offset: '+06:00', offsetMinutes: 360, abbreviation: 'ALMT', description: 'Almaty' },
    { name: 'Asia/Novosibirsk', offset: '+07:00', offsetMinutes: 420, abbreviation: 'NOVT', description: 'Novosibirsk' },
    { name: 'Asia/Vladivostok', offset: '+10:00', offsetMinutes: 600, abbreviation: 'VLAT', description: 'Vladivostok' },
    { name: 'Asia/Yekaterinburg', offset: '+05:00', offsetMinutes: 300, abbreviation: 'YEKT', description: 'Yekaterinburg' },
    
    // Australia & Oceania
    { name: 'Australia/Sydney', offset: '+10:00', offsetMinutes: 600, abbreviation: 'AEST', description: 'Sydney' },
    { name: 'Australia/Melbourne', offset: '+10:00', offsetMinutes: 600, abbreviation: 'AEST', description: 'Melbourne' },
    { name: 'Australia/Perth', offset: '+08:00', offsetMinutes: 480, abbreviation: 'AWST', description: 'Perth' },
    { name: 'Australia/Adelaide', offset: '+09:30', offsetMinutes: 570, abbreviation: 'ACST', description: 'Adelaide' },
    { name: 'Australia/Brisbane', offset: '+10:00', offsetMinutes: 600, abbreviation: 'AEST', description: 'Brisbane' },
    { name: 'Australia/Darwin', offset: '+09:30', offsetMinutes: 570, abbreviation: 'ACST', description: 'Darwin' },
    { name: 'Pacific/Auckland', offset: '+12:00', offsetMinutes: 720, abbreviation: 'NZST', description: 'Auckland' },
    { name: 'Pacific/Fiji', offset: '+12:00', offsetMinutes: 720, abbreviation: 'FJT', description: 'Fiji' },
    { name: 'Pacific/Guam', offset: '+10:00', offsetMinutes: 600, abbreviation: 'ChST', description: 'Guam' },
    { name: 'Pacific/Samoa', offset: '+13:00', offsetMinutes: 780, abbreviation: 'WST', description: 'Samoa' },
    
    // Middle East
    { name: 'Asia/Jerusalem', offset: '+02:00', offsetMinutes: 120, abbreviation: 'IST', description: 'Jerusalem' },
    { name: 'Asia/Tehran', offset: '+03:30', offsetMinutes: 210, abbreviation: 'IRST', description: 'Tehran' },
    { name: 'Asia/Baghdad', offset: '+03:00', offsetMinutes: 180, abbreviation: 'AST', description: 'Baghdad' },
    { name: 'Asia/Riyadh', offset: '+03:00', offsetMinutes: 180, abbreviation: 'AST', description: 'Riyadh' },
    { name: 'Asia/Kuwait', offset: '+03:00', offsetMinutes: 180, abbreviation: 'AST', description: 'Kuwait' },
    { name: 'Asia/Qatar', offset: '+03:00', offsetMinutes: 180, abbreviation: 'AST', description: 'Qatar' },
    { name: 'Asia/Bahrain', offset: '+03:00', offsetMinutes: 180, abbreviation: 'AST', description: 'Bahrain' },
    { name: 'Asia/Oman', offset: '+04:00', offsetMinutes: 240, abbreviation: 'GST', description: 'Muscat' },
    
    // Central Asia
    { name: 'Asia/Bishkek', offset: '+06:00', offsetMinutes: 360, abbreviation: 'KGT', description: 'Bishkek' },
    { name: 'Asia/Dushanbe', offset: '+05:00', offsetMinutes: 300, abbreviation: 'TJT', description: 'Dushanbe' },
    { name: 'Asia/Ashgabat', offset: '+05:00', offsetMinutes: 300, abbreviation: 'TMT', description: 'Ashgabat' },
    { name: 'Asia/Tbilisi', offset: '+04:00', offsetMinutes: 240, abbreviation: 'GET', description: 'Tbilisi' },
    { name: 'Asia/Yerevan', offset: '+04:00', offsetMinutes: 240, abbreviation: 'AMT', description: 'Yerevan' },
    { name: 'Asia/Baku', offset: '+04:00', offsetMinutes: 240, abbreviation: 'AZT', description: 'Baku' }
  ];

  private userTimezoneSubject = new BehaviorSubject<string>('');
  public userTimezone$ = this.userTimezoneSubject.asObservable();

  constructor(private authService: AuthService) {
    this.initializeUserTimezone();
  }

  private initializeUserTimezone(): void {
    // Subscribe to user changes to update timezone
    this.authService.currentUser$.subscribe(user => {
      if (user && user.timezone) {
        this.userTimezoneSubject.next(user.timezone);
      } else {
        // Fallback to browser timezone
        this.userTimezoneSubject.next(this.getUserTimezone());
      }
    });
  }

  // Get user's preferred timezone (from profile or browser)
  getUserPreferredTimezone(): string {
    return this.userTimezoneSubject.value || this.getUserTimezone();
  }

  // Get user's local timezone (browser)
  getUserTimezone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  // Get all available timezones
  getTimezones(): Observable<Timezone[]> {
    return of(this.commonTimezones);
  }

  // Convert date between timezones - FIXED VERSION
  convertTimezone(date: Date, fromTimezone: string, toTimezone: string): Date {
    if (fromTimezone === toTimezone) {
      return new Date(date.getTime());
    }

    // Create a new date object to avoid mutating the original
    const newDate = new Date(date.getTime());
    
    // Get the timezone offset difference
    const fromOffset = this.getTimezoneOffsetMinutes(fromTimezone);
    const toOffset = this.getTimezoneOffsetMinutes(toTimezone);
    const offsetDiff = toOffset - fromOffset;
    
    // Apply the offset difference
    newDate.setMinutes(newDate.getMinutes() + offsetDiff);
    
    return newDate;
  }

  // Get timezone offset in minutes - IMPROVED VERSION
  getTimezoneOffsetMinutes(timezone: string): number {
    try {
      // Use Intl.DateTimeFormat to get the timezone offset more reliably
      const date = new Date();
      const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000);
      const targetTime = new Date(utcTime + (this.getTimezoneOffsetFromList(timezone) * 60000));
      const offset = (targetTime.getTime() - date.getTime()) / (1000 * 60);
      
      console.log(`🌍 Timezone offset for ${timezone}: ${offset} minutes`);
      return offset;
    } catch (error) {
      console.warn(`Invalid timezone: ${timezone}, falling back to UTC`);
      return 0;
    }
  }

  // Helper method to get timezone offset from our predefined list
  private getTimezoneOffsetFromList(timezone: string): number {
    const tz = this.commonTimezones.find(t => t.name === timezone);
    return tz ? tz.offsetMinutes : 0;
  }

  // Convert date to UTC - IMPROVED VERSION
  toUTC(date: Date, timezone: string): Date {
    const offset = this.getTimezoneOffsetMinutes(timezone);
    return new Date(date.getTime() - (offset * 60 * 1000));
  }

  // Convert UTC date to specific timezone - IMPROVED VERSION
  fromUTC(utcDate: Date, timezone: string): Date {
    const offset = this.getTimezoneOffsetMinutes(timezone);
    return new Date(utcDate.getTime() + (offset * 60 * 1000));
  }

  // Normalize timezone format to ensure consistency
  normalizeTimezone(timezone: string): string {
    if (!timezone || typeof timezone !== 'string') {
      return 'UTC';
    }
    
    // Trim whitespace
    timezone = timezone.trim();
    
    // Handle common abbreviations
    const abbreviationMap: { [key: string]: string } = {
      'EST': 'America/New_York',
      'CST': 'America/Chicago',
      'MST': 'America/Denver',
      'PST': 'America/Los_Angeles',
      'GMT': 'Europe/London',
      'UTC': 'UTC'
    };
    
    if (abbreviationMap[timezone.toUpperCase()]) {
      return abbreviationMap[timezone.toUpperCase()];
    }
    
    // Check if it's already a valid IANA timezone
    if (this.isValidTimezone(timezone)) {
      return timezone;
    }
    
    // Fallback to UTC
    console.warn(`⚠️ Unrecognized timezone: ${timezone}, falling back to UTC`);
    return 'UTC';
  }

  // Validate timezone string
  isValidTimezone(timezone: string): boolean {
    if (!timezone || typeof timezone !== 'string') {
      return false;
    }
    
    // First check against our predefined timezone list
    const isInOurList = this.commonTimezones.some(tz => tz.name === timezone);
    if (isInOurList) {
      return true;
    }
    
    // Then check using Intl.DateTimeFormat for additional validation
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch (e) {
      console.warn(`⚠️ Invalid timezone: ${timezone}`);
      return false;
    }
  }

  // Get timezone abbreviation
  getTimezoneAbbreviation(timezone: string): string {
    const tz = this.commonTimezones.find(t => t.name === timezone);
    return tz ? tz.abbreviation : timezone.split('/').pop() || timezone;
  }

  // Create calendar event from session
  createCalendarEvent(session: any, timezone: string): CalendarEvent {
    const hostId = typeof session.host === 'object' ? session.host._id : session.host;
    const host = typeof session.host === 'object' ? session.host : session.hostDetails;
    
    // Use moment-timezone for proper timezone conversion
    const startUTC = new Date(session.startTime);
    const endUTC = new Date(session.endTime);
    
    // Convert UTC times to the target timezone for display
    const startInTimezone = moment.tz(startUTC, timezone).toDate();
    const endInTimezone = moment.tz(endUTC, timezone).toDate();
    
    console.log('📅 Calendar Event Conversion:');
    console.log('🌍 Session startTime (UTC):', startUTC.toISOString());
    console.log('🌍 Session endTime (UTC):', endUTC.toISOString());
    console.log('🌍 Display timezone:', timezone);
    console.log('🌍 Start in timezone:', startInTimezone.toISOString());
    console.log('🌍 End in timezone:', endInTimezone.toISOString());
    console.log('🌍 Start in timezone toString:', startInTimezone.toString());
    console.log('🌍 End in timezone toString:', endInTimezone.toString());
    
    // Additional debugging: convert back to verify
    const startBackToUTC = moment.tz(startInTimezone, timezone).utc().toDate();
    const endBackToUTC = moment.tz(endInTimezone, timezone).utc().toDate();
    console.log('🔍 Verification - Start back to UTC:', startBackToUTC.toISOString());
    console.log('🔍 Verification - End back to UTC:', endBackToUTC.toISOString());
    console.log('🔍 Start conversion matches:', startBackToUTC.toISOString() === startUTC.toISOString());
    console.log('🔍 End conversion matches:', endBackToUTC.toISOString() === endUTC.toISOString());
    
    return {
      id: session.id || session._id,
      title: session.title,
      start: startInTimezone,
      end: endInTimezone,
      timezone: timezone,
      allDay: false,
      description: session.description,
      location: session.meetingUrl || 'Online',
      attendees: [session.teacherName, session.studentName].filter(Boolean),
      meetingUrl: session.meetingUrl,
      meta: {
        sessionId: session.id || session._id,
        hostId: hostId,
        host: host,
        skill: session.skill,
        sessionType: session.sessionType,
        difficulty: session.difficulty,
        maxParticipants: session.maxParticipants,
        tags: session.tags,
        attendees: session.attendees,
        allDay: false,
        online: true,
        inPerson: false,
        location: session.meetingUrl || '',
        recurrence: 'none',
        price: session.price || 0,
        meetingStatus: session.meetingStatus || 'not-started',
        actualStartTime: session.actualStartTime,
        actualEndTime: session.actualEndTime,
        hostJoinedAt: session.hostJoinedAt,
        session: session
      }
    };
  }

  // Create date with proper AM/PM handling in the specified timezone
  createDateWithTime(year: number, month: number, day: number, hour: number, minute: number, ampm: string, timezone: string = 'UTC'): Date {
    console.log('🔧 createDateWithTime called with:', { year, month, day, hour, minute, ampm, timezone });
    
    // Validate input parameters
    if (!year || !month || !day || hour === undefined || minute === undefined) {
      console.error('❌ Invalid input parameters:', { year, month, day, hour, minute });
      throw new Error('Invalid date/time parameters');
    }
    
    // Normalize the input timezone
    timezone = this.normalizeTimezone(timezone);
    
    // Convert 12-hour time to 24-hour time if needed
    let hour24 = hour;
    if (hour >= 1 && hour <= 12 && ampm) {
      if (ampm === 'PM' && hour !== 12) {
        hour24 = hour + 12;
      } else if (ampm === 'AM' && hour === 12) {
        hour24 = 0;
      }
    }
    
    console.log('🕐 Using hour24:', hour24);
    console.log('🌍 Target timezone:', timezone);
    
    // If timezone is UTC, create the date directly
    if (timezone === 'UTC') {
      const utcDate = new Date(Date.UTC(year, month - 1, day, hour24, minute, 0));
      console.log('🌍 Returning UTC date:', utcDate.toISOString());
      return utcDate;
    }
    
    // Use moment-timezone for accurate timezone conversion
    const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    const hourStr = hour24.toString().padStart(2, '0');
    const minuteStr = minute.toString().padStart(2, '0');
    const datetimeStr = `${dateStr} ${hourStr}:${minuteStr}`;
    
    console.log('📅 Date string:', dateStr);
    console.log('🕐 Time string:', `${hourStr}:${minuteStr}`);
    console.log('📅 Full datetime string:', datetimeStr);
    
    try {
      // Create the date in the target timezone using moment-timezone
      // This interprets the datetime as being in the specified timezone
      const momentDate = moment.tz(datetimeStr, 'YYYY-MM-DD HH:mm', timezone);
      
      if (!momentDate.isValid()) {
        console.error('❌ Invalid moment date created');
        throw new Error('Invalid date/time combination for the specified timezone');
      }
      
      // Convert to UTC
      const utcTime = momentDate.toDate();
      
      console.log('🌍 Moment date object:', momentDate.format());
      console.log('🌍 Converted to UTC:', utcTime.toISOString());
      console.log('🌍 UTC toString:', utcTime.toString());
      
      // Verify the conversion by converting back to the target timezone
      const verification = moment.tz(utcTime, timezone).format('YYYY-MM-DD HH:mm');
      console.log('🔍 Verification - UTC time in', timezone, ':', verification);
      console.log('🔍 Original input:', datetimeStr);
      console.log('🔍 Verification matches:', verification === datetimeStr);
      
      if (verification !== datetimeStr) {
        console.warn('⚠️ Timezone conversion verification failed, but proceeding with result');
        console.log('🔍 Difference detected - this might indicate a timezone conversion issue');
      }
      
      return utcTime;
    } catch (error) {
      console.error('❌ Error in moment-timezone conversion:', error);
      console.log('🔄 Falling back to manual timezone conversion');
      
      // Fallback: manual timezone conversion
      const localDate = new Date(year, month - 1, day, hour24, minute, 0);
      const offset = this.getTimezoneOffsetMinutes(timezone);
      const utcTime = new Date(localDate.getTime() - (offset * 60 * 1000));
      
      console.log('🌍 Fallback UTC time:', utcTime.toISOString());
      return utcTime;
    }
  }

  // Format date with timezone
  formatDateWithTimezone(date: Date, timezone: string, format: 'full' | 'short' | 'time' = 'full'): string {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone
    };

    switch (format) {
      case 'full':
        options.year = 'numeric';
        options.month = 'long';
        options.day = 'numeric';
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.timeZoneName = 'short';
        break;
      case 'short':
        options.month = 'short';
        options.day = 'numeric';
        options.hour = '2-digit';
        options.minute = '2-digit';
        break;
      case 'time':
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.timeZoneName = 'short';
        break;
    }

    return date.toLocaleDateString('en-US', options);
  }

  // Get timezone offset in minutes (legacy method)
  getTimezoneOffset(timezone: string): number {
    return this.getTimezoneOffsetMinutes(timezone);
  }

  // Check if date is in daylight saving time
  isDST(date: Date, timezone: string): boolean {
    const jan = new Date(date.getFullYear(), 0, 1);
    const jul = new Date(date.getFullYear(), 6, 1);
    const janOffset = this.getTimezoneOffsetMinutes(timezone);
    const julOffset = this.getTimezoneOffsetMinutes(timezone);
    return Math.max(janOffset, julOffset) !== Math.min(janOffset, julOffset);
  }

  // Generate time slots for a day
  generateTimeSlots(date: Date, timezone: string, startHour: number = 9, endHour: number = 17, intervalMinutes: number = 60): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const startDate = new Date(date);
    startDate.setHours(startHour, 0, 0, 0);
    
    const endDate = new Date(date);
    endDate.setHours(endHour, 0, 0, 0);

    while (startDate < endDate) {
      const endTime = new Date(startDate.getTime() + intervalMinutes * 60000);
      
      slots.push({
        startTime: new Date(startDate).toISOString(),
        endTime: endTime.toISOString(),
        timezone: timezone,
        available: true
      });

      startDate.setTime(startDate.getTime() + intervalMinutes * 60000);
    }

    return slots;
  }

  // Calculate duration between two dates
  calculateDuration(startDate: Date, endDate: Date): { hours: number; minutes: number } {
    const diffMs = endDate.getTime() - startDate.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return { hours, minutes };
  }

  // Check if two time slots overlap
  doTimeSlotsOverlap(slot1: TimeSlot, slot2: TimeSlot): boolean {
    return new Date(slot1.startTime) < new Date(slot2.endTime) && new Date(slot2.startTime) < new Date(slot1.endTime);
  }

  // Get next business day
  getNextBusinessDay(date: Date): Date {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    
    while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
      nextDay.setDate(nextDay.getDate() + 1);
    }
    
    return nextDay;
  }

  // Get business hours for a timezone
  getBusinessHours(timezone: string): { start: number; end: number } {
    // Default business hours (9 AM - 5 PM)
    return { start: 9, end: 17 };
  }

  // Format relative time (e.g., "2 hours ago", "in 3 days")
  formatRelativeTime(date: Date, timezone: string): string {
    const now = new Date();
    const targetDate = this.convertTimezone(date, timezone, this.getUserTimezone());
    const diffMs = targetDate.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffDays > 0) {
      return `in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
    } else if (diffDays < 0) {
      return `${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    } else if (diffHours < 0) {
      return `${Math.abs(diffHours)} hour${Math.abs(diffHours) > 1 ? 's' : ''} ago`;
    } else if (diffMinutes > 0) {
      return `in ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
    } else if (diffMinutes < 0) {
      return `${Math.abs(diffMinutes)} minute${Math.abs(diffMinutes) > 1 ? 's' : ''} ago`;
    } else {
      return 'now';
    }
  }
} 