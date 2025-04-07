import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DoctorUpcomingAppointmentsPage } from './doctor-upcoming-appointments.page';

describe('DoctorUpcomingAppointmentsPage', () => {
  let component: DoctorUpcomingAppointmentsPage;
  let fixture: ComponentFixture<DoctorUpcomingAppointmentsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DoctorUpcomingAppointmentsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
