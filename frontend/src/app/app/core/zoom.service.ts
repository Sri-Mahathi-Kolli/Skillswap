import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class ZoomService {
  constructor(private http: HttpClient) {}

  connectZoom() {
    window.location.href = '/api/zoom/auth';
  }

  createMeeting(startTime: string, duration: number) {
    return this.http.post<any>('/api/zoom/meeting', { startTime, duration });
  }

  deleteMeeting(meetingId: string) {
    return this.http.delete<any>(`/api/zoom/meeting/${meetingId}`);
  }
}
