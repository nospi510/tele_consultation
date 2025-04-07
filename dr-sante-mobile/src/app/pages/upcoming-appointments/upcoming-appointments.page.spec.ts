import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UpcomingAppointmentsPage } from './upcoming-appointments.page';

describe('UpcomingAppointmentsPage', () => {
  let component: UpcomingAppointmentsPage;
  let fixture: ComponentFixture<UpcomingAppointmentsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(UpcomingAppointmentsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
