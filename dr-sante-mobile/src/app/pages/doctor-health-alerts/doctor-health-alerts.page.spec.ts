import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DoctorHealthAlertsPage } from './doctor-health-alerts.page';

describe('DoctorHealthAlertsPage', () => {
  let component: DoctorHealthAlertsPage;
  let fixture: ComponentFixture<DoctorHealthAlertsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DoctorHealthAlertsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
