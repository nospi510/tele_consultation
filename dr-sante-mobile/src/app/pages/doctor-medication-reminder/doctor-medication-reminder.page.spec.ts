import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DoctorMedicationReminderPage } from './doctor-medication-reminder.page';

describe('DoctorMedicationReminderPage', () => {
  let component: DoctorMedicationReminderPage;
  let fixture: ComponentFixture<DoctorMedicationReminderPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DoctorMedicationReminderPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
