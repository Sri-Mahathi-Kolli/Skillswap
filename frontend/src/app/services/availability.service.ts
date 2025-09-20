import { environment } from '../../environments/environment';
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface AvailabilitySlot {
  start: Date;
  end: Date;
  status: 'free' | 'busy' | 'tentative' | 'out-of-office' | 'unavailable';
  title?: string;
  description?: string;
  timeString: string;
}

export interface UserAvailability {
  userId: string;
  name: string;
  email: string;
  timezone: string;
  availability: AvailabilitySlot[];
}

export interface OptimalTime {
  start: Date;
  end: Date;
  duration: number;
  timeString: string;
}

export interface AvailabilityResponse {
  users: UserAvailability[];
  optimalTimes: OptimalTime[];
  date: Date;
  timezone: string;
  duration: number;
}

export interface SchedulingPreferences {
  defaultDuration: number;
  bufferTime: number;
  workingHours: {
    start: string;
    end: string;
  };
  workingDays: string[];
}

@Injectable({
  providedIn: 'root'
})
export class AvailabilityService {
  private apiUrl = environment.apiUrl + '/availability';

  constructor(private http: HttpClient) {}

  // Get availability for multiple users
  getUserAvailability(
    userIds: string[], 
    startDate: string, 
    endDate: string, 
    timezone: string = 'UTC', 
    duration: number = 30
  ): Observable<AvailabilityResponse> {
    const params = new HttpParams()
      .set('userIds', userIds.join(','))
      .set('startDate', startDate)
      .set('endDate', endDate)
      .set('timezone', timezone)
      .set('duration', duration.toString());

    return this.http.get<AvailabilityResponse>(`${this.apiUrl}/user-availability`, { params });
  }

  // Update user's custom availability
  updateUserAvailability(date: Date, slots: AvailabilitySlot[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/update-availability`, {
      date: date.toISOString(),
      slots: slots.map(slot => ({
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
        status: slot.status,
        title: slot.title,
        description: slot.description
      }))
    });
  }

  // Get user's scheduling preferences
  getUserSchedulingPreferences(): Observable<{
    schedulingPreferences: SchedulingPreferences;
    timezone: string;
  }> {
    return this.http.get<{
      schedulingPreferences: SchedulingPreferences;
      timezone: string;
    }>(`${this.apiUrl}/scheduling-preferences`);
  }

  // Update user's scheduling preferences
  updateUserSchedulingPreferences(preferences: Partial<SchedulingPreferences>): Observable<any> {
    return this.http.post(`${this.apiUrl}/update-scheduling-preferences`, {
      schedulingPreferences: preferences
    });
  }

  // Get status color for availability slots
  getStatusColor(status: string): string {
    switch (status) {
      case 'free':
        return '#ffffff'; // White
      case 'busy':
        return '#3b82f6'; // Blue
      case 'tentative':
        return '#93c5fd'; // Light Blue
      case 'out-of-office':
        return '#8b5cf6'; // Purple
      case 'unavailable':
        return '#6b7280'; // Gray
      default:
        return '#ffffff';
    }
  }

  // Get status border color for availability slots
  getStatusBorderColor(status: string): string {
    switch (status) {
      case 'free':
        return '#e5e7eb'; // Light gray border
      case 'busy':
        return '#1d4ed8'; // Dark blue border
      case 'tentative':
        return '#3b82f6'; // Blue border
      case 'out-of-office':
        return '#7c3aed'; // Dark purple border
      case 'unavailable':
        return '#374151'; // Dark gray border
      default:
        return '#e5e7eb';
    }
  }

  // Get status tooltip text
  getStatusTooltip(status: string, title?: string): string {
    switch (status) {
      case 'free':
        return 'Available';
      case 'busy':
        return title || 'Busy';
      case 'tentative':
        return title || 'Tentative';
      case 'out-of-office':
        return title || 'Out of Office';
      case 'unavailable':
        return title || 'Unavailable';
      default:
        return 'Unknown';
    }
  }

  // Generate time slots for a day
  generateTimeSlots(date: Date, interval: number = 30): AvailabilitySlot[] {
    const slots: AvailabilitySlot[] = [];
    const startHour = 0;
    const endHour = 23;

    for (let hour = startHour; hour <= endHour; hour++) {
      for (let minute = 0; minute < 60; minute += interval) {
        const slotStart = new Date(date);
        slotStart.setHours(hour, minute, 0, 0);
        
        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + interval);

        slots.push({
          start: slotStart,
          end: slotEnd,
          status: 'free',
          timeString: slotStart.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          })
        });
      }
    }

    return slots;
  }

  // Find common free time slots among multiple users
  findCommonFreeSlots(users: UserAvailability[], duration: number): OptimalTime[] {
    if (users.length === 0) return [];

    const optimalTimes: OptimalTime[] = [];
    const allSlots = new Set<string>();

    // Get all unique time slots
    users.forEach(user => {
      user.availability.forEach(slot => {
        allSlots.add(slot.start.toISOString());
      });
    });

    const sortedSlots = Array.from(allSlots).sort();
    const requiredSlots = Math.ceil(duration / 30); // 30-minute intervals

    // Find consecutive free slots for all users
    for (let i = 0; i < sortedSlots.length; i++) {
      const startSlot = new Date(sortedSlots[i]);
      let allUsersFree = true;

      // Check if all users are free for the required duration
      for (let j = 0; j < requiredSlots && i + j < sortedSlots.length; j++) {
        const currentSlot = new Date(sortedSlots[i + j]);
        
        users.forEach(user => {
          const userSlot = user.availability.find(slot => 
            slot.start.toISOString() === currentSlot.toISOString()
          );
          
          if (!userSlot || userSlot.status !== 'free') {
            allUsersFree = false;
          }
        });
      }

      if (allUsersFree) {
        const endTime = new Date(startSlot);
        endTime.setMinutes(endTime.getMinutes() + duration);
        
        optimalTimes.push({
          start: startSlot,
          end: endTime,
          duration,
          timeString: startSlot.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          })
        });
      }
    }

    return optimalTimes.slice(0, 5); // Return top 5 optimal times
  }

  private handleError(error: any) {
    console.error('An error occurred:', error);
    return throwError(() => error);
  }
} 