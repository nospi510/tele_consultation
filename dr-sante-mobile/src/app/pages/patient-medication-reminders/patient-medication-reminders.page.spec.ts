import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PatientMedicationRemindersPage } from './patient-medication-reminders.page';

describe('PatientMedicationRemindersPage', () => {
  let component: PatientMedicationRemindersPage;
  let fixture: ComponentFixture<PatientMedicationRemindersPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(PatientMedicationRemindersPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
