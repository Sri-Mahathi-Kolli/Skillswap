import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';

import { ScheduleComponent } from './schedule.component';
import { ScheduleService } from '../services/schedule.service';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

describe('ScheduleComponent', () => {
  let component: ScheduleComponent;
  let fixture: ComponentFixture<ScheduleComponent>;
  let scheduleServiceSpy: jasmine.SpyObj<ScheduleService>;
  let dialogSpy: jasmine.SpyObj<MatDialog>;

  beforeEach(async () => {
    scheduleServiceSpy = jasmine.createSpyObj('ScheduleService', ['getSessions', 'createSession', 'updateSession', 'cancelSession']);
    dialogSpy = jasmine.createSpyObj('MatDialog', ['open']);
    await TestBed.configureTestingModule({
      imports: [ScheduleComponent],
      providers: [
        { provide: ScheduleService, useValue: scheduleServiceSpy },
        { provide: MatDialog, useValue: dialogSpy }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(ScheduleComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load events on init', () => {
    scheduleServiceSpy.getSessions.and.returnValue(of([]));
    component.ngOnInit();
    expect(scheduleServiceSpy.getSessions).toHaveBeenCalled();
  });

  it('should create an event', () => {
    scheduleServiceSpy.createSession.and.returnValue(of({} as any));
    component.openCreateEventModal();
    // Simulate dialog close with result
    // ... (mock dialog logic as needed)
    expect(scheduleServiceSpy.createSession).toHaveBeenCalled();
  });

  it('should edit an event', () => {
    scheduleServiceSpy.updateSession.and.returnValue(of({} as any));
    const event: any = { title: 'Test', start: new Date(), meta: { id: '1', attendees: '', meetingUrl: '', description: '' } };
    component.editEvent(event);
    // Simulate dialog close with result
    // ... (mock dialog logic as needed)
    expect(scheduleServiceSpy.updateSession).toHaveBeenCalled();
  });

  it('should delete an event', () => {
    scheduleServiceSpy.cancelSession.and.returnValue(of({} as any));
    const event: any = { title: 'Test', start: new Date(), meta: { id: '1' } };
    component.calendarEvents = [event];
    component.deleteEvent(event);
    expect(scheduleServiceSpy.cancelSession).toHaveBeenCalledWith('1');
  });

  it('should set up polling on init and clear on destroy', fakeAsync(() => {
    scheduleServiceSpy.getSessions.and.returnValue(of([]));
    component.ngOnInit();
    tick(30000);
    expect(scheduleServiceSpy.getSessions).toHaveBeenCalledTimes(2);
    component.ngOnDestroy();
    tick(30000);
    // Should not call again after destroy
    expect(scheduleServiceSpy.getSessions).toHaveBeenCalledTimes(2);
  }));
});
