import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { AuthService, User } from '../core/services/auth.service';
import { MatTabsModule } from '@angular/material/tabs';
import { MatNativeDateModule } from '@angular/material/core';
import { QuillModule } from 'ngx-quill';

@Component({
  selector: 'app-create-event-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatTabsModule, MatDatepickerModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatDialogModule, MatNativeDateModule, QuillModule, MatSelectModule],
  template: `
    <h1 mat-dialog-title>Create Event</h1>
    <mat-tab-group (selectedTabChange)="onTabChange($event)">
      <mat-tab label="Event Details">
        <div mat-dialog-content>
          <form>
            <mat-form-field appearance="fill" style="width: 100%;">
              <mat-label>Agenda</mat-label>
              <input matInput [(ngModel)]="eventData.title" name="title" required>
            </mat-form-field>
            <mat-form-field appearance="fill" style="width: 100%;">
              <mat-label>Invite Attendees</mat-label>
              <input matInput [(ngModel)]="eventData.attendees" name="attendees" placeholder="Emails, comma separated">
            </mat-form-field>
            <mat-form-field appearance="fill" style="width: 100%;">
              <mat-label>Join Link</mat-label>
              <input matInput [(ngModel)]="eventData.meetingUrl" name="meetingUrl">
            </mat-form-field>
            <mat-form-field appearance="fill" style="width: 100%;">
              <mat-label>Date</mat-label>
              <input matInput [matDatepicker]="picker" [(ngModel)]="eventData.date" name="date">
              <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
              <mat-datepicker #picker></mat-datepicker>
            </mat-form-field>
            <mat-form-field appearance="fill" style="width: 100%;">
              <mat-label>Time</mat-label>
              <input matInput type="time" [(ngModel)]="eventData.time" name="time">
            </mat-form-field>
            <mat-form-field appearance="fill" style="width: 100%;">
              <mat-label>Reminder</mat-label>
              <mat-select [(ngModel)]="eventData.reminder" name="reminder">
                <mat-option value="none">None</mat-option>
                <mat-option value="5">5 minutes before</mat-option>
                <mat-option value="15">15 minutes before</mat-option>
                <mat-option value="30">30 minutes before</mat-option>
                <mat-option value="60">1 hour before</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="fill" style="width: 100%;">
              <mat-label>Recurrence</mat-label>
              <mat-select [(ngModel)]="eventData.recurrence" name="recurrence">
                <mat-option value="none">None</mat-option>
                <mat-option value="daily">Daily</mat-option>
                <mat-option value="weekly">Weekly</mat-option>
                <mat-option value="monthly">Monthly</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-label>Description</mat-label>
            <quill-editor [(ngModel)]="eventData.description" name="description"></quill-editor>
          </form>
        </div>
      </mat-tab>
      <mat-tab label="Scheduling Assistant">
        <div style="padding: 16px;">
          <h3>Attendee Availability</h3>
          <div *ngIf="loadingAvailability">Loading availability...</div>
          <div *ngIf="availabilityError">{{ availabilityError }}</div>
          <div class="availability-grid" *ngIf="!loadingAvailability && !availabilityError">
            <div class="availability-row" *ngFor="let attendee of realAttendees">
              <span class="attendee-name">{{ attendee.name }}</span>
              <span *ngIf="attendee.availability.length === 0">No availability data</span>
              <span *ngFor="let slot of attendee.availability" class="availability-slot">
                {{ slot.day }}: <span *ngFor="let s of slot.slots">{{ s.start }}-{{ s.end }} </span>
              </span>
            </div>
          </div>
        </div>
      </mat-tab>
    </mat-tab-group>
    <div mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="onCreate()">Create</button>
    </div>
  `,
  styles: [`
    mat-form-field { margin-bottom: 16px; }
    quill-editor { min-height: 120px; margin-bottom: 16px; }
    .availability-grid { display: flex; flex-direction: column; gap: 8px; }
    .availability-row { display: flex; align-items: center; gap: 8px; }
    .attendee-name { width: 120px; font-weight: 500; }
    .availability-slot { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
    .availability-slot.free { background: #c8e6c9; color: #256029; }
    .availability-slot.busy { background: #ffcdd2; color: #b71c1c; }
  `]
})
export class CreateEventDialogComponent implements OnInit {
  eventData: any = {
    title: '',
    attendees: '',
    meetingUrl: '',
    date: '',
    time: '',
    description: '',
    recurrence: 'none'
  };

  mockAttendees = [
    { name: 'Alice', availability: [
      { time: '7:00 PM', busy: false },
      { time: '7:30 PM', busy: true },
      { time: '8:00 PM', busy: false }
    ]},
    { name: 'Bob', availability: [
      { time: '7:00 PM', busy: true },
      { time: '7:30 PM', busy: false },
      { time: '8:00 PM', busy: false }
    ]},
    { name: 'Carol', availability: [
      { time: '7:00 PM', busy: false },
      { time: '7:30 PM', busy: false },
      { time: '8:00 PM', busy: true }
    ]}
  ];

  realAttendees: { name: string, availability: any[] }[] = [];
  loadingAvailability = false;
  availabilityError = '';

  constructor(
    public dialogRef: MatDialogRef<CreateEventDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private authService: AuthService
  ) {
    if (data) {
      this.eventData.date = data.date;
    }
  }

  ngOnInit(): void {}

  onCancel(): void {
    this.dialogRef.close();
  }

  onCreate(): void {
    this.dialogRef.close(this.eventData);
  }

  onTabChange(event: any): void {
    if (event.index === 1) { // Scheduling Assistant tab
      this.fetchAttendeeAvailability();
    }
  }

  fetchAttendeeAvailability(): void {
    this.loadingAvailability = true;
    this.availabilityError = '';
    this.realAttendees = [];
    const emails = (this.eventData.attendees || '').split(',').map((e: string) => e.trim()).filter(Boolean);
    if (emails.length === 0) {
      this.loadingAvailability = false;
      this.availabilityError = 'No attendees entered.';
      return;
    }
    
    // For now, just use mock data since getUserByEmail is not available
    // TODO: Implement proper user lookup by email
    emails.forEach((email: string) => {
      this.realAttendees.push({
        name: email,
        availability: [
          { time: '7:00 PM', busy: false },
          { time: '7:30 PM', busy: false },
          { time: '8:00 PM', busy: false }
        ]
      });
    });
    this.loadingAvailability = false;
  }
} 